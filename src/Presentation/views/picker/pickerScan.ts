// src/Presentation/views/picker/pickerScan.ts
// Qué hacer con cada lectura del escáner del Picker. Un paquete se recibe
// (el servidor lo estantea según su código postal); una estantería mueve ahí
// el último paquete leído. Las reglas de custodia y estado son del servidor:
// acá solo se clasifica lo que responde, sin tocar lo que leyó la cámara.

import { isShelfQr, moveToShelf, receivePackage, ReceiveResult, WarehouseApiError } from "./warehouseApi";

export type PendingPackage = { id: number; tracking: string | null };

// Qué pasó con una recepción, según los campos de la respuesta y no por el
// solo hecho de que fue 200:
// - received: hubo transición de ingreso (ARRIVED_WAREHOUSE / SHELVED).
// - alreadyHere: ya estaba estanteado en este Warehouse.
// - closed: envío terminado (alerta CLOSED); no vuelve a planta.
// - inRoute: asignado a un recorrido (alerta IN_ROUTE); no se reestantea.
// - unchanged: el servidor respondió sin cambiar nada y sin decir por qué.
export type ReceiveStatus = "received" | "alreadyHere" | "closed" | "inRoute" | "unchanged";

// De qué tipo es un error del servidor:
// - identification: no reconoce la etiqueta o el envío (400, 404, 422).
// - conflict: el envío no se puede recibir/mover acá por estado o custodia (409).
// - access: sesión, permiso o Warehouse del usuario (401, 403, 400 de Warehouse).
// - server: error interno (5xx u otro); no se sabe si se aplicó.
export type ErrorCategory = "identification" | "conflict" | "access" | "server";

export type ScanOutcome =
  | { kind: "received"; status: ReceiveStatus; result: ReceiveResult }
  | { kind: "moved"; tracking: string | null; from: string | null; to: string }
  // raw: lo que leyó la cámara, solo en errores de recepción donde sirve para
  // diagnosticar la etiqueta. Vive en memoria hasta la próxima lectura.
  | { kind: "error"; category: ErrorCategory; message: string; status: number | null; raw: string | null; operation: "receive" | "move" }
  // Estantería escaneada sin un paquete antes.
  | { kind: "sequence"; message: string }
  // Sin respuesta (timeout o sin red): el servidor pudo haberlo ejecutado.
  // Repetir es seguro: recibir de nuevo solo informa dónde está, y mover a la
  // misma estantería no cambia nada.
  | { kind: "unknown"; message: string };

export const NO_RESPONSE_RECEIVE =
  "No sabemos si quedó registrado. Volvé a escanear el paquete: si ya estaba, vas a ver «Ya estaba en planta».";
export const NO_RESPONSE_MOVE =
  "No sabemos si se movió. Volvé a escanear la estantería: repetirlo no lo mueve dos veces.";
export const SHELF_FIRST = "Escaneá primero el paquete y después la estantería.";

const RECEPTION_TRANSITIONS = new Set(["ARRIVED_WAREHOUSE", "SHELVED"]);

export function receiveStatus(result: ReceiveResult): ReceiveStatus {
  const alert = (code: string) => result.alerts.some((a) => a.code === code);
  if (alert("CLOSED")) return "closed";
  if (result.ops.transitions.some((t) => RECEPTION_TRANSITIONS.has(t))) return "received";
  if (result.ops.already_here) return "alreadyHere";
  if (alert("IN_ROUTE")) return "inRoute";
  return "unchanged";
}

// El servidor usa 400 tanto para "QR ilegible" como para "no tenés un
// Warehouse asignado / inactivo"; mientras no mande un código propio, el
// texto es lo único que los distingue.
export function errorCategory(status: number, message: string): ErrorCategory {
  if (status === 401 || status === 403) return "access";
  if (status === 400) return /warehouse/i.test(message) ? "access" : "identification";
  if (status === 404 || status === 422) return "identification";
  if (status === 409) return "conflict";
  return "server";
}

const failure = (e: unknown, operation: "receive" | "move", raw: string): ScanOutcome => {
  if (!(e instanceof WarehouseApiError)) {
    return { kind: "unknown", message: operation === "receive" ? NO_RESPONSE_RECEIVE : NO_RESPONSE_MOVE };
  }
  const category = errorCategory(e.status, e.message);
  const showRaw = operation === "receive" && (category === "identification" || category === "server");
  return { kind: "error", category, message: e.message, status: e.status || null, raw: showRaw ? raw : null, operation };
};

// Devuelve el resultado y cuál queda como "último paquete" para una estantería.
// `raw` viaja al servidor tal cual lo leyó la cámara.
export async function processScan(
  raw: string,
  pending: PendingPackage | null,
): Promise<{ outcome: ScanOutcome; pending: PendingPackage | null }> {
  if (isShelfQr(raw)) {
    if (!pending) return { outcome: { kind: "sequence", message: SHELF_FIRST }, pending: null };
    try {
      const r = await moveToShelf(pending.id, raw);
      return { outcome: { kind: "moved", tracking: pending.tracking, from: r.from, to: r.shelf.code }, pending: null };
    } catch (e) {
      // Si la estantería no sirve (o no hubo respuesta), el paquete sigue
      // esperando: se puede volver a escanear la estantería.
      return { outcome: failure(e, "move", raw), pending };
    }
  }

  try {
    const result = await receivePackage(raw);
    const status = receiveStatus(result);
    // Solo lo que está en planta se puede mover a otra estantería.
    const movable = result.shelf && (status === "received" || status === "alreadyHere");
    const next = movable ? { id: result.delivery.id, tracking: result.delivery.tracking } : null;
    return { outcome: { kind: "received", status, result }, pending: next };
  } catch (e) {
    return { outcome: failure(e, "receive", raw), pending: null };
  }
}
