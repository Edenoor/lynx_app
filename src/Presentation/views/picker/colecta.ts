// src/Presentation/views/picker/colecta.ts
// Recepción por colecta (Control 3): totales, estado de recepción, búsqueda y
// cómo se muestra la atribución de cada paquete. Sin React: se prueba con node.
// Los números salen del servidor. `recibido` del contrato cuenta paquetes
// ATRIBUIDOS a la parada, no los que entraron físicamente: acá se llama
// «atribuidos» y no se calcula ningún conteo físico.

import { COLLECTION_STATUS_LABEL } from "../driver/routes/collectionLabels";
import { normalizeSearch } from "../driver/routes/stopSearch";
import type { Colecta, ColectaAttribution, ColectaStop } from "./warehouseApi";

export const STOP_RECEPTION_LABEL: Record<string, string> = {
  PENDIENTE: "Recepción abierta",
  CORRECTA: "Cerrada: correcta",
  DIFERENCIA: "Cerrada: con diferencia",
};
export const stopReceptionLabel = (status: string) => STOP_RECEPTION_LABEL[status] ?? status;
export const stopIsClosed = (s: ColectaStop) => s.reception_status !== "PENDIENTE";

export const colectaStatusLabel = (status: string) => COLLECTION_STATUS_LABEL[status] ?? status;

export type ColectaTotals = { stores: number; declared: number; undeclared: number; attributed: number };
export function colectaTotals(c: Colecta): ColectaTotals {
  let declared = 0;
  let undeclared = 0;
  let attributed = 0;
  for (const s of c.stops) {
    if (typeof s.declarado === "number") declared += s.declarado;
    else undeclared++;
    attributed += s.recibido;
  }
  return { stores: c.stops.length, declared, undeclared, attributed };
}

// Estado de la recepción de la colecta, solo a partir del estado de cada
// parada (el servidor cierra por parada; no hay cierre de colecta).
export type ColectaReception = { kind: "open" | "partial" | "closed"; label: string };
export function colectaReception(c: Colecta): ColectaReception {
  const closed = c.stops.filter(stopIsClosed);
  if (c.stops.length && closed.length === c.stops.length) {
    const diff = closed.some((s) => s.reception_status === "DIFERENCIA");
    return { kind: "closed", label: diff ? "Recepción cerrada con diferencias" : "Recepción cerrada" };
  }
  if (closed.length) return { kind: "partial", label: `Recepción cerrada en ${closed.length} de ${c.stops.length} tiendas` };
  return { kind: "open", label: "Recepción abierta" };
}

// Por nombre de la colecta o de alguna de sus tiendas, sin mayúsculas ni acentos.
export function searchColectas(list: Colecta[], query: string): Colecta[] {
  const q = normalizeSearch(query);
  if (!q) return list;
  const has = (v: string | null) => normalizeSearch(v).includes(q);
  return list.filter((c) => has(c.name) || c.stops.some((s) => has(s.store_name)));
}

// AAAA-MM-DD → DD/MM/AAAA, sin pasar por Date (no cambia de día por la zona).
export const dayLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

// La colecta elegida, buscada en la lista del día por su id.
export const findColecta = (list: Colecta[], routeId: number) => list.find((c) => c.route_id === routeId) ?? null;

export const stopName =(s: Pick<ColectaStop, "store_name" | "store_id">) => s.store_name || `Tienda #${s.store_id}`;

// «12 de 47» o, sin cantidad declarada, «12 atribuidos».
export const progressText = (attributed: number, declared: number | null | undefined) =>
  typeof declared === "number" ? `${attributed} de ${declared}` : `${attributed} atribuidos (sin declarar)`;

// Actualiza la parada con lo que el servidor confirmó al atribuir. Solo
// ATRIBUIDO y YA_CONTADO traen la foto de la parada; el resto no cambia nada.
export function applyAttribution(c: Colecta, a: ColectaAttribution | null | undefined): Colecta {
  if (!a || (a.status !== "ATRIBUIDO" && a.status !== "YA_CONTADO")) return c;
  if (a.route_id !== undefined && a.route_id !== c.route_id) return c;
  const i = c.stops.findIndex((s) => s.route_stop_id === a.route_stop_id);
  if (i < 0) return c;
  const s = c.stops[i];
  const next: ColectaStop = {
    ...s,
    recibido: typeof a.recibido === "number" ? a.recibido : s.recibido,
    reception_status: typeof a.reception_status === "string" ? a.reception_status : s.reception_status,
  };
  return { ...c, stops: c.stops.map((x, j) => (j === i ? next : x)) };
}

// Lo que agrega la atribución a la tarjeta del escaneo. Nunca cambia el color
// ni el título: la recepción física ya tiene su resultado; si no se sumó a la
// colecta, es un aviso.
export function attributionNotice(a: ColectaAttribution | null | undefined): { line: string | null; warning: string | null } {
  if (!a) return { line: null, warning: "El servidor no confirmó la atribución: no se sumó a la colecta." };
  const store = a.store_name || "la tienda";
  const count = typeof a.recibido === "number" ? progressText(a.recibido, a.declarado) : null;
  switch (a.status) {
    case "ATRIBUIDO":
      return { line: `Atribuido a ${store}${count ? `: ${count}` : ""}`, warning: null };
    case "YA_CONTADO":
      return { line: `Ya estaba atribuido a ${store}${count ? ` (${count})` : ""}`, warning: null };
    case "RECHAZADO":
      return { line: null, warning: `No se sumó a la colecta: ${a.text || a.reason || "el servidor lo rechazó"}.` };
    case "ERROR":
      return { line: null, warning: `No se sumó a la colecta: ${a.text || "error al atribuir"}.` };
    default:
      return { line: null, warning: "El servidor no confirmó la atribución: no se sumó a la colecta." };
  }
}
