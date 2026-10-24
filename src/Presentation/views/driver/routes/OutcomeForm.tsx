// src/Presentation/views/driver/routes/OutcomeForm.tsx
// Cierre de un envío con la declaración del Baúl. Todo es opcional: con
// «Confirmar» sin tocar nada se cierra igual que antes. Plegar una sección
// borra lo que tenía, así no viaja nada que el chofer no ve. El importe
// (precargado con la cobranza) solo viaja si el chofer marca cómo le pagaron.

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import AppTheme from "../../../theme/AppTheme";
import {
  Destination, DESTINATION_LABEL, emptyDraft, formatAmountAr, OutcomeDraft, parseAmountAr, PAYMENT_LABEL, PaymentMethod, RETURN_LABEL, ReturnKind,
} from "./outcomeDeclaration";

type Props = {
  outcome: "DELIVERED" | "NOT_DELIVERED";
  cobranza: number | null;
  busy: boolean;
  error: string | null;
  onConfirm: (draft: OutcomeDraft) => void;
  onCancel: () => void;
};

const PAYMENTS: PaymentMethod[] = ["CASH", "TRANSFER"];
const RETURNS: ReturnKind[] = ["CAMBIO", "RECUPERO", "VA_Y_VUELVE"];
const DESTINATIONS: Destination[] = ["REENTREGA", "DEVOLUCION", "CANCELACION"];

