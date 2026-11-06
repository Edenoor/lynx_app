// src/Presentation/views/driver/turbo/scheduledList.ts
// Turbos de mañana: filtro por tienda, orden y la promesa de entrega de cada
// uno. Módulo puro (sin React Native) para probarlo con node.
//
// Lo que manda el servidor (GET /v2/turbo/scheduled/available): sin store_id
// ni coordenadas, así que la tienda se identifica por su nombre y no hay orden
// por cercanía. «Mis tiendas» son los que le ofrecieron como chofer de la
// tienda (offered_to_me): el servidor no expone otra relación chofer-tienda.
// Filtrar es solo la vista: quién puede tomar cada uno lo decide el servidor.
//
// Promesa de entrega: la franja de Mercado Libre (window_start_at → deadline_at)
// del día del recorrido (scheduled_date). No es la hora de retiro.

import type { ScheduledTurbo } from "./turboApi";
import { capitalize, executionDayLabel } from "../routes/collectionLabels";

export type StoreFilter = { kind: "all" } | { kind: "mine" } | { kind: "store"; name: string };
export type ScheduledSort = "promise" | "store";

type Item = Pick<ScheduledTurbo, "route_id" | "scheduled_date" | "window_start_at" | "deadline_at" | "store_name" | "offered_to_me">;

export const storeName = (t: Pick<ScheduledTurbo, "store_name">) => t.store_name?.trim() || "Tienda sin nombre";

// Las tiendas de la lista, por nombre.
export const storesOf = (turbos: Item[]): string[] =>
  [...new Set(turbos.map(storeName))].sort((a, b) => a.localeCompare(b, "es"));

export const hasMine = (turbos: Item[]) => turbos.some((t) => t.offered_to_me);

export function filterScheduled<T extends Item>(turbos: T[], f: StoreFilter): T[] {
  if (f.kind === "mine") return turbos.filter((t) => t.offered_to_me);
  if (f.kind === "store") return turbos.filter((t) => storeName(t) === f.name);
  return turbos;
}

// Lo que se compara para ordenar por promesa: el inicio de la franja, o su
// fin, o el día. Sin dato, al final.
const promiseKey = (t: Item) => t.window_start_at || t.deadline_at || (t.scheduled_date ? `${t.scheduled_date.slice(0, 10)}T23:59:59` : "￿");
const byPromise = (a: Item, b: Item) => {
  const ka = Date.parse(promiseKey(a));
  const kb = Date.parse(promiseKey(b));
  if (Number.isNaN(ka) || Number.isNaN(kb)) return Number.isNaN(ka) ? (Number.isNaN(kb) ? a.route_id - b.route_id : 1) : -1;
  return ka - kb || a.route_id - b.route_id;
};

export function sortScheduled<T extends Item>(turbos: T[], sort: ScheduledSort): T[] {
  const out = [...turbos];
  if (sort === "store") return out.sort((a, b) => storeName(a).localeCompare(storeName(b), "es") || byPromise(a, b));
  return out.sort(byPromise);
}

// «Mañana, viernes 06/11 · 09:00 a 12:00». Sin franja, solo el día.
export function promiseText(t: Item, todayIso: string, hora: (iso: string) => string | null): string {
  const day = t.scheduled_date ? capitalize(executionDayLabel(t.scheduled_date, todayIso)) : "";
  const desde = t.window_start_at ? hora(t.window_start_at) : null;
  const hasta = t.deadline_at ? hora(t.deadline_at) : null;
  const franja = desde && hasta ? `${desde} a ${hasta}` : hasta ? `antes de las ${hasta}` : "";
  return [day, franja].filter(Boolean).join(" · ") || "Sin promesa informada";
}
