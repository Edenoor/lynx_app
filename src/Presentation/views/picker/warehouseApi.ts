// src/Presentation/views/picker/warehouseApi.ts
// Cliente de /v2/warehouse para el Picker. El servidor toma el Warehouse del
// Picker de su perfil (admin_data.warehouse_id): acá no viaja ningún id de
// Warehouse.

import { getJson, postJsonWithTimeout, putJsonWithTimeout } from "../../config/Api";

// Con poca señal en el depósito un pedido no puede quedar colgado. Recibir
// puede consultar a Mercado Libre antes de responder: tiene más margen.
const RECEIVE_TIMEOUT_MS = 20_000;
const MOVE_TIMEOUT_MS = 15_000;

// Prefijo de las etiquetas QR de estantería (shelfService del servidor).
const SHELF_QR_PREFIX = "LYNX:SHELF:";
export const isShelfQr = (raw: string) => raw.trim().startsWith(SHELF_QR_PREFIX);

// Token del QR de estantería, con la misma regla que el servidor
// (shelfService.parseShelfQr): prefijo + UUID. Cualquier otra cosa, null.
const SHELF_TOKEN = /^[0-9a-f-]{36}$/i;
export const shelfQrToken = (raw: string) => {
  const s = raw.trim();
  if (!s.startsWith(SHELF_QR_PREFIX)) return null;
  const token = s.slice(SHELF_QR_PREFIX.length);
  return SHELF_TOKEN.test(token) ? token.toLowerCase() : null;
};

// Texto del QR impreso en la estantería (shelfService.shelfQrPayload del
// servidor). null si no hay un token válido: nunca se arma otro formato.
export const shelfQrPayload = (shelf: Pick<Shelf, "qr_token">) =>
  typeof shelf.qr_token === "string" && SHELF_TOKEN.test(shelf.qr_token) ? `${SHELF_QR_PREFIX}${shelf.qr_token}` : null;

// Busca la estantería escaneada SOLO entre las del Warehouse del Picker (las
// que devuelve /shelves). Coincidencia exacta de token: nunca por código ni
// por texto parecido.
export type ShelfQrMatch = { kind: "shelf"; shelf: Shelf } | { kind: "not_shelf" } | { kind: "unknown" };
export const matchShelfQr = (shelves: Shelf[], raw: string): ShelfQrMatch => {
  const token = shelfQrToken(raw);
  if (!token) return { kind: "not_shelf" };
  const shelf = shelves.find((s) => typeof s.qr_token === "string" && s.qr_token.toLowerCase() === token);
  return shelf ? { kind: "shelf", shelf } : { kind: "unknown" };
};

export type ReceiveAlert = { code: string; text: string };

export type ReceiveResult = {
  delivery: {
    id: number;
    tracking: string | null;
    store: string | null;
    receiver: string | null;
    direccion: string | null;
    postal_code: string | null;
    tipo_envio: string | null;
    is_turbo: boolean;
  };
  // null cuando el envío ya está cerrado (no vuelve a planta).
  shelf: { id: number; code: string; name: string | null; unclassified: boolean; suggested: string | null } | null;
  ops: { from: string; to: string; transitions: string[]; already_here: boolean };
  alerts: ReceiveAlert[];
};

export type MoveResult = { from: string | null; shelf: { id: number; code: string; name: string | null } };

export type Shelf = {
  id: number;
  code: string;
  name: string | null;
  active: boolean;
  unclassified: boolean;
  postal_codes_count: number;
  // Cuenta todo lo que tiene la estantería asignada, cerrados incluidos: no
  // se muestra como cantidad de paquetes.
  deliveries_count: number;
  // Paquetes presentes (sin entregados ni cancelados). Lo agrega el contrato
  // acordado con backend: mientras no llegue, no se muestra ninguna cifra.
  present_count?: number;
  // Token del QR impreso en la estantería. Solo para reconocerla al escanear:
  // no se muestra ni se registra.
  qr_token: string | null;
};
export type ShelvesResult = { warehouse_id: number; warehouse_name?: string | null; shelves: Shelf[] };

export const presentCount = (s: Shelf) =>
  typeof s.present_count === "number" && Number.isFinite(s.present_count) ? s.present_count : null;

// Para buscar sin distinguir mayúsculas ni acentos ("Morón" = "moron").
// Sin normalize (motor JS sin Intl completo) igual busca, solo que distingue
// acentos.
const fold = (s: string) =>
  (typeof s.normalize === "function" ? s.normalize("NFD") : s).replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Filtra por nombre o código y deja primero las que tienen paquetes. Dentro
