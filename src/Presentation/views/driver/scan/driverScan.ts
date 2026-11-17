// src/Presentation/views/driver/scan/driverScan.ts
// Qué ve el chofer por cada lectura del escáner (Asignarme, Colecta, Planta):
// tono, título y detalle, a partir de la respuesta del servidor. Sin React ni
// red: la pantalla hace los pedidos y acá solo se interpreta lo que vuelve.
// Al chofer no se le muestran ids internos ni respuestas crudas del servidor.

import type { ScanKind } from "../../../config/scanResult";

export type DriverScanMode = "colecta" | "planta" | "asignarme";

export type ScanPayload = {
  raw: string;
  id: string;
  senderId: string;
  hashCode?: string | null;
  securityDigit?: string | null;
};

// Verde, amarillo (ya estaba hecho) o rojo: scanResult.
export type ScanTone = ScanKind;

export type ScanFeedback = {
  tone: ScanTone;
  title: string;
  detail: string | null;
  // Estantería en grande (Planta).
  shelf?: string | null;
  // 401: la sesión venció. Es lo único que frena el escaneo.
  sessionExpired?: boolean;
  // Éxito con avisos (Planta): vibra distinto para que se mire la pantalla.
  warned?: boolean;
};

const SHELF_QR_PREFIX = "LYNX:SHELF:";
// Etiqueta Lynx: «LYNX:PKG:LP» + 8 dígitos + verificador (server labelService).
const LYNX_PACKAGE = /^LYNX:PKG:([A-Z0-9]+)$/i;
// LightData tipeado: «LD:1600274», «LD 1600274», «LD-1600274», «LD#1600274».
const LIGHTDATA_TYPED = /^LD[\s:#-]*(\d+)$/i;

// Cómo se nombra el bulto en pantalla y en el resumen: el código que el chofer
// reconoce (tracking de ML, etiqueta Lynx, número de LightData); nunca el
// contenido crudo de la etiqueta. Solo para mostrar: al servidor va el QR tal
// cual (lo interpreta resolveScan).
export function scanLabel(payload: ScanPayload): string {
  const raw = payload.raw;
  if (raw.startsWith(SHELF_QR_PREFIX)) return "Estantería";
  const lynx = raw.match(LYNX_PACKAGE);
  if (lynx) return lynx[1].toUpperCase();
  const typed = raw.match(LIGHTDATA_TYPED);
  if (typed) return `LightData ${typed[1]}`;
  if (raw.startsWith("{")) {
    try {
      const did = JSON.parse(raw)?.did;
      if (did !== undefined && did !== null && /^\d+$/.test(String(did))) return `LightData ${did}`;
    } catch {
      // No es JSON: sigue como texto.
    }
  }
  return /^\d{6,20}$/.test(payload.id) ? payload.id : "Etiqueta sin tracking";
}

/**
 * Para mostrar el tracking de Mercado Libre de la etiqueta (scanLabel): el
 * JSON de la etiqueta, una query-string, o el tracking pelado. No decide qué
 * se manda: al servidor va siempre `raw` completo.
 *
 * OJO con el JSON: `JSON.parse("47741557287")` NO tira excepción, devuelve el
 * numero. Si se intenta parsear cualquier payload como JSON, el tracking
 * pelado entra por ese camino, ninguna clave existe y el escaneo muere en
 * "No pudimos identificar el shipping_id" sin llegar a la API. Por eso el
 * camino JSON se abre solo cuando el payload arranca con "{", igual que en el
 * backend (`receiveService.parseMlQr`).
 */
const parseTextPayload = (raw: string): ScanPayload => {
  const shippingMatch = raw.match(
    /(?:shipping_id|shippingId|shipment_id|tracking|order_id|orderId|id)=([^&\s]+)/i
  );
  const senderMatch = raw.match(/(?:sender_id|senderId)=([^&\s]+)/i);
  const longNumberMatch = raw.match(/\d{8,}/);

  return {
    raw,
    id: shippingMatch?.[1]?.trim() || longNumberMatch?.[0] || raw,
    senderId: senderMatch?.[1]?.trim() || "",
    hashCode: null,
    securityDigit: null,
  };
};

export const parseScanPayload = (value: string): ScanPayload => {
  const raw = String(value ?? "").trim();

  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          raw,
          id: String(parsed?.id ?? parsed?.shipping_id ?? parsed?.shippingId ?? parsed?.tracking ?? "").trim(),
          senderId: String(parsed?.sender_id ?? parsed?.senderId ?? "").trim(),
          hashCode: parsed?.hash_code ?? parsed?.hashCode ?? null,
          securityDigit: parsed?.security_digit ?? parsed?.securityDigit ?? null,
        };
      }
    } catch (_e) {
      // JSON inválido: se lee como texto, abajo.
    }
  }

  return parseTextPayload(raw);
};

