// src/Presentation/components/driver/MissionCard.tsx
// Misión activa en Inicio: un recorrido que está en la calle, con lo que sigue
// (la dirección antes que el destinatario), cuánto falta y el acceso directo.
// Compacta: Inicio tiene que mostrar la misión, Turbo y la barra sin scroll.
// `compact` es la versión de una línea para cuando hay más de un recorrido en curso.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme, useThemedStyles } from "../../theme/ThemeContext";
import type { Theme } from "../../theme/createTheme";
import type { Mission } from "../../views/driver/work/driverWork";

type Props = { mission: Mission; onPress: () => void; compact?: boolean };

export function MissionCard({ mission, onPress, compact = false }: Props) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const p = mission.progress;
  const ratio = p && p.total ? Math.min(1, p.done / p.total) : 0;

  if (compact) {
    return (
      <Pressable style={[theme.listItem, styles.compact]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Continuar ${mission.title}`}>
        <Ionicons name="navigate-outline" size={18} color={theme.status.inTransit.icon} />
        <View style={styles.flex}>
          <Text style={styles.compactTitle} numberOfLines={1}>{mission.title}</Text>
          <Text style={styles.meta} numberOfLines={1}>{[p?.label, mission.since].filter(Boolean).join(" · ") || mission.nextAction}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
      </Pressable>
    );
  }

  return (
    <View style={[theme.card, styles.card]}>
      <View style={styles.top}>
        <View style={styles.live}>
          <Ionicons name="navigate" size={12} color={theme.status.inTransit.icon} />
          <Text style={styles.liveText}>EN CURSO</Text>
        </View>
        <Text style={styles.title} numberOfLines={1}>{mission.title}</Text>
        {mission.since ? <Text style={styles.since}>{mission.since}</Text> : null}
      </View>
      <View style={styles.nextRow}>
        <Ionicons name="location-outline" size={16} color={theme.text.accent} />
        <Text style={styles.next} numberOfLines={2}>{mission.nextAction}</Text>
      </View>
      {p ? (
        <View style={styles.progressRow} accessibilityLabel={`Progreso: ${p.label}`}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
          </View>
          <Text style={styles.meta}>{p.label}</Text>
        </View>
      ) : null}
      <Pressable style={styles.button} onPress={onPress} accessibilityRole="button">
        <Text style={styles.buttonText}>Continuar recorrido</Text>
        <Ionicons name="arrow-forward" size={18} color={theme.text.onPrimary} />
      </Pressable>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  flex: { flex: 1 },
  card: { padding: t.spacing.md, gap: 8, borderWidth: 1, borderColor: t.status.inTransit.border },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  live: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: t.status.inTransit.border, backgroundColor: t.status.inTransit.background },
  liveText: { color: t.status.inTransit.text, fontSize: 10, fontWeight: "800" },
  title: { flex: 1, color: t.text.primary, fontSize: 16, fontWeight: "800" },
  since: { color: t.status.pending.text, fontSize: 12, fontWeight: "700" },
  nextRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  next: { flex: 1, color: t.text.primary, fontSize: 15, fontWeight: "600", lineHeight: 20 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  track: { flex: 1, height: 6, borderRadius: 999, backgroundColor: t.surfaces.muted, overflow: "hidden" },
  fill: { height: 6, borderRadius: 999, backgroundColor: t.status.inTransit.solid },
  meta: { color: t.text.secondary, fontSize: 13 },
  button: { minHeight: 44, borderRadius: t.radius.md, backgroundColor: t.colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { color: t.text.onPrimary, fontSize: 15, fontWeight: "800" },
  compact: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: t.spacing.md, paddingVertical: 10, marginTop: t.list.gap },
  compactTitle: { color: t.text.primary, fontSize: 15, fontWeight: "700" },
});

export default MissionCard;
