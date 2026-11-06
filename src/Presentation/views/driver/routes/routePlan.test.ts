// Pruebas de routePlan.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/route-plan --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/routes/routePlan.test.ts
//   node /tmp/route-plan/routes/routePlan.test.js

import {
  canOrganize, defaultPoints, homeNotice, metricsLabel, moveStop, orderedStops, pointAvailability, pointLabel, sameOrder,
} from "./routePlan";
import type { PlanPlaces, Stop } from "./routesApi";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

const WH = { id: 3, name: "Barracas", address: "Iriarte 2000", latitude: -34.64, longitude: -58.38, valid: true };
const HOME = { address: "Rivadavia 6000", latitude: -34.62, longitude: -58.44, valid: true };
const places = (over: Partial<PlanPlaces> = {}): PlanPlaces => ({ warehouse: WH, home: HOME, ...over });

// Qué viene elegido.
eq("por defecto: sale del depósito y termina en Mi domicilio", defaultPoints(places()), { start: { kind: "WAREHOUSE" }, end: { kind: "HOME" } });
eq("sin depósito con ubicación: sale de la ubicación actual",
  [defaultPoints(places({ warehouse: null })).start, defaultPoints(places({ warehouse: { ...WH, valid: false } })).start], [{ kind: "GPS" }, { kind: "GPS" }]);
eq("sin domicilio válido: sin destino fijo",
  [defaultPoints(places({ home: null })).end, defaultPoints(places({ home: { ...HOME, valid: false } })).end], [{ kind: "NONE" }, { kind: "NONE" }]);

// Qué se puede elegir.
eq("domicilio sin cargar o sin ubicación: no se ofrece, con el motivo",
  [pointAvailability("HOME", places({ home: null })), pointAvailability("HOME", places({ home: { ...HOME, valid: false } }))],
  [{ ok: false, reason: "No tenés domicilio cargado" }, { ok: false, reason: "Tu domicilio no tiene ubicación válida" }]);
eq("depósito sin ubicación: no se ofrece", pointAvailability("WAREHOUSE", places({ warehouse: { ...WH, valid: false } })).ok, false);
eq("ubicación actual, otra dirección y sin destino: siempre", ["GPS", "CUSTOM", "NONE"].map((k) => pointAvailability(k as any, places({ warehouse: null, home: null })).ok), [true, true, true]);
eq("etiquetas", [pointLabel({ kind: "WAREHOUSE" }, places()), pointLabel({ kind: "HOME" }, places()), pointLabel({ kind: "CUSTOM", label: "Lavalle 300" }, places()), pointLabel({ kind: "NONE" }, places())],
  ["Depósito · Barracas", "Mi domicilio", "Otra dirección · Lavalle 300", "Sin destino fijo"]);
eq("aviso del domicilio", [homeNotice(places()), !!homeNotice(places({ home: null })), /ubicación válida/.test(homeNotice(places({ home: { ...HOME, valid: false } })) ?? "")], [null, true, true]);

// Qué recorridos se organizan.
eq("solo repartos asignados, cargados o en la calle",
  [canOrganize({ type: "DELIVERY", status: "ASSIGNED" }), canOrganize({ type: "DELIVERY", status: "IN_PROGRESS" }), canOrganize({ type: "DELIVERY", status: "COMPLETED" }), canOrganize({ type: "TURBO", status: "IN_PROGRESS" }), canOrganize({ type: "PICKUP", status: "ASSIGNED" })],
  [true, true, false, false, false]);

// Mover a mano: lo fijo no se mueve y se saltea.
const fixed = new Set([2]);
eq("subir", moveStop([1, 3, 4], new Set(), 3, -1), [3, 1, 4]);
eq("bajar saltando una fija", moveStop([1, 2, 3], fixed, 1, 1), [3, 2, 1]);
eq("la fija no se mueve", moveStop([1, 2, 3], fixed, 2, 1), [1, 2, 3]);
eq("en el borde no hace nada", [moveStop([1, 3], new Set(), 1, -1), moveStop([1, 3], new Set(), 3, 1)], [[1, 3], [1, 3]]);
eq("arriba de todo hay una fija: no sube más", moveStop([2, 1, 3], fixed, 1, -1), [2, 1, 3]);

// Lista y mapa en el orden elegido, numerados de nuevo.
const s = (id: number, sequence: number) => ({ id, sequence, status: "PENDING", deliveries: [] } as unknown as Stop);
eq("orden elegido, renumerado", orderedStops([s(1, 1), s(2, 2), s(3, 3)], [3, 1, 2]).map((x) => [x.id, x.sequence]), [[3, 1], [1, 2], [2, 3]]);
eq("mismo orden", [sameOrder([1, 2], [1, 2]), sameOrder([1, 2], [2, 1]), sameOrder([1], [1, 2])], [true, false, false]);

// Cuánto se recorre.
eq("por calle", metricsLabel({ km: 12.34, minutes: 45, unreachable_legs: 0 }), "12,3 km · 45 min");
eq("más de una hora", metricsLabel({ km: 40, minutes: 95, unreachable_legs: 0 }), "40 km · 1 h 35 min");

console.log(failed ? `\n${failed} FALLAS` : "\nOK");
if (failed) process.exit(1);
