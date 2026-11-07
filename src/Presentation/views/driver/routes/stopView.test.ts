// Pruebas de stopView.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/stop-view --module commonjs --target es2020 --strict --skipLibCheck --jsx react-native \
//     src/Presentation/views/driver/routes/stopView.test.ts
//   node /tmp/stop-view/routes/stopView.test.js

import {
  awaitingProvider, closesOnFinish, deliveryDelivered, deliveryResolved, deliveryStatusLabel, deliveryView, providerGoverned, routeCanFinish, routeMapPoints, routeProgress, splitDeliveries,
  splitStops, stopActions, stopAddress, stopFinished, stopMapsAddress, stopPackagesLabel, stopsToCloseOnFinish, stopStateLabel, stopSummary,
} from "./stopView";
import type { Stop, StopDelivery } from "./routesApi";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

const d = (id: number, ops_status: string, outcome: string | null = null, extra: Partial<StopDelivery> = {}): StopDelivery => ({
  delivery_id: id, tracking: 4600 + id, nombre_destinatario: "Ana", direccion: "Calle 9", codigo_postal: "1425", tipo_envio: "flex",
  ops_status, outcome, outcome_at: null, notes: null, ...extra,
});
const stop = (status: Stop["status"], deliveries: StopDelivery[], extra: Partial<Stop> = {}): Stop =>
  ({ id: 1, route_id: 158, sequence: 1, type: "DELIVERY", status, arrived_at: null, completed_at: null, notes: null, address: "Lavalle 300", postal_code: "1043", receiver_name: "Ana", deliveries, ...extra } as Stop);

// Envío por envío.
eq("resuelto: con resultado o entregado/cancelado", [d(1, "OUT_FOR_DELIVERY", "NOT_DELIVERED"), d(2, "DELIVERED"), d(3, "CANCELLED"), d(4, "OUT_FOR_DELIVERY")].map(deliveryResolved), [true, true, true, false]);
eq("un no entregado de un intento anterior (sin resultado acá) no está resuelto", deliveryResolved(d(5, "NOT_DELIVERED")), false);
eq("#158: entregado por ML se ve una vez («Entregado», no «Entregado · entregado»)", deliveryStatusLabel(d(1, "DELIVERED", "DELIVERED")), "Entregado");
eq("estado: el resultado manda sobre el operativo", [deliveryStatusLabel(d(1, "NOT_DELIVERED", "NOT_DELIVERED")), deliveryStatusLabel(d(2, "NOT_DELIVERED", "RETURNED"))], ["No entregado", "Devuelto"]);
eq("estado: sin resultado, el operativo", [deliveryStatusLabel(d(1, "OUT_FOR_DELIVERY")), deliveryStatusLabel(d(2, "RARO"))], ["En calle", "RARO"]);

// Dirección primero.
eq("dirección de la parada como título", stopAddress(stop("PENDING", [d(1, "OUT_FOR_DELIVERY")])), "Lavalle 300");
eq("sin dirección en la parada: la del envío", stopAddress(stop("PENDING", [d(1, "OUT_FOR_DELIVERY")], { address: null })), "Calle 9");
eq("sin ninguna: se dice", stopAddress(stop("PENDING", [d(1, "OUT_FOR_DELIVERY", null, { direccion: null })], { address: " " })), "Dirección sin informar");
eq("para Maps: dirección y CP", stopMapsAddress(stop("PENDING", [])), "Lavalle 300, CP 1043");
eq("para Maps: sin dirección no hay destino", stopMapsAddress(stop("PENDING", [], { address: null })), null);
eq("retiro: la dirección de la tienda", stopAddress({ type: "PICKUP", address: null, store_address: "Tienda 1", deliveries: [] }), "Tienda 1");

// Resumen.
const mixed = stop("PENDING", [d(1, "DELIVERED", "DELIVERED"), d(2, "OUT_FOR_DELIVERY", "NOT_DELIVERED"), d(3, "OUT_FOR_DELIVERY")]);
eq("resumen", stopSummary(mixed), { total: 3, resolved: 2, delivered: 1, pending: 1, allResolved: false });
eq("paquetes", stopPackagesLabel(stopSummary(mixed)), "3 paquetes · 1 entregado · 1 sin entregar · 1 pendiente");
eq("paquetes: todos pendientes, sin repetir", stopPackagesLabel(stopSummary(stop("PENDING", [d(1, "OUT_FOR_DELIVERY")]))), "1 paquete");
eq("parada vacía no está «resuelta»", stopSummary(stop("PENDING", [])).allResolved, false);

