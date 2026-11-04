// src/Presentation/views/driver/work/driverWork.ts
// El trabajo del chofer armado a partir de los recorridos que ya existen
// (/v2/routes y los grupos Turbo): a qué modalidad pertenece cada recorrido,
// cuáles siguen abiertos y, de los que están en la calle, la «misión activa»
// (qué sigue, cuánto falta y a qué pantalla se entra). No hay entidad Mission:
// es una vista sobre RouteSummary, RouteDetail y TurboGroup.
// Módulo puro (sin React Native) para probarlo con node.

import type { RouteDetail, RouteStatus, RouteSummary, Stop } from "../routes/routesApi";
import type { TurboGroup } from "../turbo/turboApi";
import { deliveryClosed, groupTitle } from "../turbo/turboGroup";

// Colecta (PICKUP) tiene su pestaña; «otro» es un tipo que esta versión de la
// app no conoce: se muestra igual como misión, sin suponer que es Turbo o Flex.
export type Modality = "turbo" | "flex" | "colecta" | "otro";

export function routeModality(r: Pick<RouteSummary, "type">): Modality {
  const type = String(r.type ?? "").toUpperCase();
  if (type === "TURBO") return "turbo";
  if (type === "DELIVERY") return "flex";
  if (type === "PICKUP") return "colecta";
  return "otro";
}

const CLOSED: RouteStatus[] = ["COMPLETED", "CANCELLED"];
export const isOpenRoute = (r: Pick<RouteSummary, "status">) => !CLOSED.includes(r.status);
export const isRunning = (r: Pick<RouteSummary, "status">) => r.status === "IN_PROGRESS";

// ---------- Fechas ----------

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Días anteriores a `today`, del más nuevo al más viejo: [ayer, anteayer, …].
export const previousDays = (today: string, count: number) => Array.from({ length: count }, (_, i) => shift(today, -(i + 1)));

// Días de un rango (incluidos los extremos), en orden.
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = shift(d, 1)) out.push(d);
  return out;
}

