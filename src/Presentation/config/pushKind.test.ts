// Pruebas de pushKind.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/pushkind --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/config/pushKind.ts src/Presentation/config/pushKind.test.ts
//   node /tmp/pushkind/pushKind.test.js

import { isRouteNotice, normalizeKind, routeIdOf } from "./pushKind";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

// Avisos de recorridos (el servidor manda el tipo dentro de data)
eq("PICKUP_ASSIGNED", normalizeKind("PICKUP_ASSIGNED", { routeId: 12 }), "PICKUP_ASSIGNED");
eq("PICKUP_REASSIGNED", normalizeKind("pickup_reassigned", { routeId: 12 }), "PICKUP_REASSIGNED");
eq("ROUTE_UPDATED", normalizeKind("ROUTE_UPDATED", { routeId: 12, reordered: true }), "ROUTE_UPDATED");
eq("ROUTE_OFFER con tipo: no es Turbo", normalizeKind("ROUTE_OFFER", { routeId: 5, offerId: 9, kind: "ADMIN" }), "ROUTE_OFFER");
eq("ROUTE_OFFER sin tipo (push viejo): por kind", normalizeKind(undefined, { routeId: 5, offerId: 9, kind: "SHELF" }), "ROUTE_OFFER");
eq("Turbo con tipo", normalizeKind("TURBO_OFFER", { routeId: 5, offerId: 9 }), "TURBO_OFFER");
eq("Turbo sin tipo (push viejo)", normalizeKind(undefined, { routeId: 5, offerId: 9 }), "TURBO_OFFER");
eq("Turbo sin tipo con kind TURBO", normalizeKind(undefined, { routeId: 5, offerId: 9, kind: "TURBO" }), "TURBO_OFFER");

// Lo que ya existía sigue igual
eq("ronda de mañana sin tipo", normalizeKind(undefined, { routeId: 3, template_name: "Norte" }), "ROUTE_CONFIRMATION");
eq("asignación por título", normalizeKind(undefined, { deliveryId: 4 }, "Nuevo envío asignado"), "ASIGNACION");
eq("aviso del coordinador", normalizeKind("ALERTA", { ping: true }), "ALERT");
eq("desconocido", normalizeKind("ALGO", {}), "INFO");

eq("isRouteNotice", ["PICKUP_ASSIGNED", "PICKUP_REASSIGNED", "ROUTE_UPDATED", "ROUTE_OFFER", "TURBO_OFFER", "ROUTE_CONFIRMATION"].map((k) => isRouteNotice(k as any)), [true, true, true, true, false, false]);
eq("routeIdOf", [routeIdOf({ routeId: 12 }), routeIdOf({ routeId: "12" }), routeIdOf({ route_id: 7 }), routeIdOf({}), routeIdOf({ routeId: "x" }), routeIdOf(null)], [12, 12, 7, null, null, null]);

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
