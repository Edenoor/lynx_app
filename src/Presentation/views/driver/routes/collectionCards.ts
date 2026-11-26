// src/Presentation/views/driver/routes/collectionCards.ts
// Una tarjeta por colecta habitual (10-nov): las ejecuciones diarias de un
// mismo horario de plantilla (template_departure_id) se muestran juntas, con
// los días, la hora y las tiendas, la ejecución de hoy (para operarla) y la de
// mañana (para confirmar la asistencia). Dos horarios de una plantilla son dos
// tarjetas. Una colecta eventual sigue siendo una tarjeta por recorrido. Las
// ejecuciones y sus estados los decide el servidor; acá solo se agrupan.
// Sin React: se prueba con node.

import type { RouteSummary } from "./routesApi";
import { pickupAnswer, PickupAnswer } from "./pickupConfirmation";
import { executionDayLabel } from "./collectionLabels";

export type HabitualCard = {
  kind: "habitual";
  key: string;
  name: string;
  days: string | null;
  time: string | null;
  stores: number;
  // La de hoy (si hay y no terminó) se abre para operarla; la de mañana pide confirmación.
  today: RouteSummary | null;
  tomorrow: RouteSummary | null;
  // Qué se abre al tocar la tarjeta: la de hoy, si no la próxima.
  open: RouteSummary;
};
export type EventualCard = { kind: "eventual"; key: string; route: RouteSummary };
export type CollectionCardModel = HabitualCard | EventualCard;

const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const weekdayOf = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).getUTCDay();

