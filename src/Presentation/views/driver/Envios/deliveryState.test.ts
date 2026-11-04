// Pruebas de deliveryState.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/delivery-state --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/Envios/deliveryState.test.ts
//   node /tmp/delivery-state/deliveryState.test.js

import { classifyDelivery, deliveryKey, REVIEW_LABEL } from "./deliveryState";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};
const brief = (item: Parameters<typeof classifyDelivery>[0]) => {
  const s = classifyDelivery(item);
  return [s.phase, s.label, s.finished, s.attention, s.issue];
};

// 1) Manda ops_status: todo el catálogo del backend.
for (const [ops, want] of [
  ["DELIVERED", ["delivered", "Entregado", true, false, null]],
  ["CANCELLED", ["cancelled", "Cancelado", true, true, null]],
  ["NOT_DELIVERED", ["notDelivered", "No entregado", false, true, null]],
  ["ENTERED", ["inProgress", "Ingresado", false, false, null]],
  ["COLLECTED", ["inProgress", "Colectado", false, false, null]],
  ["ARRIVED_WAREHOUSE", ["inProgress", "En planta", false, false, null]],
  ["SHELVED", ["inProgress", "En planta", false, false, null]],
  ["ASSIGNED_TO_ROUTE", ["inProgress", "Asignado a recorrido", false, false, null]],
  ["OUT_FOR_DELIVERY", ["inProgress", "En camino", false, false, null]],
] as const) {
  eq(`ops ${ops}`, brief({ ops_status: ops }), want);
}
eq("ops en minúsculas y con espacios", brief({ ops_status: " delivered " }), ["delivered", "Entregado", true, false, null]);
eq("ops abierto gana sobre un ML abierto", brief({ ops_status: "OUT_FOR_DELIVERY", status_ml: "shipped" }), ["inProgress", "En camino", false, false, null]);

// 2) NOT_DELIVERED: abierto, con atención, sin suponer Baúl.
{
  const s = classifyDelivery({ ops_status: "NOT_DELIVERED", status_ml: "not_delivered" });
  eq("NOT_DELIVERED no es finalizado", s.finished, false);
  eq("NOT_DELIVERED pide atención", s.attention, true);
  eq("NOT_DELIVERED con ML not_delivered es coherente", s.issue, null);
  eq("NOT_DELIVERED no dice Baúl", /ba[uú]l/i.test(s.label), false);
}

// 3) Sin ops_status: respaldo en status_ml, en inglés y en español.
for (const [ml, want] of [
  ["delivered", ["delivered", "Entregado", true, false, null]],
  ["Entregado", ["delivered", "Entregado", true, false, null]],
  ["cancelled", ["cancelled", "Cancelado", true, true, null]],
  ["Cancelado", ["cancelled", "Cancelado", true, true, null]],
  ["not_delivered", ["notDelivered", "No entregado", false, true, null]],
  ["No entregado", ["notDelivered", "No entregado", false, true, null]],
  ["ready_to_ship", ["inProgress", "Listo para enviar", false, false, null]],
  ["shipped", ["inProgress", "En camino", false, false, null]],
  ["En camino", ["inProgress", "En camino", false, false, null]],
  ["Listo para enviar", ["inProgress", "Listo para enviar", false, false, null]],
] as const) {
  eq(`sin ops, status_ml «${ml}»`, brief({ ops_status: null, status_ml: ml }), want);
}
eq("«No entregado» nunca cuenta como entregado", classifyDelivery({ status_ml: "No entregado" }).phase, "notDelivered");
eq("sin ops ni status_ml: usa status (mapa ML en español)", brief({ status: "Entregado" }), ["delivered", "Entregado", true, false, null]);
eq("sin ops ni status_ml: usa estado legacy", brief({ estado: "En camino" }), ["inProgress", "En camino", false, false, null]);
eq("legacy «Reprogramado» → no entregado (abierto)", brief({ estado: "Reprogramado" }), ["notDelivered", "No entregado", false, true, null]);
eq("legacy «Nadie en domicilio» → no entregado (abierto)", brief({ estado: "Nadie en domicilio" }), ["notDelivered", "No entregado", false, true, null]);
eq("sin ningún estado → en curso", brief({}), ["inProgress", "En curso", false, false, null]);
eq("todo null → en curso", brief({ ops_status: null, status_ml: null, status: null, estado: null }), ["inProgress", "En curso", false, false, null]);

