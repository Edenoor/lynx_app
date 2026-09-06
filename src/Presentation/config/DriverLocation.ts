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

import { postJson } from "./Api";

export const LOCATION_TASK = "lynx-driver-location";

const BUFFER_KEY = "driver_positions_buffer";
const MAX_BUFFER = 5000;        // ~2 días a 30 s; más viejo se descarta
const MAX_BATCH = 500;          // tope del endpoint
const FLUSH_MIN_INTERVAL_MS = 30_000;
const FLUSH_WHEN_PENDING = 10;  // con esta cantidad acumulada se sube sin esperar
const FALLBACK_POLL_MS = 30_000;

type PendingPosition = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  battery_level: number | null;
  recorded_at: string;
  source: "foreground" | "background" | "buffer";
};

export type StartResult =
  | { ok: true; mode: "background" | "foreground-only" }
  | { ok: false; reason: "foreground-permission" | "background-permission" | "error"; error?: string };

/* =========================
   Buffer local con candado
   ========================= */

// Las llamadas de la tarea de fondo y las de la pantalla comparten el mismo
// runtime de JS: un candado en memoria alcanza para que no se pisen el buffer.
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

/* =========================
   Subida en lote
   ========================= */

let lastFlushAt = 0;
let sessionExpired = false;

type FlushResult = { sent: number; pending: number; stopped?: boolean };

// Sube el buffer en lotes de hasta MAX_BATCH. `available` viaja solo en el
// primer lote (o solo, sin posiciones, cuando hay que informar un cambio de
// disponibilidad con el buffer vacío).
export const flushDriverPositions = (opts: { available?: boolean } = {}): Promise<FlushResult> =>
  withLock(async () => {
    let buffer = await readBuffer();
    let sent = 0;
    let available = opts.available;

    if (!buffer.length && available === undefined) return { sent, pending: 0 };
    if (sessionExpired && available === undefined) return { sent, pending: buffer.length };

    while (buffer.length || available !== undefined) {
      const batch = buffer.slice(0, MAX_BATCH);
      const body: Record<string, unknown> = {};
      if (batch.length) body.positions = batch;
      if (available !== undefined) body.available = available;

      let res: any;
      try {
        res = await postJson("/v2/driver-locations", body);
      } catch (e) {
        // Sin red: lo que queda se marca como "buffer" (en el histórico se
        // distingue lo que se subió con demora) y se reintenta en el próximo ciclo.
        buffer = buffer.map((p) => (p.source === "buffer" ? p : { ...p, source: "buffer" as const }));
        await writeBuffer(buffer);
        console.log("[Lynx Location] Sin conexión, quedan", buffer.length, "posiciones en el buffer");
        return { sent, pending: buffer.length };
      }

      if (res?.sessionExpired || res?.status === 401) {
        sessionExpired = true;
        console.log("[Lynx Location] Sesión vencida: se detiene el seguimiento");
        await stopLocationUpdatesQuietly();
        return { sent, pending: buffer.length, stopped: true };
      }

      if (res?.ok) {
        sent += Number(res.accepted ?? 0) + Number(res.duplicated ?? 0);
        buffer = buffer.slice(batch.length);
        available = undefined;
        lastFlushAt = Date.now();
        continue;
      }

      // 400/403/422: el servidor rechazó el lote entero. Reintentarlo no lo va
      // a arreglar (lote inválido, chofer sin ficha): se descarta para no
      // trabar el resto y se deja constancia.
      console.log("[Lynx Location] Lote rechazado por el servidor:", res?.status, res?.error ?? res?.message);
      buffer = buffer.slice(batch.length);
      available = undefined;
      if (res?.status === 403) {
        await stopLocationUpdatesQuietly();
        await writeBuffer(buffer);
        return { sent, pending: buffer.length, stopped: true };
      }
    }

    await writeBuffer(buffer);
    return { sent, pending: buffer.length };
  });

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
      await maybeFlush(await pendingPositionsCount());
    } catch (e) {
      console.log("[Lynx Location] Sin posición en primer plano:", e);
    }
  };
  tick();
  fallbackTimer = setInterval(tick, FALLBACK_POLL_MS);
};

const stopLocationUpdatesQuietly = async () => {
  stopFallback();
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

export const startDriverTracking = async (opts: { available?: boolean } = {}): Promise<StartResult> => {
  sessionExpired = false;

  const fg = await Location.getForegroundPermissionsAsync();
  const fgFinal = fg.granted ? fg : await Location.requestForegroundPermissionsAsync();
  if (!fgFinal.granted) return { ok: false, reason: "foreground-permission" };

  // El permiso "siempre" se pide después del de primer plano (Android lo exige
  // en ese orden y en Android 11+ lo lleva a Ajustes).
  const bg = await Location.getBackgroundPermissionsAsync();
  const bgFinal = bg.granted ? bg : await Location.requestBackgroundPermissionsAsync();

  if (!bgFinal.granted) {
    startFallback();
    void flushDriverPositions({ available: opts.available });
    return { ok: true, mode: "foreground-only" };
  }

  try {
    if (!(await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 30_000,          // Android: un fix cada 30 s como máximo
        distanceInterval: 20,          // o cada 20 m, lo que ocurra primero
        deferredUpdatesInterval: 60_000,   // entrega agrupada: menos radio y batería
        deferredUpdatesDistance: 100,
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
    stopFallback();
    void flushDriverPositions({ available: opts.available });
    return { ok: true, mode: "background" };
  } catch (e: any) {
    console.log("[Lynx Location] No se pudo iniciar el seguimiento en segundo plano:", e?.message ?? e);
    startFallback();
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
