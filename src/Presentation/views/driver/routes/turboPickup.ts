// src/Presentation/views/driver/routes/turboPickup.ts
// Retiro de un Turbo: en la tienda el chofer marca solo los envíos de SU
// recorrido (los de las paradas de entrega), no todo lo pendiente de la tienda.
// Eso último es la colecta genérica (/stops/:id/pending), donde sí corresponde;
// en un Turbo, «Colecté» sobre un envío ajeno lo sacaba a la calle sin parada
// de entrega. Sin React: se prueba con node.

type DeliveryLike = { delivery_id: number };
type StopLike<D extends DeliveryLike> = { type: "PICKUP" | "DELIVERY"; deliveries: D[] };

// Los envíos de las paradas de entrega, en el orden del recorrido y sin
// repetir. `collected`: ya tiene resultado en la parada de retiro.
export function turboPickupItems<D extends DeliveryLike>(
  stops: StopLike<D>[],
  pickupStop: { deliveries: DeliveryLike[] },
): (D & { collected: boolean })[] {
  const handled = new Set(pickupStop.deliveries.map((d) => d.delivery_id));
  const seen = new Set<number>();
  const items: (D & { collected: boolean })[] = [];
  for (const s of stops) {
    if (s.type !== "DELIVERY") continue;
    for (const d of s.deliveries) {
      if (seen.has(d.delivery_id)) continue;
      seen.add(d.delivery_id);
      items.push({ ...d, collected: handled.has(d.delivery_id) });
    }
  }
  return items;
}

export const TURBO_NOT_IN_ROUTE_MESSAGE =
  "Ese envío no es parte de este Turbo: en el retiro solo se marcan los envíos del recorrido.";

// El servidor rechaza con 409 TURBO_NOT_IN_ROUTE lo que no es del recorrido
// (un dato viejo en pantalla, una app anterior): ese código se explica; el
// resto de los errores pasa tal cual.
export function turboPickupError(e: unknown): unknown {
  return (e as { code?: unknown } | null | undefined)?.code === "TURBO_NOT_IN_ROUTE" ? new Error(TURBO_NOT_IN_ROUTE_MESSAGE) : e;
}
