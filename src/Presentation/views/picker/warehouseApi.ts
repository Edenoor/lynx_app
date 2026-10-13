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

export type ShelvesResult = { warehouse_id: number; shelves: { id: number; code: string; active?: boolean }[] };

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

// Pide warehouse_access; solo se usa para mostrar en qué Warehouse opera. Para
// un Picker el servidor resuelve siempre SU Warehouse, el mismo donde recibe.
export const fetchShelves = async () => unwrap<ShelvesResult>(await getJson("/v2/warehouse/shelves"));
