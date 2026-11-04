// src/Presentation/views/driver/scan/driverScan.ts
// Qué ve el chofer por cada lectura del escáner (Asignarme, Colecta, Planta):
// tono, título y detalle, a partir de la respuesta del servidor. Sin React ni
// red: la pantalla hace los pedidos y acá solo se interpreta lo que vuelve.
// Al chofer no se le muestran ids internos ni respuestas crudas del servidor.

export type DriverScanMode = "colecta" | "planta" | "asignarme";

export type ScanPayload = {
  raw: string;
  id: string;
  senderId: string;
  hashCode?: string | null;
  securityDigit?: string | null;
};

export type ScanTone = "success" | "warning" | "error";

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

// Cómo se nombra el bulto en pantalla y en el resumen: el tracking si lo hay;
// nunca el contenido crudo de la etiqueta.
export function scanLabel(payload: ScanPayload): string {
  if (payload.raw.startsWith(SHELF_QR_PREFIX)) return "Estantería";
  return /^\d{6,20}$/.test(payload.id) ? payload.id : "Etiqueta sin tracking";
}

/**
 * Un escaneo puede venir en tres formatos: el JSON de la etiqueta de Mercado
 * Libre, una query-string, o el tracking pelado (QR o código de barras del
 * depósito).
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

// Antes de pedir nada: la etiqueta tiene que traer lo que el modo necesita.
export function payloadProblem(mode: DriverScanMode, payload: ScanPayload): ScanFeedback | null {
  if (!payload.raw || !payload.id) {
    return { tone: "error", title: "No reconocemos esta etiqueta", detail: "Escaneá el QR del envío." };
  }
  if (mode === "colecta" && !payload.senderId) {
    return {
      tone: "error",
      title: "No reconocemos esta etiqueta",
      detail: "Para ingresar un envío, escaneá el QR de Mercado Libre.",
    };
  }
  return null;
}

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
  loaded: "Envío retirado",
  already: "Ya lo tenías cargado",
};

// PUT /v2/deliveries/self-assign (claimByScan): result claimed | loaded | already.
export function assignFeedback(res: any, tracking: string): ScanFeedback {
  if (!res?.ok) return rejection("asignarme", res);
  return { tone: "success", title: ASSIGN_RESULT[String(res?.result)] ?? "Envío asignado", detail: tracking || null };
}

// POST /v2/deliveries/scan: { success } o { success: false, error }.
export function collectFeedback(res: any, tracking: string): ScanFeedback {
  if (!res?.ok || res?.success === false) return rejection("colecta", res);
  return { tone: "success", title: "Envío ingresado", detail: tracking || null };
}

// Sin respuesta (tiempo agotado o sin red) DESPUÉS de enviar: el servidor pudo
// haberlo aplicado. No se reintenta solo; el chofer lo verifica.
export function noResponseFeedback(mode: DriverScanMode): ScanFeedback {
  const what = mode === "asignarme" ? "quedó asignado" : mode === "colecta" ? "quedó ingresado" : "quedó registrado";
  return {
    tone: "warning",
    title: "Sin respuesta del servidor",
    detail: `No sabemos si ${what}. Revisalo antes de volver a escanearlo.`,
  };
}

// Planta: el resultado ya armado por la regla del Picker (presentOutcome).
export function plantaFeedback(
  view: { tone: "success" | "neutral" | "warning" | "danger"; title: string; shelf: string | null; lines: string[]; warnings: string[] },
  status: number | null
): ScanFeedback {
  if (status === 401) return SESSION_EXPIRED;
  const tone: ScanTone = view.tone === "success" ? "success" : view.tone === "danger" ? "error" : "warning";
  const detail = [...view.lines.filter(Boolean).slice(0, 1), ...view.warnings.map((w) => `⚠ ${w}`)].join("\n");
  return { tone, title: view.title, detail: detail || null, shelf: view.shelf, warned: view.warnings.length > 0 };
}

// ---------- Resumen de la sesión de escaneo ----------

export const SESSION_ERRORS_KEPT = 20;

export type ScanSessionError = { title: string; detail: string | null; code: string };

export type ScanSession = { ok: number; failed: number; errors: ScanSessionError[] };

export const EMPTY_SESSION: ScanSession = { ok: 0, failed: 0, errors: [] };

// `code`: lo que identifica el bulto para el chofer (tracking), no un id interno.
export function recordScan(session: ScanSession, feedback: ScanFeedback, code: string): ScanSession {
  if (feedback.tone === "success") return { ...session, ok: session.ok + 1 };
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
