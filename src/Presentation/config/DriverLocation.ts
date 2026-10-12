// src/Presentation/config/DriverLocation.ts
//
// Seguimiento operativo del chofer: ubicación en segundo plano con
// expo-location + TaskManager (foreground service en Android, modo
// "location" en iOS), buffer local en AsyncStorage cuando no hay conexión y
// subida en lote a POST /v2/driver-locations.
//
// El chofer se identifica en el servidor por el token de sesión: acá no se
// manda ningún username ni id.
//
// Reglas (especificación técnica, sección 2):
//   - fuera de operación → seguimiento apagado
//   - chofer disponible / trabajando → encendido
//   - Route activa → encendido obligatorio (queda previsto vía startDriverTracking)
//
// IMPORTANTE: este módulo se importa desde index.ts para que la tarea quede
// definida en el arranque, incluso cuando Android relanza la app en segundo
// plano sin pasar por ninguna pantalla.

import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Battery from "expo-battery";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";

import { postJsonWithTimeout } from "./Api";
import { renewSessionIfNeeded } from "./SessionRenewal";

export const LOCATION_TASK = "lynx-driver-location";

const BUFFER_KEY = "driver_positions_buffer";
const MAX_BUFFER = 5000;        // ~2 días a 30 s; más viejo se descarta
const MAX_BATCH = 500;          // tope del endpoint
const FLUSH_MIN_INTERVAL_MS = 30_000;
const FLUSH_WHEN_PENDING = 10;  // con esta cantidad acumulada se sube sin esperar
const FALLBACK_POLL_MS = 30_000;
// Tiempo límite de cada envío, aplicado del lado nativo (ver postJsonWithTimeout).
// Con la app en segundo plano Android congela la red por ratos: sin límite, el
// request se cuelga y no entra al catch; con límite, falla, marca "buffer" y el
// próximo fix reintenta. Un lote de 500 posiciones pesa ~60 KB: 15 s sobran.
const UPLOAD_TIMEOUT_MS = 15_000;
// Con el chofer quieto no hay fixes (distanceInterval) y el panel lo vería
// "perdido"; además, con la pantalla bloqueada el sistema retiene lo diferido
// en memoria. Cada HEARTBEAT_MS se informa la última posición conocida y se
// sube lo pendiente aunque no haya fix nuevo.
const HEARTBEAT_MS = 5 * 60_000;

type PendingPosition = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  battery_level: number | null;
  recorded_at: string;
  source: "foreground" | "background" | "buffer" | "heartbeat";
};

export type StartResult =
  | { ok: true; mode: "background" | "foreground-only" }
  | { ok: false; reason: "foreground-permission" | "background-permission" | "error"; error?: string };

/* =========================
   Buffer local con candado
   ========================= */

// Las llamadas de la tarea de fondo y las de la pantalla comparten el mismo
// runtime de JS: un candado en memoria alcanza para que no se pisen el buffer.
// El candado protege SOLO lecturas y escrituras de AsyncStorage (milisegundos).
// La llamada de red va SIEMPRE con el candado suelto: si se tomara con el
// candado puesto, un envío colgado dejaría esperando a cada fix que llega
// detrás (grabar también pasa por acá) y nada saldría hasta abrir la app.
let chain: Promise<unknown> = Promise.resolve();
const withLock = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
};

