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
