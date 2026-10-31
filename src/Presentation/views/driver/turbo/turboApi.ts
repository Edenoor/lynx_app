// src/Presentation/views/driver/turbo/turboApi.ts
// Cliente de /v2/turbo para el chofer: ofertas de turbo y su vencimiento.
// El servidor identifica al chofer por el token; acá no viaja ningún id.

import { getJson, getJsonWithTimeout, postJson, postJsonWithTimeout } from "../../../config/Api";

// Ofertas: con límite nativo (ver postJsonWithTimeout). Un `fetch` sin límite
// dejaba el «Acepto» girando para siempre y el sondeo colgado. Sin respuesta,
// rechaza con un Error común: el servidor pudo haberlo ejecutado igual.
const OFFERS_TIMEOUT_MS = 10_000;
const ACCEPT_TIMEOUT_MS = 15_000;
const DECLINE_TIMEOUT_MS = 10_000;

export type TurboOffer = {
  id: number;
  route_id: number;
  ring: number;
  distance_km: string | number | null;
  offered_at: string;
  expires_at: string;
  deadline_at: string | null;
  delivery_id: number;
  store_name: string | null;
  store_address: string | null;
  delivery_address: string | null;
  delivery_postal_code: string | null;
  receiver_name: string | null;
  seconds_left?: number;
};

export type TurboDispatch = {
  route_id: number;
  status: "OFFERING" | "ASSIGNED" | "ESCALATED" | "CANCELLED";
  deadline_at: string | null;
  distance_km: string | number | null;
  store_name?: string | null;
};

export type TurboAvailability = { ok: boolean; turbo_active: boolean; turbo_enabled: boolean };

// Un 409 trae `code` (TAKEN, EXPIRED, NOT_OFFERED, NOT_OFFERING): se conserva
// para que la pantalla decida qué hacer con la tarjeta.
export class TurboApiError extends Error {
  code: string | null;
  status: number;
  constructor(message: string, code: string | null, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// Una respuesta que no es JSON no la mandó el servidor (un proxy, un portal
// cautivo): se rechaza con un Error común, sin status, y cuenta como «no se
// sabe qué pasó», igual que sin red.
const unwrap = <T,>(res: any): T => {
  if (res?.invalidResponse && !res.sessionExpired) throw new Error(res.message || "Respuesta inesperada del servidor");
  if (!res || res.ok === false) {
    throw new TurboApiError(res?.error || res?.message || "Error del servidor", res?.code ?? null, Number(res?.status ?? 0));
  }
  return res as T;
};

export const fetchMyOffers = async () =>
  unwrap<{ offers: TurboOffer[] }>(await getJsonWithTimeout("/v2/turbo/offers/mine", OFFERS_TIMEOUT_MS)).offers;

// Idempotente en el servidor: si ya es tuyo devuelve `already: true`.
export const acceptOffer = async (routeId: number) =>
  unwrap<{ route: { id: number }; already?: boolean }>(
    await postJsonWithTimeout(`/v2/turbo/offers/${routeId}/accept`, {}, ACCEPT_TIMEOUT_MS),
  );

export const declineOffer = async (routeId: number) =>
  unwrap<{ ok: true }>(await postJsonWithTimeout(`/v2/turbo/offers/${routeId}/decline`, {}, DECLINE_TIMEOUT_MS));

// Solo para la cabecera del recorrido; si el servidor no lo expone, la pantalla lo omite.
export const fetchDispatch = async (routeId: number) =>
  unwrap<{ dispatch: TurboDispatch }>(await getJson(`/v2/turbo/dispatches/${routeId}`)).dispatch;

export const getAvailability = async () => unwrap<TurboAvailability>(await postJson("/driver/availability/get", {}));
export const setAvailability = async (turboActive: boolean) =>
  unwrap<TurboAvailability>(await postJson("/driver/availability/set", { turbo_active: turboActive }));

export const km = (v: string | number | null | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(1)} km` : "";
};
export const hhmm = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : null;
