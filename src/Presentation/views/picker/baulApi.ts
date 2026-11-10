// src/Presentation/views/picker/baulApi.ts
// Cliente de /v2/baul para el Picker (contratos B1, 9-nov). El servidor toma
// el depósito del perfil del Picker: acá no viaja ningún id de depósito, y
// solo ve y rinde lo de recorridos de SU depósito.
//
//   GET  /v2/baul                    choferes con algo pendiente
//   GET  /v2/baul/drivers/:id        detalle del chofer
//   GET  /v2/baul/lookup?qr=         qué tiene pendiente un envío (etiqueta original)
//   POST /v2/baul/drivers/:id/parcels  { delivery_id }
//   POST /v2/baul/drivers/:id/items    { rsd_id, description? }
//   POST /v2/baul/drivers/:id/cash     { items: [{ rsd_id, method, received_amount, notes? }] }

import { getJson, postJsonWithTimeout } from "../../config/Api";
import { WarehouseApiError } from "./warehouseApi";
import type { BaulCashRow, BaulItemRow, BaulParcelRow, BaulVerifyRow, CashItem } from "./baulPicker";

// Recibir un paquete de reentrega pasa por la recepción de Planta (puede
// consultar a Mercado Libre): mismo margen que el escáner de recepción.
const PARCEL_TIMEOUT_MS = 20_000;
const POST_TIMEOUT_MS = 15_000;

export type BaulDriver = { id: number; username: string; first_name: string | null; last_name: string | null };
export type BaulDriverRow = BaulDriver & {
  cash_count: number; cash_amount: number; transfer_count: number; transfer_amount: number;
  parcels: number; items: number; to_verify?: number;
};
export type BaulDetail = {
  driver: BaulDriver;
  cash: BaulCashRow[]; parcels: BaulParcelRow[]; items: BaulItemRow[]; to_verify?: BaulVerifyRow[];
};
export type BaulLookup = {
  delivery: { id: number; tracking: string | number | null; lynx_code: string | null; store: string | null; ops_status: string | null };
  drivers: BaulDriver[];
  cash: BaulCashRow[]; parcels: BaulParcelRow[]; items: BaulItemRow[]; to_verify: BaulVerifyRow[];
  other_warehouse: boolean; message: string;
};
export type ParcelReceipt = { destination: "TIENDA" | "REPARTO" | "ESTANTERIA"; shelf: { code: string } | null };

// El code del servidor (p. ej. DELIVERED_NOT_PARCEL) viaja con el error.
export class BaulApiError extends WarehouseApiError {
  code: string | null;
  constructor(message: string, status: number, code: string | null) {
    super(message, status);
    this.code = code;
  }
}

const unwrap = <T,>(res: any): T => {
  if (!res || res.ok === false) {
    throw new BaulApiError(res?.error || res?.message || "Error del servidor", Number(res?.status ?? 0), res?.code ?? null);
  }
  return res as T;
};

export const driverName = (d: BaulDriver) => [d.first_name, d.last_name].filter(Boolean).join(" ") || d.username;

export const fetchBaulDrivers = async () => unwrap<{ drivers: BaulDriverRow[] }>(await getJson("/v2/baul"));
export const fetchBaulDriver = async (driverId: number) => unwrap<BaulDetail>(await getJson(`/v2/baul/drivers/${driverId}`));
export const lookupBaul = async (qr: string) => unwrap<BaulLookup>(await getJson(`/v2/baul/lookup?qr=${encodeURIComponent(qr)}`));

// Sin respuesta (timeout o sin red) rechaza con un Error común: el servidor
// pudo haberlo registrado. Repetir no duplica (índices únicos del Baúl).
export const postBaul = async <T,>(path: string, body: Record<string, unknown>) =>
  unwrap<T>(await postJsonWithTimeout(path, body, path.endsWith("/parcels") ? PARCEL_TIMEOUT_MS : POST_TIMEOUT_MS));

export const settleCash = async (driverId: number, item: CashItem) =>
  postBaul<{ ok: true }>(`/v2/baul/drivers/${driverId}/cash`, { items: [item] });
