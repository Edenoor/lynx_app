// src/Presentation/views/driver/routes/routePlan.ts
// Lo que decide la pantalla «Organizar recorrido», sin React Native (se prueba
// con node): qué se ofrece como inicio y fin, qué viene elegido, cómo se
// mueve una parada a mano y cómo se cuenta la propuesta. El orden lo calcula
// el servidor (POST /v2/routes/:id/plan/preview); acá no se optimiza nada.

import type { PlanMetrics, PlanPlaces, PlanPointKind, PlanPointSpec, RouteDetail, Stop } from "./routesApi";

// Solo repartos del chofer que todavía se recorren (el servidor exige lo mismo).
export const canOrganize = (r: Pick<RouteDetail, "type" | "status">) =>
  r.type === "DELIVERY" && (r.status === "ASSIGNED" || r.status === "LOADED" || r.status === "IN_PROGRESS");

// Lo visitado (llegada, cerrada, salteada) queda en su lugar.
export const isFixed = (s: Pick<Stop, "status">) => s.status !== "PENDING";

export const START_KINDS: PlanPointKind[] = ["WAREHOUSE", "GPS", "HOME", "CUSTOM"];
export const END_KINDS: PlanPointKind[] = ["HOME", "WAREHOUSE", "CUSTOM", "NONE"];

// Inicio: el depósito del recorrido si tiene ubicación; si no, la ubicación
// actual. Fin: Mi domicilio si tiene ubicación; si no, sin destino fijo.
export function defaultPoints(p: PlanPlaces): { start: PlanPointSpec; end: PlanPointSpec } {
  return {
    start: { kind: p.warehouse?.valid ? "WAREHOUSE" : "GPS" },
    end: { kind: p.home?.valid ? "HOME" : "NONE" },
  };
}

// Se puede elegir (o por qué no).
export function pointAvailability(kind: PlanPointKind, p: PlanPlaces): { ok: boolean; reason?: string } {
  if (kind === "WAREHOUSE") {
    if (!p.warehouse) return { ok: false, reason: "Este recorrido no tiene depósito" };
    if (!p.warehouse.valid) return { ok: false, reason: "El depósito no tiene ubicación cargada" };
  }
  if (kind === "HOME") {
    if (!p.home) return { ok: false, reason: "No tenés domicilio cargado" };
    if (!p.home.valid) return { ok: false, reason: "Tu domicilio no tiene ubicación válida" };
  }
  return { ok: true };
}

export function pointLabel(spec: PlanPointSpec, p: PlanPlaces): string {
  switch (spec.kind) {
    case "WAREHOUSE": return p.warehouse ? `Depósito · ${p.warehouse.name}` : "Depósito";
    case "HOME": return "Mi domicilio";
    case "GPS": return "Mi ubicación actual";
    case "CUSTOM": return spec.label ? `Otra dirección · ${spec.label}` : "Otra dirección";
    default: return "Sin destino fijo";
  }
}

// Aviso del domicilio para elegir dónde terminar.
export function homeNotice(p: PlanPlaces): string | null {
  if (!p.home) return "No tenés domicilio cargado: cargalo en Mi cuenta → Mi domicilio para terminar ahí.";
  if (!p.home.valid) return "Tu domicilio no tiene una ubicación válida: volvé a buscarlo en Mi cuenta → Mi domicilio.";
  return null;
}

// Sube o baja una parada pendiente, saltando las fijas (que no se mueven).
export function moveStop(order: number[], fixed: Set<number>, id: number, dir: -1 | 1): number[] {
  const i = order.indexOf(id);
  if (i === -1 || fixed.has(id)) return order;
  let j = i + dir;
  while (j >= 0 && j < order.length && fixed.has(order[j])) j += dir;
  if (j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

// Las paradas en el orden dado, numeradas de nuevo (para la lista y el mapa).
export function orderedStops(stops: Stop[], order: number[]): Stop[] {
  const byId = new Map(stops.map((s) => [s.id, s]));
  return order.map((id) => byId.get(id)).filter((s): s is Stop => !!s).map((s, i) => ({ ...s, sequence: i + 1 }));
}

export const sameOrder = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

// «12,3 km · 45 min», por calle (sin tráfico: lo que calcula Valhalla).
export function metricsLabel(m: PlanMetrics): string {
  const km = `${String(Math.round(m.km * 10) / 10).replace(".", ",")} km`;
  const h = Math.floor(m.minutes / 60), min = m.minutes % 60;
  return `${km} · ${h ? `${h} h ${min} min` : `${min} min`}`;
}
