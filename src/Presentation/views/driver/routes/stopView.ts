// src/Presentation/views/driver/routes/stopView.ts
// Qué muestra una parada y qué se puede hacer en ella, según lo que dice el
// servidor de cada envío. Módulo puro (sin React Native) para probarlo con node.
//
// Tres cosas distintas, cada una con su fuente:
// - resultado del envío: route_stop_deliveries.outcome (y ops_status del envío);
// - estado de la parada: route_stops.status (lo cierra el chofer con «done»);
// - estado del recorrido: routes.status.
// Mercado Libre cierra los Flex en el servidor (ops_status DELIVERED y outcome)
// pero no cierra la parada: por eso una parada puede seguir «Pendiente» con
// todos sus envíos entregados. En un reparto el servidor la cierra sola al
// finalizar el recorrido (closesOnFinish); acá no se cierra nada sola.

import type { Stop, StopDelivery } from "./routesApi";

export const OPS_LABEL: Record<string, string> = {
  ENTERED: "Ingresado", COLLECTED: "Colectado", ARRIVED_WAREHOUSE: "En planta", SHELVED: "Estanteado", ASSIGNED_TO_ROUTE: "En recorrido",
  OUT_FOR_DELIVERY: "En calle", DELIVERED: "Entregado", NOT_DELIVERED: "No entregado", CANCELLED: "Cancelado",
};

// Terminales del envío: no admiten otro resultado (el servidor responde 409).
const TERMINAL_OPS = ["DELIVERED", "CANCELLED"];

const OUTCOME_LABEL: Record<string, string> = { DELIVERED: "Entregado", NOT_DELIVERED: "No entregado", RETURNED: "Devuelto" };

export const deliveryResolved = (d: Pick<StopDelivery, "outcome" | "ops_status">) =>
  !!d.outcome || TERMINAL_OPS.includes(String(d.ops_status ?? "").toUpperCase());

// Entregado: lo registró el chofer o lo confirmó Mercado Libre (el servidor
// pasa el envío a DELIVERED aunque antes se hubiera cargado otro resultado).
export const deliveryDelivered = (d: Pick<StopDelivery, "outcome" | "ops_status">) =>
  d.outcome === "DELIVERED" || String(d.ops_status ?? "").toUpperCase() === "DELIVERED";

// Un solo estado por envío: entregado si figura entregado; si no, el
// resultado en la parada si lo hay; si no, el operativo. Nunca «Entregado · entregado».
export function deliveryStatusLabel(d: Pick<StopDelivery, "outcome" | "ops_status">): string {
  const ops = String(d.ops_status ?? "").toUpperCase();
  if (deliveryDelivered(d)) return OUTCOME_LABEL.DELIVERED;
  if (d.outcome) return OUTCOME_LABEL[d.outcome] ?? d.outcome;
  return OPS_LABEL[ops] ?? d.ops_status ?? "Sin estado";
}

// ---------- Reparto: qué ve el chofer de cada envío ----------

// Mercado Libre gobierna el resultado: el chofer lo cierra en Envíos Flex, no
// en Lynx. `provider` lo calcula el servidor (cuenta de ML o referencia de ML);
// `tipo_envio` flex queda para un servidor que todavía no manda `provider`.
export const providerGoverned = (d: Pick<StopDelivery, "provider" | "tipo_envio">) =>
  d.provider === "mercadolibre" || String(d.tipo_envio ?? "").toLowerCase() === "flex";

// status_ml (el estado de ML que guardó el poller) llega crudo o traducido;
// los mismos valores que reconoce el servidor (opsService.js).
const ML_STATE: Record<string, "delivered" | "not_delivered" | "cancelled" | "shipped"> = {
  delivered: "delivered", Entregado: "delivered",
  not_delivered: "not_delivered", "No entregado": "not_delivered",
  cancelled: "cancelled", Cancelado: "cancelled",
  shipped: "shipped", "En camino": "shipped",
};

export type DeliveryTone = "delivered" | "failed" | "cancelled" | "transit" | "pending";
export type DeliveryView = { label: string; final: boolean; tone: DeliveryTone };

// El estado real de un envío, para la lista: nunca el de la parada. Lo
// desconocido queda «Pendiente» y no se da por terminado.
export function deliveryView(d: Pick<StopDelivery, "outcome" | "ops_status" | "status_ml">): DeliveryView {
  const ops = String(d.ops_status ?? "").toUpperCase();
  const ml = d.status_ml ? ML_STATE[d.status_ml] : undefined;
  if (ops === "DELIVERED" || d.outcome === "DELIVERED" || ml === "delivered") return { label: "Entregado", final: true, tone: "delivered" };
  if (ops === "CANCELLED" || ml === "cancelled") return { label: "Cancelado", final: true, tone: "cancelled" };
  if (d.outcome === "RETURNED") return { label: "Devuelto", final: true, tone: "failed" };
  if (d.outcome === "NOT_DELIVERED" || ops === "NOT_DELIVERED" || ml === "not_delivered") return { label: "No entregado", final: true, tone: "failed" };
  if (ops === "OUT_FOR_DELIVERY" || ml === "shipped") return { label: "En camino", final: false, tone: "transit" };
  return { label: "Pendiente", final: false, tone: "pending" };
}

