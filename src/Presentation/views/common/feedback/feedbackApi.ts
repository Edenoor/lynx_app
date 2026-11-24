// src/Presentation/views/common/feedback/feedbackApi.ts
// POST /v2/feedback: el mismo que usa el botón 💬 de la WebApp. Cualquier
// usuario logueado puede mandar; el servidor guarda quién es por el token y lo
// muestra en Sistema › Sugerencias y errores. Sin reintentos: no es idempotente.
// Con tiempo límite: una foto con señal mala no deja la pantalla esperando
// para siempre.

import { postJsonWithTimeout } from "../../../config/Api";
import type { FeedbackKind } from "./feedbackContext";

export const SEND_TIMEOUT_MS = 60_000;

export type FeedbackReport = {
  kind: FeedbackKind;
  message: string;
  page: string;
  viewport: string;
  screenshot?: string; // data URL JPEG
};

export async function sendFeedback(report: FeedbackReport): Promise<{ id: number; created_at: string }> {
  const res: any = await postJsonWithTimeout("/v2/feedback", report, SEND_TIMEOUT_MS);
  if (!res || res.ok === false) {
    throw new Error(res?.error || res?.message || "No se pudo enviar el reporte");
  }
  return res.report;
}
