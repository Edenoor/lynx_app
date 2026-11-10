// Pruebas de collectionCards.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/collection-cards --module commonjs --target es2020 --strict --skipLibCheck \
//     --esModuleInterop --jsx react-jsx src/Presentation/views/driver/routes/collectionCards.test.ts
//   node /tmp/collection-cards/collectionCards.test.js

import { collectionCards, HabitualCard, tomorrowPrompt, weekdaysLabel } from "./collectionCards";
import type { RouteSummary } from "./routesApi";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

// Martes 10/11/2026: hoy; mañana miércoles 11.
const HOY = "2026-11-10", MANANA = "2026-11-11";
let next = 1;
const run = (date: string, extra: Partial<RouteSummary> = {}): RouteSummary => ({
  id: next++, type: "PICKUP", status: "ASSIGNED", scheduled_date: date, stops_count: 3, deliveries_count: 0,
  load_expected_count: null, load_confirmed_count: null, template_id: 9, template_name: "MAÑANERO 02", departure_time: "09:00:00",
  template_departure_id: 41, template_weekdays: [1, 2, 3, 4, 5], driver_confirmation: null, ...extra,
});
const semana = (extra: Partial<RouteSummary> = {}) =>
  ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-16"].map((d) => run(d, extra));
const habituales = (list: RouteSummary[]) => collectionCards(list, HOY, MANANA).filter((c): c is HabitualCard => c.kind === "habitual");

// 1) Lunes a viernes: una sola tarjeta.
let cards = habituales(semana());
eq("lunes a viernes → una tarjeta", cards.length, 1);
eq("con nombre, días, hora y tiendas", [cards[0].name, cards[0].days, cards[0].time, cards[0].stores], ["MAÑANERO 02", "Lunes a viernes", "09:00", 3]);

// 2) Dos horarios de la misma plantilla → dos tarjetas.
const tarde = ["2026-11-10", "2026-11-12"].map((d) => run(d, { template_departure_id: 42, departure_time: "15:00:00", template_weekdays: [2, 4] }));
cards = habituales([...semana(), ...tarde]);
eq("dos horarios → dos tarjetas, por horario", cards.map((c) => [c.time, c.days]), [["09:00", "Lunes a viernes"], ["15:00", "Mar y Jue"]]);
// Mismo nombre en dos plantillas distintas: no se mezclan.
cards = habituales([...semana(), run(MANANA, { template_id: 10, template_departure_id: 77 })]);
eq("mismo nombre, otra plantilla → otra tarjeta", cards.length, 2);

// 3) La confirmación es de la ejecución de mañana, y solo de esa.
const sem = semana();
let card = habituales(sem)[0];
eq("la de mañana es la del 11", [card.tomorrow?.id, card.tomorrow?.scheduled_date], [sem[1].id, MANANA]);
eq("pide confirmar mañana", tomorrowPrompt(card), { answer: "PENDING", text: "¿Confirmás tu asistencia para mañana?", canAccept: true, canDecline: true });

// 4) Ya confirmada.
card = habituales(semana().map((r) => (r.scheduled_date === MANANA ? { ...r, driver_confirmation: "ACCEPTED" as const } : r)))[0];
eq("confirmada", tomorrowPrompt(card)?.text, "Asistencia confirmada para mañana.");
eq("confirmada: sin botones", [tomorrowPrompt(card)?.canAccept, tomorrowPrompt(card)?.canDecline], [false, false]);
card = habituales(semana().map((r) => (r.scheduled_date === MANANA ? { ...r, driver_confirmation: "DECLINED" as const } : r)))[0];
eq("rechazada: puede volver a confirmar", [tomorrowPrompt(card)?.answer, tomorrowPrompt(card)?.canAccept], ["DECLINED", true]);

// 5) Mañana no hay colecta (plantilla de martes y jueves; hoy martes, mañana miércoles).
card = habituales(tarde)[0];
eq("mañana sin colecta → no pregunta", tomorrowPrompt(card), null);
// La de mañana ya salió o se canceló: tampoco se pregunta.
card = habituales(semana().map((r) => (r.scheduled_date === MANANA ? { ...r, status: "CANCELLED" as const } : r)))[0];
eq("mañana cancelada → no pregunta", tomorrowPrompt(card), null);

// 10) Eventuales: una tarjeta por recorrido, como antes.
const ev = run(MANANA, { template_id: null, template_name: null, template_departure_id: null, template_weekdays: null });
const all = collectionCards([...semana(), ev], HOY, MANANA);
eq("eventual aparte", all.map((c) => c.kind), ["habitual", "eventual"]);

// 11) La de hoy sigue accesible aunque la tarjeta pregunte por mañana.
const conHoy = semana();
card = habituales(conHoy)[0];
eq("se abre la de hoy", [card.today?.id, card.open.id], [conHoy[0].id, conHoy[0].id]);
eq("y a la vez pregunta por mañana", tomorrowPrompt(card)?.answer, "PENDING");
// Hoy terminada: se abre la próxima.
const terminada = semana().map((r) => (r.scheduled_date === HOY ? { ...r, status: "COMPLETED" as const } : r));
card = habituales(terminada)[0];
eq("hoy terminada → abre la próxima", [card.today, card.open.scheduled_date], [null, MANANA]);
// Hoy en curso: se abre esa.
card = habituales(semana().map((r) => (r.scheduled_date === HOY ? { ...r, status: "IN_PROGRESS" as const } : r)))[0];
eq("hoy en curso → abre la de hoy", card.open.status, "IN_PROGRESS");

// Servidor anterior (sin template_departure_id ni template_weekdays): plantilla + hora, días por las fechas.
const viejo = semana({ template_departure_id: null, template_weekdays: null });
cards = habituales(viejo);
eq("servidor anterior: una tarjeta igual", [cards.length, cards[0].days], [1, "Lunes a viernes"]);

eq("días", [weekdaysLabel([0, 1, 2, 3, 4, 5, 6]), weekdaysLabel([1, 2, 3, 4, 5, 6]), weekdaysLabel([6, 0]), weekdaysLabel([3]), weekdaysLabel([0, 1, 5]), weekdaysLabel([])],
  ["Todos los días", "Lunes a sábado", "Fin de semana", "Solo mié", "Lun, Vie y Dom", null]);

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
