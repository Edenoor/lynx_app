// src/Presentation/views/picker/BaulObligationCard.tsx
// Una obligación del Baúl de un chofer y su confirmación individual. La
// recibe el Picker (el chofer nunca marca nada): un toque manda el POST de B1
// que corresponde y, al volver, la pantalla recarga lo pendiente. La cobranza
// lleva lo recibido escrito a mano y, si no coincide con lo esperado, el motivo.

import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import AppTheme from "../../theme/AppTheme";
import { postBaul, settleCash, BaulApiError, ParcelReceipt } from "./baulApi";
import {
  cashItem, confirmErrorText, differenceOf, Method, Obligation, parcelResultText, parseArs, pesos, receiveRequest, startAmount,
} from "./baulPicker";

type Props = {
  obligation: Obligation;
  // ok: texto del resultado. reload: la lista se vuelve a pedir (también ante
  // un «ya estaba registrado» o una respuesta que no llegó).
  onResult: (r: { ok: boolean; text: string; reload: boolean }) => void;
  // Sin permiso de operar el baúl: se ve qué hay, sin cargar ni confirmar.
  soloConsulta?: boolean;
};

export function BaulObligationCard({ obligation: o, onResult, soloConsulta = false }: Props) {
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [method, setMethod] = useState<Method>(o.kind === "cash" ? o.declaredMethod ?? "CASH" : "CASH");
  const [amount, setAmount] = useState(o.kind === "cash" ? startAmount(o, method) : "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [method, amount, note]);

  const diff = o.kind === "cash" ? differenceOf(o.expected, parseArs(amount)) : null;
  const showNote = diff !== null && Math.abs(diff) >= 0.005;

  const confirm = async () => {
    if (sending.current) return;
    let send: () => Promise<string>;
    if (o.kind === "cash") {
      const built = cashItem(o, method, amount, note);
      if (!built.ok) { setError(built.error); return; }
      send = async () => {
        await settleCash(o.driverId, built.item);
        return `Cobranza de ${o.ref}: recibido ${pesos(built.item.received_amount)}${method === "TRANSFER" ? " (transferencia)" : ""}.`;
      };
    } else {
      const { path, body } = receiveRequest(o);
      send = async () => {
        const r = await postBaul<ParcelReceipt>(path, body);
        return o.kind === "parcel" ? `${o.ref}: ${parcelResultText(r)}` : `${o.ref}: ${o.label} recibido.`;
      };
    }
    sending.current = true;
    setBusy(true);
    try {
      onResult({ ok: true, text: await send(), reload: true });
    } catch (e) {
      const err = e instanceof BaulApiError ? { status: e.status, message: e.message, code: e.code } : { status: 0, message: "" };
      const { text, reload } = confirmErrorText(err);
      onResult({ ok: false, text, reload });
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const action = o.kind === "cash" ? "Confirmar cobranza" : o.kind === "parcel" ? "Recibir paquete" : o.kind === "verify" ? "Lo trajo" : "Recibir";

  return (
    <View style={styles.card} accessibilityLabel={`${o.label} ${o.ref}`}>
      <Text style={styles.kind}>{o.label}</Text>
      <Text style={styles.ref}>{o.ref}{o.store ? ` · ${o.store}` : ""}</Text>
      {o.detail ? <Text style={styles.detail}>{o.detail}</Text> : null}

      {o.kind === "cash" && !soloConsulta ? (
        <View style={styles.cash}>
          <View style={styles.methods}>
            {(["CASH", "TRANSFER"] as const).map((m) => (
              <Pressable key={m} disabled={busy} onPress={() => { setMethod(m); setAmount(startAmount(o, m)); }}
                style={[styles.method, method === m && styles.methodOn]} accessibilityRole="radio" accessibilityState={{ selected: method === m }}>
                <Text style={[styles.methodText, method === m && styles.methodTextOn]}>{m === "CASH" ? "Efectivo" : "Transferencia"}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input} value={amount} onChangeText={setAmount} editable={!busy} keyboardType="decimal-pad"
            placeholder={method === "TRANSFER" ? "Importe acreditado" : "Importe contado"} placeholderTextColor={AppTheme.text.muted}
            accessibilityLabel={`Recibido ${o.ref}`}
          />
          {showNote ? (
            <>
              <Text style={styles.diff}>Diferencia {pesos(diff as number)}</Text>
              <TextInput
                style={styles.input} value={note} onChangeText={setNote} editable={!busy}
                placeholder="Motivo de la diferencia" placeholderTextColor={AppTheme.text.muted} accessibilityLabel={`Motivo ${o.ref}`}
              />
            </>
          ) : null}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {soloConsulta ? null : (
        <Pressable style={[styles.button, busy && styles.buttonBusy]} onPress={confirm} disabled={busy} accessibilityRole="button">
          {busy ? <ActivityIndicator color={AppTheme.colors.white} /> : <Text style={styles.buttonText}>{action}</Text>}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: AppTheme.spacing.md, gap: 6, borderRadius: AppTheme.radius.lg, borderWidth: 1,
    borderColor: AppTheme.borders.default, backgroundColor: AppTheme.surfaces.card,
  },
  kind: { color: AppTheme.text.accent, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  ref: { color: AppTheme.text.primary, fontSize: 16, fontWeight: "700" },
  detail: { color: AppTheme.text.secondary, fontSize: 13 },
  cash: { gap: 8, marginTop: 4 },
  methods: { flexDirection: "row", gap: 8 },
  method: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 999, borderWidth: 1, borderColor: AppTheme.borders.default },
  methodOn: { borderColor: AppTheme.text.accent, backgroundColor: AppTheme.surfaces.input },
  methodText: { color: AppTheme.text.secondary, fontWeight: "700", fontSize: 13 },
  methodTextOn: { color: AppTheme.text.accent },
  input: {
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: AppTheme.radius.md, borderWidth: 1,
    borderColor: AppTheme.borders.default, backgroundColor: AppTheme.surfaces.input, color: AppTheme.text.primary, fontSize: 16,
  },
  diff: { color: AppTheme.colors.warning, fontSize: 13, fontWeight: "700" },
  error: { color: AppTheme.colors.danger, fontSize: 13 },
  button: { marginTop: 6, paddingVertical: 12, alignItems: "center", borderRadius: AppTheme.radius.md, backgroundColor: AppTheme.colors.primary },
  buttonBusy: { opacity: 0.7 },
  buttonText: { color: AppTheme.colors.white, fontWeight: "800", fontSize: 15 },
});
