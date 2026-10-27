// src/Presentation/config/pushKind.ts
// Qué tipo de aviso es un push, a partir de lo que manda el servidor. El
// servidor copia `type` dentro de `data` (utils/pushData.js); para pushes
// viejos sin `type` quedan las reglas por los datos que traen.

export type NotiKind =
  | "NEW_TRAD"
  | "TRAD_ACCEPTED"
  | "ASIGNACION"
  | "DRIVER_ASIGNADO"
  | "ASSIGNMENT_ACCEPTED"
  | "ASSIGNMENT_REJECTED"
  | "ROUTE_CONFIRMATION"
  | "TURBO_OFFER"
  // Recorridos (data.routeId): colecta asignada / quitada, cambios en un
  // recorrido y recorrido ofrecido por el coordinador (no es un Turbo).
  | "PICKUP_ASSIGNED"
  | "PICKUP_REASSIGNED"
  | "ROUTE_UPDATED"
  | "ROUTE_OFFER"
  | "INFO"
  | "ALERT";

const EXPLICIT: NotiKind[] = [
  "NEW_TRAD",
  "TRAD_ACCEPTED",
  "ASIGNACION",
  "DRIVER_ASIGNADO",
  "ASSIGNMENT_ACCEPTED",
  "ASSIGNMENT_REJECTED",
  "ROUTE_CONFIRMATION",
  "TURBO_OFFER",
  "PICKUP_ASSIGNED",
  "PICKUP_REASSIGNED",
  "ROUTE_UPDATED",
  "ROUTE_OFFER",
];

// Avisos que abren un recorrido (data.routeId). ROUTE_CONFIRMATION es el
// pedido de confirmar una colecta habitual.
export type RouteNoticeKind = "PICKUP_ASSIGNED" | "PICKUP_REASSIGNED" | "ROUTE_UPDATED" | "ROUTE_OFFER" | "ROUTE_CONFIRMATION";
const ROUTE_NOTICES = new Set<NotiKind>(["PICKUP_ASSIGNED", "PICKUP_REASSIGNED", "ROUTE_UPDATED", "ROUTE_OFFER", "ROUTE_CONFIRMATION"]);
export const isRouteNotice = (kind: NotiKind): kind is RouteNoticeKind => ROUTE_NOTICES.has(kind);

export function normalizeKind(type?: unknown, data?: any, title?: string | null): NotiKind {
  const normalized = String(type ?? "").toUpperCase().trim();
  const titleNormalized = String(title ?? "").toUpperCase().trim();

  const explicit = EXPLICIT.find((k) => k === normalized);
  if (explicit) return explicit;

  // Sin `type`: una oferta trae offerId y routeId. La de un recorrido trae
  // además `kind` (ADMIN/SHELF); la de un Turbo, no.
  if (data?.offerId != null && data?.routeId != null) {
    const offerKind = String(data?.kind ?? "").toUpperCase();
    return offerKind && offerKind !== "TURBO" ? "ROUTE_OFFER" : "TURBO_OFFER";
  }
  if (data?.template_name != null && data?.routeId != null) return "ROUTE_CONFIRMATION";

  if (data?.deliveryId && titleNormalized.includes("NUEVO ENVÍO ASIGNADO")) return "ASIGNACION";

  if (normalized.includes("REJECT")) return "ASSIGNMENT_REJECTED";
  if (normalized.includes("ACCEPT")) return "ASSIGNMENT_ACCEPTED";
  if (normalized.includes("ALERT")) return "ALERT";

  return "INFO";
}

export const routeIdOf = (data: any): number | null => {
  const n = Number(data?.routeId ?? data?.route_id);
  return Number.isInteger(n) && n > 0 ? n : null;
};
