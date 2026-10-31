// Pruebas de turboPickup.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/turbo-pickup --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/routes/turboPickup.ts src/Presentation/views/driver/routes/turboPickup.test.ts
//   node /tmp/turbo-pickup/turboPickup.test.js

import { TURBO_NOT_IN_ROUTE_MESSAGE, turboPickupError, turboPickupItems } from "./turboPickup";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

const d = (delivery_id: number, ops_status = "ENTERED") => ({ delivery_id, tracking: String(46000 + delivery_id), ops_status });
const pickup = (collected: number[] = []) => ({ type: "PICKUP" as const, deliveries: collected.map((id) => d(id, "OUT_FOR_DELIVERY")) });
const delivery = (...ids: number[]) => ({ type: "DELIVERY" as const, deliveries: ids.map((id) => d(id)) });

const ids = (items: { delivery_id: number; collected: boolean }[]) => items.map((i) => [i.delivery_id, i.collected]);

{
  const p = pickup();
  eq("Turbo de un envío: solo ese, sin colectar", ids(turboPickupItems([p, delivery(501)], p)), [[501, false]]);
}
{
  const p = pickup([501]);
  eq("ya colectado en el retiro: se marca", ids(turboPickupItems([p, delivery(501)], p)), [[501, true]]);
}
{
  const p = pickup([777]);
  eq("lo colectado en el retiro que no es del recorrido no se lista", ids(turboPickupItems([p, delivery(501)], p)), [[501, false]]);
}
{
  const p = pickup();
  eq("varias entregas: en orden y sin repetir", ids(turboPickupItems([p, delivery(501, 502), delivery(502, 503)], p)), [[501, false], [502, false], [503, false]]);
}
{
  const p = pickup();
  eq("sin parada de entrega: nada", turboPickupItems([p], p), []);
}
eq("conserva los datos del envío", turboPickupItems([pickup(), delivery(501)], pickup())[0].tracking, "46501");

const ajeno = Object.assign(new Error("turbo_not_in_route"), { code: "TURBO_NOT_IN_ROUTE", status: 409 });
eq("409 TURBO_NOT_IN_ROUTE: se explica", (turboPickupError(ajeno) as Error).message, TURBO_NOT_IN_ROUTE_MESSAGE);
const otro = Object.assign(new Error("el envío 501 está DELIVERED: no se puede colectar"), { code: null, status: 409 });
eq("otro error del servidor: pasa tal cual", turboPickupError(otro) === otro, true);
eq("sin red: pasa tal cual", (turboPickupError(new TypeError("Network request failed")) as Error).message, "Network request failed");

if (failed) { console.log(`\n${failed} prueba(s) fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