// 4) Discrepancias Lynx / Mercado Libre: manda ops_status, se marca para revisar.
for (const [ops, ml, phase] of [
  ["DELIVERED", "cancelled", "delivered"],
  ["DELIVERED", "not_delivered", "delivered"],
  ["CANCELLED", "delivered", "cancelled"],
  ["CANCELLED", "Entregado", "cancelled"],
  ["OUT_FOR_DELIVERY", "delivered", "inProgress"],
  ["SHELVED", "cancelled", "inProgress"],
  ["NOT_DELIVERED", "delivered", "notDelivered"],
  ["NOT_DELIVERED", "Cancelado", "notDelivered"],
] as const) {
  const s = classifyDelivery({ ops_status: ops, status_ml: ml });
  eq(`discrepancia ops ${ops} / ML ${ml}`, [s.phase, s.label, s.attention, s.issue], [phase, REVIEW_LABEL, true, "mismatch"]);
}
eq("ML abierto con ops terminal no es discrepancia", classifyDelivery({ ops_status: "DELIVERED", status_ml: "shipped" }).issue, null);
eq("ML not_delivered con ops abierto no es discrepancia", classifyDelivery({ ops_status: "OUT_FOR_DELIVERY", status_ml: "not_delivered" }).issue, null);

// 5) ops_status desconocido: nunca entregado en silencio.
{
  const s = classifyDelivery({ ops_status: "RETURNED", status_ml: "delivered" });
  eq("ops desconocido → en curso, para revisar", [s.phase, s.finished, s.attention, s.issue, s.label], ["inProgress", false, true, "unknown", REVIEW_LABEL]);
}

// 6) Regresión Dancona (producción, 04/11/2026): los 10 envíos de Current
// venían con ops DELIVERED, status_ml delivered y status Entregado, y Mobile
// los mostraba «En curso». Los 4 primeros pares id / delivery_id son casos
// verificados; los otros 6 repiten los mismos estados con ids de prueba.
const DANCONA = [
  [1365, 24293], [1384, 24385], [2378, 72127], [2642, 83500],
  [9001, 90001], [9002, 90002], [9003, 90003], [9004, 90004], [9005, 90005], [9006, 90006],
].map(([id, delivery_id]) => ({ id, delivery_id, status: "Entregado", status_ml: "delivered", ops_status: "DELIVERED" }));
eq("Dancona: los 10 quedan finalizados", DANCONA.filter((d) => classifyDelivery(d).finished).length, 10);
eq("Dancona: ninguno queda en curso", DANCONA.filter((d) => !classifyDelivery(d).finished).length, 0);
eq("Dancona: los 10 cuentan como entregados", DANCONA.filter((d) => classifyDelivery(d).phase === "delivered").length, 10);
eq("Dancona: ninguno pide atención", DANCONA.filter((d) => classifyDelivery(d).attention).length, 0);
eq("Dancona: la clave es el envío, no delivery_status.id", deliveryKey(DANCONA[1], 0), "d24385");

// Ficha de prueba de abril (envío 55): status «Entered», status_ml en español.
eq("envío 55: ops DELIVERED y status_ml «Entregado» → entregado, coherente", brief({ status: "Entered", status_ml: "Entregado", ops_status: "DELIVERED" }), ["delivered", "Entregado", true, false, null]);

// 7) Clave de la fila.
eq("clave con delivery_id 0", deliveryKey({ delivery_id: 0, id: 9 }, 3), "d0");
eq("clave sin delivery_id (legacy) usa id e índice", deliveryKey({ id: 7 }, 2), "7-2");
eq("clave sin ids usa el tracking", deliveryKey({ numero_tracking: "T1" }, 1), "T1-1");
eq("clave vacía", deliveryKey({ delivery_id: null }, 4), "nt-4");

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
