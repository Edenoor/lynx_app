// Pruebas de turboGroup.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/turbo-group --module commonjs --target es2020 --strict --skipLibCheck --jsx react-native \
//     src/Presentation/views/driver/turbo/turboGroup.ts src/Presentation/views/driver/turbo/turboGroup.test.ts
//   node /tmp/turbo-group/turboGroup.test.js

import { deliveryTime, groupActions, groupTitle, loadText, offerCards, routesWithGroups, storeTitle, storeTurbos } from "./turboGroup";
import type { GroupTurbo, TurboGroup } from "./turboApi";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

const turbo = (route_id: number, over: Partial<GroupTurbo> = {}): GroupTurbo => ({
  route_id, route_status: "ASSIGNED", delivery_id: route_id * 10, tracking: 46000 + route_id, nombre_destinatario: "Comprador",
  store_id: 1, store_name: "FIX SALUD", deadline_at: "2026-11-04T15:00:00Z", window_start_at: "2026-11-04T13:00:00Z",
  pickup_stop_id: route_id * 100, pickup_status: "PENDING", collected: false, dropoff_stop_id: route_id * 100 + 1, dropoff_status: "PENDING",
  address: "Calle 123", postal_code: "1425", receiver_name: "Comprador", ops_status: "ENTERED", eta: null, slack_minutes: null, ...over,
});
const group = (id: number, turbos: GroupTurbo[], over: Partial<TurboGroup> = {}): TurboGroup => ({
  id, scheduled_date: "2026-11-04", kind: "AUTO", status: "ASSIGNED", plan_at: null, estimated: false, turbos,
  stores: [...new Set(turbos.map((t) => t.store_id))].map((sid) => ({
    store_id: sid, store_name: turbos.find((t) => t.store_id === sid)!.store_name, store_address: null, latitude: null, longitude: null,
    turbos: turbos.filter((t) => t.store_id === sid && t.route_status !== "CANCELLED").length, collected: 0, pickup_status: "PENDING" as const, eta: null,
  })),
  ...over,
});
const hora = (iso: string) => iso.slice(11, 16);

// La lista de recorridos: un elemento por grupo, en el lugar del primero.
const routes = [
  { id: 1, type: "DELIVERY" }, { id: 11, type: "TURBO", turbo_group_id: 5 }, { id: 2, type: "DELIVERY" },
  { id: 12, type: "TURBO", turbo_group_id: 5 }, { id: 13, type: "TURBO", turbo_group_id: null }, { id: 14, type: "TURBO", turbo_group_id: 9 },
];
const g5 = group(5, [turbo(11), turbo(12)]);
eq("lista: el grupo reemplaza a sus Turbos, en el lugar del primero", routesWithGroups(routes, [g5]).map((i) => (i.kind === "group" ? `g${i.group.id}` : i.route.id)), [1, "g5", 2, 13, 14]);
eq("lista: sin grupos (servidor anterior), la de siempre", routesWithGroups(routes, []).map((i) => (i.kind === "route" ? i.route.id : null)), [1, 11, 2, 12, 13, 14]);

eq("título: una tienda", groupTitle(g5), "FIX SALUD · 2 Turbos");
const dos = group(6, [turbo(21), turbo(22, { store_id: 2, store_name: "LOLA PETS" }), turbo(23, { route_status: "CANCELLED" })]);
eq("título: dos tiendas, sin contar el cancelado", groupTitle(dos), "FIX SALUD y LOLA PETS · 2 Turbos");
eq("retiro: tienda y paquetes", storeTitle(g5.stores[0]), "Retiro · FIX SALUD · 2 paquetes");
eq("retiro: los Turbos de la tienda", storeTurbos(dos, 1).map((t) => t.route_id), [21]);

eq("hora: sin plan, la hora límite", deliveryTime(turbo(1), hora), "Entregar antes de las 15:00");
eq("hora: con plan", deliveryTime(turbo(1, { eta: "2026-11-04T14:40:00Z", slack_minutes: 10 }), hora), "Entregar antes de las 15:00 · llegás ~14:40");
eq("hora: atrasado", deliveryTime(turbo(1, { eta: "2026-11-04T15:10:00Z", slack_minutes: -20 }), hora), "Entregar antes de las 15:00 · llegás ~15:10, 20 min tarde");
eq("hora: entregado, sin la estimada", deliveryTime(turbo(1, { eta: "2026-11-04T14:40:00Z", ops_status: "DELIVERED" }), hora), "Entregar antes de las 15:00");

eq("acciones: asignado de hoy, se comienza", groupActions(g5, "2026-11-04"), { later: false, canStart: true, started: false, canComplete: false });
eq("acciones: de mañana, no se comienza", groupActions(g5, "2026-11-03").canStart, false);
const enCalle = group(7, [turbo(31, { route_status: "IN_PROGRESS", pickup_status: "DONE", dropoff_status: "DONE" }), turbo(32, { route_status: "IN_PROGRESS", pickup_status: "DONE" })]);
eq("acciones: en curso con una entrega abierta, no se termina", groupActions(enCalle, "2026-11-04").canComplete, false);
const listo = group(8, [turbo(41, { route_status: "IN_PROGRESS", pickup_status: "DONE", dropoff_status: "DONE" }), turbo(42, { route_status: "COMPLETED", pickup_status: "DONE", dropoff_status: "DONE" })]);
eq("acciones: todo cerrado, se termina", groupActions(listo, "2026-11-04").canComplete, true);
const sumado = group(9, [turbo(51, { route_status: "IN_PROGRESS" }), turbo(52)]);
eq("acciones: uno sumado con el grupo en la calle no vuelve a pedir Comenzar", groupActions(sumado, "2026-11-04").canStart, false);

eq("tope", loadText({ morning: 3, cap_morning: 10, other: 1, cap_other: 5, morning_until: "13:00" }), "3 de 10 a la mañana · 1 de 5 después de las 13:00");
eq("tope: sin datos", loadText(null), null);

// Ofertas: las del lote en una sola tarjeta.
const cards = offerCards([{ route_id: 1, group_id: null }, { route_id: 2, group_id: 7 }, { route_id: 3, group_id: null }, { route_id: 4, group_id: 7 }]);
eq("ofertas: el lote junta sus Turbos en una tarjeta, en el lugar del primero", cards.map((c) => (c.kind === "lote" ? `L${c.group_id}:${c.offers.map((o) => o.route_id).join("+")}` : c.offer.route_id)), [1, "L7:2+4", 3]);

if (failed) { console.log(`${failed} fallas`); process.exit(1); }
console.log("todo ok");
