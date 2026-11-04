// src/Presentation/views/driver/work/workSource.ts
// Lee el trabajo del chofer (recorridos abiertos, grupos Turbo del día, el
// detalle de lo que está en la calle y si está habilitado para Turbo) y lo
// comparte entre Inicio, Envíos y Colectas: un solo pedido por ronda, que se
// reutiliza unos segundos.
//
// Recorridos de días anteriores: /v2/routes/mine devuelve un día por pedido.
// Mientras el servidor no mande los abiertos de todos los días (`open`, ver
// routesApi.fetchMyRoutesWithOpen), se revisan los últimos LOOKBACK_DAYS días
// y la pantalla dice desde qué día miró, con «Buscar más atrás» para seguir.
// Un día que no se pudo leer se informa; no se da por vacío.

import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { fetchMyRoutes, fetchMyRoutesWithOpen, fetchRoute, RouteDetail, RouteSummary, todayIso } from "../routes/routesApi";
import { fetchMyGroups, getAvailability, TurboGroup, TurboLoad } from "../turbo/turboApi";
import { errorMessage } from "../errorMessage";
import { buildMissions, mergeOpenRoutes, Mission, previousDays, runningRouteIds, turboScheduled, WorkItem } from "./driverWork";
import { sharedValue, useSharedValue } from "./sharedValue";

// «unsupported»: el servidor todavía no tiene esa función (404). Un 5xx, sin
// red o cualquier otro rechazo es «error» y se muestra como error.
export type SourceState = "ok" | "unsupported" | "error";

export type DriverWork = {
  today: string;
  openRoutes: RouteSummary[];
  // Desde qué día se revisaron los abiertos; null si el servidor los mandó todos.
  checkedFrom: string | null;
  failedDays: string[];
  groups: TurboGroup[];
  groupsState: SourceState;
  groupsError: string | null;
  turboLoad: TurboLoad | null;
  details: Record<number, RouteDetail>;
  // null: no se pudo saber.
  turboEnabled: boolean | null;
  missions: Mission[];
};

export type WorkState = { work: DriverWork | null; loading: boolean; error: string | null };

export const LOOKBACK_DAYS = 7;
const WORK_TTL_MS = 30_000;

// Un 404 en HTML (servidor sin la ruta) llega como «Respuesta inesperada del
// servidor (404)», sin status: también es «no soportado».
export function isUnsupported(e: unknown): boolean {
  const err = e as { status?: unknown; message?: unknown } | null | undefined;
  return Number(err?.status) === 404 || /\(404\)$/.test(String(err?.message ?? ""));
}

const state = sharedValue<WorkState>({ work: null, loading: false, error: null });
let loadedAt = 0;
let inflight: Promise<void> | null = null;
let lookback = LOOKBACK_DAYS;
// Si el servidor ya contestó `open`, no hace falta revisar día por día.
let serverSendsOpen = false;
// Sube al cerrar sesión: lo que estaba en vuelo ya no se publica.
let generation = 0;

type GroupsRead = { state: SourceState; groups: TurboGroup[]; load: TurboLoad | null; error: string | null };

// Grupos Turbo de un día. Un servidor sin grupos (404) no es un error: la
// lista sigue con los Turbos de a uno.
const readGroups = (date: string): Promise<GroupsRead> =>
  fetchMyGroups(date).then(
    (r) => ({ state: "ok" as SourceState, groups: r.groups ?? [], load: r.load ?? null, error: null }),
    (e) => ({
      state: (isUnsupported(e) ? "unsupported" : "error") as SourceState,
      groups: [],
      load: null,
      error: isUnsupported(e) ? null : errorMessage(e, "No se pudieron cargar los grupos Turbo"),
    })
  );

