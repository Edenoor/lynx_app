// src/Presentation/views/driver/Envios/BaulPanel.tsx
// El Baúl del chofer (solo lectura): qué tiene que rendir o devolver en planta.
// Lo resuelve el picker al recibirlo; acá no se marca nada. Cada cosa sale de
// la lista recién cuando el picker la confirma (la pantalla la vuelve a pedir).

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import type { BaulCash, BaulParcel, MyBaul } from "./baulSource";
// Los mismos nombres que ve el picker al recibirlo.
import { CLOSURE_LABEL } from "../../picker/baulPicker";

const money = (v: unknown) => `$${(Number(v) || 0).toLocaleString("es-AR")}`;

// Qué hay que traer: «Cambio: zapatillas»; con cierre OTRO lo que importa es
// lo que se trae («Traer: remito»), no la palabra «Otro».
export const itemDetail = (closure: string, what: string | null) =>
  closure === "OTRO" ? (what ? `Traer: ${what}` : "Traer lo que pidió la tienda")
    : `${CLOSURE_LABEL[closure] ?? closure}${what ? `: ${what}` : ""}`;

export const verifyDetail = (kind: string, note: string | null) =>
  `Pidieron traer${kind === "OTRO" ? (note ? `: ${note}` : " algo") : ` ${(CLOSURE_LABEL[kind] ?? kind).toLowerCase()}${note ? `: ${note}` : ""}`}. No lo declaraste: si lo tenés, entregalo en planta.`;

// Lo esperado (la cobranza del envío) y lo que declaraste, por separado.
const cashDetail = (c: BaulCash) => {
  const how = c.declared_method === "TRANSFER" ? " por transferencia" : c.declared_method === "CASH" ? " en efectivo" : "";
  const declared = c.declared_amount == null
    ? (c.provider_closed ? "sin declarar (la cerró Mercado Libre o LightData)" : "sin declarar")
    : `declaraste ${money(c.declared_amount)}${how}`;
  return `A cobrar ${money(c.expected_amount)} · ${declared}`;
};

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
        <Ionicons name={empty ? "checkmark-circle-outline" : "briefcase-outline"} size={28} color={empty ? theme.status.confirmed.text : theme.text.accent} />
        <Text style={styles.title}>Tu Baúl</Text>
        {empty ? (
          <Text style={styles.muted}>No tenés nada pendiente de rendir ni devolver.</Text>
        ) : (
          <>
            {totals.parcels ? <Text style={styles.line}>Paquetes para devolver: {totals.parcels}</Text> : null}
            {totals.items ? <Text style={styles.line}>Cambios, retiros y remitos: {totals.items}</Text> : null}
            {totals.cash_count ? <Text style={styles.line}>Efectivo por rendir: {money(totals.cash_amount)} ({totals.cash_count})</Text> : null}
            {totals.transfer_count ? <Text style={styles.line}>Transferencias a confirmar: {money(totals.transfer_amount)} ({totals.transfer_count})</Text> : null}
            {totals.declared_amount != null && cash.length ? (
              <Text style={styles.line}>
                Declaraste {money(totals.declared_amount)}{totals.undeclared_count ? ` · ${totals.undeclared_count} sin declarar` : ""}
              </Text>
            ) : null}
            {toVerify.length ? <Text style={styles.line}>A verificar con coordinación: {toVerify.length}</Text> : null}
            <Text style={styles.muted}>Entregalo al picker en planta: cada cosa sale de esta lista cuando él confirma que la recibió.</Text>
          </>
        )}
      </View>

      {parcels.length ? <Section title="Paquetes para devolver" count={parcels.length}>{parcels.map((p) => (
        <Row key={`p${p.delivery_id}`} title={p.tracking || p.lynx_code || `#${p.delivery_id}`} sub={p.store} detail={parcelLabel(p)} />
      ))}</Section> : null}

      {items.length ? <Section title="Cambios, retiros y remitos" count={items.length}>{items.map((i) => (
        <Row key={`i${i.delivery_id}`} title={i.tracking || i.lynx_code || `#${i.delivery_id}`} sub={i.store} detail={itemDetail(i.closure, i.return_item)} />
      ))}</Section> : null}

      {toVerify.length ? <Section title="A verificar con coordinación" count={toVerify.length}>{toVerify.map((v) => (
        <Row key={`v${v.delivery_id}`} title={v.tracking || v.lynx_code || `#${v.delivery_id}`} sub={v.store} detail={verifyDetail(v.reverse_kind, v.reverse_note)} />
      ))}</Section> : null}

      {cash.length ? <Section title="Cobranzas" count={cash.length}>{cash.map((c) => (
        <Row key={`c${c.delivery_id}`} title={c.tracking || c.lynx_code || `#${c.delivery_id}`} sub={c.store} detail={cashDetail(c)} />
      ))}</Section> : null}
    </View>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[theme.card, styles.section]}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCount}>{count}</Text>
      </View>
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
  wrap: { gap: t.spacing.md, paddingTop: t.spacing.sm },
  summary: { alignItems: "center", gap: 6, paddingVertical: t.spacing.lg, paddingHorizontal: t.spacing.md },
  title: { color: t.text.primary, fontSize: 20, fontWeight: t.font.weight.black, marginBottom: 2 },
  line: { color: t.text.primary, fontSize: 14, lineHeight: 20 },
  muted: { color: t.text.secondary, fontSize: 13, lineHeight: 18, textAlign: "center", marginTop: 4 },
  section: { gap: 4, paddingVertical: t.spacing.md, paddingHorizontal: t.spacing.md },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sectionTitle: { flex: 1, color: t.text.primary, fontSize: 15, fontWeight: t.font.weight.black },
  sectionCount: { minWidth: 26, textAlign: "center", color: t.text.secondary, fontSize: 12, fontWeight: t.font.weight.bold, borderRadius: 999, borderWidth: 1, borderColor: t.borders.default, paddingHorizontal: 6, paddingVertical: 1 },
  row: { gap: 3, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.borders.default },
  rowTitle: { color: t.text.primary, fontSize: 14, fontWeight: "600" },
  rowDetail: { color: t.text.secondary, fontSize: 13, lineHeight: 18 },
});
