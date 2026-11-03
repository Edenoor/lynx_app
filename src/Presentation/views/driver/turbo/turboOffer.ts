// src/Presentation/views/driver/turbo/turboOffer.ts
// Reglas de la pantalla de ofertas Turbo, sin React Native para probarlas solas.
//
// Cuenta regresiva: manda el servidor. Cada oferta trae `seconds_left` (lo que
// le queda según el reloj del servidor); con el reloj del teléfono adelantado
// la cuenta con `expires_at` daba «vencida» y deshabilitaba Acepto con la
// oferta viva. El vencimiento local se ancla al momento en que salió el pedido
// (no al que llegó la respuesta): así nunca muestra más tiempo del que hay.
//
// Acepto: el servidor es idempotente (aceptar de nuevo lo que ya es tuyo
// devuelve `already`; si lo tomó otro o venció, 409). Si la respuesta no llega
// (sin red, sin respuesta a tiempo, 5xx, algo que no es JSON) no se sabe si
// quedó asignado: se vuelve a aceptar, que es lo que pidió el chofer.

import { executionDayLabel } from "../routes/collectionLabels";

export type WithLocalExpiry<T> = T & { expires_local: number };

export function withLocalExpiry<T extends { expires_at: string; seconds_left?: number | null }>(
  offers: T[],
  startedAt: number,
): WithLocalExpiry<T>[] {
  return offers.map((o) => ({
    ...o,
    expires_local:
      typeof o.seconds_left === "number" && Number.isFinite(o.seconds_left)
        ? startedAt + o.seconds_left * 1000
        : new Date(o.expires_at).getTime(),
  }));
}

export const secondsLeft = (o: { expires_local: number }, now: number) =>
  Math.max(0, Math.round((o.expires_local - now) / 1000));

// Respuesta final del servidor: un 4xx (409 TAKEN/EXPIRED/NOT_OFFERING, 404,
// 403, 401). Sin status (sin red, sin respuesta, algo que no es JSON), un 5xx,
// 408 o 429: no se sabe qué pasó.
export function isDefinitive(e: unknown): boolean {
  const status = Number((e as { status?: unknown } | null | undefined)?.status ?? 0);
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

export type AcceptOutcome =
  | { kind: "assigned" }
  // La oferta ya no vale (la tomó otro, venció, no es tuya): error con el mensaje del servidor.
  | { kind: "gone"; error: unknown }
  // Ningún intento tuvo respuesta: puede haber quedado asignado o no.
  | { kind: "unknown"; error: unknown };

export const ACCEPT_RETRY_MS = 1500;

export async function acceptWithConfirm(
  routeId: number,
  accept: (routeId: number) => Promise<unknown>,
  opts: { tries?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<AcceptOutcome> {
  const tries = opts.tries ?? 3;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let last: unknown = null;
  for (let i = 0; i < tries; i++) {
    if (i > 0) await sleep(ACCEPT_RETRY_MS);
    try {
      await accept(routeId);
      return { kind: "assigned" };
    } catch (e) {
      if (isDefinitive(e)) return { kind: "gone", error: e };
      last = e;
    }
  }
  return { kind: "unknown", error: last };
}

// Un Turbo programado: Mercado Libre lo prometió para otro día. El chofer lo
// puede aceptar antes, pero no retirarlo: si lo escanea con la app de Flex,
// ML lo da en camino y hay que entregarlo ese mismo día.
export const NO_RETIRAR_ANTES = "No lo retires hoy: si lo escaneás con la app de Flex, Mercado Libre lo da en camino y hay que entregarlo hoy.";

export const esProgramado = (o: { scheduled_date?: string | null }, todayIso: string) =>
  !!o.scheduled_date && o.scheduled_date.slice(0, 10) > todayIso;

// «Para mañana, miércoles 04/11, de 11:00 a 13:00». null si es para hoy.
// `hora` formatea una hora (la de la pantalla, hhmm).
export function programadoLabel(
  o: { scheduled_date?: string | null; window_start_at?: string | null; deadline_at?: string | null },
  todayIso: string,
  hora: (iso: string) => string | null,
): string | null {
  if (!esProgramado(o, todayIso)) return null;
  const desde = o.window_start_at ? hora(o.window_start_at) : null;
  const hasta = o.deadline_at ? hora(o.deadline_at) : null;
  const franja = desde && hasta ? `, de ${desde} a ${hasta}` : hasta ? `, antes de las ${hasta}` : "";
  return `Para ${executionDayLabel(o.scheduled_date as string, todayIso)}${franja}`;
}

// El plazo para contestar una oferta: «45 s», «12 min» o, en una de un
// programado (vale hasta la mañana del día prometido), «13 h 20 min».
export function plazoParaResponder(left: number): string {
  if (left <= 0) return "vencida";
  if (left < 120) return `${left} s para responder`;
  if (left < 3600) return `${Math.floor(left / 60)} min para responder`;
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60);
  return `${h} h${m ? ` ${m} min` : ""} para responder`;
}
