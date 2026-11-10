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
//
// Un mensaje del chat interno (CHAT_MESSAGE) no es una notificación de la
// bandeja: al llegar pone al día el chat (lista, charla abierta y número) y,
// al tocarlo, abre esa charla.

import { useContext, useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";

import { UserContext } from "../../context/UserContext";
import { claimNotificationResponse, setupPushAndRegisterDevice } from "../../config/Push";
import { refreshUnreadCount } from "./notificationsApi";
import { conversationIdOf, isChatMessage } from "../../config/pushKind";
import { chatMessageArrived } from "../driver/chat/chatStore";

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
// getLastNotificationResponseAsync: se abre una sola vez. La cuenta de toques
// atendidos es la misma que la del chofer (claimNotificationResponse).

// openChat: con la charla del push, o null si no vino (abre la lista de chats).
export function usePickerPush(openInbox: () => void, openChat: (conversationId: number | null) => void) {
  const { user } = useContext(UserContext);
  const openRef = useRef(openInbox);
  openRef.current = openInbox;
  const chatRef = useRef(openChat);
  chatRef.current = openChat;

  const userId = user?.id;
  const username = user?.username;

  useEffect(() => {
    if (!userId || !pickerPushEnabledFor(username)) return;
    let alive = true;

    const open = (response: Notifications.NotificationResponse | null) => {
      const id = response?.notification?.request?.identifier;
      if (!alive || !claimNotificationResponse(id)) return;
      const data: any = response?.notification?.request?.content?.data ?? {};
      if (isChatMessage(data)) {
        chatMessageArrived();
        chatRef.current(conversationIdOf(data));
        return;
      }
      refreshUnreadCount();
      openRef.current();
    };

    setupPushAndRegisterDevice({ userId, username: username!, rol: "admin" }).catch(() => undefined);
    const received = Notifications.addNotificationReceivedListener((n) => {
      if (isChatMessage(n?.request?.content?.data)) chatMessageArrived();
      else refreshUnreadCount();
    });
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
