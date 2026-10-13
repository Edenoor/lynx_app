// src/Presentation/views/picker/pickerScan.ts
// Qué hacer con cada lectura del escáner del Picker. Un paquete se recibe
// (el servidor lo estantea según su código postal); una estantería mueve ahí
// el último paquete leído. Las reglas de custodia y estado son del servidor:
// acá solo se muestra lo que responde.

import { isShelfQr, moveToShelf, receivePackage, ReceiveResult, WarehouseApiError } from "./warehouseApi";

export type PendingPackage = { id: number; tracking: string | null };

export type ScanOutcome =
  | { kind: "received"; result: ReceiveResult }
  | { kind: "moved"; tracking: string | null; from: string | null; to: string }
  | { kind: "error"; message: string; status: number | null }
  // Sin respuesta (timeout o sin red): el servidor pudo haberlo ejecutado.
  // Repetir es seguro: recibir de nuevo solo informa dónde está, y mover a la
  // misma estantería no cambia nada.
  | { kind: "unknown"; message: string };

export const NO_RESPONSE_RECEIVE =
  "No sabemos si quedó registrado. Volvé a escanear el paquete: si ya estaba, vas a ver «Ya estaba en planta».";
export const NO_RESPONSE_MOVE =
  "No sabemos si se movió. Volvé a escanear la estantería: repetirlo no lo mueve dos veces.";

const toOutcome = (e: unknown, noResponse: string): ScanOutcome =>
  e instanceof WarehouseApiError
    ? { kind: "error", message: e.message, status: e.status || null }
    : { kind: "unknown", message: noResponse };

// Devuelve el resultado y cuál queda como "último paquete" para una estantería.
export async function processScan(
  raw: string,
  pending: PendingPackage | null,
): Promise<{ outcome: ScanOutcome; pending: PendingPackage | null }> {
  if (isShelfQr(raw)) {
    if (!pending) {
      return {
        outcome: { kind: "error", message: "Escaneá primero el paquete y después la estantería.", status: null },
        pending: null,
      };
    }
    try {
      const r = await moveToShelf(pending.id, raw);
      return { outcome: { kind: "moved", tracking: pending.tracking, from: r.from, to: r.shelf.code }, pending: null };
    } catch (e) {
      // Si la estantería no sirve (o no hubo respuesta), el paquete sigue
      // esperando: se puede volver a escanear la estantería.
      return { outcome: toOutcome(e, NO_RESPONSE_MOVE), pending };
    }
  }

  try {
    const result = await receivePackage(raw);
    // Sin estantería (envío cerrado) no hay nada que mover.
    const next = result.shelf ? { id: result.delivery.id, tracking: result.delivery.tracking } : null;
    return { outcome: { kind: "received", result }, pending: next };
  } catch (e) {
    return { outcome: toOutcome(e, NO_RESPONSE_RECEIVE), pending: null };
  }
}
