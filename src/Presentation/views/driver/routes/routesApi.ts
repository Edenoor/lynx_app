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
  // Solo en colectas que salen de una plantilla (habituales): cómo se llama
  // (solo en la lista; el detalle no trae el nombre), a qué hora sale y qué
  // contestó el chofer. driver_confirmation viene en toda colecta.
  template_id?: number | null; template_name?: string | null; departure_time?: string | null;
  driver_confirmation?: "ACCEPTED" | "DECLINED" | null; confirmation_state?: ConfirmationState | null;
  // Turbo: el grupo en el que corre (varios Turbos de una tienda con un solo
  // retiro). Un servidor anterior no lo manda.
  turbo_group_id?: number | null;
};
export type StopDelivery = {
  delivery_id: number; tracking: string | number | null; nombre_destinatario: string | null; direccion: string | null;
  codigo_postal: string | null; tipo_envio: string | null; ops_status: string; outcome: string | null; outcome_at: string | null; notes: string | null;
  // Cobranza del envío (delivery_financials), con la que la app muestra
  // «Cobrar $X». La manda el servidor desde feat/integracion-20261024; uno
  // anterior no la trae y el cierre funciona igual, sin el importe.
  importe_cobranza?: number | string | null;
  // Canal comercial (mercadolibre, tiendanube, shopify, woocommerce) para el
  // logo; null si no se sabe. Un servidor anterior no lo manda.
  provider?: string | null;
  // Estado de Mercado Libre de ESTE envío que guardó el poller (crudo, p. ej.
  // not_delivered, o traducido). Un servidor anterior no lo manda: sin él, un
  // «no entregado» de ML se ve por ops_status/outcome.
  status_ml?: string | null;
  // Logística inversa pedida por coordinación (CAMBIO, RECUPERO, VA_Y_VUELVE,
  // OTRO): una solicitud, no algo que el chofer ya tenga. Un servidor anterior no la manda.
  reverse_kind?: string | null;
  reverse_note?: string | null;
};
export type Stop = {
  id: number; route_id: number; sequence: number; type: "PICKUP" | "DELIVERY"; status: StopStatus;
  // `notes` también la escribe el sistema («escaneado por el chofer»); la
  // observación del chofer es `driver_notes` (PUT …/notes). Un servidor
  // anterior no la manda.
  arrived_at: string | null; completed_at: string | null; notes: string | null;
  driver_notes?: string | null; driver_notes_at?: string | null; driver_notes_by?: string | null;
  store_id?: number; store_name?: string; store_address?: string; cutoff_snapshot?: string | null; window_snapshot?: number | null;
  collected_count?: number; store_ready_at?: string | null;
  // Retiro: coordenadas congeladas al armar la parada (pg las manda como texto)
  // y, si el origen es un Dropoff en vez de una tienda, su nombre.
  latitude_snapshot?: number | string | null; longitude_snapshot?: number | string | null; warehouse_name?: string | null;
  // Retiro: horario planificado de la tienda («HH:MM:SS») y cantidad que
  // declaró el chofer (null = sin informar). Un servidor anterior no los manda.
  pickup_time_snapshot?: string | null; declared_count?: number | null; declared_at?: string | null;
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
// Etiquetas del estado operativo del envío (viven en stopView.ts, que es puro).
export { OPS_LABEL } from "./stopView";

// Las respuestas traen ok:false con el mensaje del servidor; acá se convierten
// en excepción. El `code` y el status viajan en el error para los casos que la
// pantalla distingue (por ejemplo, TURBO_NOT_IN_ROUTE en el retiro de un Turbo).
const unwrap = <T,>(res: any): T => {
  if (!res || res.ok === false) {
    throw Object.assign(new Error(res?.error || res?.message || "Error del servidor"), {
      code: res?.code ?? null,
      status: Number(res?.status ?? 0),
      // Paradas a las que se refiere el error (ruteador: sin camino por calle).
      stopIds: Array.isArray(res?.stop_ids) ? (res.stop_ids as number[]) : null,
    });
  }
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

// Los de `date` y, si el servidor ya lo soporta (contesta `open: true`), también
// los abiertos de cualquier otro día. Uno que no lo soporta ignora `open` y
// contesta solo los de `date`: `open` vuelve en false y la app revisa los días
// anteriores de a uno (ver work/workSource.ts).
export const fetchMyRoutesWithOpen = async (date: string) => {
  const res = unwrap<{ routes: RouteSummary[]; open?: boolean }>(await getJson(`/v2/routes/mine?date=${date}&open=1`));
  return { routes: res.routes ?? [], open: res.open === true };
};

// Confirmación de una colecta (de ese día): contestar de nuevo pisa la respuesta.
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

// Observación del chofer en la parada (route_stops.driver_notes): se guarda
// sola, sin cerrar ni registrar nada; vacío la borra. Un servidor sin el
// endpoint responde 404.
export const saveStopNotes = async (routeId: number, stopId: number, notes: string) =>
  unwrap<{ stop: Stop }>(await putJson(`/v2/routes/${routeId}/stops/${stopId}/notes`, { notes: notes.trim() || null })).stop;

// Cantidad de paquetes retirados en una parada de colecta. stopId es el de la
// parada de este recorrido (route_stops.id), no el de la tienda ni la plantilla.
export const declareStopCount = async (routeId: number, stopId: number, count: number) =>
  unwrap<{ stop: Stop }>(await putJson(`/v2/routes/${routeId}/stops/${stopId}/declare-count`, { count })).stop;

// `declaration` (Baúl) trae solo los campos que el chofer completó.
export const recordOutcome = async (routeId: number, stopId: number, deliveryId: number, outcome: string, notes?: string, declaration?: OutcomeDeclaration) =>
  unwrap<{ stop: Stop }>(await postJson(`/v2/routes/${routeId}/stops/${stopId}/outcomes`, { delivery_id: deliveryId, outcome, notes: notes ?? null, ...declaration })).stop;

// ---------- Ruteador del chofer (solo repartos) ----------
// El depósito y el domicilio los resuelve el servidor (con sus coordenadas);
// la ubicación actual y una dirección elegida viajan con las suyas. Nada de
// esto se guarda: solo el orden que el chofer confirma.
export type PlanPointKind = "WAREHOUSE" | "HOME" | "GPS" | "CUSTOM" | "NONE";
export type PlanPointSpec = { kind: PlanPointKind; latitude?: number; longitude?: number; label?: string };
export type PlanPlace = { address: string | null; latitude: number | null; longitude: number | null; valid: boolean };
export type PlanPlaces = { warehouse: (PlanPlace & { id: number; name: string }) | null; home: PlanPlace | null };
export type PlanMetrics = { km: number; minutes: number; unreachable_legs: number };
// Siempre por calles (Valhalla). Si no se puede calcular, el servidor responde
// un error con `code` (ROUTING_UNAVAILABLE, UNREACHABLE_STOPS con `stop_ids`,
// NOTHING_TO_ROUTE, TOO_MANY_STOPS) y no hay propuesta: el orden queda igual.
export type PlanPreview = {
  stop_ids: number[]; current_stop_ids: number[]; proposed: PlanMetrics; current: PlanMetrics;
  vehicle: string; missing_stop_ids: number[];
  start: { kind: PlanPointKind; label: string } | null; end: { kind: PlanPointKind; label: string } | null;
};

export const fetchPlanPlaces = async (id: number) => {
  const res = unwrap<PlanPlaces>(await getJson(`/v2/routes/${id}/plan/places`));
  return { warehouse: res.warehouse ?? null, home: res.home ?? null };
};
export const previewPlan = async (id: number, body: { start: PlanPointSpec; end: PlanPointSpec; first_stop_id?: number | null; last_stop_id?: number | null }) =>
  unwrap<PlanPreview>(await postJson(`/v2/routes/${id}/plan/preview`, body));
// expected: el orden que el chofer estaba viendo; si cambió, 409 ROUTE_CHANGED.
export const saveDriverOrder = async (id: number, stopIds: number[], expected: number[]) =>
  unwrap<{ route: RouteDetail }>(await putJson(`/v2/routes/${id}/stops/driver-order`, { stop_ids: stopIds, expected_stop_ids: expected })).route;

// Recorridos que el coordinador le ofrece al chofer (GET /v2/offers/mine trae
// también los Turbo, que tienen su propia pantalla: acá se dejan afuera).
export type RouteOffer = {
  id: number; route_id: number; kind: string; scheduled_date: string | null; expires_at: string; seconds_left: number;
  deliveries: number; first_addresses?: string[];
};
export const fetchRouteOffers = async () =>
  unwrap<{ offers: RouteOffer[] }>(await getJson("/v2/offers/mine")).offers.filter((o) => String(o.kind).toUpperCase() !== "TURBO");
export const acceptRouteOffer = async (routeId: number) => unwrap<unknown>(await postJson(`/v2/offers/${routeId}/accept`, {}));
export const declineRouteOffer = async (routeId: number) => unwrap<unknown>(await postJson(`/v2/offers/${routeId}/decline`, {}));

export const fetchPendingAtStore = async (routeId: number, stopId: number) =>
  unwrap<{ deliveries: PendingDelivery[] }>(await getJson(`/v2/routes/${routeId}/stops/${stopId}/pending`)).deliveries;
