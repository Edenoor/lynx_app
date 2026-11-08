// src/Presentation/views/driver/chat/chatApi.ts
// Cliente de /v2/chat: el chat interno del chofer (sus charlas con
// coordinación o administración y las novedades que le mandan). El servidor
// decide qué ve y dónde puede escribir a partir de sus grupos; acá solo se
// muestra. Una charla que no puede ver responde 404, igual que una inexistente.

import { getJsonWithTimeout, postJson } from "../../../config/Api";

export type ChatChannel = { id: number; name: string; kind: "direct" | "news"; assistant_line: boolean };

// «subject»: el chofer es la persona atendida; «audience»: lee unas novedades.
export type ChatRole = "team" | "subject" | "audience";

export type ChatConversation = {
  id: number;
  channel: ChatChannel;
  role: ChatRole;
  title: string;
  can_write: boolean;
  last_message: { id: number; body: string; author_name: string | null; created_at: string } | null;
  unread: number;
};

export type ChatInbox = {
  conversations: ChatConversation[];
  // Canales donde el chofer puede abrir una charla y todavía no tiene ninguna.
  startable: { id: number; name: string }[];
  unread_total: number;
};

export type ChatMessage = {
  id: number;
  // «handoff»: la consulta que el chofer derivó desde el asistente.
  kind: "text" | "handoff";
  body: string;
  created_at: string;
  author: { id: number; name: string } | null;
  mine: boolean;
  from_team: boolean;
};

export type ChatThread = {
  conversation: { id: number; role: ChatRole; can_write: boolean; channel: ChatChannel; title: string };
  messages: ChatMessage[];
  has_more: boolean;
};

// Lo mismo que valida el servidor (TOO_LONG).
export const MAX_MESSAGE_LENGTH = 2000;

// Las consultas se repiten solas (lista, charla abierta): con tiempo límite,
// una colgada no deja la pantalla sin refrescar.
const GET_TIMEOUT_MS = 15_000;

// El error conserva el código del servidor (NO_FIRST_LINE, READ_ONLY, …).
const unwrap = <T,>(res: any): T => {
  if (!res || res.ok === false) {
    const e = new Error(res?.error || res?.message || "Error del servidor") as Error & { code?: string; status?: number };
    e.code = res?.code;
    e.status = res?.status;
    throw e;
  }
  return res as T;
};

const get = async <T,>(path: string) => unwrap<T>(await getJsonWithTimeout(path, GET_TIMEOUT_MS));

export const fetchInbox = () => get<ChatInbox>("/v2/chat/inbox");

export const fetchUnread = async () => (await get<{ unread_total: number }>("/v2/chat/unread")).unread_total;

// Los últimos mensajes (o los anteriores a `before`), del más viejo al más nuevo.
export const fetchMessages = (conversationId: number, before?: number) =>
  get<ChatThread>(`/v2/chat/conversations/${conversationId}/messages${before ? `?before=${before}` : ""}`);

// Sin reintento automático: el mensaje pudo haber quedado guardado aunque se cortara la red.
export const sendMessage = async (conversationId: number, body: string) =>
  unwrap<{ message: ChatMessage }>(await postJson(`/v2/chat/conversations/${conversationId}/messages`, { body })).message;

export const markRead = async (conversationId: number, messageId: number) => {
  unwrap(await postJson(`/v2/chat/conversations/${conversationId}/read`, { message_id: messageId }));
};

// Abre la charla del chofer en un canal donde puede iniciarla (o devuelve la que ya tiene).
export const startConversation = async (channelId: number) =>
  unwrap<{ conversation_id: number }>(await postJson(`/v2/chat/channels/${channelId}/conversations`, {})).conversation_id;

// «Consultalo con coordinación»: abre (o reusa) la charla con el grupo de
// primera línea, con la pregunta y la respuesta del asistente como primer
// mensaje. 409 NO_FIRST_LINE si todavía no se eligió ese grupo.
export const handoff = async (assistantMessageId: number) =>
  unwrap<{ conversation_id: number; channel: { id: number; name: string } }>(
    await postJson("/v2/chat/handoff", { assistant_message_id: assistantMessageId })
  );
