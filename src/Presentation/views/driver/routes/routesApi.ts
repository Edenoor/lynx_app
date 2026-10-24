// src/Presentation/views/driver/routes/routesApi.ts
// Cliente de /v2/routes para el chofer. El servidor identifica al chofer por
// el token: acá no viaja ningún id de chofer.

import { getJson, postJson, putJson } from "../../../config/Api";
import type { OutcomeDeclaration } from "./outcomeDeclaration";

export type RouteType = "PICKUP" | "DELIVERY" | "TURBO";
export type RouteStatus = "PLANNED" | "ASSIGNED" | "LOADED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type StopStatus = "PENDING" | "ARRIVED" | "DONE" | "SKIPPED";

export type ConfirmationState = "ACCEPTED" | "DECLINED" | "PENDING" | "OVERDUE";
export type RouteSummary = {
  id: number; type: RouteType; status: RouteStatus; scheduled_date: string;
  stops_count: number; deliveries_count: number; load_expected_count: number | null; load_confirmed_count: number | null;
  // Solo en recorridos que vienen de una ronda fija: cómo se llama, a qué hora
  // sale y qué contestó el chofer al aviso de la noche anterior.
  template_id?: number | null; template_name?: string | null; departure_time?: string | null;
  driver_confirmation?: "ACCEPTED" | "DECLINED" | null; confirmation_state?: ConfirmationState | null;
};
export type StopDelivery = {
  delivery_id: number; tracking: string | number | null; nombre_destinatario: string | null; direccion: string | null;
  codigo_postal: string | null; tipo_envio: string | null; ops_status: string; outcome: string | null; outcome_at: string | null; notes: string | null;
  // Cobranza del envío (delivery_financials). El servidor todavía no la manda
  // en el detalle del recorrido: sin ella, la app no muestra «Cobrar $X».
  importe_cobranza?: number | string | null;
};
export type Stop = {
  id: number; route_id: number; sequence: number; type: "PICKUP" | "DELIVERY"; status: StopStatus;
  arrived_at: string | null; completed_at: string | null; notes: string | null;
  store_id?: number; store_name?: string; store_address?: string; cutoff_snapshot?: string | null; window_snapshot?: number | null;
  collected_count?: number; store_ready_at?: string | null;
  address?: string | null; postal_code?: string | null; latitude?: number | null; longitude?: number | null; receiver_name?: string | null;
  deliveries: StopDelivery[];
};
// `warnings` solo viene en la respuesta de /start: envíos Flex que Mercado
// Libre todavía no muestra «En camino».
export type StartWarning = { delivery_id: number; tracking: string | number | null; status_ml: string | null; message: string };
export type RouteDetail = RouteSummary & { qr_token: string; notes: string | null; started_at: string | null; completed_at: string | null; stops: Stop[]; warnings?: StartWarning[] };
export type PendingDelivery = { delivery_id: number; tracking: string | number | null; nombre_destinatario: string | null; codigo_postal: string | null; ops_status: string };

export const TYPE_LABEL: Record<RouteType, string> = { PICKUP: "Colecta", DELIVERY: "Reparto", TURBO: "Turbo" };
export const STATUS_LABEL: Record<RouteStatus, string> = {
  PLANNED: "Planificado", ASSIGNED: "Asignado", LOADED: "Cargado", IN_PROGRESS: "En curso", COMPLETED: "Completado", CANCELLED: "Cancelado",
};
export const STOP_STATUS_LABEL: Record<StopStatus, string> = { PENDING: "Pendiente", ARRIVED: "Llegaste", DONE: "Cerrada", SKIPPED: "Salteada" };
export const OPS_LABEL: Record<string, string> = {
  ENTERED: "Ingresado", COLLECTED: "Colectado", ARRIVED_WAREHOUSE: "En planta", SHELVED: "Estanteado", ASSIGNED_TO_ROUTE: "En recorrido",
  OUT_FOR_DELIVERY: "En calle", DELIVERED: "Entregado", NOT_DELIVERED: "No entregado", CANCELLED: "Cancelado",
};

// Las respuestas traen ok:false con el mensaje del servidor; acá se convierten en excepción.
const unwrap = <T,>(res: any): T => {
  if (!res || res.ok === false) throw new Error(res?.error || res?.message || "Error del servidor");
  return res as T;
};

// Fecha local del teléfono (YYYY-MM-DD). toISOString() da la de UTC, que en
// Argentina ya es el día siguiente desde las 21:00.
const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const todayIso = () => localIso(new Date());
export const tomorrowIso = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localIso(d);
};

export const fetchMyRoutes = async (date: string) =>
  unwrap<{ routes: RouteSummary[] }>(await getJson(`/v2/routes/mine?date=${date}`)).routes;

// ¿Puede hacer la ronda? Se contesta la noche anterior; contestar de nuevo pisa la respuesta.
export const respondConfirmation = async (id: number, response: "ACCEPTED" | "DECLINED") =>
  unwrap<{ route: RouteDetail }>(await putJson(`/v2/routes/${id}/confirmation`, { response })).route;

export const fetchRoute = async (id: number) => unwrap<{ route: RouteDetail }>(await getJson(`/v2/routes/${id}`)).route;

export const fetchRouteByQr = async (token: string) =>
  unwrap<{ route: RouteDetail }>(await getJson(`/v2/routes/by-qr/${encodeURIComponent(token)}`)).route;

export const confirmLoad = async (id: number, confirmed: number) =>
  unwrap<{ loaded: boolean; discrepancy: { expected: number; confirmed: number; difference: number; reason: string } | null; route: RouteDetail }>(
    await putJson(`/v2/routes/${id}/confirm-load`, { load_confirmed_count: confirmed })
  );

export const startRoute = async (id: number) => unwrap<{ route: RouteDetail }>(await putJson(`/v2/routes/${id}/start`, {})).route;
export const completeRoute = async (id: number) => unwrap<{ route: RouteDetail }>(await putJson(`/v2/routes/${id}/complete`, {})).route;

export const stopAction = async (routeId: number, stopId: number, action: "arrive" | "done" | "skip" | "store-ready", notes?: string) =>
  unwrap<{ stop: Stop }>(await putJson(`/v2/routes/${routeId}/stops/${stopId}/${action}`, notes ? { notes } : {})).stop;

// `declaration` (Baúl) trae solo los campos que el chofer completó.
export const recordOutcome = async (routeId: number, stopId: number, deliveryId: number, outcome: string, notes?: string, declaration?: OutcomeDeclaration) =>
  unwrap<{ stop: Stop }>(await postJson(`/v2/routes/${routeId}/stops/${stopId}/outcomes`, { delivery_id: deliveryId, outcome, notes: notes ?? null, ...declaration })).stop;

export const fetchPendingAtStore = async (routeId: number, stopId: number) =>
  unwrap<{ deliveries: PendingDelivery[] }>(await getJson(`/v2/routes/${routeId}/stops/${stopId}/pending`)).deliveries;
