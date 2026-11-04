// Pruebas de driverWork.ts (modalidad, recorridos abiertos, períodos y misión
// activa). El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/driver-work --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/work/driverWork.test.ts
//   node /tmp/driver-work/work/driverWork.test.js

import {
  buildMissions,
  closedOf,
  dayLabel,
  daysBetween,
  deliveriesInRoute,
  flexInProgress,
  isOpenRoute,
  mergeOpenRoutes,
  missionFromGroup,
  missionFromRoute,
  periodDays,
  periodLabel,
  previousDays,
  routeModality,
  routeNextAction,
  routeProgress,
  runningRouteIds,
  turboInProgress,
  turboScheduled,
} from "./driverWork";
import type { RouteDetail, RouteSummary, Stop } from "../routes/routesApi";
import type { GroupTurbo, TurboGroup } from "../turbo/turboApi";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

const TODAY = "2026-11-04";
const route = (id: number, type: string, status: string, date = TODAY, extra: Partial<RouteSummary> = {}): RouteSummary =>
  ({ id, type, status, scheduled_date: date, stops_count: 2, deliveries_count: 3, load_expected_count: null, load_confirmed_count: null, ...extra } as RouteSummary);
const stop = (id: number, sequence: number, type: "PICKUP" | "DELIVERY", status: Stop["status"], extra: Partial<Stop> = {}): Stop =>
  ({ id, route_id: 1, sequence, type, status, arrived_at: null, completed_at: null, notes: null, deliveries: [], ...extra } as Stop);
const detail = (r: RouteSummary, stops: Stop[]): RouteDetail => ({ ...r, qr_token: "x", notes: null, started_at: null, completed_at: null, stops });
const turbo = (route_id: number, extra: Partial<GroupTurbo> = {}): GroupTurbo =>
  ({ route_id, route_status: "IN_PROGRESS", delivery_id: route_id * 10, store_id: 1, store_name: "FIX SALUD", pickup_status: "DONE", dropoff_status: "PENDING", ops_status: "OUT_FOR_DELIVERY", address: `Calle ${route_id}`, receiver_name: null, ...extra } as GroupTurbo);
const group = (id: number, status: TurboGroup["status"], turbos: GroupTurbo[], date = TODAY, storeStatus: "PENDING" | "ARRIVED" | "DONE" = "DONE"): TurboGroup =>
  ({ id, scheduled_date: date, kind: "X", status, plan_at: null, estimated: false, turbos,
    stores: [{ store_id: 1, store_name: "FIX SALUD", store_address: null, latitude: null, longitude: null, turbos: turbos.length, collected: 0, pickup_status: storeStatus, eta: null }] });

// 1) Modalidad: por el tipo del recorrido; lo desconocido no se fuerza a Turbo ni Flex.
eq("TURBO → turbo", routeModality({ type: "TURBO" } as any), "turbo");
eq("DELIVERY → flex", routeModality({ type: "DELIVERY" } as any), "flex");
eq("PICKUP → colecta", routeModality({ type: "PICKUP" } as any), "colecta");
eq("tipo nuevo → otro", routeModality({ type: "SHELF_RUN" } as any), "otro");
eq("abierto: ASSIGNED, LOADED, IN_PROGRESS, PLANNED", ["ASSIGNED", "LOADED", "IN_PROGRESS", "PLANNED"].map((s) => isOpenRoute({ status: s } as any)), [true, true, true, true]);
eq("cerrado: COMPLETED y CANCELLED", ["COMPLETED", "CANCELLED"].map((s) => isOpenRoute({ status: s } as any)), [false, false]);