// Una parada de reparto está terminada cuando la cerraron (cerrada o salteada)
// o cuando todos sus envíos tienen un resultado final. Sin envíos no: el
// servidor no la cierra sola y pide cerrarla a mano.
export function stopFinished(s: Pick<Stop, "status" | "deliveries">): boolean {
  if (s.status === "DONE" || s.status === "SKIPPED") return true;
  return s.deliveries.length > 0 && s.deliveries.every((d) => deliveryView(d).final);
}

// Lista del reparto: pendientes y terminadas, cada una en orden de visita.
// Es solo cómo se muestra: el orden guardado (sequence) no cambia.
export function splitStops<S extends Pick<Stop, "sequence" | "status" | "deliveries">>(stops: S[]): { pending: S[]; finished: S[] } {
  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);
  return { pending: ordered.filter((s) => !stopFinished(s)), finished: ordered.filter(stopFinished) };
}

// «12 envíos · 8 pendientes · 4 finalizados» (por envío, no por parada).
export function routeProgress(stops: Pick<Stop, "deliveries">[]): { total: number; pending: number; finished: number } {
  const all = stops.flatMap((s) => s.deliveries);
  const finished = all.filter((d) => deliveryView(d).final).length;
  return { total: all.length, pending: all.length - finished, finished };
}

// El estado en el encabezado de la parada: el de su envío; con varios, cuántos
// hay en cada estado («Entregado: 1 · En camino: 1»). Llegada y salteo van
// adelante porque son de la parada, no de los envíos.
export function stopStateLabel(s: Pick<Stop, "status" | "deliveries">): string {
  const counts = new Map<string, number>();
  for (const d of s.deliveries) { const l = deliveryView(d).label; counts.set(l, (counts.get(l) ?? 0) + 1); }
  const deliveries = s.deliveries.length === 1 ? deliveryView(s.deliveries[0]).label
    : s.deliveries.length ? [...counts].map(([l, n]) => `${l}: ${n}`).join(" · ") : "Sin envíos";
  const prefix = s.status === "ARRIVED" ? "Llegaste" : s.status === "SKIPPED" ? "Salteada" : null;
  return prefix ? `${prefix} · ${deliveries}` : deliveries;
}

// Paradas terminadas que el servidor no cierra solo al finalizar (un cancelado
// o un no entregado de Mercado Libre, sin resultado cargado): la app las
// cierra antes de completar, como haría el chofer con «Cerrar parada».
export function stopsToCloseOnFinish<S extends Pick<Stop, "type" | "status" | "deliveries">>(stops: S[], routeType: string): S[] {
  if (routeType !== "DELIVERY") return [];
  return stops.filter((s) => (s.status === "PENDING" || s.status === "ARRIVED") && stopFinished(s) && !closesOnFinish(s, routeType));
}

// Envíos de Mercado Libre de la parada que ML todavía no cerró.
export const awaitingProvider = (s: Pick<Stop, "deliveries">) => s.deliveries.filter((d) => providerGoverned(d) && !deliveryView(d).final);

// Pendientes arriba; lo resuelto va a «Envíos cerrados», en el mismo orden.
export function splitDeliveries<D extends Pick<StopDelivery, "outcome" | "ops_status">>(deliveries: D[]): { pending: D[]; closed: D[] } {
  return { pending: deliveries.filter((d) => !deliveryResolved(d)), closed: deliveries.filter(deliveryResolved) };
}

// La misma regla con la que el servidor cierra la parada al finalizar un
// reparto: abierta, con envíos, y cada uno con resultado o entregado. Un
// cancelado sin resultado no alcanza (la parada sigue pidiendo cerrarla).
export function closesOnFinish(s: Pick<Stop, "type" | "status" | "deliveries">, routeType: string): boolean {
  if (routeType !== "DELIVERY" || s.type !== "DELIVERY") return false;
  if (s.status !== "PENDING" && s.status !== "ARRIVED") return false;
  return s.deliveries.length > 0 && s.deliveries.every((d) => !!d.outcome || deliveryDelivered(d));
}

// «Finalizar recorrido» se habilita con cada parada cerrada o que el servidor
// cierra sola al finalizar.
// En un reparto alcanza con que cada parada esté terminada (stopsToCloseOnFinish
// cierra las que el servidor no cierra solo).
export function routeCanFinish(r: { type: string; stops: Pick<Stop, "type" | "status" | "deliveries">[] }): boolean {
  if (r.type === "DELIVERY") return r.stops.every(stopFinished);
  return r.stops.every((s) => s.status === "DONE" || s.status === "SKIPPED" || closesOnFinish(s, r.type));
}