const readBuffer = async (): Promise<PendingPosition[]> => {
  try {
    const raw = await AsyncStorage.getItem(BUFFER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeBuffer = async (items: PendingPosition[]) => {
  try {
    if (items.length) await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(items));
    else await AsyncStorage.removeItem(BUFFER_KEY);
  } catch (e) {
    console.log("[Lynx Location] No se pudo guardar el buffer:", e);
  }
};

const enqueue = (items: PendingPosition[]) =>
  withLock(async () => {
    if (!items.length) return;
    const current = await readBuffer();
    const merged = current.concat(items);
    // Si se pasa del tope se descarta lo más viejo: la posición actual vale
    // más que una de hace dos días.
    await writeBuffer(merged.length > MAX_BUFFER ? merged.slice(merged.length - MAX_BUFFER) : merged);
  });

export const pendingPositionsCount = async () => (await readBuffer()).length;

// Al cerrar sesión: lo que no se pudo subir con el token de este chofer no se
// puede subir con el del siguiente (se le atribuiría a otro). Devuelve cuántas
// posiciones se descartaron.
export const clearDriverPositionsBuffer = () =>
  withLock(async () => {
    const discarded = (await readBuffer()).length;
    await writeBuffer([]);
    return discarded;
  });

/* =========================
   Subida en lote
   ========================= */

let lastFlushAt = 0;
let sessionExpired = false;

type FlushResult = { sent: number; pending: number; stopped?: boolean };

// Una posición se identifica por su instante de grabación: es lo que se usa
// para sacar del buffer exactamente el lote que se envió, aunque mientras
// viajaba hayan entrado fixes nuevos por detrás.
const keyOf = (p: PendingPosition) => p.recorded_at;

// Saca del buffer el lote enviado (aceptado o rechazado como inválido) y
// devuelve cuántas quedan.
const removeFromBuffer = (batch: PendingPosition[]) =>
  withLock(async () => {
    const keys = new Set(batch.map(keyOf));
    const rest = (await readBuffer()).filter((p) => !keys.has(keyOf(p)));
    await writeBuffer(rest);
    return rest.length;
  });

// El envío falló (sin red o sin respuesta a tiempo): lo que hay se marca como
// "buffer" (en el histórico se distingue lo que se subió con demora) y se
// reintenta en el próximo ciclo. Devuelve cuántas quedan.
const markBufferDelayed = () =>
  withLock(async () => {
    const marked = (await readBuffer()).map((p) => (p.source === "buffer" ? p : { ...p, source: "buffer" as const }));
    await writeBuffer(marked);
    return marked.length;
  });

// Un solo envío en vuelo. El que llega mientras otro está en curso no se
// encola detrás: comparte el resultado y el próximo fix vuelve a intentar.
// La excepción es el aviso de disponibilidad (`available`), que no se puede
// perder: espera a que termine el que está en vuelo y recién sale.
let inflight: Promise<FlushResult> | null = null;

// Sube el buffer en lotes de hasta MAX_BATCH. `available` viaja solo en el
// primer lote (o solo, sin posiciones, cuando hay que informar un cambio de
// disponibilidad con el buffer vacío).
export const flushDriverPositions = async (opts: { available?: boolean } = {}): Promise<FlushResult> => {
  if (inflight) {
    if (opts.available === undefined) return inflight;
    await inflight.catch(() => undefined);
  }
  const run = flushNow(opts);
  inflight = run;
  try {
    return await run;
  } finally {
    if (inflight === run) inflight = null;
  }
};

const flushNow = async (opts: { available?: boolean }): Promise<FlushResult> => {
  let sent = 0;
  let available = opts.available;

  if (sessionExpired && available === undefined) return { sent, pending: await pendingPositionsCount() };

  // Con la app en segundo plano esta es la única parte que sigue corriendo:
  // acá se renueva la sesión antes de que venza (C7). No se espera: se renueva
  // con horas de margen, así que este envío sale bien con el token actual.
  void renewSessionIfNeeded();

  for (;;) {
    // Bajo candado solo se LEE el lote; la red se llama con el candado suelto.
    const batch = await withLock(async () => (await readBuffer()).slice(0, MAX_BATCH));
    if (!batch.length && available === undefined) break;

    const body: Record<string, unknown> = {};
    if (batch.length) body.positions = batch;
    if (available !== undefined) body.available = available;
    if (trackingStatus) body.tracking = trackingStatus;

    let res: any;
    try {
      res = await postJsonWithTimeout("/v2/driver-locations", body, UPLOAD_TIMEOUT_MS);
    } catch (e: any) {
      const pending = await markBufferDelayed();
      console.log("[Lynx Location] No se pudo subir (", String(e?.message ?? e), "), quedan", pending, "posiciones en el buffer");
      return { sent, pending };
    }

    if (res?.sessionExpired || res?.status === 401) {
      sessionExpired = true;
      console.log("[Lynx Location] Sesión vencida: se detiene el seguimiento");
      await stopLocationUpdatesQuietly();
      return { sent, pending: await pendingPositionsCount(), stopped: true };
    }

    const accepted = Boolean(res?.ok);

    // 5xx, 408 y 429 son fallas del servidor o del camino (reinicio del api, 502
    // del proxy, límite de pedidos), no del lote: se conserva igual que cuando
    // no hay red y se reintenta en el próximo ciclo. Solo un rechazo 4xx
    // descarta el lote.
    const status = Number(res?.status ?? 0);
    if (!accepted && (status === 0 || status >= 500 || status === 408 || status === 429)) {
      const pending = await markBufferDelayed();
      console.log("[Lynx Location] El servidor no pudo recibir el lote (", status, "), quedan", pending, "posiciones en el buffer");
      return { sent, pending };
    }

    if (accepted) {
      sent += Number(res.accepted ?? 0) + Number(res.duplicated ?? 0);
      lastFlushAt = Date.now();
    } else {
      // 400/403/422: el servidor rechazó el lote entero. Reintentarlo no lo va
      // a arreglar (lote inválido, chofer sin ficha): se descarta para no
      // trabar el resto y se deja constancia.
      console.log("[Lynx Location] Lote rechazado por el servidor:", res?.status, res?.error ?? res?.message);
    }

    // Aceptado o rechazado como inválido, el lote sale del buffer.
    const pending = batch.length ? await removeFromBuffer(batch) : await pendingPositionsCount();
    available = undefined;

    if (!accepted && res?.status === 403) {
      await stopLocationUpdatesQuietly();
      return { sent, pending, stopped: true };
    }
    if (!batch.length) break; // era solo el aviso de disponibilidad
  }

  return { sent, pending: await pendingPositionsCount() };
};

const maybeFlush = async (pending: number) => {
  const due = Date.now() - lastFlushAt >= FLUSH_MIN_INTERVAL_MS;
  if (pending >= FLUSH_WHEN_PENDING || due) await flushDriverPositions();
};

/* =========================
   Captura
   ========================= */

const readBattery = async (): Promise<number | null> => {
  try {
    const level = await Battery.getBatteryLevelAsync();
    return level >= 0 ? level : null;
  } catch {
    return null;
  }
};

const toPending = (loc: Location.LocationObject, battery: number | null): PendingPosition => ({
  latitude: loc.coords.latitude,
  longitude: loc.coords.longitude,
  accuracy: loc.coords.accuracy ?? null,
  speed: loc.coords.speed != null && loc.coords.speed >= 0 ? loc.coords.speed : null,
  heading: loc.coords.heading != null && loc.coords.heading >= 0 ? loc.coords.heading : null,
  battery_level: battery,
  recorded_at: new Date(loc.timestamp).toISOString(),
  source: AppState.currentState === "active" ? "foreground" : "background",
});

// La tarea corre aunque la app esté en segundo plano o la pantalla bloqueada.
// Con deferredUpdates* el sistema entrega varias posiciones juntas.
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations?: Location.LocationObject[] }>) => {
  if (error) {
    console.log("[Lynx Location] Error de la tarea de fondo:", error.message);
    return;
  }
  const locations = data?.locations ?? [];
  if (!locations.length) return;

  const battery = await readBattery();
  await enqueue(locations.map((l) => toPending(l, battery)));
  lastFixAt = Date.now();
  await maybeFlush(await pendingPositionsCount());
});

