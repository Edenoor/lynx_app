import { postJson } from "../../../config/Api";

export type AssignmentResponse = "accepted" | "rejected";

export async function respondToDeliveryAssignment(
  deliveryId: number | string,
  response: AssignmentResponse
) {
  if (!deliveryId) {
    throw new Error("Falta deliveryId para responder la asignación.");
  }

  const result = await postJson(`/v2/deliveries/${deliveryId}/assignment-response`, {
    response,
  });

  if (result?.ok === false) {
    throw new Error(
      result?.message ||
        result?.error ||
        "No se pudo responder la asignación."
    );
  }

  return result;
}

export async function acceptDeliveryAssignment(deliveryId: number | string) {
  return respondToDeliveryAssignment(deliveryId, "accepted");
}

export async function rejectDeliveryAssignment(deliveryId: number | string) {
  return respondToDeliveryAssignment(deliveryId, "rejected");
}

/**
 * Compatibilidad temporal.
 * El flujo viejo aceptaba por tracking en /envios/:tracking/accept.
 * El backend nuevo acepta/rechaza por deliveryId en /v2/deliveries/:id/assignment-response.
 */
export async function acceptShipment(tracking: string, _driverUsername: string) {
  throw new Error(
    `acceptShipment por tracking ya no está soportado. Tracking recibido: ${tracking}`
  );
}