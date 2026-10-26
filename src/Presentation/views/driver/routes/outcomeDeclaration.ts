// src/Presentation/views/driver/routes/outcomeDeclaration.ts
// Lo que el chofer declara al cerrar una entrega (Baúl): cómo cobró y cuánto,
// si trae algo de vuelta, o qué pasa con un paquete que no entregó. Todo es
// opcional: sin nada declarado, el resultado viaja igual que siempre.
// Módulo puro (sin React Native) para poder probarlo solo.

export type PaymentMethod = "CASH" | "TRANSFER";
export type ReturnKind = "CAMBIO" | "RECUPERO" | "VA_Y_VUELVE";
export type Destination = "REENTREGA" | "DEVOLUCION" | "CANCELACION";

export const PAYMENT_LABEL: Record<PaymentMethod, string> = { CASH: "Efectivo", TRANSFER: "Transferencia" };
export const RETURN_LABEL: Record<ReturnKind, string> = { CAMBIO: "Cambio", RECUPERO: "Recupero", VA_Y_VUELVE: "Va y vuelve" };
export const DESTINATION_LABEL: Record<Destination, string> = { REENTREGA: "Reentrega", DEVOLUCION: "Devolución", CANCELACION: "Cancelación" };

// Mismo tope que el servidor (columna NUMERIC(12,2)).
export const MAX_AMOUNT = 100000000;

export type OutcomeDraft = {
  paymentMethod: PaymentMethod | null;
  amountText: string;
  returnKind: ReturnKind | null;
  returnItem: string;
  destination: Destination | null;
};

export const emptyDraft = (amountText = ""): OutcomeDraft => ({
  paymentMethod: null, amountText, returnKind: null, returnItem: "", destination: null,
});

// Campos opcionales del POST .../outcomes. Solo viaja lo que se completó.
export type OutcomeDeclaration = {
  payment_method?: PaymentMethod;
  collected_amount?: number;
  closure?: ReturnKind | Destination;
  return_item?: string;
};

export type AmountResult = { ok: true; value: number | null } | { ok: false; error: string };

// Importe en formato argentino: el punto separa miles y la coma, decimales
// («1.500», «1500», «1.234,56»). Como muchos teclados numéricos de Android
// solo ofrecen «.», un único punto seguido de 1 o 2 dígitos también vale como
// decimal («1500.50», «0.5»): no se confunde con miles, que siempre van de a
// tres. Lo demás («1.5000», «1.234.56») se rechaza en vez de adivinar.
// Vacío = no declaró importe.
export function parseAmountAr(raw: string): AmountResult {
  const text = String(raw ?? "").replace(/\$/g, "").replace(/\s+/g, "");
  if (!text) return { ok: true, value: null };
  if (text.startsWith("-")) return { ok: false, error: "El importe no puede ser negativo" };
  const dotDecimal = /^\d+\.\d{1,2}$/.test(text);
  if (!dotDecimal && !/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(text)) {
    return { ok: false, error: "Importe inválido: usá punto para los miles y coma o punto para los centavos (ej. 1.500 o 1.234,56)" };
  }
  const value = Number(dotDecimal ? text : text.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(value)) return { ok: false, error: "Importe inválido" };
  if (value > MAX_AMOUNT) return { ok: false, error: "El importe es demasiado grande" };
  return { ok: true, value };
}

// 1500 → «1.500»; 1234.5 → «1.234,50». Sin Intl: el resultado no depende del teléfono.
export function formatAmountAr(n: number): string {
  const cents = Math.round(n * 100);
  const int = Math.floor(cents / 100);
  const dec = cents % 100;
  const grouped = String(int).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dec ? `${grouped},${String(dec).padStart(2, "0")}` : grouped;
}

// importe_cobranza puede llegar como número o como texto (NUMERIC de Postgres).
// Solo cuenta una cobranza positiva.
export function cobranzaOf(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type DeclarationResult = { ok: true; declaration: OutcomeDeclaration } | { ok: false; error: string };

// Arma la declaración para `outcome`. Lo que no corresponde al resultado
// (por ejemplo, el cobro en un no entregado) se ignora. El importe solo viaja
// con un medio de pago elegido: la cobranza viene precargada por comodidad y,
// sin medio, el Baúl registraría «cobró todo» aunque el cliente no pagó.
export function buildDeclaration(outcome: string, draft: OutcomeDraft): DeclarationResult {
  const out: OutcomeDeclaration = {};
  if (outcome === "DELIVERED") {
    if (draft.paymentMethod) {
      out.payment_method = draft.paymentMethod;
      const amount = parseAmountAr(draft.amountText);
      if (!amount.ok) return amount;
      if (amount.value !== null) out.collected_amount = amount.value;
    }
    if (draft.returnKind) {
      const item = draft.returnItem.trim();
      if (!item) return { ok: false, error: "Contá qué traés de vuelta" };
      out.closure = draft.returnKind;
      out.return_item = item.slice(0, 500);
    }
  } else if (draft.destination) {
    out.closure = draft.destination;
  }
  return { ok: true, declaration: out };
}
