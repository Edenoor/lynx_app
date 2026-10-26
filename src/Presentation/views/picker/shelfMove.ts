// src/Presentation/views/picker/shelfMove.ts
// Mover un paquete de estantería eligiendo el destino de la lista. Quién
// puede moverse lo decide el servidor (custodia, Warehouse, estado): acá no se
// filtra por estado del envío ni del recorrido.

import { moveToShelfById, Shelf, visibleShelves, WarehouseApiError } from "./warehouseApi";

// Destinos posibles: las estanterías activas del Warehouse, menos la actual.
// El buscador y el orden son los de la lista de Estanterías.
export const moveTargets = (shelves: Shelf[], fromShelfId: number, query: string) =>
  visibleShelves(
    shelves.filter((s) => s.active && s.id !== fromShelfId),
    query,
  );

export type MoveOutcome =
  | { kind: "moved"; from: string | null; to: string }
  | { kind: "error"; message: string }
  // Sin respuesta: el servidor pudo haberlo movido. Repetir con el mismo
  // destino no lo mueve dos veces.
  | { kind: "unknown"; message: string };

export const NO_RESPONSE_SHELF_MOVE =
  "No sabemos si se movió. Podés volver a intentarlo: repetirlo con el mismo destino no lo mueve dos veces.";

export async function moveDelivery(deliveryId: number, target: Shelf): Promise<MoveOutcome> {
  try {
    const r = await moveToShelfById(deliveryId, target.id);
    return { kind: "moved", from: r.from, to: r.shelf.code };
  } catch (e) {
    if (e instanceof WarehouseApiError) return { kind: "error", message: e.message };
    return { kind: "unknown", message: NO_RESPONSE_SHELF_MOVE };
  }
}
