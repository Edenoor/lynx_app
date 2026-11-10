// src/Presentation/views/picker/baulPicker.ts
// Qué puede recibir el Picker del Baúl de un chofer y cómo se arma cada
// confirmación. Sin React ni red: se prueba con node. Las reglas (depósito,
// doble rendición, qué cuenta como pendiente) son del servidor (B1, 9-nov);
// acá solo se presenta lo que devuelve y se valida lo que escribe el picker.

export type Method = "CASH" | "TRANSFER";

type Ref = { delivery_id: number; tracking: string | number | null; lynx_code: string | null; store: string | null; receiver?: string | null };
export type BaulCashRow = Ref & {
  rsd_id: number; driver_id?: number; expected_amount: number;
  declared_amount: number | null; declared_method: Method | null;
  outcome_by?: string | null; provider_closed?: boolean;
};
export type BaulParcelRow = Ref & {
  driver_id?: number; rsd_id: number | null; kind?: "NOT_DELIVERED" | "CANCELLED";
  declared_closure: string | null; attempted?: boolean; driver_notes?: string | null;
};
export type BaulItemRow = Ref & { rsd_id: number; driver_id?: number; closure: string; return_item: string | null };
export type BaulVerifyRow = Ref & { rsd_id: number; driver_id?: number; reverse_kind: string; reverse_note: string | null };
export type BaulPending = { cash: BaulCashRow[]; parcels: BaulParcelRow[]; items: BaulItemRow[]; to_verify?: BaulVerifyRow[] };

// Una cosa que el chofer entrega y el picker confirma por separado.
export type Obligation =
  | { kind: "parcel"; key: string; driverId: number; deliveryId: number; ref: string; store: string | null; label: string; detail: string }
  | { kind: "item"; key: string; driverId: number; rsdId: number; deliveryId: number; ref: string; store: string | null; label: string; detail: string }
  | { kind: "verify"; key: string; driverId: number; rsdId: number; deliveryId: number; ref: string; store: string | null; label: string; detail: string; description: string | null }
  | { kind: "cash"; key: string; driverId: number; rsdId: number; deliveryId: number; ref: string; store: string | null; label: string; detail: string;
      expected: number; declared: number | null; declaredMethod: Method | null };

export const CLOSURE_LABEL: Record<string, string> = {
  REENTREGA: "Reentrega", DEVOLUCION: "Devolución", CANCELACION: "Cancelación",
  CAMBIO: "Cambio", RECUPERO: "Recupero", VA_Y_VUELVE: "Va y vuelve", OTRO: "Otro",
};
const PROVIDER_LABEL: Record<string, string> = { mercadolibre: "Mercado Libre", lightdata: "LightData" };