export default function OutcomeForm({ outcome, cobranza, busy, error, onConfirm, onCancel }: Props) {
  const [draft, setDraft] = useState<OutcomeDraft>(() => emptyDraft(cobranza !== null ? formatAmountAr(cobranza) : ""));
  const [payOpen, setPayOpen] = useState(cobranza !== null);
  const [returnOpen, setReturnOpen] = useState(false);
  // El error del importe se muestra al salir del campo o al confirmar, no
  // mientras se escribe («1.5» camino a «1.500»).
  const [showAmountError, setShowAmountError] = useState(false);
  const set = (patch: Partial<OutcomeDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const amount = parseAmountAr(draft.amountText);
  const delivered = outcome === "DELIVERED";
  // Igual que buildDeclaration: el importe solo cuenta con un medio de pago elegido.
  const amountBlocks = delivered && draft.paymentMethod !== null && !amount.ok;
  const confirm = () => {
    if (amountBlocks) { setShowAmountError(true); return; }
    onConfirm(draft);
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{delivered ? "Cerrar como entregado" : "Cerrar como no entregado"}</Text>

      {delivered ? (
        <>
          {cobranza !== null ? (
            <View style={styles.cobrar}>
              <Text style={styles.cobrarText}>Cobrar $ {formatAmountAr(cobranza)}</Text>
              <Text style={styles.hint}>Si te pagó, marcá cómo y revisá el importe. Sin medio de pago no se registra el cobro.</Text>
            </View>
          ) : (
            <Toggle label="¿Cobraste? (opcional)" open={payOpen} onPress={() => { if (payOpen) set({ paymentMethod: null, amountText: "" }); setPayOpen(!payOpen); }} />
          )}
          {payOpen ? (
            <>
              <Chips options={PAYMENTS} labels={PAYMENT_LABEL} value={draft.paymentMethod} onChange={(v) => set({ paymentMethod: v })} />
              <TextInput value={draft.amountText} onChangeText={(t) => set({ amountText: t })} keyboardType="decimal-pad"
                onFocus={() => setShowAmountError(false)} onBlur={() => setShowAmountError(true)}
                placeholder="Importe cobrado (ej. 1.500 o 1.234,56)" placeholderTextColor={AppTheme.text.muted} style={styles.input} />
              {showAmountError && !amount.ok && draft.paymentMethod ? <Text style={styles.warn}>{amount.error}</Text> : null}
              {cobranza === null && !draft.paymentMethod && draft.amountText.trim() ? (
                <Text style={styles.hint}>Marcá Efectivo o Transferencia para que se registre el importe.</Text>
              ) : null}
            </>
          ) : null}

          <Toggle label="¿Traés algo de vuelta? (opcional)" open={returnOpen} onPress={() => { if (returnOpen) set({ returnKind: null, returnItem: "" }); setReturnOpen(!returnOpen); }} />
          {returnOpen ? (
            <>
              <Chips options={RETURNS} labels={RETURN_LABEL} value={draft.returnKind} onChange={(v) => set({ returnKind: v })} />
              {draft.returnKind ? (
                <TextInput value={draft.returnItem} onChangeText={(t) => set({ returnItem: t })} maxLength={500}
                  placeholder="¿Qué traés? (obligatorio)" placeholderTextColor={AppTheme.text.muted} style={styles.input} />
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.label}>¿Qué pasa con el paquete? (opcional)</Text>
          <Chips options={DESTINATIONS} labels={DESTINATION_LABEL} value={draft.destination}
            onChange={(v) => set({ destination: v })} />
          <Text style={styles.hint}>Devolución y Cancelación lo mandan de vuelta a la tienda: no vuelve a salir.</Text>
        </>
      )}

      {error ? <Text style={styles.warn}>{error}</Text> : null}
      <View style={styles.row}>
        <Pressable onPress={confirm} disabled={busy} style={[styles.btn, busy && styles.btnDisabled]}>
          <Text style={styles.btnText}>{delivered ? "Confirmar entrega" : "Confirmar no entregado"}</Text>
        </Pressable>
        <Pressable onPress={onCancel} disabled={busy} style={[styles.btn, styles.btnGhost, busy && styles.btnDisabled]}>
          <Text style={styles.btnGhostText}>Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Toggle({ label, open, onPress }: { label: string; open: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.toggle} hitSlop={6} accessibilityRole="button" accessibilityState={{ expanded: open }}>
      <Text style={styles.label}>{label}</Text>
      <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={AppTheme.text.muted} />
    </Pressable>
  );
}

// Tocar la opción elegida la desmarca.
function Chips<T extends string>({ options, labels, value, onChange }: {
  options: T[]; labels: Record<T, string>; value: T | null; onChange: (v: T | null) => void;
}) {
  return (
    <View style={styles.row}>
      {options.map((o) => (
        <Pressable key={o} onPress={() => onChange(value === o ? null : o)} style={[styles.chip, value === o && styles.chipActive]}
          accessibilityRole="button" accessibilityState={{ selected: value === o }}>
          <Text style={[styles.chipText, value === o && styles.chipTextActive]}>{labels[o]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: "100%", gap: 8, padding: AppTheme.spacing.sm, borderRadius: AppTheme.radius.md, borderWidth: 1, borderColor: AppTheme.borders.primary, backgroundColor: AppTheme.overlays.primary },
  title: { color: AppTheme.text.primary, fontWeight: "700", fontSize: 14 },
  label: { color: AppTheme.text.primary, fontSize: 13, fontWeight: "600" },
  hint: { color: AppTheme.text.secondary, fontSize: 12, lineHeight: 16 },
  warn: { color: AppTheme.colors.warning, fontSize: 13 },
  cobrar: { borderWidth: 1, borderColor: AppTheme.colors.warning, borderRadius: AppTheme.radius.md, padding: 10, gap: 2 },
  cobrarText: { color: AppTheme.colors.warning, fontSize: 16, fontWeight: "700" },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  row: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  chip: { borderRadius: AppTheme.radius.md, borderWidth: 1, borderColor: AppTheme.borders.default, paddingHorizontal: 12, minHeight: 36, justifyContent: "center" },
  chipActive: { backgroundColor: AppTheme.colors.primary, borderColor: AppTheme.colors.primary },
  chipText: { color: AppTheme.text.primary, fontWeight: "600" },
  chipTextActive: { color: AppTheme.text.inverse },
  input: { minHeight: 44, borderRadius: AppTheme.radius.md, borderWidth: 1, borderColor: AppTheme.borders.default, backgroundColor: AppTheme.surfaces.input, color: AppTheme.text.primary, paddingHorizontal: 12 },
  btn: { alignItems: "center", justifyContent: "center", backgroundColor: AppTheme.colors.primary, borderRadius: AppTheme.radius.md, paddingHorizontal: 16, minHeight: 44 },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: AppTheme.borders.default },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: AppTheme.text.inverse, fontWeight: "700" },
  btnGhostText: { color: AppTheme.text.primary, fontWeight: "600" },
});
