// src/Presentation/views/driver/Envios/baulSource.ts
// Lo que el chofer tiene en el Baúl: cobranzas por rendir, paquetes (no
// entregados y cancelados que siguen con él) y cambios para devolver. Lo
// calcula el servidor; la app solo lo muestra.
//
//   GET /v2/baul/me   (DRIVER; el chofer sale del token)
//   200 { ok, start_at, totals, cash: [...], parcels: [...], items: [...] }
//   403 sin ficha de chofer activa · 401 sesión vencida
//   404 servidor sin el contrato todavía → «unsupported» (no es un error)

import { getJson } from "../../../config/Api";

type BaulRow = { delivery_id: number; tracking: string | null; lynx_code: string | null; store: string | null; receiver: string | null };
export type BaulCash = BaulRow & { expected_amount: number; declared_amount: number | null; declared_method: "CASH" | "TRANSFER" | null };
// kind CANCELLED: cancelado que sigue con el chofer. attempted: hubo intento
// de entrega (si no, quedó con él sin intentarlo).
export type BaulParcel = BaulRow & { kind?: "NOT_DELIVERED" | "CANCELLED"; attempted?: boolean };
export type BaulItem = BaulRow & { closure: string; return_item: string | null };
export type BaulTotals = { cash_count: number; cash_amount: number; transfer_count: number; transfer_amount: number; parcels: number; items: number };
export type MyBaul = { totals: BaulTotals; cash: BaulCash[]; parcels: BaulParcel[]; items: BaulItem[] };

export type BaulResult =
  | { status: "ok"; baul: MyBaul }
  | { status: "unsupported" }
  | { status: "error"; message: string };

export function toBaulResult(json: any): BaulResult {
  if (json?.status === 404) return { status: "unsupported" };
  if (!json?.ok) return { status: "error", message: json?.message || json?.error || "No se pudo cargar el Baúl" };
  const list = (x: unknown) => (Array.isArray(x) ? x : []);
  const cash = list(json.cash), parcels = list(json.parcels), items = list(json.items);
  const totals: BaulTotals = json.totals ?? { cash_count: cash.length, cash_amount: 0, transfer_count: 0, transfer_amount: 0, parcels: parcels.length, items: items.length };
  return { status: "ok", baul: { totals, cash, parcels, items } };
}

export async function fetchMyBaul(): Promise<BaulResult> {
  try {
    return toBaulResult(await getJson("/v2/baul/me"));
  } catch {
    return { status: "error", message: "Sin conexión. Probá de nuevo." };
  }
}
