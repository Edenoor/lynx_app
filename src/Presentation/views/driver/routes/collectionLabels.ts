// src/Presentation/views/driver/routes/collectionLabels.ts
// Textos de colectas que ve el chofer. Nunca «ronda» ni nombres internos
// (PICKUP, ROUTE_CONFIRMATION). Sin React: se prueba con node.

import type { PickupAnswer } from "./pickupConfirmation";
import type { StatusKey } from "../../../theme/createTheme";

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const dayNumber = (iso: string) => Math.round(Date.parse(`${iso.slice(0, 10)}T12:00:00Z`) / 86_400_000);

// «hoy, lunes 26/10», «mañana, martes 27/10» o «jueves 29/10». Se calcula
// contra la fecha del teléfono al mostrarlo, no cuando llegó el aviso.
export function executionDayLabel(iso: string, todayIso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  const date = `${WEEKDAYS[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const diff = dayNumber(iso) - dayNumber(todayIso);
  return diff === 0 ? `hoy, ${date}` : diff === 1 ? `mañana, ${date}` : date;
}

export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Las colectas que salen de una plantilla tienen nombre y son habituales; las
// armadas a mano por el coordinador, extraordinarias.
export const collectionName = (r: { id: number; template_name?: string | null }) => r.template_name || `Colecta #${r.id}`;
export const collectionKindLabel = (r: { template_id?: number | null }) => (r.template_id ? "Habitual" : "Extraordinaria");

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const COLLECTION_STATUS_LABEL: Record<string, string> = {
  PLANNED: "Planificada", ASSIGNED: "Asignada", LOADED: "Cargada", IN_PROGRESS: "En curso", COMPLETED: "Completada", CANCELLED: "Cancelada",
};

// Tono del estado en la lista de colectas. Mismo criterio de color que antes
// (pendiente; rechazada o cancelada; el resto, positivo), con la colecta en
// curso como «en camino». Solo presentación: el estado lo decide el servidor.
export function collectionStatusKey(status: string, answer: PickupAnswer | null): StatusKey {
  if (answer === "PENDING") return "pending";
  if (answer === "DECLINED") return "rejected";
  if (status === "CANCELLED") return "cancelled";
  if (answer === null && status === "IN_PROGRESS") return "inTransit";
  return "confirmed";
}

// Aviso de confirmación (ROUTE_CONFIRMATION). El servidor arma el texto con
// «Ronda … hoy/mañana» y «Confirmá desde Rutas»; acá se rearma con los datos
// que trae (template_name, scheduled_date, departure_time, stops_count).
export function confirmationNoticeText(data: any, todayIso: string): { title: string; body: string } {
  const name = data?.template_name ? String(data.template_name) : null;
  const day = data?.scheduled_date ? executionDayLabel(String(data.scheduled_date), todayIso) : "";
  const time = data?.departure_time ? `sale ${String(data.departure_time).slice(0, 5)}` : "";
  const stops = Number(data?.stops_count);
  const parts = [capitalize(day), time, Number.isInteger(stops) && stops > 0 ? plural(stops, "tienda", "tiendas") : ""].filter(Boolean);
  return {
    title: name ? `Confirmá tu colecta ${name}` : "Confirmá tu colecta",
    body: parts.length ? `${parts.join(" · ")}. Confirmá desde Colectas si podés hacerla.` : "Confirmá desde Colectas si podés hacerla.",
  };
}

// «Cómo llegar» en Google Maps: por coordenadas si están, si no por dirección.
export function directionsUrl(p: { latitude?: number | string | null; longitude?: number | string | null; address?: string | null }): string | null {
  const lat = Number(p.latitude);
  const lng = Number(p.longitude);
  if (p.latitude != null && p.longitude != null && Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  const address = p.address?.trim();
  return address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}` : null;
}
