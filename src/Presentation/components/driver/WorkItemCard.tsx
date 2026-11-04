// src/Presentation/components/driver/WorkItemCard.tsx
// Un recorrido (o un grupo Turbo) en una lista: tipo y número, estado con
// chip y el resumen de paradas. Lo usan Recorridos y Envíos.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme, useThemedStyles } from "../../theme/ThemeContext";
import type { Theme } from "../../theme/createTheme";
import StatusChip from "../StatusChip";
import { STATUS_LABEL, TYPE_LABEL } from "../../views/driver/routes/routesApi";
import { routeStatusKey } from "../../views/driver/routes/routeStatus";
import { groupTitle } from "../../views/driver/turbo/turboGroup";
import type { WorkItem } from "../../views/driver/work/driverWork";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

// `extra`: una línea más (la fecha de un recorrido de otro día).
export function WorkItemCard({ item, onPress, extra }: { item: WorkItem; onPress: () => void; extra?: string | null }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  if (item.kind === "group") {
    const g = item.group;
    const estado = g.status === "IN_PROGRESS" ? "IN_PROGRESS" : g.status === "DONE" ? "COMPLETED" : "ASSIGNED";
    return (
      <Pressable style={[theme.listItem, styles.card]} onPress={onPress}>
        <View style={styles.top}>
          <Text style={styles.type}>Turbo · grupo #{g.id}</Text>
          <StatusChip status={routeStatusKey(estado)} label={STATUS_LABEL[estado]} />
        </View>
        <Text style={styles.meta}>{groupTitle(g)} · un solo retiro por tienda</Text>
        {extra ? <Text style={styles.extra}>{extra}</Text> : null}
      </Pressable>
    );
  }

  const r = item.route;
  return (
    <Pressable style={[theme.listItem, styles.card]} onPress={onPress}>
      <View style={styles.top}>
        <Text style={styles.type}>{TYPE_LABEL[r.type] ?? "Recorrido"} #{r.id}</Text>
        <StatusChip status={routeStatusKey(r.status)} label={STATUS_LABEL[r.status] ?? r.status} />
      </View>
      <Text style={styles.meta}>
        {plural(r.stops_count, "parada", "paradas")} · {plural(r.deliveries_count, "envío", "envíos")}
        {r.type === "DELIVERY" && r.load_expected_count !== null ? ` · carga ${r.load_confirmed_count ?? "–"}/${r.load_expected_count}` : ""}
      </Text>
      {extra ? <Text style={styles.extra}>{extra}</Text> : null}
      {r.type === "DELIVERY" && r.status === "ASSIGNED" ? <Text style={styles.hint}>Escaneá el QR del recorrido y confirmá la cantidad para salir.</Text> : null}
    </Pressable>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  card: { padding: t.spacing.md, marginBottom: t.list.gap, gap: 6 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  type: { color: t.text.primary, fontSize: 16, fontWeight: "700" },
  meta: { color: t.text.secondary, fontSize: 13 },
  extra: { color: t.status.pending.text, fontSize: 12, fontWeight: "700" },
  hint: { color: t.text.accent, fontSize: 12 },
});

export default WorkItemCard;