// «hoy», «ayer» o «lunes 2/11».
export function dayLabel(iso: string, today: string): string {
  if (iso === today) return "hoy";
  if (iso === shift(today, -1)) return "ayer";
  if (iso === shift(today, 1)) return "mañana";
  const d = new Date(`${iso}T12:00:00Z`);
  const weekday = d.toLocaleDateString("es-AR", { weekday: "long", timeZone: "UTC" });
  return `${weekday} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

// Período de una vista de historial. «all»: sin filtro de fecha.
export type Period = { kind: "all" } | { kind: "today" } | { kind: "yesterday" } | { kind: "range"; from: string; to: string };

// Días que abarca (null = todos). Un rango al revés se da vuelta.
export function periodDays(p: Period, today: string): string[] | null {
  if (p.kind === "all") return null;
  if (p.kind === "today") return [today];
  if (p.kind === "yesterday") return [shift(today, -1)];
  return p.from <= p.to ? daysBetween(p.from, p.to) : daysBetween(p.to, p.from);
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export function periodLabel(p: Period): string {
  if (p.kind === "all") return "Todo";
  if (p.kind === "today") return "Hoy";
  if (p.kind === "yesterday") return "Ayer";
  return p.from === p.to ? ddmm(p.from) : `${ddmm(p.from)} → ${ddmm(p.to)}`;
}

// ---------- Recorridos abiertos ----------

// Junta las listas de varios días sin repetir y deja primero lo más viejo:
// un recorrido que quedó abierto de otro día es el que más urge cerrar.
export function mergeOpenRoutes(lists: RouteSummary[][]): RouteSummary[] {
  const byId = new Map<number, RouteSummary>();
  for (const list of lists) for (const r of list) if (isOpenRoute(r) && !byId.has(r.id)) byId.set(r.id, r);
  return [...byId.values()].sort((a, b) =>
    a.scheduled_date === b.scheduled_date ? a.id - b.id : a.scheduled_date < b.scheduled_date ? -1 : 1
  );
}

// Envíos que el servidor ya puso en un recorrido y siguen abiertos: si los hay
// y no aparece ningún recorrido abierto en los días revisados, hay trabajo
// pendiente más atrás (o el recorrido no se pudo leer).
const IN_ROUTE_OPS = new Set(["ASSIGNED_TO_ROUTE", "OUT_FOR_DELIVERY"]);
export const deliveriesInRoute = (rows: { [key: string]: unknown }[]) =>
  rows.filter((r) => IN_ROUTE_OPS.has(String(r?.ops_status ?? "").toUpperCase())).length;

// ---------- Listas por modalidad ----------

export type WorkItem = { kind: "group"; group: TurboGroup } | { kind: "route"; route: RouteSummary };

// Turbo en curso: los grupos del día que no terminaron y los Turbos abiertos
// que no van en uno de esos grupos. Lo programado para después de hoy queda
// para el bloque de mañana.
export function turboInProgress(openRoutes: RouteSummary[], groups: TurboGroup[], today: string): WorkItem[] {
  const live = groups.filter((g) => g.status !== "DONE" && g.scheduled_date <= today);
  const grouped = new Set(live.map((g) => g.id));
  const singles = openRoutes.filter(
    (r) => routeModality(r) === "turbo" && r.scheduled_date <= today && !(r.turbo_group_id != null && grouped.has(r.turbo_group_id))
  );
  return [...live.map((group) => ({ kind: "group" as const, group })), ...singles.map((route) => ({ kind: "route" as const, route }))];
}

// Flex en curso: los recorridos de reparto abiertos de hoy y de días anteriores.
export const flexInProgress = (openRoutes: RouteSummary[], today: string): WorkItem[] =>
  openRoutes.filter((r) => routeModality(r) === "flex" && r.scheduled_date <= today).map((route) => ({ kind: "route", route }));

// Programados para mañana (Turbo): mis grupos y Turbos de ese día.
export function turboScheduled(routes: RouteSummary[], groups: TurboGroup[]): WorkItem[] {
  const grouped = new Set(groups.map((g) => g.id));
  const singles = routes.filter((r) => routeModality(r) === "turbo" && isOpenRoute(r) && !(r.turbo_group_id != null && grouped.has(r.turbo_group_id)));
  return [...groups.map((group) => ({ kind: "group" as const, group })), ...singles.map((route) => ({ kind: "route" as const, route }))];
}

// Finalizados: los recorridos cerrados de una modalidad.
export const closedOf = (routes: RouteSummary[], modality: Modality) =>
  routes.filter((r) => routeModality(r) === modality && !isOpenRoute(r));

// ---------- Misión activa ----------

export type MissionTarget =
  | { screen: "RouteDetailScreen"; params: { routeId: number; name?: string } }
  | { screen: "TurboGroupScreen"; params: { groupId: number } };

export type Mission = {
  key: string;
  modality: Modality;
  title: string;
  // Fecha del recorrido cuando no es de hoy («Desde ayer»).
  since: string | null;
  nextAction: string;
  progress: { done: number; total: number; label: string } | null;
  target: MissionTarget;
};

const MODALITY_TITLE: Record<Modality, string> = { turbo: "Turbo", flex: "Reparto", colecta: "Colecta", otro: "Recorrido" };
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const stopPlace = (s: Stop) =>
  s.type === "PICKUP"
    ? s.store_name ?? s.warehouse_name ?? s.store_address ?? "la tienda"
    : [s.address, s.receiver_name].filter(Boolean).join(" · ") || "la próxima entrega";

const isStopClosed = (s: Stop) => s.status === "DONE" || s.status === "SKIPPED";

export function routeNextAction(detail: RouteDetail): string {
  const next = [...(detail.stops ?? [])].sort((a, b) => a.sequence - b.sequence).find((s) => !isStopClosed(s));
  if (!next) return "Cerrá el recorrido";
  if (next.status === "ARRIVED") return `Estás en ${stopPlace(next)}: cerrá la parada`;
  return next.type === "PICKUP" ? `Retirá en ${stopPlace(next)}` : `Entregá en ${stopPlace(next)}`;
}

export function routeProgress(detail: RouteDetail): Mission["progress"] {
  const stops = detail.stops ?? [];
  if (!stops.length) return null;
  const done = stops.filter(isStopClosed).length;
  return { done, total: stops.length, label: `${done} de ${plural(stops.length, "parada", "paradas")}` };
}

export function missionFromRoute(r: RouteSummary, detail: RouteDetail | null, today: string): Mission {
  const modality = routeModality(r);
  const name = r.template_name?.trim() || null;
  return {
    key: `r${r.id}`,
    modality,
    title: name ? `${MODALITY_TITLE[modality]} · ${name}` : `${MODALITY_TITLE[modality]} #${r.id}`,
    since: r.scheduled_date < today ? `Desde ${dayLabel(r.scheduled_date, today)}` : null,
    // Sin el detalle (no se pudo leer) no se inventa la próxima parada.
    nextAction: detail ? routeNextAction(detail) : "Abrí el recorrido para ver la próxima parada",
    progress: detail ? routeProgress(detail) : null,
    target: { screen: "RouteDetailScreen", params: name ? { routeId: r.id, name } : { routeId: r.id } },
  };
}

