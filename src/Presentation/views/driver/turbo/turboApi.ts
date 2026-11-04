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
  // Programado: Mercado Libre lo prometió para otro día (la fecha del
  // recorrido) y la franja empieza a esta hora. Para hoy, la fecha de hoy.
  scheduled_date?: string | null;
  window_start_at?: string | null;
  // Lote: los programados de una tienda que se ofrecen juntos y se aceptan
  // enteros. Cada Turbo trae su oferta con el mismo group_id.
  group_id?: number | null;
  source?: string | null;
};

export type TurboDispatch = {
  route_id: number;
  status: "SCHEDULED" | "OFFERING" | "ASSIGNED" | "ESCALATED" | "CANCELLED";
  deadline_at: string | null;
  window_start_at?: string | null;
  scheduled_date?: string | null;
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

// Grupos: varios Turbos de una misma tienda con un solo retiro. Cada Turbo
// sigue siendo su recorrido (route_id); el grupo los junta para la pantalla.
export type GroupTurbo = {
  route_id: number;
  route_status: string;
  delivery_id: number;
  tracking: string | number | null;
  nombre_destinatario: string | null;
  store_id: number;
  store_name: string | null;
  deadline_at: string | null;
  window_start_at: string | null;
  pickup_stop_id: number | null;
  pickup_status: "PENDING" | "ARRIVED" | "DONE" | "SKIPPED" | null;
  collected: boolean;
  dropoff_stop_id: number | null;
  dropoff_status: "PENDING" | "ARRIVED" | "DONE" | "SKIPPED" | null;
  address: string | null;
  postal_code: string | null;
  receiver_name: string | null;
  ops_status: string | null;
  // Plan del grupo: hora estimada de la entrega y holgura contra el fin de la
  // franja menos el margen (negativa = llega tarde). null sin plan.
  eta: string | null;
  slack_minutes: number | null;
};
export type GroupStore = {
  store_id: number;
  store_name: string | null;
  store_address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  turbos: number;
  collected: number;
  pickup_status: "PENDING" | "ARRIVED" | "DONE";
  eta: string | null;
};
export type TurboGroup = {
  id: number;
  scheduled_date: string;
  kind: string;
  status: "ASSIGNED" | "IN_PROGRESS" | "DONE";
  plan_at: string | null;
  estimated: boolean;
  turbos: GroupTurbo[];
  stores: GroupStore[];
};
// Cuántos Turbos abiertos lleva contra su tope, por turno.
export type TurboLoad = { morning: number; cap_morning: number; other: number; cap_other: number; morning_until: string };
export type GroupWarning = { delivery_id?: number; message: string };

export const fetchMyGroups = async (date: string) =>
  unwrap<{ groups: TurboGroup[]; load: TurboLoad }>(await getJsonWithTimeout(`/v2/turbo/groups/mine?date=${date}`, OFFERS_TIMEOUT_MS));
export const fetchGroup = async (id: number) => unwrap<{ group: TurboGroup }>(await getJson(`/v2/turbo/groups/${id}`)).group;
export const startGroup = async (id: number) =>
  unwrap<{ group: TurboGroup; warnings: GroupWarning[] }>(await postJson(`/v2/turbo/groups/${id}/start`, {}));
export const groupStoreAction = async (id: number, storeId: number, action: "arrive" | "done") =>
  unwrap<{ group: TurboGroup }>(await postJson(`/v2/turbo/groups/${id}/stores/${storeId}/${action}`, {})).group;
export const collectInGroup = async (id: number, routeId: number) =>
  unwrap<{ group: TurboGroup; warnings: GroupWarning[] }>(await postJson(`/v2/turbo/groups/${id}/collect`, { route_id: routeId }));
export const completeGroup = async (id: number) =>
  unwrap<{ group: TurboGroup; completed: number[]; pending: number[] }>(await postJson(`/v2/turbo/groups/${id}/complete`, {}));

// Lotes: se aceptan o se rechazan enteros (todos sus Turbos).
export const acceptLote = async (groupId: number) =>
  unwrap<{ group: TurboGroup; already?: boolean }>(await postJsonWithTimeout(`/v2/turbo/offers/lote/${groupId}/accept`, {}, ACCEPT_TIMEOUT_MS));
export const declineLote = async (groupId: number) =>
  unwrap<{ ok: true }>(await postJsonWithTimeout(`/v2/turbo/offers/lote/${groupId}/decline`, {}, DECLINE_TIMEOUT_MS));

// Turbos de mañana: los programados sin chofer que cualquiera puede tomar antes.
export type ScheduledTurbo = {
  route_id: number;
  delivery_id: number;
  scheduled_date: string;
  window_start_at: string | null;
  deadline_at: string | null;
  store_name: string | null;
  store_address: string | null;
  delivery_address: string | null;
  delivery_postal_code: string | null;
  receiver_name: string | null;
  offered_to_me: boolean;
};
export const fetchScheduledAvailable = async () =>
  unwrap<{ turbos: ScheduledTurbo[] }>(await getJsonWithTimeout("/v2/turbo/scheduled/available", OFFERS_TIMEOUT_MS)).turbos;
export const claimScheduled = async (routeId: number) =>
  unwrap<{ route: { id: number }; group_id?: number | null; already?: boolean }>(await postJsonWithTimeout(`/v2/turbo/scheduled/${routeId}/claim`, {}, ACCEPT_TIMEOUT_MS));

// Pasar un Turbo a otro grupo mío del mismo día, o separarlo en uno nuevo
// (toGroupId null). `late`: las entregas que con el cambio llegarían tarde.
export const moveTurbo = async (groupId: number, routeId: number, toGroupId: number | null) =>
  unwrap<{ from: TurboGroup; to: TurboGroup; late: { route_id: number; slack_minutes: number }[] }>(
    await postJson(`/v2/turbo/groups/${groupId}/move`, { route_id: routeId, to_group_id: toGroupId }),
  );
