// src/Presentation/views/driver/chat/chatStore.ts
// Mensajes sin leer del chofer, compartidos entre la barra (el número de
// Alertas), la pestaña Mensajes y la charla: se piden una vez y se reutilizan
// unos segundos. Y el aviso de que llegó un mensaje (push con la app abierta),
// para que la lista y la charla abiertas se pongan al día sin esperar su sondeo.

import { fetchUnread } from "./chatApi";
import { sharedValue, useSharedValue } from "../work/sharedValue";
import { goToDriverTab, goToPickerTab } from "../../../navigator/tabNavigation";

const UNREAD_TTL_MS = 30_000;

// null: todavía no se sabe (o no se pudo leer nunca).
const unread = sharedValue<number | null>(null);
let unreadAt = 0;
let inflight: Promise<void> | null = null;
// Sube al cerrar sesión: lo que estaba en vuelo ya no se publica.
let generation = 0;

export function publishChatUnread(n: number) {
  unreadAt = Date.now();
  unread.set(n);
}

// Si el pedido falla queda el último número conocido.
export function refreshChatUnread(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && unread.get() !== null && Date.now() - unreadAt < UNREAD_TTL_MS) return Promise.resolve();
  const gen = generation;
  inflight = fetchUnread()
    .then((n) => { if (gen === generation) publishChatUnread(n); })
    .catch(() => {})
    .finally(() => { if (gen === generation) inflight = null; });
  return inflight;
}

export const useChatUnread = () => useSharedValue(unread);

// Cuenta los mensajes que llegaron por push: la lista y la charla abiertas se
// suscriben y recargan.
const arrivals = sharedValue(0);
export function chatMessageArrived() {
  arrivals.set(arrivals.get() + 1);
  void refreshChatUnread(true);
}
export const useChatArrivals = () => useSharedValue(arrivals);

// Al cerrar sesión: nada de esto es del próximo chofer.
export function resetChatStore() {
  generation++;
  inflight = null;
  unreadAt = 0;
  unread.set(null);
}

// La lista de chats es la pestaña «Mensajes» de Alertas, que es una pestaña
// de la barra: se vuelve a ella (lo apilado encima se cierra), nunca se apila
// otra. Vale igual si se llegó sin pasar por la lista (un push, Inicio).
type TabNav = { dispatch: (action: any) => void };

export const openChatList = (navigation: TabNav) => goToDriverTab(navigation, "NotificationsScreen", { tab: "messages" });

// Volver desde una charla o el asistente.
export const backToChatList = openChatList;

// Picker: su lista de chats es la pestaña «Mensajes» de sus Alertas, que
// conserva sus parámetros (el Warehouse).
export const backToPickerChatList = (navigation: TabNav) =>
  goToPickerTab(navigation, "PickerNotificationsScreen", { tab: "messages" });