// Dirección como título de una entrega; el destinatario va abajo.
export function stopAddress(s: Pick<Stop, "type" | "address" | "store_address" | "deliveries">): string {
  if (s.type === "PICKUP") return s.store_address?.trim() || "Dirección de la tienda sin informar";
  return s.address?.trim() || s.deliveries.find((d) => d.direccion?.trim())?.direccion?.trim() || "Dirección sin informar";
}

// «Belgrano 1234, CP 1425»: lo que se manda a Maps cuando no hay coordenadas.
export function stopMapsAddress(s: Pick<Stop, "type" | "address" | "postal_code" | "store_address" | "deliveries">): string | null {
  const address = stopAddress(s);
  if (/sin informar$/.test(address)) return null;
  return s.type === "DELIVERY" && s.postal_code ? `${address}, CP ${s.postal_code}` : address;
}

export type StopSummary = { total: number; resolved: number; delivered: number; pending: number; allResolved: boolean };

export function stopSummary(s: Pick<Stop, "deliveries">): StopSummary {
  const total = s.deliveries.length;
  const resolved = s.deliveries.filter(deliveryResolved).length;
  const delivered = s.deliveries.filter((d) => d.outcome === "DELIVERED" || String(d.ops_status).toUpperCase() === "DELIVERED").length;
  return { total, resolved, delivered, pending: total - resolved, allResolved: total > 0 && resolved === total };
}

// «2 paquetes · 1 entregado · 1 pendiente».
export function stopPackagesLabel(sum: StopSummary): string {
  const parts = [`${sum.total} ${sum.total === 1 ? "paquete" : "paquetes"}`];
  if (sum.delivered) parts.push(`${sum.delivered} ${sum.delivered === 1 ? "entregado" : "entregados"}`);
  if (sum.resolved - sum.delivered) parts.push(`${sum.resolved - sum.delivered} sin entregar`);
  if (sum.pending && sum.pending !== sum.total) parts.push(`${sum.pending} ${sum.pending === 1 ? "pendiente" : "pendientes"}`);
  return parts.join(" · ");
}

export type StopActions = {
  arrive: boolean;
  close: boolean;
  skip: boolean;
  // Todos los envíos ya están resueltos y la parada sigue abierta.
  resolvedButOpen: boolean;
};

// Entrega (DELIVERY) o Turbo; las colectas siguen su propio flujo.
export function stopActions(s: Pick<Stop, "type" | "status" | "deliveries">, inProgress: boolean): StopActions {
  const closed = s.status === "DONE" || s.status === "SKIPPED";
  const sum = stopSummary(s);
  const open = inProgress && !closed;
  const isPickup = s.type === "PICKUP";
  // Saltear dice que no se visitó: no va si algún envío ya se entregó.
  const anyDelivered = sum.delivered > 0;
  const resolvedButOpen = !isPickup && open && sum.allResolved;
  return {
    arrive: open && s.status === "PENDING" && !resolvedButOpen,
    close: open && (s.status === "ARRIVED" || (!isPickup && s.status === "PENDING")),
    skip: open && !anyDelivered && !resolvedButOpen,
    resolvedButOpen,
  };
}

// ---------- Recorrido en el mapa ----------

export type MapPoint = { stopId: number; sequence: number; latitude: number; longitude: number; title: string; closed: boolean };

const coord = (v: unknown) => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) ? n : null;
};

// Las paradas con coordenadas, en orden de visita. Las coordenadas de una
// entrega son las que el servidor guardó al armar la parada; sin ellas la
// parada no se dibuja (no se inventa un punto) y se cuenta aparte.
export function routeMapPoints(stops: Stop[]): { points: MapPoint[]; missing: number } {
  const points: MapPoint[] = [];
  let missing = 0;
  for (const s of [...stops].sort((a, b) => a.sequence - b.sequence)) {
    const lat = coord(s.type === "PICKUP" ? s.latitude_snapshot ?? s.latitude : s.latitude);
    const lng = coord(s.type === "PICKUP" ? s.longitude_snapshot ?? s.longitude : s.longitude);
    if (lat === null || lng === null || (lat === 0 && lng === 0)) { missing++; continue; }
    points.push({
      stopId: s.id, sequence: s.sequence, latitude: lat, longitude: lng,
      title: s.type === "PICKUP" ? `Retiro · ${s.store_name ?? s.warehouse_name ?? "tienda"}` : stopAddress(s),
      closed: s.status === "DONE" || s.status === "SKIPPED",
    });
  }
  return { points, missing };
}