// de cada grupo respeta el orden del servidor. Sin present_count no se
// reordena: no hay cómo saber cuáles están vacías.
export const visibleShelves = (shelves: Shelf[], query: string) => {
  const q = fold(query);
  const found = q ? shelves.filter((s) => fold(s.name ?? "").includes(q) || fold(s.code).includes(q)) : shelves;
  const withPackages = found.filter((s) => (presentCount(s) ?? 0) > 0);
  const rest = found.filter((s) => (presentCount(s) ?? 0) === 0);
  return [...withPackages, ...rest];
};

export type ShelfPackage = {
  id: number;
  tracking: string | null;
  store: string | null;
  receiver: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  postal_code_norm: string | null;
  tipo_envio: string | null;
  ops_status: string | null;
  shelved_at: string | null;
};
export type ShelfContents = {
  shelf: { id: number; code: string; name: string | null; active: boolean; unclassified: boolean };
  deliveries: ShelfPackage[];
};

// Una estantería muestra solo lo que está físicamente en el depósito. El
// cierre que informa Mercado Libre no les quita la estantería a los envíos
// entregados o cancelados, así que /shelves/:id/deliveries los sigue
// devolviendo: se descartan.
const CLOSED_OPS = new Set(["DELIVERED", "CANCELLED"]);
export const activeShelfPackages = (list: ShelfPackage[]) =>
  list.filter((p) => !CLOSED_OPS.has(String(p.ops_status ?? "")));

// Estanteado donde no le toca por su CP (la misma regla que el escáner).
export type MisplacedPackage = {
  id: number;
  tracking: string | null;
  store: string | null;
  receiver: string | null;
  codigo_postal: string | null;
  postal_code_norm: string | null;
  shelved_at: string | null;
  shelf_code: string;
  expected_shelf_code: string;
  expected_unclassified: boolean;
};
export type MisplacedResult = { warehouse_id: number; deliveries: MisplacedPackage[] };

// El status viaja para que la pantalla distinga sesión (401), permiso (403) y
// custodia o estado (409) sin interpretar el texto.
export class WarehouseApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const unwrap = <T,>(res: any): T => {
  if (!res || res.ok === false) {
    throw new WarehouseApiError(res?.error || res?.message || "Error del servidor", Number(res?.status ?? 0));
  }
  return res as T;
};

// Recepción en planta: el texto crudo del QR (etiqueta de Mercado Libre,
// etiqueta Lynx LP… o tracking). El servidor lo interpreta, da de alta el
// envío si hace falta y lo estantea según el código postal.
// Sin respuesta (timeout o sin red) rechaza con un Error común: el servidor
// pudo haberlo ejecutado igual.
export const receivePackage = async (qr: string) =>
  unwrap<ReceiveResult>(await postJsonWithTimeout("/v2/warehouse/receive", { qr }, RECEIVE_TIMEOUT_MS));

export const moveToShelf = async (deliveryId: number, shelfQr: string) =>
  unwrap<MoveResult>(
    await putJsonWithTimeout(`/v2/warehouse/deliveries/${deliveryId}/shelf`, { shelf_qr: shelfQr }, MOVE_TIMEOUT_MS),
  );

// Mismo endpoint, eligiendo la estantería destino de la lista ({ shelf_id }).
// deliveryId es el id interno del envío (deliveries.id), no el tracking.
export const moveToShelfById = async (deliveryId: number, shelfId: number) =>
  unwrap<MoveResult>(
    await putJsonWithTimeout(`/v2/warehouse/deliveries/${deliveryId}/shelf`, { shelf_id: shelfId }, MOVE_TIMEOUT_MS),
  );

// Consultas: piden warehouse_access. Para un Picker el servidor resuelve
// siempre SU Warehouse (el mismo donde recibe) y no deja ver estanterías de
// otro.
export const fetchShelves = async () => unwrap<ShelvesResult>(await getJson("/v2/warehouse/shelves"));

export const fetchShelfContents = async (shelfId: number) =>
  unwrap<ShelfContents>(await getJson(`/v2/warehouse/shelves/${shelfId}/deliveries`));

export const fetchMisplaced = async () => unwrap<MisplacedResult>(await getJson("/v2/warehouse/misplaced"));

// Texto para una consulta que falló. Un 403 por falta de permiso ("Permiso
// '…' requerido") se explica; cualquier otro (por ejemplo, una estantería de
// otro Warehouse) se muestra como lo dice el servidor.
export const loadErrorMessage = (e: unknown) => {
  if (!(e instanceof WarehouseApiError)) return "Sin conexión con el servidor.";
  if (e.status === 403 && /requerido/i.test(e.message)) {
    return "Tu usuario no tiene warehouse_access: pedíselo a un administrador.";
  }
  return e.message;
};