// 2) Días: hacia atrás, rangos y etiquetas.
eq("7 días anteriores, del más nuevo al más viejo", previousDays(TODAY, 3), ["2026-11-03", "2026-11-02", "2026-11-01"]);
eq("cruza de mes", previousDays("2026-03-01", 1), ["2026-02-28"]);
eq("rango con extremos", daysBetween("2026-10-30", "2026-11-02"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
eq("etiquetas: hoy, ayer, mañana", [dayLabel(TODAY, TODAY), dayLabel("2026-11-03", TODAY), dayLabel("2026-11-05", TODAY)], ["hoy", "ayer", "mañana"]);
eq("etiqueta de otro día", dayLabel("2026-11-02", TODAY), "lunes 2/11");
eq("período hoy / ayer / todo", [periodDays({ kind: "today" }, TODAY), periodDays({ kind: "yesterday" }, TODAY), periodDays({ kind: "all" }, TODAY)], [[TODAY], ["2026-11-03"], null]);
eq("rango al revés se da vuelta", periodDays({ kind: "range", from: "2026-11-02", to: "2026-11-01" }, TODAY), ["2026-11-01", "2026-11-02"]);
eq("etiqueta del rango", [periodLabel({ kind: "range", from: "2026-11-01", to: "2026-11-03" }), periodLabel({ kind: "range", from: "2026-11-01", to: "2026-11-01" })], ["01/11 → 03/11", "01/11"]);

// 3) Abiertos de varios días: sin repetir, sin cerrados, lo más viejo primero.
{
  const merged = mergeOpenRoutes([
    [route(11, "DELIVERY", "ASSIGNED"), route(14, "DELIVERY", "COMPLETED")],
    [route(8, "DELIVERY", "IN_PROGRESS", "2026-11-02")],
    [route(8, "DELIVERY", "IN_PROGRESS", "2026-11-02"), route(5, "TURBO", "CANCELLED", "2026-11-01")],
  ]);
  eq("abiertos sin repetir y el de días atrás primero", merged.map((r) => r.id), [8, 11]);
}
eq("envíos en recorrido (ops del servidor)", deliveriesInRoute([{ ops_status: "OUT_FOR_DELIVERY" }, { ops_status: "assigned_to_route" }, { ops_status: "DELIVERED" }, {}]), 2);

// 4) Listas por modalidad.
{
  const open = [
    route(8, "DELIVERY", "IN_PROGRESS", "2026-11-02"),
    route(11, "DELIVERY", "ASSIGNED"),
    route(12, "TURBO", "IN_PROGRESS", TODAY, { turbo_group_id: 70 }),
    route(13, "TURBO", "ASSIGNED"),
    route(20, "TURBO", "ASSIGNED", "2026-11-05"),
    route(30, "PICKUP", "ASSIGNED"),
    route(31, "SHELF_RUN", "IN_PROGRESS"),
  ];
  const groups = [group(70, "IN_PROGRESS", [turbo(12)]), group(71, "DONE", [turbo(99, { route_status: "COMPLETED" })])];
  const turboItems = turboInProgress(open, groups, TODAY);
  eq("Turbo en curso: el grupo vivo y el Turbo suelto; sin el de mañana ni el grupo cerrado",
    turboItems.map((i) => (i.kind === "group" ? `g${i.group.id}` : `r${i.route.id}`)), ["g70", "r13"]);
  eq("Flex en curso: repartos abiertos, también de días anteriores; sin colectas ni tipos desconocidos",
    flexInProgress(open, TODAY).map((i) => (i.kind === "route" ? i.route.id : 0)), [8, 11]);
  eq("Sin grupos (servidor anterior): los Turbos de a uno", turboInProgress(open, [], TODAY).map((i) => (i.kind === "route" ? i.route.id : 0)), [12, 13]);
  eq("Mañana: mis grupos y Turbos abiertos de ese día", turboScheduled([route(20, "TURBO", "ASSIGNED", "2026-11-05"), route(21, "TURBO", "ASSIGNED", "2026-11-05", { turbo_group_id: 80 }), route(22, "DELIVERY", "ASSIGNED", "2026-11-05")], [group(80, "ASSIGNED", [turbo(21)], "2026-11-05")])
    .map((i) => (i.kind === "group" ? `g${i.group.id}` : `r${i.route.id}`)), ["g80", "r20"]);
  eq("Finalizados: solo cerrados de la modalidad", closedOf([route(1, "DELIVERY", "COMPLETED"), route(2, "TURBO", "COMPLETED"), route(3, "DELIVERY", "IN_PROGRESS"), route(4, "DELIVERY", "CANCELLED")], "flex").map((r) => r.id), [1, 4]);
  eq("detalle solo de los en curso sin grupo", runningRouteIds(open, groups), [8, 31]);
}

// 5) Próxima acción y progreso de un recorrido.
{
  const r = route(8, "DELIVERY", "IN_PROGRESS");
  const d = detail(r, [
    stop(1, 1, "DELIVERY", "DONE", { address: "Mitre 10" }),
    stop(2, 2, "DELIVERY", "SKIPPED", { address: "Paso 5" }),
    stop(3, 3, "DELIVERY", "PENDING", { address: "Lavalle 300", receiver_name: "Ana" }),
    stop(4, 4, "DELIVERY", "PENDING", { address: "Sarmiento 1" }),
  ]);
  eq("próxima: la primera abierta por secuencia", routeNextAction(d), "Entregá en Lavalle 300 · Ana");
  eq("progreso: cerradas y salteadas cuentan", routeProgress(d), { done: 2, total: 4, label: "2 de 4 paradas" });
  eq("parada en la que ya llegó", routeNextAction(detail(r, [stop(1, 1, "PICKUP", "ARRIVED", { store_name: "Tienda A" })])), "Estás en Tienda A: cerrá la parada");
  eq("retiro en un Dropoff (sin tienda)", routeNextAction(detail(r, [stop(1, 1, "PICKUP", "PENDING", { warehouse_name: "Dropoff Norte" })])), "Retirá en Dropoff Norte");
  eq("todo cerrado → cerrar el recorrido", routeNextAction(detail(r, [stop(1, 1, "DELIVERY", "DONE")])), "Cerrá el recorrido");
  eq("sin paradas: sin progreso", routeProgress(detail(r, [])), null);
}

// 6) Misión activa.
{
  const old = route(8, "DELIVERY", "IN_PROGRESS", "2026-11-03");
  const m = missionFromRoute(old, null, TODAY);
  eq("sin detalle: no inventa la próxima parada", [m.nextAction, m.progress], ["Abrí el recorrido para ver la próxima parada", null]);
  eq("de otro día: lo dice", m.since, "Desde ayer");
  eq("abre el detalle del recorrido", m.target, { screen: "RouteDetailScreen", params: { routeId: 8 } });
  const col = missionFromRoute(route(30, "PICKUP", "IN_PROGRESS", TODAY, { template_name: "MAÑANERO 02" }), null, TODAY);
  eq("colecta con plantilla: nombre en el título y en la navegación", [col.title, col.target], ["Colecta · MAÑANERO 02", { screen: "RouteDetailScreen", params: { routeId: 30, name: "MAÑANERO 02" } }]);
  eq("tipo desconocido: «Recorrido», sin asumir Turbo/Flex", [missionFromRoute(route(31, "SHELF_RUN", "IN_PROGRESS"), null, TODAY).title, missionFromRoute(route(31, "SHELF_RUN", "IN_PROGRESS"), null, TODAY).modality], ["Recorrido #31", "otro"]);

  const g = group(70, "IN_PROGRESS", [turbo(12, { dropoff_status: "DONE" }), turbo(13, { address: "Belgrano 9", receiver_name: "Luis" }), turbo(14, { route_status: "CANCELLED" })]);
  const gm = missionFromGroup(g, TODAY);
  eq("grupo con el retiro cerrado: la próxima entrega", gm.nextAction, "Entregá en Belgrano 9 · Luis");
  eq("grupo: progreso en entregas, sin los cancelados", gm.progress, { done: 1, total: 2, label: "1 de 2 entregas" });
  eq("grupo: abre su pantalla", gm.target, { screen: "TurboGroupScreen", params: { groupId: 70 } });
  eq("grupo con el retiro pendiente", missionFromGroup(group(70, "IN_PROGRESS", [turbo(12)], TODAY, "PENDING"), TODAY).nextAction, "Retirá en FIX SALUD");
  eq("grupo en la tienda", missionFromGroup(group(70, "IN_PROGRESS", [turbo(12)], TODAY, "ARRIVED"), TODAY).nextAction, "Estás en FIX SALUD: retirá los paquetes");

  const open = [route(12, "TURBO", "IN_PROGRESS", TODAY, { turbo_group_id: 70 }), old, route(11, "DELIVERY", "ASSIGNED"), route(30, "PICKUP", "IN_PROGRESS")];
  const missions = buildMissions(open, { 8: detail(old, [stop(1, 1, "DELIVERY", "PENDING", { address: "Mitre 10" })]) }, [group(70, "IN_PROGRESS", [turbo(12)])], TODAY);
  eq("varias a la vez: grupo, reparto de ayer y colecta; el Turbo del grupo no se repite; lo asignado no es misión",
    missions.map((x) => x.key), ["r8", "g70", "r30"]);
  eq("la de ayer primero, con su próxima parada", [missions[0].since, missions[0].nextAction], ["Desde ayer", "Entregá en Mitre 10"]);
  eq("sin nada en la calle: sin misiones", buildMissions([route(11, "DELIVERY", "ASSIGNED")], {}, [], TODAY), []);
}

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