// Acciones.
const all = (s: Stop, inProgress = true) => stopActions(s, inProgress);
eq("pendiente con envíos por entregar: llegar, cerrar y saltear", all(stop("PENDING", [d(1, "OUT_FOR_DELIVERY")])), { arrive: true, close: true, skip: true, resolvedButOpen: false });
eq("#158: todos entregados por ML y la parada abierta: solo cerrarla", all(stop("PENDING", [d(1, "DELIVERED", "DELIVERED"), d(2, "DELIVERED")])), { arrive: false, close: true, skip: false, resolvedButOpen: true });
eq("con algo entregado no se saltea", all(mixed).skip, false);
eq("cerrada o salteada: nada", [all(stop("DONE", [d(1, "DELIVERED")])), all(stop("SKIPPED", []))].map((a) => a.arrive || a.close || a.skip), [false, false]);
eq("recorrido sin salir: nada", all(stop("PENDING", [d(1, "OUT_FOR_DELIVERY")]), false), { arrive: false, close: false, skip: false, resolvedButOpen: false });
eq("en la parada (ARRIVED): cerrar y saltear, no llegar", all(stop("ARRIVED", [d(1, "OUT_FOR_DELIVERY")])), { arrive: false, close: true, skip: true, resolvedButOpen: false });
eq("retiro pendiente: hay que llegar antes de cerrar", all(stop("PENDING", [], { type: "PICKUP" })), { arrive: true, close: false, skip: true, resolvedButOpen: false });

// Mapa del recorrido.
const map = routeMapPoints([
  stop("DONE", [], { id: 3, sequence: 3, latitude: -34.6, longitude: -58.4 }),
  stop("PENDING", [], { id: 2, sequence: 2, latitude: null, longitude: null }),
  stop("PENDING", [], { id: 1, sequence: 1, type: "PICKUP", store_name: "Tienda A", latitude_snapshot: "-34.5", longitude_snapshot: "-58.5" }),
  stop("PENDING", [], { id: 4, sequence: 4, latitude: 0, longitude: 0 }),
]);
eq("mapa: en orden de visita, solo con coordenadas (texto de pg incluido)", map.points.map((p) => [p.sequence, p.latitude, p.closed]), [[1, -34.5, false], [3, -34.6, true]]);
eq("mapa: retiro con su tienda; sin coordenadas (o 0,0) se cuentan aparte", [map.points[0].title, map.missing], ["Retiro · Tienda A", 2]);

// Envíos que Mercado Libre ya entregó: fuera de los pendientes, «Entregado».
eq("entregado: lo registró el chofer o lo confirmó ML", [d(1, "DELIVERED", "DELIVERED"), d(2, "DELIVERED"), d(3, "OUT_FOR_DELIVERY", "DELIVERED"), d(4, "OUT_FOR_DELIVERY"), d(5, "CANCELLED")].map(deliveryDelivered), [true, true, true, false, false]);
eq("confirmación tardía: ML lo entregó después de un «No entregado» → «Entregado»", deliveryStatusLabel(d(1, "DELIVERED", "NOT_DELIVERED")), "Entregado");
eq("Nadie/Reprogramado/Cancelado sin cambios: siguen con su estado", [deliveryStatusLabel(d(1, "OUT_FOR_DELIVERY")), deliveryStatusLabel(d(2, "CANCELLED")), deliveryStatusLabel(d(3, "NOT_DELIVERED", "NOT_DELIVERED"))], ["En calle", "Cancelado", "No entregado"]);
{
  const s = splitDeliveries([d(1, "DELIVERED", "DELIVERED"), d(2, "OUT_FOR_DELIVERY"), d(3, "DELIVERED"), d(4, "NOT_DELIVERED", "NOT_DELIVERED"), d(5, "OUT_FOR_DELIVERY")]);
  eq("parada mixta: pendientes arriba, en su orden", s.pending.map((x) => x.delivery_id), [2, 5]);
  eq("parada mixta: los resueltos a «Envíos cerrados», en su orden", s.closed.map((x) => x.delivery_id), [1, 3, 4]);
  eq("sin envíos: nada en ninguna lista", splitDeliveries([]), { pending: [], closed: [] });
}

