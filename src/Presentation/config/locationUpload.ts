// src/Presentation/config/locationUpload.ts
// Qué hacer con la respuesta de una subida de posiciones (POST
// /v2/driver-locations). Módulo puro, sin React Native, para probarlo solo.
//
//   accepted  Lynx recibió el lote: sale del buffer.
//   retry     no contestó Lynx o falló el camino: sin respuesta, 5xx, 408,
//             429, o una respuesta que no es JSON (la página de un proxy, un
//             portal cautivo, un WAF). El lote se conserva y se reintenta.
//   discard   Lynx rechazó el lote (400, 422): reintentarlo no lo arregla.
//   session   la sesión venció (401).
//   forbidden Lynx dice que el usuario no tiene ficha de chofer activa (403):
//             se apaga el seguimiento sin borrar nada.
//
// Fuera del horario de trabajo el lote llega `accepted` (el servidor lo cuenta
// como descartado) y trae la política: ver trackingPolicyOf.
//
// Una respuesta que no es JSON no vale como rechazo de Lynx aunque traiga 4xx:
// antes se descartaba el lote (y con 200 se daba por subido), así que un proxy
// que contestaba HTML borraba en un solo envío todo lo guardado.

export type UploadVerdict = "accepted" | "retry" | "discard" | "session" | "forbidden";

export function classifyUpload(res: any): UploadVerdict {
  if (res?.sessionExpired || res?.status === 401) return "session";
  if (res?.invalidResponse) return "retry";
  if (res?.ok) return "accepted";
  const status = Number(res?.status ?? 0);
  if (status === 0 || status >= 500 || status === 408 || status === 429) return "retry";
  if (status === 403) return "forbidden";
  return "discard";
}

// Franja horaria del GPS. Fuera del horario de trabajo el servidor contesta
// `tracking: { activo: false, reanuda_a: "HH:MM" }` (en el POST de posiciones
// y en GET /v2/driver-locations/me/policy): hay que apagar el seguimiento hasta
// esa hora. null = la respuesta no trae política: se sigue como siempre.
export type TrackingPolicy = { activo: boolean; reanudaA: string | null };

export function trackingPolicyOf(res: any): TrackingPolicy | null {
  const t = res?.tracking;
  if (!t || typeof t !== "object" || typeof t.activo !== "boolean") return null;
  const reanudaA = typeof t.reanuda_a === "string" && /^\d{2}:\d{2}$/.test(t.reanuda_a) ? t.reanuda_a : null;
  return { activo: t.activo, reanudaA };
}
