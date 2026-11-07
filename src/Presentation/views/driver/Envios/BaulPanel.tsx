// src/Presentation/views/driver/Envios/BaulPanel.tsx
// El Baúl del chofer (solo lectura): qué tiene que rendir o devolver en planta.
// Lo resuelve el picker al recibirlo; acá no se marca nada.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import type { BaulParcel, MyBaul } from "./baulSource";

const money = (v: unknown) => `$${(Number(v) || 0).toLocaleString("es-AR")}`;
const CLOSURE_LABEL: Record<string, string> = { CAMBIO: "Cambio", RECUPERO: "Recupero", VA_Y_VUELVE: "Va y vuelve", OTRO: "Otro" };

const parcelLabel = (p: BaulParcel) =>
  p.kind === "CANCELLED" ? "Cancelado: devolvelo en planta, no se vuelve a entregar"
    : p.attempted ? "No entregado" : "Sin entregar (quedó con vos, sin intento)";

export default function BaulPanel({ baul }: { baul: MyBaul }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { totals, cash, parcels, items, toVerify } = baul;
  const empty = !cash.length && !parcels.length && !items.length && !toVerify.length;

  return (
    <View style={styles.wrap}>
      <View style={[theme.card, styles.summary]}>
        <Ionicons name="briefcase-outline" size={28} color={theme.text.accent} />
        <Text style={styles.title}>Tu Baúl</Text>
        {empty ? (
          <Text style={styles.muted}>No tenés nada pendiente de rendir ni devolver.</Text>
        ) : (
          <>
            <Text style={styles.line}>Efectivo por rendir: {money(totals.cash_amount)} ({totals.cash_count})</Text>
            {totals.transfer_count ? <Text style={styles.line}>Transferencias a confirmar: {money(totals.transfer_amount)} ({totals.transfer_count})</Text> : null}
            <Text style={styles.line}>Paquetes para devolver: {totals.parcels}</Text>
            <Text style={styles.line}>Cambios y retiros: {totals.items}</Text>
            <Text style={styles.muted}>Lo recibe el picker en planta.</Text>
          </>
        )}
      </View>

      {cash.length ? <Section title="Cobranzas">{cash.map((c) => (
        <Row key={`c${c.delivery_id}`} title={c.tracking || c.lynx_code || `#${c.delivery_id}`} sub={c.store}
          detail={`${money(c.declared_amount ?? c.expected_amount)}${c.declared_method === "TRANSFER" ? " · transferencia" : " · efectivo"}`} />
      ))}</Section> : null}

      {parcels.length ? <Section title="Paquetes">{parcels.map((p) => (
        <Row key={`p${p.delivery_id}`} title={p.tracking || p.lynx_code || `#${p.delivery_id}`} sub={p.store} detail={parcelLabel(p)} />
      ))}</Section> : null}

      {items.length ? <Section title="Cambios y retiros">{items.map((i) => (
        <Row key={`i${i.delivery_id}`} title={i.tracking || i.lynx_code || `#${i.delivery_id}`} sub={i.store}
          detail={`${CLOSURE_LABEL[i.closure] ?? i.closure}${i.return_item ? `: ${i.return_item}` : ""}`} />
      ))}</Section> : null}

      {toVerify.length ? <Section title="A verificar con coordinación">{toVerify.map((v) => (
        <Row key={`v${v.delivery_id}`} title={v.tracking || v.lynx_code || `#${v.delivery_id}`} sub={v.store}
          detail={`Pidieron traer ${CLOSURE_LABEL[v.reverse_kind] ?? v.reverse_kind}${v.reverse_note ? `: ${v.reverse_note}` : ""} y no lo declaraste. Si lo tenés, entregalo en planta.`} />
      ))}</Section> : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[theme.card, styles.section]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ title, sub, detail }: { title: string; sub: string | null; detail: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row} accessibilityLabel={`${title}: ${detail}`}>
      <Text style={styles.rowTitle}>{title}{sub ? ` · ${sub}` : ""}</Text>
      <Text style={styles.rowDetail}>{detail}</Text>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  wrap: { gap: 12 },
  summary: { alignItems: "center", gap: 6 },
  title: { color: t.text.primary, fontSize: 20, fontWeight: t.font.weight.black },
  line: { color: t.text.primary, fontSize: 14 },
  muted: { color: t.text.secondary, fontSize: 13, textAlign: "center" },
  section: { gap: 8 },
  sectionTitle: { color: t.text.primary, fontSize: 15, fontWeight: t.font.weight.black },
  row: { gap: 2, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.borders.default },
  rowTitle: { color: t.text.primary, fontSize: 14, fontWeight: "600" },
  rowDetail: { color: t.text.secondary, fontSize: 13 },
});
