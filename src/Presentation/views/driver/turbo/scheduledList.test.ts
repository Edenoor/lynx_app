// Pruebas de scheduledList.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/scheduled-list --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/turbo/scheduledList.ts src/Presentation/views/driver/turbo/scheduledList.test.ts
//   node /tmp/scheduled-list/turbo/scheduledList.test.js

import { filterScheduled, hasMine, promiseText, sortScheduled, storesOf } from "./scheduledList";
import type { ScheduledTurbo } from "./turboApi";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

const TODAY = "2026-11-05";
const t = (route_id: number, over: Partial<ScheduledTurbo> = {}): ScheduledTurbo => ({
  route_id, delivery_id: route_id * 10, scheduled_date: "2026-11-06", window_start_at: "2026-11-06T12:00:00Z", deadline_at: "2026-11-06T15:00:00Z",
  store_name: "Beta", store_address: "Retiro 1", delivery_address: "Entrega 1", delivery_postal_code: "1425", receiver_name: "Ana", offered_to_me: false, ...over,
});
const hora = (iso: string) => iso.slice(11, 16);
const ids = (xs: { route_id: number }[]) => xs.map((x) => x.route_id);

const list = [
  t(1, { store_name: "Beta", window_start_at: "2026-11-06T15:00:00Z", deadline_at: "2026-11-06T18:00:00Z" }),
  t(2, { store_name: "alfa", offered_to_me: true }),
  t(3, { store_name: null, window_start_at: null, deadline_at: "2026-11-06T13:00:00Z" }),
  t(4, { store_name: "Beta", window_start_at: null, deadline_at: null, scheduled_date: "2026-11-07" }),
];

eq("tiendas por nombre (sin nombre, con etiqueta)", storesOf(list), ["alfa", "Beta", "Tienda sin nombre"]);
eq("hay de mis tiendas", [hasMine(list), hasMine([t(9)])], [true, false]);
eq("filtro: todas", ids(filterScheduled(list, { kind: "all" })), [1, 2, 3, 4]);
eq("filtro: mis tiendas (ofrecidos como chofer de la tienda)", ids(filterScheduled(list, { kind: "mine" })), [2]);
eq("filtro: una tienda", ids(filterScheduled(list, { kind: "store", name: "Beta" })), [1, 4]);
eq("filtro: la tienda sin nombre", ids(filterScheduled(list, { kind: "store", name: "Tienda sin nombre" })), [3]);
eq("orden por promesa: franja antes, sin franja por su día, al final", ids(sortScheduled(list, "promise")), [2, 3, 1, 4]);
eq("orden por tienda y, dentro, por promesa", ids(sortScheduled(list, "store")), [2, 1, 4, 3]);
eq("ordenar no cambia la lista original", ids(list), [1, 2, 3, 4]);
eq("promesa: día y franja", promiseText(list[1], TODAY, hora), "Mañana, viernes 06/11 · 12:00 a 15:00");
eq("promesa: solo el fin", promiseText(list[2], TODAY, hora), "Mañana, viernes 06/11 · antes de las 13:00");
eq("promesa: solo el día", promiseText(list[3], TODAY, hora), "Sábado 07/11");
eq("promesa: sin datos", promiseText(t(5, { scheduled_date: "", window_start_at: null, deadline_at: null }), TODAY, hora), "Sin promesa informada");

console.log(failed ? `\n${failed} FALLAS` : "\nOK");
if (failed) process.exit(1);
