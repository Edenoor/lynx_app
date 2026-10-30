// Cuerpo de una respuesta del servidor → el objeto que esperan las pantallas
// ({ ok, status, ...lo que mandó el servidor }). Lo usan requestJson (fetch) y
// el envío con tiempo límite del GPS (XMLHttpRequest).
//
// Una respuesta que no es JSON NO es un éxito, aunque venga con 200: la página
// de login de un proxy (Cloudflare Access), un 404 en HTML o la propia web.
// Antes contaba como `ok: true` y la app daba por guardado lo que nunca llegó
// (el interruptor Turbo se «prendía» sin tocar el servidor; el GPS podía
// descartar posiciones). Solo un cuerpo vacío (204) vale por el código HTTP.

export const INVALID_RESPONSE_MESSAGE = "Respuesta inesperada del servidor";

export const parseJsonBody = (text: string | null | undefined, status: number): any => {
  const okStatus = status >= 200 && status < 300;
  if (!text || !text.trim()) return { ok: okStatus, status };
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    const message = `${INVALID_RESPONSE_MESSAGE} (${status})`;
    return { ok: false, status, invalidResponse: true, error: message, message };
  }
  if (parsed === null || typeof parsed !== "object") return { ok: okStatus, status };
  if (typeof parsed.ok !== "boolean") parsed.ok = okStatus;
  if (typeof parsed.status !== "number") parsed.status = status;
  return parsed;
};
