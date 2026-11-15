// src/Presentation/views/driver/routes/stopSearch.ts
// Buscar un envío dentro del reparto abierto, sobre lo que ya está cargado
// (sin pedidos a la API): por tracking, destinatario o dirección. Sin
// distinguir mayúsculas, acentos ni espacios de más; el tracking también por
// sus dígitos («4612 345» encuentra «4612345»). No cambia el orden ni toca
// nada operativo: solo dice qué paradas mostrar y qué envíos destacar.
// Sin React: se prueba con node.

type SearchDelivery = { delivery_id: number; tracking: string | number | null; nombre_destinatario: string | null; direccion: string | null };
type SearchStop = { id: number; address?: string | null; receiver_name?: string | null; deliveries: SearchDelivery[] };

export function normalizeSearch(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const digitsOf = (value: unknown) => String(value ?? "").replace(/\D/g, "");

// Paradas que coinciden → ids de sus envíos que coinciden ([] si coincidió
// la parada misma: su dirección o su destinatario). null: no hay búsqueda.
export function searchStops(stops: readonly SearchStop[], query: string): Map<number, number[]> | null {
  const q = normalizeSearch(query);
  if (!q) return null;
  // Solo números (con espacios o guiones): también por dígitos del tracking.
  const qDigits = /^[\d\s-]+$/.test(query.trim()) ? digitsOf(query) : "";
  const has = (value: unknown) => normalizeSearch(value).includes(q);
  const tracking = (d: SearchDelivery) => {
    const t = d.tracking ?? d.delivery_id;
    return has(t) || (!!qDigits && digitsOf(t).includes(qDigits));
  };
  const found = new Map<number, number[]>();
  for (const stop of stops) {
    const ids = stop.deliveries.filter((d) => tracking(d) || has(d.nombre_destinatario) || has(d.direccion)).map((d) => d.delivery_id);
    if (ids.length || has(stop.address) || has(stop.receiver_name)) found.set(stop.id, ids);
  }
  return found;
}
