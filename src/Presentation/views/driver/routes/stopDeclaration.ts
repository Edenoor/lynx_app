// src/Presentation/views/driver/routes/stopDeclaration.ts
// Cantidad de paquetes que el chofer declara haber retirado en cada parada de
// una colecta (PUT /v2/routes/:id/stops/:stopId/declare-count). Es un número
// a mano por parada: no es collected_count (envíos escaneados uno por uno).
// null = sin informar; 0 = informó cero. Sin React: se prueba con node.

// store_id: el retiro es de una tienda; sin él, de un Dropoff (warehouse).
type StopLike = { type: "PICKUP" | "DELIVERY"; declared_count?: number | null; store_id?: number | null };

// Un servidor anterior a la declaración no manda el campo: ahí no se ofrece.
export const supportsDeclaration = (s: StopLike) => s.type === "PICKUP" && s.declared_count !== undefined;

// El servidor la acepta con la colecta en curso o finalizada (corrección).
export const canDeclare = (routeStatus: string) => routeStatus === "IN_PROGRESS" || routeStatus === "COMPLETED";

export const declarationLabel = (count: number | null | undefined) =>
  count === null || count === undefined ? "Sin informar" : `Informado: ${count} ${count === 1 ? "paquete" : "paquetes"}`;

// Solo dígitos: sin vacío, signo, decimales ni espacios en el medio.
export function parseDeclaredCount(text: string): { ok: true; count: number } | { ok: false; error: string } {
  const t = text.trim();
  if (!t) return { ok: false, error: "Ingresá cuántos paquetes retiraste (0 si no retiraste ninguno)." };
  if (!/^\d{1,6}$/.test(t)) return { ok: false, error: "Ingresá un número entero, sin decimales ni signos." };
  return { ok: true, count: Number(t) };
}

// Totales del detalle: solo declared_count. Una parada con 0 cuenta como informada.
export function declarationSummary(stops: StopLike[]) {
  const counted = stops.filter(supportsDeclaration);
  const informed = counted.filter((s) => s.declared_count !== null);
  return {
    stops: counted.length,
    informed: informed.length,
    pending: counted.length - informed.length,
    total: informed.reduce((n, s) => n + (s.declared_count as number), 0),
    allStores: counted.every((s) => s.store_id != null),
  };
}

// «tiendas informadas» si todos los retiros son de tiendas; con algún Dropoff,
// «puntos de retiro informados».
export function placeStatLabel(n: number, allStores: boolean, kind: "informed" | "pending"): string {
  const one = n === 1;
  if (allStores) return `${one ? "tienda" : "tiendas"} ${kind === "pending" ? (one ? "pendiente" : "pendientes") : one ? "informada" : "informadas"}`;
  return `${one ? "punto" : "puntos"} de retiro ${kind === "pending" ? (one ? "pendiente" : "pendientes") : one ? "informado" : "informados"}`;
}
