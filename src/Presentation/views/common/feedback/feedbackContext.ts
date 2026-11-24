// src/Presentation/views/common/feedback/feedbackContext.ts
// Sugerencias y errores (POST /v2/feedback, el mismo de la WebApp): los
// límites del contrato, el texto técnico que va en `page` y el control de la
// foto. Los límites son los que valida el servidor (feedbackService.js); la
// app los aplica antes para no mandar algo que se va a rechazar.
// Módulo puro (sin React Native) para poder probarlo solo.

export type FeedbackKind = "ERROR" | "SUGERENCIA";
export type FeedbackArea = "driver" | "picker";

export const MIN_MESSAGE = 3;
export const MAX_MESSAGE = 2000;
const MAX_PAGE = 500;
const MAX_VIEWPORT = 20;

// El servidor rechaza la imagen si DECODIFICADA pasa de 2 MB
// (MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024); el tope en caracteres que mira
// antes es más alto, así que manda este.
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
// Como la WebApp (shrinkImage): lado mayor de 1600 px. Sin librería para
// achicar, se le pide a la cámara una resolución que no pase de eso.
export const PHOTO_MAX_SIDE = 1600;
export const PHOTO_QUALITY = 0.6;

// Los mismos textos que el formulario de la WebApp.
export const PLACEHOLDER: Record<FeedbackKind, string> = {
  ERROR: "Qué estabas haciendo, qué esperabas que pasara y qué pasó.",
  SUGERENCIA: "Qué te gustaría que haga el sistema, o qué cambiarías.",
};

const AREA_LABEL: Record<FeedbackArea, string> = { driver: "Driver", picker: "Picker" };

export const canSend = (kind: FeedbackKind | null, message: string) =>
  !!kind && message.trim().length >= MIN_MESSAGE && message.trim().length <= MAX_MESSAGE;

export type TechInfo = {
  area: FeedbackArea;
  screen?: string | null;
  app: string; // appUpdateLabel(): versión, canal, actualización y runtime
  os?: string | null;
  model?: string | null;
};

// «Mobile · Driver · pantalla DriverScanScreen · Lynx 1.1.1 · production ·
// versión instalada · runtime aae3475b · Android 14 · samsung SM-A155M».
// Solo datos de la app y del teléfono: el usuario lo identifica el servidor
// por el token. Nada de token, email, teléfono ni el nombre del dispositivo
// (lo elige la persona y puede tener su nombre).
export function buildPage(info: TechInfo): string {
  const parts = [
    "Mobile",
    AREA_LABEL[info.area],
    info.screen ? `pantalla ${info.screen}` : null,
    info.app,
    info.os ? `Android ${info.os}` : null,
    info.model || null,
  ];
  return parts.filter(Boolean).join(" · ").slice(0, MAX_PAGE);
}

export const viewportOf = (width: number, height: number) =>
  `${Math.round(width)}x${Math.round(height)}`.slice(0, MAX_VIEWPORT);

// Bytes de la imagen que representa un texto base64 (lo que mide el servidor).
export function base64Bytes(b64: string): number {
  const clean = b64.replace(/\s/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

export const photoDataUrl = (b64: string) => `data:image/jpeg;base64,${b64.replace(/\s/g, "")}`;

export type PhotoCheck = { ok: true; dataUrl: string; bytes: number } | { ok: false; reason: string };

// La foto se manda solo si entra en el límite del servidor; si no, se avisa y
// el reporte se puede mandar igual sin ella.
export function checkPhoto(b64: string | null | undefined): PhotoCheck {
  const bytes = base64Bytes(String(b64 ?? ""));
  if (!bytes) return { ok: false, reason: "No se pudo leer la foto. Probá sacarla de nuevo." };
  if (bytes > MAX_PHOTO_BYTES) {
    return { ok: false, reason: "La foto pesa más de 2 MB y el servidor no la acepta. Probá de nuevo o mandá el reporte sin foto." };
  }
  return { ok: true, dataUrl: photoDataUrl(String(b64)), bytes };
}

/* ---------- pantalla de origen ---------- */

// La última pantalla de trabajo antes de abrir el formulario. Se anota en cada
// cambio de navegación (App.tsx); no cuentan el formulario ni las pantallas
// desde donde se abre. Cambiar de área o de sesión la olvida.
const NOT_ORIGIN = new Set(["FeedbackScreen", "FeedbackPhotoScreen", "DriverAccountScreen", "PickerHomeScreen"]);
let lastScreen: string | null = null;
let lastRoot: string | null = null;

const focused = (state: any) => state?.routes?.[state.index ?? state.routes.length - 1];

export function rememberScreen(state: any) {
  const root = focused(state)?.name ?? null;
  if (root !== lastRoot) {
    lastRoot = root;
    lastScreen = null;
  }
  let route = focused(state);
  let name: string | null = null;
  while (route) {
    name = route.name ?? name;
    route = focused(route.state);
  }
  if (name && !NOT_ORIGIN.has(name)) lastScreen = name;
}

export const originScreen = () => lastScreen;
