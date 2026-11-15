// src/Presentation/navigator/driverTabs.ts
// Secciones de la barra del chofer sobre el stack único de DriverStackNavigator.
//
// En React Navigation 7, `navigate` apila una pantalla nueva salvo que sea la
// que está a la vista: tocar la barra varias veces dejaba Inicio, Envíos,
// Colectas, Inicio… y Atrás las recorría todas. Acá cambiar de sección deja
// el stack en [Inicio, raíz de la sección] (o solo [Inicio]), reusando la
// `key` de las pantallas que ya estaban: Inicio no se vuelve a montar y Envíos
// conserva su modalidad. Lo de adentro de una sección (Recorridos, Detalle,
// Organizar) sigue entrando con `navigate`: ese es su historial.
//
// Una pantalla con algo sin guardar pregunta antes de salir (pendingWork.tsx):
// `reset` pasa por el mismo aviso que Atrás.
// Sin React: se prueba con node.

import type { DriverTabKey } from "../components/DriverBottomNavigation";

export const DRIVER_HOME = "DriverScreen";

export const DRIVER_TAB_ROOT: Record<DriverTabKey, string> = {
  home: DRIVER_HOME,
  deliveries: "EnviosScreen",
  scan: "DriverScanOptionsScreen",
  collections: "CollectionsScreen",
  activity: "NotificationsScreen",
};

export type StackRoute = { key?: string; name: string; params?: object };
export type StackReset = { index: number; routes: StackRoute[] };

// El stack que deja tocar `tab` con `routes` abiertas (la última es la que se
// ve). null: ya se está en la raíz de esa sección y no hay nada que hacer.
export function tabStack(routes: readonly StackRoute[], tab: DriverTabKey): StackReset | null {
  const root = DRIVER_TAB_ROOT[tab];
  const home = routes.find((r) => r.name === DRIVER_HOME) ?? { name: DRIVER_HOME };
  let next: StackRoute[] = [home];
  if (tab !== "home") {
    const existing = [...routes].reverse().find((r) => r.name === root);
    next = [home, existing ?? { name: root }];
  }
  const same = next.length === routes.length && next.every((r, i) => !!r.key && r.key === routes[i].key);
  return same ? null : { index: next.length - 1, routes: next };
}

// La `navigation` del stack del chofer (o una simulada en las pruebas).
type StackNavigation = {
  getState(): { index: number; routes: readonly StackRoute[] } | undefined;
  reset(state: any): void;
};

// Cambiar de sección (la barra, «ver en Inicio», «ver en Envíos»).
export function goToDriverTab(navigation: StackNavigation, tab: DriverTabKey) {
  const state = navigation.getState();
  const routes = state ? state.routes.slice(0, state.index + 1) : [];
  const next = tabStack(routes, tab);
  if (next) navigation.reset(next);
}
