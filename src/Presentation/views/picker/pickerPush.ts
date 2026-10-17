// src/Presentation/views/picker/pickerPush.ts
// Push para el Picker: PRUEBA TEMPORAL y controlada. Solo se registra el
// dispositivo de los usuarios listados en EXPO_PUBLIC_PICKER_PUSH_USERS
// (usernames separados por coma, fuera del código). Sin esa variable no se
// registra nadie. Ese usuario recibe los avisos generales de administradores
// (NotifyAllAdmins / por perfil del servidor): pueden traer información
// administrativa, por eso no se habilita para todos los Pickers.
//
// La bandeja sale siempre del servidor (/notifications/my): el push solo
// actualiza la campana y, al tocarlo, abre la bandeja. No se guarda nada en el
// contexto local de notificaciones, así no hay duplicados.

import { useContext, useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";

import { UserContext } from "../../context/UserContext";
import { setupPushAndRegisterDevice } from "../../config/Push";
import { refreshUnreadCount } from "./notificationsApi";

export const pickerPushEnabledFor = (
  username: string | null | undefined,
  configured: string | undefined = process.env.EXPO_PUBLIC_PICKER_PUSH_USERS,
) => {
  const name = String(username ?? "").trim().toLowerCase();
  if (!name || !configured) return false;
  return configured
    .split(",")
    .map((u) => u.trim().toLowerCase())
    .includes(name);
};

// Una misma notificación tocada puede llegar por el listener y por
// getLastNotificationResponseAsync: se abre la bandeja una sola vez.
const opened = new Set<string>();

export function usePickerPush(openInbox: () => void) {
  const { user } = useContext(UserContext);
  const openRef = useRef(openInbox);
  openRef.current = openInbox;

  const userId = user?.id;
  const username = user?.username;

  useEffect(() => {
    if (!userId || !pickerPushEnabledFor(username)) return;
    let alive = true;

    const open = (response: Notifications.NotificationResponse | null) => {
      const id = response?.notification?.request?.identifier;
      if (!alive || !id || opened.has(id)) return;
      opened.add(id);
      refreshUnreadCount();
      openRef.current();
    };

    setupPushAndRegisterDevice({ userId, username: username!, rol: "admin" }).catch(() => undefined);
    const received = Notifications.addNotificationReceivedListener(() => refreshUnreadCount());
    const tapped = Notifications.addNotificationResponseReceivedListener(open);
    // App abierta desde una notificación con la app cerrada.
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined);

    return () => {
      alive = false;
      received.remove();
      tapped.remove();
    };
  }, [userId, username]);
}
