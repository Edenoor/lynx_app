// src/Presentation/views/driver/turbo/turboApi.ts
// Cliente de /v2/turbo para el chofer: ofertas de turbo y su vencimiento.
// El servidor identifica al chofer por el token; acá no viaja ningún id.

import { getJson, postJson } from "../../../config/Api";

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

const unwrap = <T,>(res: any): T => {
  if (!res || res.ok === false) {
    throw new TurboApiError(res?.error || res?.message || "Error del servidor", res?.code ?? null, Number(res?.status ?? 0));
  }
  return res as T;
};

export const fetchMyOffers = async () => unwrap<{ offers: TurboOffer[] }>(await getJson("/v2/turbo/offers/mine")).offers;

export const acceptOffer = async (routeId: number) =>
  unwrap<{ route: { id: number } }>(await postJson(`/v2/turbo/offers/${routeId}/accept`, {}));

export const declineOffer = async (routeId: number) => unwrap<{ ok: true }>(await postJson(`/v2/turbo/offers/${routeId}/decline`, {}));

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