async function readWork(): Promise<DriverWork> {
  const today = todayIso();
  const days = serverSendsOpen ? [] : previousDays(today, lookback);
  const [current, before, groups, turboEnabled] = await Promise.all([
    // Sin los de hoy no hay pantalla: el error sube.
    fetchMyRoutesWithOpen(today),
    Promise.allSettled(days.map((d) => fetchMyRoutes(d))),
    readGroups(today),
    getAvailability().then((a) => (typeof a.turbo_enabled === "boolean" ? a.turbo_enabled : null), () => null),
  ]);
  serverSendsOpen = current.open;
  const failedDays = days.filter((_, i) => before[i].status === "rejected");
  const lists = [current.routes, ...before.flatMap((r) => (r.status === "fulfilled" ? [r.value ?? []] : []))];
  const openRoutes = mergeOpenRoutes(lists);

  const ids = runningRouteIds(openRoutes, groups.groups);
  const fetched = await Promise.allSettled(ids.map((id) => fetchRoute(id)));
  const details: Record<number, RouteDetail> = {};
  fetched.forEach((r, i) => { if (r.status === "fulfilled") details[ids[i]] = r.value; });

  return {
    today,
    openRoutes,
    checkedFrom: current.open ? null : days[days.length - 1] ?? today,
    failedDays,
    groups: groups.groups,
    groupsState: groups.state,
    groupsError: groups.error,
    turboLoad: groups.load,
    details,
    turboEnabled,
    missions: buildMissions(openRoutes, details, groups.groups, today),
  };
}

export function refreshDriverWork(force = false): Promise<void> {
  if (inflight) return inflight;
  const cur = state.get();
  if (!force && cur.work && Date.now() - loadedAt < WORK_TTL_MS) return Promise.resolve();
  state.set({ ...cur, loading: true });
  const gen = generation;
  inflight = readWork()
    .then((work) => {
      if (gen !== generation) return;
      loadedAt = Date.now();
      state.set({ work, loading: false, error: null });
    })
    .catch((e) => {
      if (gen !== generation) return;
      // Lo último que se leyó queda a la vista, con el error arriba.
      state.set({ ...state.get(), loading: false, error: errorMessage(e, "No se pudieron cargar tus recorridos") });
    })
    .finally(() => { if (gen === generation) inflight = null; });
  return inflight;
}

// «Buscar más atrás»: otra semana más de días anteriores.
export function searchFurtherBack(): Promise<void> {
  lookback += LOOKBACK_DAYS;
  return refreshDriverWork(true);
}

// Algo cambió (se aceptó una oferta, se cerró sesión): la próxima lectura va al servidor.
export function invalidateDriverWork() {
  loadedAt = 0;
}

// Para cerrar sesión o cambiar de chofer: nada de lo leído sirve.
export function resetDriverWork() {
  generation++;
  inflight = null;
  loadedAt = 0;
  lookback = LOOKBACK_DAYS;
  serverSendsOpen = false;
  state.set({ work: null, loading: false, error: null });
}

// La pantalla lee el trabajo al ganar el foco (si lo leído es viejo).
export function useDriverWork(): WorkState & { refresh: () => Promise<void>; searchFurtherBack: () => Promise<void> } {
  const value = useSharedValue(state);
  useFocusEffect(useCallback(() => { void refreshDriverWork(); }, []));
  return { ...value, refresh: () => refreshDriverWork(true), searchFurtherBack };
}

// ---------- Historial y programados (se piden al abrir esa vista) ----------

// Finalizados por rango: un pedido por día, así que el rango tiene tope.
export const HISTORY_MAX_DAYS = 14;

// Los recorridos de esos días. Un día que falla se informa; si fallan todos, error.
export async function fetchRoutesForDays(days: string[]): Promise<{ routes: RouteSummary[]; failedDays: string[] }> {
  const res = await Promise.allSettled(days.map((d) => fetchMyRoutes(d)));
  const failedDays = days.filter((_, i) => res[i].status === "rejected");
  const first = res.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (days.length && failedDays.length === days.length && first) throw first.reason;
  return { routes: res.flatMap((r) => (r.status === "fulfilled" ? r.value ?? [] : [])), failedDays };
}

// Turbo programado para un día (mañana): mis grupos y Turbos de ese día.
export async function fetchScheduledTurbo(date: string): Promise<{ items: WorkItem[]; groupsState: SourceState; groupsError: string | null }> {
  const [routes, groups] = await Promise.all([fetchMyRoutes(date), readGroups(date)]);
  return { items: turboScheduled(routes ?? [], groups.groups), groupsState: groups.state, groupsError: groups.error };
}
