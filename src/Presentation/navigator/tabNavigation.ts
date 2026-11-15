// Navegación a las pestañas de la barra inferior (Driver y Picker).
// Las pestañas viven en un navegador de tabs anidado en el stack de cada
// área: cada una queda montada y recuerda su estado. Ir a una pestaña desde
// cualquier pantalla (otra pestaña, un detalle apilado, un push) es volver al
// navegador de tabs y elegirla: nunca se apila otra copia.

import { StackActions } from "@react-navigation/native";

export const DRIVER_TABS = "DriverTabs";
export const PICKER_TABS = "PickerTabs";

type Dispatcher = { dispatch: (action: any) => void };

// merge: sin parámetros nuevos la pestaña conserva los que tenía.
export function goToTab(navigation: Dispatcher, tabs: string, screen: string, params?: object) {
  navigation.dispatch(StackActions.popTo(tabs, { screen, params, merge: true }));
}

export type DriverTabScreen =
  | "DriverScreen"
  | "EnviosScreen"
  | "DriverScanOptionsScreen"
  | "CollectionsScreen"
  | "NotificationsScreen";

export const goToDriverTab = (navigation: Dispatcher, screen: DriverTabScreen, params?: object) =>
  goToTab(navigation, DRIVER_TABS, screen, params);

export type PickerTabScreen = "PickerHomeScreen" | "PickerScanOptionsScreen" | "PickerNotificationsScreen";

export const goToPickerTab = (navigation: Dispatcher, screen: PickerTabScreen, params?: object) =>
  goToTab(navigation, PICKER_TABS, screen, params);
