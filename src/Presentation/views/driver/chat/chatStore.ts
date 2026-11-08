// src/Presentation/views/driver/chat/chatStore.ts
// Mensajes sin leer del chofer, compartidos entre la barra (el número de
// Alertas), la pestaña Mensajes y la charla: se piden una vez y se reutilizan
// unos segundos. Y el aviso de que llegó un mensaje (push con la app abierta),
// para que la lista y la charla abiertas se pongan al día sin esperar su sondeo.

import { fetchUnread } from "./chatApi";
import { sharedValue, useSharedValue } from "../work/sharedValue";

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

// La lista de chats es la pestaña «Mensajes» de Alertas. Si Alertas ya está
// abierta más atrás se vuelve a ella (sin apilar otra); si no, se abre.
type StackNav = {
  popTo: (...args: any[]) => void;
  replace: (...args: any[]) => void;
  getState: () => { routes?: { name: string }[] } | undefined;
};
const LIST = ["NotificationsScreen", { tab: "messages" }] as const;

export const openChatList = (navigation: StackNav) => navigation.popTo(...LIST);

// «<<» desde una charla o el asistente. Si se llegó sin pasar por la lista
// (un push, el ícono flotante), la lista toma el lugar de esta pantalla.
export function backToChatList(navigation: StackNav) {
  if (navigation.getState()?.routes?.some((r) => r.name === LIST[0])) navigation.popTo(...LIST);
  else navigation.replace(...LIST);
}