// Cierre al finalizar: la misma regla que el servidor.
eq("todo entregado por ML: se cierra sola al finalizar", closesOnFinish(stop("PENDING", [d(1, "DELIVERED", "DELIVERED")]), "DELIVERY"), true);
eq("con llegada marcada también", closesOnFinish(stop("ARRIVED", [d(1, "DELIVERED", "DELIVERED"), d(2, "NOT_DELIVERED", "NOT_DELIVERED")]), "DELIVERY"), true);
eq("dos de tres resueltos: no", closesOnFinish(stop("PENDING", [d(1, "DELIVERED", "DELIVERED"), d(2, "DELIVERED"), d(3, "OUT_FOR_DELIVERY")]), "DELIVERY"), false);
eq("cancelado sin resultado: no (no cambia su tratamiento)", closesOnFinish(stop("PENDING", [d(1, "DELIVERED", "DELIVERED"), d(2, "CANCELLED")]), "DELIVERY"), false);
eq("parada vacía: no", closesOnFinish(stop("PENDING", []), "DELIVERY"), false);
eq("ya cerrada: no (nada que hacer)", [closesOnFinish(stop("DONE", [d(1, "DELIVERED", "DELIVERED")]), "DELIVERY"), closesOnFinish(stop("SKIPPED", [d(1, "DELIVERED", "DELIVERED")]), "DELIVERY")], [false, false]);
eq("Turbo y colecta: no se tocan", [closesOnFinish(stop("PENDING", [d(1, "DELIVERED", "DELIVERED")]), "TURBO"), closesOnFinish(stop("PENDING", [d(1, "COLLECTED", "COLLECTED")], { type: "PICKUP" }), "PICKUP")], [false, false]);
{
  const done = stop("DONE", [d(1, "DELIVERED", "DELIVERED")]);
  const resolved = stop("PENDING", [d(2, "DELIVERED", "DELIVERED")], { id: 2 });
  const open = stop("PENDING", [d(3, "OUT_FOR_DELIVERY")], { id: 3 });
  eq("finalizar: con todas cerradas o resueltas, sí", routeCanFinish({ type: "DELIVERY", stops: [done, resolved] }), true);
  eq("finalizar: con una entrega pendiente, no", routeCanFinish({ type: "DELIVERY", stops: [done, resolved, open] }), false);
  eq("finalizar: un Turbo sigue exigiendo cerrar sus paradas", routeCanFinish({ type: "TURBO", stops: [done, resolved] }), false);
  eq("finalizar: colecta, como siempre", [routeCanFinish({ type: "PICKUP", stops: [stop("DONE", [], { type: "PICKUP" })] }), routeCanFinish({ type: "PICKUP", stops: [stop("ARRIVED", [], { type: "PICKUP" })] })], [true, false]);
}

// ---------- Reparto: estado real por envío ----------
const v = (x: StopDelivery) => { const r = deliveryView(x); return [r.label, r.final]; };
eq("ML entregado → «Entregado», finalizado", v(d(1, "DELIVERED", "DELIVERED", { provider: "mercadolibre" })), ["Entregado", true]);
eq("ML no entregado (status_ml, crudo o traducido) → «No entregado», finalizado",
  [v(d(1, "OUT_FOR_DELIVERY", null, { status_ml: "not_delivered" })), v(d(2, "OUT_FOR_DELIVERY", null, { status_ml: "No entregado" }))], [["No entregado", true], ["No entregado", true]]);