export function missionFromGroup(g: TurboGroup, today: string): Mission {
  const turbos = g.turbos.filter((t) => t.route_status !== "CANCELLED");
  const pendingStore = g.stores.find((s) => s.turbos > 0 && s.pickup_status !== "DONE");
  const nextDrop = turbos.find((t) => !deliveryClosed(t));
  const nextAction = pendingStore
    ? pendingStore.pickup_status === "ARRIVED"
      ? `Estás en ${pendingStore.store_name ?? "la tienda"}: retirá los paquetes`
      : `Retirá en ${pendingStore.store_name ?? "la tienda"}`
    : nextDrop
    ? `Entregá en ${[nextDrop.address, nextDrop.receiver_name].filter(Boolean).join(" · ") || "la próxima entrega"}`
    : "Cerrá el grupo";
  const done = turbos.filter(deliveryClosed).length;
  return {
    key: `g${g.id}`,
    modality: "turbo",
    title: `Turbo · ${groupTitle(g)}`,
    since: g.scheduled_date < today ? `Desde ${dayLabel(g.scheduled_date, today)}` : null,
    nextAction,
    progress: turbos.length ? { done, total: turbos.length, label: `${done} de ${plural(turbos.length, "entrega", "entregas")}` } : null,
    target: { screen: "TurboGroupScreen", params: { groupId: g.id } },
  };
}

// Misiones: los grupos Turbo en la calle y los recorridos en curso de
// cualquier tipo (un Turbo que va en uno de esos grupos se ve en el grupo).
// Primero lo más viejo.
export function buildMissions(
  openRoutes: RouteSummary[],
  details: Record<number, RouteDetail | undefined>,
  groups: TurboGroup[],
  today: string
): Mission[] {
  const running = groups.filter((g) => g.status === "IN_PROGRESS");
  const grouped = new Set(running.map((g) => g.id));
  const fromGroups = running.map((g) => ({ date: g.scheduled_date, m: missionFromGroup(g, today) }));
  const fromRoutes = openRoutes
    .filter((r) => isRunning(r) && !(r.turbo_group_id != null && grouped.has(r.turbo_group_id)))
    .map((r) => ({ date: r.scheduled_date, m: missionFromRoute(r, details[r.id] ?? null, today) }));
  return [...fromGroups, ...fromRoutes].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1)).map((x) => x.m);
}

// Recorridos en curso sin grupo: de esos se pide el detalle para la próxima parada.
export const runningRouteIds = (openRoutes: RouteSummary[], groups: TurboGroup[]) => {
  const grouped = new Set(groups.filter((g) => g.status === "IN_PROGRESS").map((g) => g.id));
  return openRoutes.filter((r) => isRunning(r) && !(r.turbo_group_id != null && grouped.has(r.turbo_group_id))).map((r) => r.id);
};