const TITLES_ERROR: Record<DriverScanMode, string> = {
  asignarme: "No se pudo asignar",
  colecta: "No se pudo ingresar",
  planta: "No se pudo procesar",
};

export const SESSION_EXPIRED: ScanFeedback = {
  tone: "error",
  title: "Tu sesión expiró",
  detail: "Volvé a iniciar sesión para seguir escaneando.",
  sessionExpired: true,
};

// Antes de pedir nada: solo se frena una lectura vacía. Qué etiqueta es (ML,
// LightData, Lynx u otra) lo decide el servidor, el mismo resolvedor que usa
// el Picker: la app no rechaza etiquetas que él puede leer.
export function payloadProblem(payload: ScanPayload): ScanFeedback | null {
  if (!payload.raw) {
    return { tone: "error", title: "No reconocemos esta etiqueta", detail: "Escaneá el QR del envío." };
  }
  return null;
}

// Lo que va al servidor en Asignarme y Colecta: el QR completo, sin tocar.
export const scanBody = (payload: ScanPayload) => ({ qr: payload.raw });

// Texto del servidor solo si es un rechazo de negocio (4xx con mensaje). Un
// 5xx o una respuesta que no es JSON no le dicen nada al chofer.
const serverText = (res: any): string | null => {
  const status = Number(res?.status ?? 0);
  if (res?.invalidResponse || status >= 500) return null;
  const text = res?.error ?? res?.message;
  return typeof text === "string" && text.trim() ? text.trim() : null;
};

function rejection(mode: DriverScanMode, res: any): ScanFeedback {
  if (res?.sessionExpired || Number(res?.status) === 401) return SESSION_EXPIRED;
  const status = Number(res?.status ?? 0);
  if (status === 403) {
    return { tone: "error", title: "Tu usuario no puede hacer esto", detail: serverText(res) };
  }
  return {
    tone: "error",
    title: TITLES_ERROR[mode],
    detail: serverText(res) ?? "Error del servidor. Probá de nuevo en un momento.",
  };
}

// Falló un pedido de lectura previo (el chofer de la sesión): no se escribió nada.
export const NO_CONNECTION: ScanFeedback = {
  tone: "error",
  title: "Sin conexión con el servidor",
  detail: "No se envió nada. Volvé a escanearlo.",
};

// GET /v2/users/:id/role: el chofer de la sesión.
export function roleProblem(res: any): ScanFeedback | null {
  if (res?.sessionExpired || Number(res?.status) === 401) return SESSION_EXPIRED;
  if (!res?.ok) return rejection("asignarme", res);
  if (String(res?.rol ?? "").toUpperCase() !== "DRIVER" || !res?.data?.id) {
    return { tone: "error", title: "Tu usuario no está habilitado como chofer", detail: null };
  }
  if (res.data.active === false) {
    return { tone: "error", title: "Tu cuenta de chofer está inactiva", detail: "Consultá con el coordinador." };
  }
  return null;
}

const ASSIGN_RESULT: Record<string, string> = {
  claimed: "Envío asignado",
  resumed: "Entrega retomada",
  loaded: "Envío retirado",
};

export const ALREADY_SCANNED = "Este paquete ya fue escaneado";

// PUT /v2/deliveries/self-assign { qr } (claimByScan): result claimed | resumed | loaded | already.
// El servidor decide: 'resumed' es un no entregado de su propio Baúl, que
// vuelve a un reparto suyo de hoy sin pasar por el depósito. 'already' (ya
// lo tenía retirado, sin escribir nada) es el único duplicado: los 409
// (RESERVED, CLOSED, NOT_IN_WAREHOUSE, HELD_BY_DRIVER, RETRY) son errores.
export function assignFeedback(res: any, tracking: string): ScanFeedback {
  if (!res?.ok) return rejection("asignarme", res);
  if (res?.result === "already") {
    const where = res?.route?.id ? `ya lo tenías cargado en tu recorrido #${res.route.id}` : "ya lo tenías cargado";
    return { tone: "duplicate", title: ALREADY_SCANNED, detail: [tracking || null, where].filter(Boolean).join(" · ") };
  }
  const routeId = res?.result === "resumed" ? res?.route?.id : null;
  const detail = [tracking || null, routeId ? `agregado a tu recorrido #${routeId}` : null].filter(Boolean).join(" · ");
  return { tone: "success", title: ASSIGN_RESULT[String(res?.result)] ?? "Envío asignado", detail: detail || null };
}