// «Lunes a viernes», «Todos los días», «Lun, Mié y Vie»…
export function weekdaysLabel(days: number[]): string | null {
  const set = [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  if (!set.length) return null;
  const is = (...want: number[]) => set.length === want.length && want.every((d) => set.includes(d));
  if (is(0, 1, 2, 3, 4, 5, 6)) return "Todos los días";
  if (is(1, 2, 3, 4, 5)) return "Lunes a viernes";
  if (is(1, 2, 3, 4, 5, 6)) return "Lunes a sábado";
  if (is(0, 6)) return "Fin de semana";
  // El domingo al final, como en un calendario de trabajo.
  const names = [...set.filter((d) => d !== 0), ...set.filter((d) => d === 0)].map((d) => DAY_SHORT[d]);
  return names.length === 1 ? `Solo ${names[0].toLowerCase()}` : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

// Un servidor anterior no manda template_departure_id: se agrupa por
// plantilla y hora, que es lo mismo (un horario por hora en cada plantilla).
const habitualKey = (r: RouteSummary) =>
  r.template_departure_id ? `d${r.template_departure_id}` : `t${r.template_id}|${(r.departure_time ?? "").slice(0, 5)}`;

const FINISHED = new Set(["COMPLETED", "CANCELLED"]);

export function collectionCards(routes: RouteSummary[], todayIso: string, tomorrowIso: string): CollectionCardModel[] {
  const pickups = routes.filter((r) => r.type === "PICKUP");
  const groups = new Map<string, RouteSummary[]>();
  const eventual: EventualCard[] = [];
  for (const r of pickups) {
    if (!r.template_id) { eventual.push({ kind: "eventual", key: `r${r.id}`, route: r }); continue; }
    const k = habitualKey(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const habitual: HabitualCard[] = [...groups.entries()].map(([key, list]) => {
    const byDate = [...list].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date) || a.id - b.id);
    const on = (iso: string) => byDate.find((r) => r.scheduled_date.slice(0, 10) === iso) ?? null;
    const today = on(todayIso);
    const tomorrow = on(tomorrowIso);
    const upcoming = byDate.find((r) => r.scheduled_date.slice(0, 10) >= todayIso && !FINISHED.has(r.status)) ?? byDate[byDate.length - 1];
    const sample = today ?? tomorrow ?? upcoming;
    // Los días salen del horario de la plantilla; si el servidor no los manda,
    // de las fechas de las ejecuciones que llegaron (la próxima semana).
    const days = sample.template_weekdays?.length ? sample.template_weekdays : byDate.map((r) => weekdayOf(r.scheduled_date));
    return {
      kind: "habitual", key, name: sample.template_name || `Colecta #${sample.id}`,
      days: weekdaysLabel(days), time: sample.departure_time ? sample.departure_time.slice(0, 5) : null, stores: sample.stops_count,
      today: today && !FINISHED.has(today.status) ? today : null,
      tomorrow,
      open: today && !FINISHED.has(today.status) ? today : upcoming,
    };
  });
  habitual.sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99") || a.name.localeCompare(b.name));
  eventual.sort((a, b) => a.route.scheduled_date.localeCompare(b.route.scheduled_date) || (a.route.departure_time ?? "").localeCompare(b.route.departure_time ?? ""));
  return [...habitual, ...eventual];
}

// Lo que la tarjeta dice de mañana. null = mañana no hay colecta (o ya no se
// confirma: salió o se canceló) y no se pregunta nada.
export type TomorrowPrompt = { answer: PickupAnswer; text: string; canAccept: boolean; canDecline: boolean } | null;
export function tomorrowPrompt(card: HabitualCard): TomorrowPrompt {
  const answer = card.tomorrow ? pickupAnswer(card.tomorrow) : null;
  if (!answer) return null;
  if (answer === "ACCEPTED") return { answer, text: "Asistencia confirmada para mañana.", canAccept: false, canDecline: false };
  if (answer === "DECLINED") return { answer, text: "Avisaste que mañana no podés. Si podés, confirmala.", canAccept: true, canDecline: false };
  return { answer, text: "¿Confirmás tu asistencia para mañana?", canAccept: true, canDecline: true };
}

// Lo que la tarjeta pregunta, día por día (26-nov). Antes los botones de la
// tarjeta eran solo para MAÑANA: con la colecta de hoy sin aceptar, el chofer
// tocaba ✓, quedaba aceptada la de mañana y la de hoy seguía sin poder
// comenzarse. Ahora la de hoy va primero, con su día escrito, y la de mañana
// después. Cada renglón dice a qué recorrido responde.
export type DayPrompt = {
  day: "today" | "tomorrow"; route: RouteSummary; label: string;
  answer: PickupAnswer; text: string; canAccept: boolean; canDecline: boolean;
};
export function dayPrompts(card: HabitualCard, todayIso: string): DayPrompt[] {
  const out: DayPrompt[] = [];
  const todayAnswer = card.today ? pickupAnswer(card.today) : null;
  if (card.today && todayAnswer) {
    const label = executionDayLabel(card.today.scheduled_date, todayIso).toUpperCase() || "HOY";
    out.push(
      todayAnswer === "ACCEPTED" ? { day: "today", route: card.today, label, answer: todayAnswer, text: "Aceptada. Abrila para comenzarla.", canAccept: false, canDecline: false }
      : todayAnswer === "DECLINED" ? { day: "today", route: card.today, label, answer: todayAnswer, text: "Avisaste que hoy no podés. Si podés, confirmala.", canAccept: true, canDecline: false }
      : { day: "today", route: card.today, label, answer: todayAnswer, text: "¿Podés hacer la colecta de hoy?", canAccept: true, canDecline: true },
    );
  }
  const t = tomorrowPrompt(card);
  if (t && card.tomorrow) {
    const label = executionDayLabel(card.tomorrow.scheduled_date, todayIso).toUpperCase() || "MAÑANA";
    out.push({ day: "tomorrow", route: card.tomorrow, label, ...t });
  }
  return out;
}

// Desde el detalle de una colecta de otro día: la ejecución de HOY del mismo
// horario, si existe y todavía se puede operar. Sirve para ofrecer «Abrir la
// de hoy» cuando el chofer entró a la de mañana (por el aviso, por ejemplo).
export function todaySibling(route: RouteSummary, sameDay: RouteSummary[], todayIso: string): RouteSummary | null {
  if (!route.template_id || route.scheduled_date.slice(0, 10) === todayIso) return null;
  const same = (r: RouteSummary) =>
    route.template_departure_id ? r.template_departure_id === route.template_departure_id
      : r.template_id === route.template_id && (r.departure_time ?? "").slice(0, 5) === (route.departure_time ?? "").slice(0, 5);
  return sameDay.find((r) => r.type === "PICKUP" && r.id !== route.id && r.scheduled_date.slice(0, 10) === todayIso && !FINISHED.has(r.status) && same(r)) ?? null;
}
