// src/Presentation/views/driver/help/helpApi.ts
// Cliente de /v2/assistant: el asistente de ayuda del chofer. Responde dudas de
// uso de la app con los instructivos; no ve envíos, recorridos ni pagos. El
// servidor identifica al chofer por el token y guarda cada charla.

import { getJson, postJson } from "../../../config/Api";

export type HelpMessage = {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  // La respuesta dice que eso lo resuelve coordinación.
  escalated?: boolean;
};

export type HelpStatus = { enabled: boolean; daily_limit: number; remaining_today: number };

export type HelpConversation = { id: number; updated_at: string; messages: HelpMessage[] };

export type HelpReply = { conversation_id: number; message: HelpMessage; remaining_today: number };

// Lo mismo que valida el servidor (TOO_LONG).
export const MAX_QUESTION_LENGTH = 1000;

// Una charla vieja no se retoma: el modelo recibe los últimos mensajes del hilo,
// y una duda de ayer mezclada con la de hoy confunde la respuesta.
export const RESUME_WINDOW_MS = 2 * 60 * 60 * 1000;

export const isRecent = (c: HelpConversation | null, now = Date.now()) =>
  !!c && c.messages.length > 0 && now - Date.parse(c.updated_at) < RESUME_WINDOW_MS;

// Preguntas frecuentes para arrancar sin escribir.
export const SUGGESTIONS = [
  "¿Cómo acepto un Turbo?",
  "¿Por qué no me llegan Turbos?",
  "¿Cómo cierro una parada de colecta?",
  "«Salir a la calle» no aparece en mi reparto",
];

// El error conserva el código del servidor (DAILY_LIMIT, DISABLED, …).
const unwrap = <T,>(res: any): T => {
  if (!res || res.ok === false) {
    const e = new Error(res?.error || res?.message || "Error del servidor") as Error & { code?: string };
    e.code = res?.code;
    throw e;
  }
  return res as T;
};

export const fetchHelpStatus = async () => unwrap<HelpStatus>(await getJson("/v2/assistant/status"));

export const fetchLatestConversation = async () =>
  unwrap<{ conversation: HelpConversation | null }>(await getJson("/v2/assistant/conversations/latest")).conversation;

// Sin reintento automático: el servidor pudo haber respondido aunque se cortara la red.
export const askHelp = async (message: string, conversationId: number | null) =>
  unwrap<HelpReply>(
    await postJson("/v2/assistant/messages", conversationId ? { message, conversation_id: conversationId } : { message })
  );
