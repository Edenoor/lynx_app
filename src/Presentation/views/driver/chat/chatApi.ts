// src/Presentation/views/driver/chat/chatApi.ts
// Cliente de /v2/chat: el chat interno del chofer (su charla fija con el
// equipo de Lynx, «Lynx») y del picker (charlas de a uno con el equipo).
// El servidor decide qué ve; acá solo se muestra.
// Una charla que no puede ver responde 404, igual que una inexistente.

import { getJsonWithTimeout, postJson } from "../../../config/Api";

// driver: la charla fija de un chofer; direct: de a uno entre internos (picker); store: tiendas (panel).
export type ChatKind = "driver" | "store" | "direct";

// «member»: el chofer es parte de la charla; «team»: es del equipo interno (no pasa en la app).
export type ChatRole = "team" | "member";

export type ChatConversation = {
  id: number;
  kind: ChatKind;
  role: ChatRole;
  title: string;
  can_write: boolean;
  last_message: { id: number; body: string; author_name: string | null; created_at: string } | null;
  unread: number;
  // De a uno: la otra persona y si está en línea (vista en el chat hace menos de 2 minutos).
  other?: { id: number; name: string; online: boolean } | null;
};

// Directorio de usuarios internos (picker y panel): para abrir una charla de a uno.
export type ChatPerson = {
  id: number;
  name: string;
  profile: string | null;
  online: boolean;
  // La charla de a uno que ya hay con esa persona, si hay.
  conversation_id: number | null;
};

export type ChatInbox = {
  conversations: ChatConversation[];
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
  conversation: { id: number; kind: ChatKind; role: ChatRole; can_write: boolean; title: string };
  messages: ChatMessage[];
  has_more: boolean;
};

// Lo mismo que valida el servidor (TOO_LONG).
export const MAX_MESSAGE_LENGTH = 2000;

// Las consultas se repiten solas (lista, charla abierta): con tiempo límite,
// una colgada no deja la pantalla sin refrescar.
const GET_TIMEOUT_MS = 15_000;

// El error conserva el código del servidor (EMPTY, TOO_LONG, …).
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

// Directorio (solo usuarios internos): primero los que están en línea.
export const fetchPeople = async (text = "") =>
  (await get<{ people: ChatPerson[] }>(`/v2/chat/people?q=${encodeURIComponent(text.trim())}`)).people;

// Abre (o retoma) la charla de a uno con esa persona.
export const openDirect = async (userId: number) =>
  unwrap<{ conversation_id: number }>(await postJson("/v2/chat/direct", { user_id: userId })).conversation_id;

// «Consultalo con coordinación»: deja en la charla del chofer con Lynx la
// pregunta y la respuesta del asistente, y le avisa al equipo.
export const handoff = async (assistantMessageId: number) =>
  unwrap<{ conversation_id: number; title: string }>(
    await postJson("/v2/chat/handoff", { assistant_message_id: assistantMessageId })
  );
