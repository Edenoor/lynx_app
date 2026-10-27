// src/Presentation/views/driver/routes/DeclaredCountForm.tsx
// Cantidad de paquetes retirados en una parada de colecta. Sin informar se
// abre directo para cargarla; ya informada se muestra y se corrige con
// «Corregir». Guardar y confirmar la corrección lo decide RouteDetailScreen.
// Se monta con key = cantidad guardada: al cambiar, vuelve a su estado inicial.

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import AppTheme from "../../../theme/AppTheme";
import { canDeclare, declarationLabel, parseDeclaredCount } from "./stopDeclaration";

type Props = {
  count: number | null;
  routeStatus: string;
  busy: boolean;
  error: string | null;
  onSubmit: (count: number) => void;
};

export default function DeclaredCountForm({ count, routeStatus, busy, error, onSubmit }: Props) {
  const [editing, setEditing] = useState(count === null);
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);
  const editable = canDeclare(routeStatus);

  const submit = () => {
    const parsed = parseDeclaredCount(text);
    if (!parsed.ok) { setInvalid(parsed.error); return; }
    if (parsed.count === count) { setEditing(false); return; }
    onSubmit(parsed.count);
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Paquetes retirados</Text>
      <Text style={[styles.status, count !== null && styles.statusDone]}>{declarationLabel(count)}</Text>

      {!editable ? (
        <Text style={styles.hint}>
          {routeStatus === "CANCELLED" ? "La colecta está cancelada: no se informa cantidad." : "La vas a poder informar cuando comiences la colecta."}
        </Text>
      ) : editing ? (
        <View style={styles.row}>
          <TextInput value={text} onChangeText={(t) => { setText(t); setInvalid(null); }} onSubmitEditing={submit}
            keyboardType="number-pad" maxLength={6} placeholder="Cantidad" placeholderTextColor={AppTheme.text.muted}
            style={styles.input} editable={!busy} accessibilityLabel="Cantidad de paquetes retirados" />
          <Pressable onPress={submit} disabled={busy} style={[styles.btn, busy && styles.btnDisabled]}>
            <Text style={styles.btnText}>{count === null ? "Informar" : "Guardar"}</Text>
          </Pressable>
          {count !== null ? (
            <Pressable onPress={() => { setEditing(false); setInvalid(null); }} disabled={busy} style={[styles.btn, styles.btnGhost, busy && styles.btnDisabled]}>
              <Text style={styles.btnGhostText}>Cancelar</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Pressable onPress={() => { setText(String(count)); setEditing(true); }} disabled={busy} style={[styles.btn, styles.btnGhost, styles.selfStart, busy && styles.btnDisabled]}>
          <Text style={styles.btnGhostText}>Corregir</Text>
        </Pressable>
      )}

      {invalid || error ? <Text style={styles.warn}>{invalid ?? error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: "100%", gap: 8, padding: AppTheme.spacing.sm, borderRadius: AppTheme.radius.md, borderWidth: 1, borderColor: AppTheme.borders.primary, backgroundColor: AppTheme.overlays.primary },
  title: { color: AppTheme.text.primary, fontWeight: "700", fontSize: 14 },
  status: { color: AppTheme.colors.warning, fontSize: 13, fontWeight: "600" },
  statusDone: { color: AppTheme.text.accent },
  hint: { color: AppTheme.text.secondary, fontSize: 12, lineHeight: 16 },
  warn: { color: AppTheme.colors.warning, fontSize: 13 },
  row: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  input: { flex: 1, minWidth: 100, minHeight: 44, borderRadius: AppTheme.radius.md, borderWidth: 1, borderColor: AppTheme.borders.default, backgroundColor: AppTheme.surfaces.input, color: AppTheme.text.primary, paddingHorizontal: 12 },
  btn: { alignItems: "center", justifyContent: "center", backgroundColor: AppTheme.colors.primary, borderRadius: AppTheme.radius.md, paddingHorizontal: 16, minHeight: 44 },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: AppTheme.borders.default },
  selfStart: { alignSelf: "flex-start" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: AppTheme.text.inverse, fontWeight: "700" },
  btnGhostText: { color: AppTheme.text.primary, fontWeight: "600" },
});
