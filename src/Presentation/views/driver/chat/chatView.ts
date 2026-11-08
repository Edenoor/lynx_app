// src/Presentation/views/driver/chat/chatView.ts
// Lo que muestran la lista de chats y la charla, armado a partir de lo que
// manda /v2/chat. Módulo puro (sin React Native) para poder probarlo solo.

import type { ChatConversation, ChatInbox, ChatMessage } from "./chatApi";

// Lista de chats: arriba el asistente, después las charlas propias (y los
// canales donde el chofer puede abrir una) y al final las novedades.
export type ChatRow =
  | { kind: "assistant"; key: string }
  | { kind: "conversation"; key: string; conversation: ChatConversation }
  | { kind: "start"; key: string; channel: { id: number; name: string } };

export function chatRows(inbox: ChatInbox | null): ChatRow[] {
  const rows: ChatRow[] = [{ kind: "assistant", key: "assistant" }];
  if (!inbox) return rows;
  const conv = (c: ChatConversation): ChatRow => ({ kind: "conversation", key: `c${c.id}`, conversation: c });
  rows.push(...inbox.conversations.filter((c) => c.channel.kind !== "news").map(conv));
  rows.push(...inbox.startable.map((ch): ChatRow => ({ kind: "start", key: `s${ch.id}`, channel: ch })));
  rows.push(...inbox.conversations.filter((c) => c.channel.kind === "news").map(conv));
  return rows;
}

export const previewOf = (c: ChatConversation) =>
  c.last_message?.body ?? (c.channel.kind === "news" ? "Sin novedades todavía" : "Sin mensajes todavía");

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

// El nombre arriba del mensaje: en una charla de a uno, el de quien escribió
// del equipo (atienden varios); en novedades, el de todos menos el propio.
export const showAuthor = (m: ChatMessage, channelKind: "direct" | "news") =>
  !m.mine && !!m.author && (channelKind === "news" || m.from_team);