eq("ML en camino → «En camino», pendiente", [v(d(1, "OUT_FOR_DELIVERY")), v(d(2, "OUT_FOR_DELIVERY", null, { status_ml: "shipped" }))], [["En camino", false], ["En camino", false]]);
eq("desconocido o sin dato → «Pendiente», no finalizado", [v(d(1, "")), v(d(2, "RARO")), v(d(3, "ASSIGNED_TO_ROUTE", null, { status_ml: "algo_nuevo" }))], [["Pendiente", false], ["Pendiente", false], ["Pendiente", false]]);
eq("propio entregado o no entregado por el chofer → finalizado", [v(d(1, "DELIVERED", "DELIVERED", { tipo_envio: "propio" })), v(d(2, "NOT_DELIVERED", "NOT_DELIVERED", { tipo_envio: "propio" }))], [["Entregado", true], ["No entregado", true]]);
eq("cancelado (sin resultado) → «Cancelado», finalizado; ML entregado después de un «No entregado» → «Entregado»",
  [v(d(1, "CANCELLED")), v(d(2, "DELIVERED", "NOT_DELIVERED"))], [["Cancelado", true], ["Entregado", true]]);
eq("nunca «Resuelta» ni «En calle»", [d(1, "OUT_FOR_DELIVERY"), d(2, "DELIVERED"), d(3, "CANCELLED")].map((x) => deliveryView(x).label).some((l) => /Resuelta|En calle/.test(l)), false);
eq("Mercado Libre se reconoce por el proveedor (no solo Flex)",
  [providerGoverned(d(1, "X", null, { tipo_envio: "otro", provider: "mercadolibre" })), providerGoverned(d(2, "X", null, { tipo_envio: "flex", provider: undefined })), providerGoverned(d(3, "X", null, { tipo_envio: "propio", provider: "tiendanube" }))], [true, true, false]);

// Paradas: pendientes y finalizadas.
{
  const s1 = stop("PENDING", [d(1, "DELIVERED", "DELIVERED")], { id: 1, sequence: 3 });
  const s2 = stop("PENDING", [d(2, "DELIVERED", "DELIVERED"), d(3, "OUT_FOR_DELIVERY")], { id: 2, sequence: 1 });
  const s3 = stop("SKIPPED", [d(4, "OUT_FOR_DELIVERY")], { id: 3, sequence: 2 });
  const s4 = stop("PENDING", [d(5, "OUT_FOR_DELIVERY")], { id: 4, sequence: 4 });
  const split = splitStops([s1, s2, s3, s4]);
  eq("parada mixta (uno entregado, otro en camino): sigue en pendientes; todo por sequence", [split.pending.map((s) => s.id), split.finished.map((s) => s.id)], [[2, 4], [3, 1]]);
  eq("una parada vacía no se da por terminada", stopFinished(stop("PENDING", [])), false);
  eq("progreso por envío", routeProgress([s1, s2, s3, s4]), { total: 5, pending: 3, finished: 2 });
  eq("estado de la parada: el del envío; con varios, por estado", [stopStateLabel(s1), stopStateLabel(s2), stopStateLabel(s3), stopStateLabel(stop("ARRIVED", [d(9, "OUT_FOR_DELIVERY")]))],
    ["Entregado", "Entregado: 1 · En camino: 1", "Salteada · En camino", "Llegaste · En camino"]);
  eq("finalizar un reparto: con todo terminado sí, con una pendiente no", [routeCanFinish({ type: "DELIVERY", stops: [s1, s3] }), routeCanFinish({ type: "DELIVERY", stops: [s1, s4] })], [true, false]);
  const cancelled = stop("PENDING", [d(6, "CANCELLED")], { id: 6 });
  const mlNot = stop("ARRIVED", [d(7, "OUT_FOR_DELIVERY", null, { status_ml: "not_delivered" })], { id: 7 });
  eq("al finalizar la app cierra solo lo terminado que el servidor no cierra (cancelado, no entregado de ML)",
    stopsToCloseOnFinish([s1, s3, s4, cancelled, mlNot], "DELIVERY").map((s) => s.id), [6, 7]);
  eq("en Turbo y colecta no cierra nada", stopsToCloseOnFinish([cancelled], "TURBO"), []);
  eq("envíos de ML que ML todavía no cerró", awaitingProvider(stop("PENDING", [d(1, "OUT_FOR_DELIVERY", null, { provider: "mercadolibre" }), d(2, "DELIVERED", "DELIVERED"), d(3, "OUT_FOR_DELIVERY", null, { tipo_envio: "propio" })])).map((x) => x.delivery_id), [1]);
}

console.log(failed ? `\n${failed} FALLAS` : "\nOK");
if (failed) process.exit(1);