/* =========================
   Encendido / apagado
   ========================= */

let fallbackTimer: ReturnType<typeof setInterval> | null = null;

const stopFallback = () => {
  if (fallbackTimer !== null) {
    clearInterval(fallbackTimer);
    fallbackTimer = null;
  }
};

// Si el chofer negó el permiso "siempre", se mide igual mientras la app está
// abierta (lo que hacía el latido viejo), para no quedarse sin nada.
const startFallback = () => {
  stopFallback();
  const tick = async () => {
    if (AppState.currentState !== "active") return;
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await enqueue([toPending(loc, await readBattery())]);
      lastFixAt = Date.now();
      await maybeFlush(await pendingPositionsCount());
    } catch (e) {
      console.log("[Lynx Location] Sin posición en primer plano:", e);
    }
  };
  tick();
  fallbackTimer = setInterval(tick, FALLBACK_POLL_MS);
};

/* =========================
   Latido
   ========================= */

let lastFixAt = 0;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

const stopHeartbeat = () => {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

// Si hubo un fix hace poco no se duplica nada: solo se sube lo pendiente.
// Si no lo hubo (chofer quieto), se encola la última posición conocida con
// fuente "heartbeat" y el instante actual, para que el panel sepa que sigue ahí.
const startHeartbeat = () => {
  stopHeartbeat();
  heartbeatTimer = setInterval(async () => {
    if (Date.now() - lastFixAt >= HEARTBEAT_MS) {
      try {
        const last = await Location.getLastKnownPositionAsync({ maxAge: HEARTBEAT_MS });
        const loc = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        await enqueue([{ ...toPending(loc, await readBattery()), source: "heartbeat", recorded_at: new Date().toISOString() }]);
      } catch (e) {
        console.log("[Lynx Location] Latido sin posición:", e);
      }
    }
    try {
      await flushDriverPositions();
    } catch (e) {
      console.log("[Lynx Location] Latido: flush fallido:", e);
    }
  }, HEARTBEAT_MS);
};

const stopLocationUpdatesQuietly = async () => {
  stopFallback();
  stopHeartbeat();
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch (e) {
    console.log("[Lynx Location] No se pudo detener la tarea:", e);
  }
};

export const isDriverTrackingActive = async () => {
  if (fallbackTimer !== null) return true;
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    return false;
  }
};

