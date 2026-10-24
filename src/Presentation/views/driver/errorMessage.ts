// src/Presentation/views/driver/errorMessage.ts
// Texto de error para mostrarle al chofer. Sin red, el `fetch` de React Native
// rechaza con «Network request failed», en inglés y sin decir qué hacer: eso se
// traduce. Los mensajes del servidor ya vienen en castellano y pasan tal cual.
// Módulo puro (sin React Native) para poder probarlo solo.

export const NO_NETWORK = "Sin conexión. Revisá la señal y probá de nuevo.";

const NETWORK = /network request failed|failed to fetch|network ?error|request timed out/i;

export function errorMessage(e: unknown, fallback: string): string {
  const raw = (e as { message?: unknown } | null | undefined)?.message;
  const message = typeof raw === "string" ? raw.trim() : "";
  if (!message) return fallback;
  return NETWORK.test(message) ? NO_NETWORK : message;
}