export const refOf = (r: Ref) => String(r.tracking ?? r.lynx_code ?? `#${r.delivery_id}`);
export const pesos = (n: number) => `$${Number(n).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;

function parcelDetail(p: BaulParcelRow): string {
  if (p.kind === "CANCELLED") return "Cancelado: vuelve a la tienda (no se reentrega)";
  const where = p.declared_closure === "DEVOLUCION" || p.declared_closure === "CANCELACION"
    ? "vuelve a la tienda" : "vuelve a su estantería para reentregar";
  const declared = p.declared_closure ? `el chofer declaró ${CLOSURE_LABEL[p.declared_closure] ?? p.declared_closure}` : "sin destino declarado";
  return `${p.attempted === false ? "Sin intento" : "No entregado"} · ${declared}: ${where}`;
}

function cashDetail(c: BaulCashRow): string {
  const method = c.declared_method === "TRANSFER" ? "transferencia" : c.declared_method === "CASH" ? "efectivo" : null;
  const declared = c.declared_amount == null
    ? (c.provider_closed && c.outcome_by ? `sin declarar (la cerró ${PROVIDER_LABEL[c.outcome_by] ?? c.outcome_by})` : "sin declarar")
    : `declaró ${pesos(c.declared_amount)}${method ? ` en ${method}` : ""}`;
  return `Esperado ${pesos(c.expected_amount)} · ${declared}`;
}

// Todo lo pendiente, en el orden en que se recibe en el mostrador: paquetes,
// lo que trae de vuelta, retornos a verificar y la plata. `driverId` es el
// chofer del detalle; en la búsqueda por etiqueta cada fila trae el suyo.
export function obligationsOf(p: BaulPending, driverId?: number): Obligation[] {
  const who = (r: { driver_id?: number }) => (r.driver_id ?? driverId) as number;
  const base = (r: Ref) => ({ deliveryId: r.delivery_id, ref: refOf(r), store: r.store ?? null });
  return [
    ...p.parcels.map((r): Obligation => ({
      kind: "parcel", key: `p${r.delivery_id}`, driverId: who(r), ...base(r),
      label: r.kind === "CANCELLED" ? "Paquete cancelado" : "Paquete", detail: parcelDetail(r),
    })),
    ...p.items.map((r): Obligation => ({
      kind: "item", key: `i${r.rsd_id}`, driverId: who(r), rsdId: r.rsd_id, ...base(r),
      label: CLOSURE_LABEL[r.closure] ?? "Trae de vuelta", detail: r.return_item ?? "",
    })),
    ...(p.to_verify ?? []).map((r): Obligation => ({
      kind: "verify", key: `v${r.rsd_id}`, driverId: who(r), rsdId: r.rsd_id, ...base(r),
      label: `${CLOSURE_LABEL[r.reverse_kind] ?? r.reverse_kind} a verificar`,
      detail: `Lo pidió coordinación${r.reverse_note ? `: ${r.reverse_note}` : ""}. Confirmá solo si el chofer lo trajo.`,
      // Sin nota de coordinación, el servidor pide decir qué es (mismo texto que la Web).
      description: r.reverse_note ? null : `${CLOSURE_LABEL[r.reverse_kind] ?? r.reverse_kind} pedido por coordinación`,
    })),
    ...p.cash.map((r): Obligation => ({
      kind: "cash", key: `c${r.rsd_id}`, driverId: who(r), rsdId: r.rsd_id, ...base(r),
      label: "Cobranza", detail: cashDetail(r),
      expected: r.expected_amount, declared: r.declared_amount, declaredMethod: r.declared_method,
    })),
  ];
}

// Lo recibido arranca con lo que declaró el chofer en efectivo; nunca con lo
// esperado. En transferencia, vacío: se escribe lo acreditado del comprobante.
export const startAmount = (o: Extract<Obligation, { kind: "cash" }>, method: Method) =>
  method === "CASH" && o.declared != null ? amountText(o.declared) : "";
const amountText = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ","));

// Importe a la argentina, igual que la Web: punto de miles, coma decimal.
// null si está vacío; NaN si no se entiende (nunca se adivina).
export function parseArs(text: string): number | null {
  const s = text.replace(/[\s$]/g, "");
  if (!s) return null;
  if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(s)) return NaN;
  return Number(s.replace(/\./g, "").replace(",", "."));
}

export const differenceOf = (expected: number, amount: number | null) =>
  amount === null || Number.isNaN(amount) ? null : Math.round((amount - expected) * 100) / 100;

export type CashItem = { rsd_id: number; method: Method; received_amount: number; notes?: string };

// Lo que va en POST /v2/baul/drivers/:id/cash para UNA cobranza, o por qué no
// se puede mandar todavía. Las mismas reglas que valida el servidor.
export function cashItem(
  o: Extract<Obligation, { kind: "cash" }>, method: Method, text: string, note: string,
): { ok: true; item: CashItem } | { ok: false; error: string } {
  const amount = parseArs(text);
  if (amount === null || Number.isNaN(amount)) {
    return { ok: false, error: "Escribí lo recibido con punto de miles y coma decimal (ej. 1.500 o 1.234,56)." };
  }
  if (method === "TRANSFER" && amount === 0) {
    return { ok: false, error: "Si la transferencia todavía no entró, no la confirmes: queda pendiente." };
  }
  const diff = differenceOf(o.expected, amount) ?? 0;
  const why = note.trim();
  if (Math.abs(diff) >= 0.005 && !why) {
    return { ok: false, error: `Lo recibido no coincide con lo esperado (diferencia ${pesos(diff)}): escribí el motivo.` };
  }
  return { ok: true, item: { rsd_id: o.rsdId, method, received_amount: amount, ...(Math.abs(diff) >= 0.005 ? { notes: why } : {}) } };
}

// Cuerpo del POST de cada tipo (sin la cobranza, que lleva importe).
export function receiveRequest(o: Exclude<Obligation, { kind: "cash" }>): { path: string; body: Record<string, unknown> } {
  const driver = `/v2/baul/drivers/${o.driverId}`;
  if (o.kind === "parcel") return { path: `${driver}/parcels`, body: { delivery_id: o.deliveryId } };
  if (o.kind === "verify") return { path: `${driver}/items`, body: o.description ? { rsd_id: o.rsdId, description: o.description } : { rsd_id: o.rsdId } };
  return { path: `${driver}/items`, body: { rsd_id: o.rsdId } };
}

// Qué decirle al picker después de confirmar. `status` 0 = sin respuesta.
export type ConfirmError = { status: number; message: string; code?: string | null };
export function confirmErrorText(e: ConfirmError): { text: string; reload: boolean } {
  if (!e.status) {
    return { text: "No sabemos si quedó registrado. Actualizamos la lista: si ya no figura, se registró.", reload: true };
  }
  // Ya rendido o recibido (otro picker o un doble toque): la lista manda.
  if (e.status === 409 && /ya (se )?rendi|ya se recibi|ya se registr|no está en el Baúl/i.test(e.message)) {
    return { text: `Ya estaba registrado: ${e.message}`, reload: true };
  }
  if (e.status === 403) return { text: `Sin permiso: ${e.message}`, reload: false };
  return { text: e.message, reload: e.status === 409 };
}

// Resultado de recibir un paquete, en una línea.
export function parcelResultText(r: { destination?: string; shelf?: { code: string } | null }): string {
  if (r.destination === "TIENDA") return "Recibido: separalo para devolver a la tienda.";
  if (r.destination === "ESTANTERIA") return `Recibido: cancelado guardado en ${r.shelf?.code ?? "la estantería"}.`;
  return r.shelf ? `Recibido: va a la estantería ${r.shelf.code}.` : "Recibido.";
}
