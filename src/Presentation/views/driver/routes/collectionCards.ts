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
