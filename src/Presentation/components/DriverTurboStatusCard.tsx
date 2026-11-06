// src/Presentation/components/DriverTurboStatusCard.tsx
// Turbo en Inicio, en una fila: disponibilidad (En línea / Fuera de línea),
// cuántos Turbos tiene activos y el interruptor. Sin habilitación del
// coordinador no se ofrece prenderlo; los Turbos que ya tiene se siguen contando.

import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme, useThemedStyles } from "../theme/ThemeContext";
import type { Theme } from "../theme/createTheme";

type DriverTurboStatusCardProps = {
  active: boolean;
  saving?: boolean;
  activeTrips?: number;
  // false = no habilitado por el coordinador; null = no se sabe (se muestra el interruptor).
  enabled?: boolean | null;
  // Tope de Turbos alcanzado (regla del servidor): no le van a ofrecer más en ese turno.
  capNotice?: string | null;
  onToggle: (value: boolean) => void;
};

export function DriverTurboStatusCard({
  active,
  saving = false,
  activeTrips = 0,
  enabled = null,
  capNotice = null,
  onToggle,
}: DriverTurboStatusCardProps) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const notEnabled = enabled === false;
  const statusColor = notEnabled ? theme.text.muted : active ? theme.status.confirmed.text : theme.status.rejected.text;
  const trips = activeTrips ? (activeTrips === 1 ? "1 activo" : `${activeTrips} activos`) : null;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="flash-outline" size={18} color={theme.text.accent} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Turbo</Text>
          <View style={styles.statusLine}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>
              {[notEnabled ? "No habilitado" : active ? "En línea" : "Fuera de línea", trips].filter(Boolean).join(" · ")}
            </Text>
          </View>
        </View>
        {notEnabled ? null : (
          <Switch
            value={active}
            onValueChange={onToggle}
            disabled={saving}
            accessibilityLabel="Disponible para Turbo"
            thumbColor={theme.text.primary}
            trackColor={{ false: theme.borders.medium, true: theme.overlays.primary }}
          />
        )}
      </View>
      {notEnabled && !activeTrips ? <Text style={styles.description}>Para recibir Turbos, pedile la habilitación a tu coordinador.</Text> : null}
      {capNotice ? <Text style={[styles.description, { color: theme.status.pending.text }]}>{capNotice}</Text> : null}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  card: {
    borderRadius: t.radius.xl,
    backgroundColor: t.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: t.borders.medium,
    paddingHorizontal: t.spacing.md,
    paddingVertical: 10,
    gap: 6,
  },
  row: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: t.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.overlays.primary,
    borderWidth: 1,
    borderColor: t.borders.primary,
  },
  textWrap: { flex: 1 },
  title: { color: t.text.primary, fontSize: 15, fontWeight: t.font.weight.black },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: t.radius.full },
  statusText: { fontSize: 12, fontWeight: t.font.weight.black },
  description: { ...t.typography.bodySm },
});

export default DriverTurboStatusCard;
