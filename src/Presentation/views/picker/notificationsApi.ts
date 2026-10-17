// src/Presentation/views/picker/notificationsApi.ts
// Bandeja de notificaciones del usuario (notification_log). Contrato actual:
// /my devuelve solo las NO vistas, como máximo 20; una vez marcada como vista,
// una notificación deja de venir.

import { useEffect, useState } from "react";

import { getJson, putJson } from "../../config/Api";
// Mismo error con status que el resto de los clientes del Picker.
import { WarehouseApiError } from "./warehouseApi";

export const INBOX_LIMIT = 20;

export type InboxNotification = {
  id: number;
  delivery_id: number | null;
  type: string | null;
  title: string | null;
  body: string | null;
  data: unknown;
  created_at: string | null;
};

const unwrap = <T,>(res: any): T => {
  if (!res || res.ok === false) {
    throw new WarehouseApiError(res?.error || res?.message || "Error del servidor", Number(res?.status ?? 0));
  }
  return res as T;
};

export const fetchMyNotifications = async () =>
  unwrap<{ notifications: InboxNotification[] }>(await getJson("/v2/notifications/my")).notifications;

// Siempre con ids explícitos: sin ids el servidor marca TODAS las del usuario,
// incluidas las que no llegaron a mostrarse por el límite de 20.
export const markNotificationsSeen = async (ids: number[]) => {
  if (!ids.length) return;
  unwrap(await putJson("/v2/notifications/seen", { ids }));
};

// Lo que muestra la campana. Con 20 no se sabe si hay más: "20+".
export const unreadBadge = (count: number | null) =>
  !count ? null : count >= INBOX_LIMIT ? `${INBOX_LIMIT}+` : String(count);

/* ---------- cantidad sin ver, compartida entre la campana y la bandeja ---------- */

let unread: number | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<(n: number | null) => void>();

export const setUnreadCount = (n: number | null) => {
  unread = n;
  listeners.forEach((listener) => listener(n));
};

// Un pedido a la vez; si falla, la campana queda como estaba.
export const refreshUnreadCount = () => {
  if (!inflight) {
    inflight = fetchMyNotifications()
      .then((list) => setUnreadCount(list.length))
      .catch(() => undefined)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
};

export function useUnreadCount() {
  const [count, setCount] = useState(unread);
  useEffect(() => {
    listeners.add(setCount);
    setCount(unread);
    return () => {
      listeners.delete(setCount);
    };
  }, []);
  return count;
}