// Diagnóstico: cómo quedó el seguimiento en este teléfono. Viaja en cada lote
// para poder verlo desde el servidor sin depender de los logs del celular.
type TrackingStatus = { mode: string; error?: string; at: string };
let trackingStatus: TrackingStatus | null = null;
const setTrackingStatus = (mode: string, error?: string) => {
  trackingStatus = { mode, ...(error ? { error } : {}), at: new Date().toISOString() };
};

export const startDriverTracking = async (opts: { available?: boolean } = {}): Promise<StartResult> => {
  sessionExpired = false;

  const fg = await Location.getForegroundPermissionsAsync();
  const fgFinal = fg.granted ? fg : await Location.requestForegroundPermissionsAsync();
  if (!fgFinal.granted) {
    setTrackingStatus("off", "foreground-permission");
    return { ok: false, reason: "foreground-permission" };
  }

  // El permiso "siempre" se pide después del de primer plano (Android lo exige
  // en ese orden y en Android 11+ lo lleva a Ajustes).
  const bg = await Location.getBackgroundPermissionsAsync();
  const bgFinal = bg.granted ? bg : await Location.requestBackgroundPermissionsAsync();

  if (!bgFinal.granted) {
    setTrackingStatus("foreground-only", "background-permission");
    startFallback();
    startHeartbeat();
    void flushDriverPositions({ available: opts.available });
    return { ok: true, mode: "foreground-only" };
  }

  try {
    if (!(await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 30_000,          // Android: un fix cada 30 s
        // 0 = el tiempo es el UNICO criterio. Con distanceInterval > 0 el chofer
        // detenido no genera fixes, no despierta la tarea y desaparece del mapa
        // aunque siga ahi; reportando por tiempo, quieto o no, sigue visible.
        distanceInterval: 0,
        // Sin diferido. deferredUpdates* autoriza a Android a RETENER los fixes y
        // entregarlos en tanda cuando quiera: medido el 7-sep-2026, con la app en
        // segundo plano los retuvo ~30 min y recien los entrego al volver a primer
        // plano. Como el unico envio en segundo plano ocurre dentro del callback de
        // la tarea, mientras Android no la llama no se sube nada y el panel ve al
        // chofer inactivo. En vivo pesa mas que el ahorro de bateria.
        deferredUpdatesInterval: 0,
        deferredUpdatesDistance: 0,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.AutomotiveNavigation,
        showsBackgroundLocationIndicator: true,
        mayShowUserSettingsDialog: true,
        foregroundService: {
          notificationTitle: "Lynx",
          notificationBody: "Compartiendo tu ubicación mientras trabajás",
          notificationColor: "#00B8FF",
          killServiceOnDestroy: false,
        },
      });
    }
    setTrackingStatus("background");
    stopFallback();
    startHeartbeat();
    void flushDriverPositions({ available: opts.available });
    return { ok: true, mode: "background" };
  } catch (e: any) {
    console.log("[Lynx Location] No se pudo iniciar el seguimiento en segundo plano:", e?.message ?? e);
    setTrackingStatus("fallback", String(e?.message ?? e));
    startFallback();
    startHeartbeat();
    void flushDriverPositions({ available: opts.available });
    return { ok: false, reason: "error", error: String(e?.message ?? e) };
  }
};

// Fin de operación: se apaga la captura y se sube lo que quede, informando
// la disponibilidad. Llamar ANTES de borrar la sesión (necesita el token).
export const stopDriverTracking = async (opts: { available?: boolean } = {}) => {
  await stopLocationUpdatesQuietly();
  try {
    await flushDriverPositions({ available: opts.available });
  } catch (e) {
    console.log("[Lynx Location] Flush final fallido:", e);
  }
};

// Al volver a primer plano se sube lo acumulado sin esperar al próximo fix.
AppState.addEventListener("change", (state) => {
  if (state === "active") void flushDriverPositions();
});
