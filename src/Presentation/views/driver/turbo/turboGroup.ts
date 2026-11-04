// Reglas de la pantalla de un grupo Turbo y de la lista de recorridos, sin
// React Native para probarlas solas (turboGroup.test.ts, con node).
//
// Un grupo junta los Turbos de una misma tienda que lleva el chofer: se
// retiran juntos y se entregan en el orden del plan. Cada Turbo sigue siendo
// su recorrido; la lista muestra un solo elemento por grupo.

import type { GroupStore, GroupTurbo, TurboGroup, TurboLoad } from "./turboApi";

type RouteLike = { id: number; type: string; turbo_group_id?: number | null };
export type RouteListItem<R extends RouteLike> = { kind: "group"; group: TurboGroup } | { kind: "route"; route: R };

// La lista de recorridos: los Turbos de un grupo se reemplazan por su grupo,
// en el lugar del primero; lo demás queda igual. Sin grupos (un servidor
// anterior), la lista de siempre.
export function routesWithGroups<R extends RouteLike>(routes: R[], groups: TurboGroup[]): RouteListItem<R>[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const shown = new Set<number>();
  const out: RouteListItem<R>[] = [];
  for (const r of routes) {
    const g = r.type === "TURBO" && r.turbo_group_id != null ? byId.get(r.turbo_group_id) : undefined;
    if (!g) { out.push({ kind: "route", route: r }); continue; }
    if (shown.has(g.id)) continue;
    shown.add(g.id);
    out.push({ kind: "group", group: g });
  }
  return out;
}

const vivos = (g: TurboGroup) => g.turbos.filter((t) => t.route_status !== "CANCELLED");
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

// «FIX SALUD · 3 Turbos» o «FIX SALUD y LOLA PETS · 4 Turbos».
export function groupTitle(g: TurboGroup): string {
  const names = g.stores.filter((s) => s.turbos > 0).map((s) => s.store_name ?? `tienda ${s.store_id}`);
  const tiendas = names.length <= 2 ? names.join(" y ") : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
  return `${tiendas || "Turbo"} · ${plural(vivos(g).length, "Turbo", "Turbos")}`;
}

// El retiro de una tienda: «Retiro · FIX SALUD · 3 paquetes».
export const storeTitle = (s: GroupStore) => `Retiro · ${s.store_name ?? `tienda ${s.store_id}`} · ${plural(s.turbos, "paquete", "paquetes")}`;

export const STORE_STATE_LABEL: Record<GroupStore["pickup_status"], string> = {
  PENDING: "Pendiente", ARRIVED: "Llegaste", DONE: "Retiro cerrado",
};

// Los Turbos de una tienda que se retiran ahí (sin los cancelados).
export const storeTurbos = (g: TurboGroup, storeId: number) => vivos(g).filter((t) => t.store_id === storeId);

// Las entregas en el orden del plan (el servidor ya las manda así), sin los cancelados.
export const deliveries = (g: TurboGroup) => vivos(g);

export const deliveryClosed = (t: GroupTurbo) =>
  t.dropoff_status === "DONE" || t.dropoff_status === "SKIPPED" || t.ops_status === "DELIVERED" || t.route_status === "COMPLETED";

// La hora de una entrega: «Entregar antes de las 12:00 · llegás ~11:40» o,
// con el plan atrasado, «… · llegás ~12:10, 10 min tarde». `hora` formatea
// (la de la pantalla).
export function deliveryTime(t: GroupTurbo, hora: (iso: string) => string | null): string | null {
  const antes = t.deadline_at ? `Entregar antes de las ${hora(t.deadline_at)}` : null;
  if (!t.eta || deliveryClosed(t)) return antes;
  const tarde = t.slack_minutes != null && t.slack_minutes < 0 ? `, ${-t.slack_minutes} min tarde` : "";
  return [antes, `llegás ~${hora(t.eta)}${tarde}`].filter(Boolean).join(" · ");
}

// Qué se puede hacer con el grupo según cómo está.
export function groupActions(g: TurboGroup, todayIso: string) {
  const turbos = vivos(g);
  const later = g.scheduled_date > todayIso;
  const assigned = turbos.some((t) => t.route_status === "ASSIGNED");
  const started = turbos.some((t) => t.route_status === "IN_PROGRESS");
  // Terminar: en curso, con el retiro cerrado y todas las entregas cerradas.
  const allClosed = turbos.length > 0 && turbos.every((t) => t.route_status === "COMPLETED" || ((t.pickup_status === "DONE" || t.pickup_status === "SKIPPED") && deliveryClosed(t)));
  return {
    later,
    canStart: !later && assigned && !started,
    // Uno que se sumó con el grupo en la calle sale solo al llegar a su tienda.
    started,
    canComplete: started && allClosed && turbos.some((t) => t.route_status === "IN_PROGRESS"),
  };
}

// «3 de 10 a la mañana · 1 de 5 después de las 13:00». null sin datos.
export function loadText(l: TurboLoad | null | undefined): string | null {
  if (!l) return null;
  return `${l.morning} de ${l.cap_morning} a la mañana · ${l.other} de ${l.cap_other} después de las ${l.morning_until}`;
}

export const loadTotal = (l: TurboLoad | null | undefined) => (l ? l.morning + l.other : 0);