// POST /v2/deliveries/scan { qr }: { success } o { success: false, error }.
export function collectFeedback(res: any, tracking: string): ScanFeedback {
  if (!res?.ok || res?.success === false) return rejection("colecta", res);
  return { tone: "success", title: "Envío ingresado", detail: tracking || null };
}

// Sin respuesta (tiempo agotado o sin red) DESPUÉS de enviar: el servidor pudo
// haberlo aplicado. No se reintenta solo; el chofer lo verifica.
export function noResponseFeedback(mode: DriverScanMode): ScanFeedback {
  const what = mode === "asignarme" ? "quedó asignado" : mode === "colecta" ? "quedó ingresado" : "quedó registrado";
  return {
    tone: "error",
    title: "Sin respuesta del servidor",
    detail: `No sabemos si ${what}. Revisalo antes de volver a escanearlo.`,
  };
}

// Planta: el resultado ya armado por la regla del Picker (presentOutcome).
export function plantaFeedback(
  view: { tone: ScanTone; title: string; shelf: string | null; lines: string[]; warnings: string[] },
  status: number | null
): ScanFeedback {
  if (status === 401) return SESSION_EXPIRED;
  const tone = view.tone;
  const detail = [...view.lines.filter(Boolean).slice(0, 1), ...view.warnings.map((w) => `⚠ ${w}`)].join("\n");
  return { tone, title: view.title, detail: detail || null, shelf: view.shelf, warned: view.warnings.length > 0 };
}

// ---------- Resumen de la sesión de escaneo ----------

export const SESSION_ERRORS_KEPT = 20;

export type ScanSessionError = { title: string; detail: string | null; code: string };

// done: los códigos que salieron bien en esta sesión (para Colecta, abajo).
export type ScanSession = { ok: number; failed: number; errors: ScanSessionError[]; done: string[] };

export const EMPTY_SESSION: ScanSession = { ok: 0, failed: 0, errors: [], done: [] };

// Códigos que no identifican un bulto: no sirven para saber si se repitió.
const NOT_A_PACKAGE = new Set(["Estantería", "Etiqueta sin tracking"]);

// Colecta: POST /v2/deliveries/scan responde igual la primera vez que las
// siguientes (no dice si ya estaba). Lo único seguro es lo de esta sesión: el
// mismo bulto que ya salió bien acá es un duplicado y no suma. Asignarme y
// Planta no lo necesitan: el servidor ya lo dice (already, already_here).
export function sessionRepeat(mode: DriverScanMode, feedback: ScanFeedback, session: ScanSession, code: string): ScanFeedback {
  if (mode !== "colecta" || feedback.tone !== "success" || NOT_A_PACKAGE.has(code) || !session.done.includes(code)) return feedback;
  return { tone: "duplicate", title: ALREADY_SCANNED, detail: `${code} · ya lo ingresaste en esta sesión` };
}

// `code`: lo que identifica el bulto para el chofer (tracking), no un id interno.
// Un duplicado no suma ni como escaneado ni como error.
export function recordScan(session: ScanSession, feedback: ScanFeedback, code: string): ScanSession {
  if (feedback.tone === "duplicate") return session;
  if (feedback.tone === "success") {
    return { ...session, ok: session.ok + 1, done: session.done.includes(code) ? session.done : [...session.done, code] };
  }
  const entry = { title: feedback.title, detail: feedback.detail, code };
  return {
    ...session,
    failed: session.failed + 1,
    errors: [entry, ...session.errors].slice(0, SESSION_ERRORS_KEPT),
  };
}

export function sessionSummary(session: ScanSession): string {
  const ok = `${session.ok} ${session.ok === 1 ? "escaneado" : "escaneados"}`;
  return session.failed ? `${ok} · ${session.failed} con error` : ok;
}
