// src/Presentation/views/driver/chat/chatView.ts
// Lo que muestran la lista de chats y la charla, armado a partir de lo que
// manda /v2/chat. Módulo puro (sin React Native) para poder probarlo solo.

import type { ChatConversation, ChatInbox, ChatMessage, ChatPerson } from "./chatApi";

// Lista de chats del chofer: arriba el asistente y después su charla con Lynx
// (el servidor la manda siempre, aunque todavía no tenga mensajes). El picker
// no tiene asistente: solo sus charlas de a uno.
export type ChatRow =
  | { kind: "assistant"; key: string }
  | { kind: "conversation"; key: string; conversation: ChatConversation };

export function chatRows(inbox: ChatInbox | null, { assistant = true } = {}): ChatRow[] {
  const rows: ChatRow[] = assistant ? [{ kind: "assistant", key: "assistant" }] : [];
  if (!inbox) return rows;
  rows.push(...inbox.conversations.map((c): ChatRow => ({ kind: "conversation", key: `c${c.id}`, conversation: c })));
  return rows;
}

export const previewOf = (c: ChatConversation) =>
  c.last_message?.body ?? (c.kind === "direct" ? "Todavía no hay mensajes" : "Escribile al equipo de Lynx");

// Debajo del nombre en el directorio: el perfil, si está en línea y si ya hay charla.
const PROFILE: Record<string, string> = {
  ADMIN_TOTAL: "Administrador Total", COORDINADOR: "Coordinación", LIQUIDACIONES: "Liquidaciones", PICKER: "Picker",
};
export const personDetail = (p: ChatPerson) =>
  [PROFILE[p.profile ?? ""] ?? "Administración", p.online ? "en línea" : null, p.conversation_id ? "ya hay charla" : null]
    .filter(Boolean).join(" · ");

export const countLabel = (n: number) => (n > 99 ? "99+" : String(n));

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => `${d.getHours()}:${pad(d.getMinutes())}`;
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dayBefore = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);

// En la lista: la hora si es de hoy, «ayer», o el día.
export function listTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (sameDay(d, now)) return hhmm(d);
  if (sameDay(d, dayBefore(now))) return "ayer";
  const day = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  return d.getFullYear() === now.getFullYear() ? day : `${day}/${String(d.getFullYear()).slice(2)}`;
}

// Debajo de cada mensaje: la hora, con el día si no es de hoy.
export function messageTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (sameDay(d, now)) return hhmm(d);
  if (sameDay(d, dayBefore(now))) return `ayer ${hhmm(d)}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hhmm(d)}`;
}

// Junta lo que ya se ve con lo que trajo el servidor, sin repetir y en orden.
export function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map<number, ChatMessage>();
  for (const m of prev) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

export const newestId = (list: ChatMessage[]): number | null => (list.length ? list[list.length - 1].id : null);

// El nombre arriba del mensaje: el de quien escribió del equipo (atienden varios).
export const showAuthor = (m: ChatMessage) => !m.mine && !!m.author && m.from_team;
