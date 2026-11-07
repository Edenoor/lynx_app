// src/Presentation/views/driver/Envios/deliveryState.ts
// Estado de un envío para la pantalla Envíos. Manda ops_status (el ciclo
// operativo de Lynx); si falta, status_ml (lo que dice Mercado Libre), que
// llega en inglés o en español según la época del dato. Solo DELIVERED y
// CANCELLED cierran el envío: NOT_DELIVERED queda abierto y pide resolución.
// NOT_DELIVERED es custodia del chofer: solo es «No entregado» (un intento)
// si Mercado Libre lo dice; si no, «Sin entregar». Solo lee: nunca corrige el backend.
// Sin React: se prueba con node.

export type DeliveryPhase = "delivered" | "cancelled" | "notDelivered" | "inProgress";

export type DeliveryState = {
  phase: DeliveryPhase;
  label: string;
  finished: boolean;
  attention: boolean;
  // mismatch: Lynx y Mercado Libre no coinciden; unknown: ops_status desconocido.
  issue: "mismatch" | "unknown" | null;
};

type DeliveryStatusFields = {
  ops_status?: string | null;
  status_ml?: string | null;
  status?: string | null;
  estado?: string | null;
  delivery_status?: string | null;
  estado_actual?: string | null;
};

export const REVIEW_LABEL = "Revisar estado";

const OPS_OPEN_LABELS: Record<string, string> = {
  ENTERED: "Ingresado",
  COLLECTED: "Colectado",
  ARRIVED_WAREHOUSE: "En planta",
  SHELVED: "En planta",
  ASSIGNED_TO_ROUTE: "Asignado a recorrido",
  OUT_FOR_DELIVERY: "En camino",
};

const ML_OPEN_LABELS: Record<string, string> = {
  ready_to_ship: "Listo para enviar",
  shipped: "En camino",
};

const PHASE_LABELS: Record<Exclude<DeliveryPhase, "inProgress">, string> = {
  delivered: "Entregado",
  cancelled: "Cancelado",
  notDelivered: "No entregado",
};

const normalize = (value?: string | null) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// «No entregado» contiene «entregado»: se descarta antes.
function providerPhase(raw?: string | null): DeliveryPhase {
  const s = normalize(raw);
  if (/not_delivered|no entregado|nadie|reprogram/.test(s)) return "notDelivered";
  if (s.includes("delivered") || s.includes("entregado")) return "delivered";
  if (s.includes("cancel")) return "cancelled";
  return "inProgress";
}

const build = (phase: DeliveryPhase, label: string, issue: DeliveryState["issue"] = null): DeliveryState => ({
  phase,
  label: issue ? REVIEW_LABEL : label,
  finished: phase === "delivered" || phase === "cancelled",
  attention: phase === "cancelled" || phase === "notDelivered" || issue !== null,
  issue,
});

export function classifyDelivery(item: DeliveryStatusFields): DeliveryState {
  const provider =
    item.status_ml || item.status || item.estado || item.delivery_status || item.estado_actual || "";
  const ml = String(provider).trim();
  const mlPhase = providerPhase(ml);
  const ops = String(item.ops_status || "").trim().toUpperCase();

  if (!ops) {
    if (mlPhase !== "inProgress") return build(mlPhase, PHASE_LABELS[mlPhase]);
    return build("inProgress", ML_OPEN_LABELS[normalize(ml)] ?? (ml || "En curso"));
  }

  if (ops === "DELIVERED" || ops === "CANCELLED") {
    const phase = ops === "DELIVERED" ? "delivered" : "cancelled";
    const clash = mlPhase !== "inProgress" && mlPhase !== phase;
    return build(phase, PHASE_LABELS[phase], clash ? "mismatch" : null);
  }

  // Mercado Libre cerró el envío y Lynx lo tiene abierto.
  const mlClosed = mlPhase === "delivered" || mlPhase === "cancelled";

  if (ops === "NOT_DELIVERED") {
    const label = mlPhase === "notDelivered" ? PHASE_LABELS.notDelivered : "Sin entregar";
    return build("notDelivered", label, mlClosed ? "mismatch" : null);
  }

  const openLabel = OPS_OPEN_LABELS[ops];
  if (!openLabel) return build("inProgress", REVIEW_LABEL, "unknown");
  return build("inProgress", openLabel, mlClosed ? "mismatch" : null);
}

// Clave de la fila: en /v2/drivers/:id/deliveries `id` es el de
// delivery_status; el envío es delivery_id.
export function deliveryKey(
  item: { delivery_id?: string | number | null; id?: string | number | null; numero_tracking?: string | null },
  index: number
): string {
  if (item.delivery_id !== undefined && item.delivery_id !== null && item.delivery_id !== "") {
    return `d${item.delivery_id}`;
  }
  return `${item.id ?? item.numero_tracking ?? "nt"}-${index}`;
}
