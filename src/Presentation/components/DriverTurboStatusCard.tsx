// src/Presentation/components/DriverTurboStatusCard.tsx

import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme, useThemedStyles } from "../theme/ThemeContext";
import type { Theme } from "../theme/createTheme";

type DriverTurboStatusCardProps = {
  active: boolean;
  saving?: boolean;
  activeTrips?: number;
  nextDeliveryText?: string;
  // false = no habilitado por el coordinador: el interruptor anda, pero no le van a ofrecer turbos.
  enabled?: boolean | null;
  onToggle: (value: boolean) => void;
};

export function DriverTurboStatusCard({
  active,
  saving = false,
  activeTrips = 0,
  nextDeliveryText,
  enabled = null,
  onToggle,
}: DriverTurboStatusCardProps) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const statusColor = active ? theme.status.confirmed.text : theme.status.rejected.text;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons
            name="flash-outline"
            size={24}
            color={theme.text.accent}
          />
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.kicker}>TURBO</Text>
          <Text style={styles.title}>
            {active ? "Disponible para Turbo" : "Turbo inactivo"}
          </Text>
        </View>

        <Switch
          value={active}
          onValueChange={onToggle}
          disabled={saving}
          thumbColor={theme.text.primary}
          trackColor={{
            false: theme.borders.medium,
            true: theme.overlays.primary,
          }}
        />
      </View>

      <View style={styles.statusRow}>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {active ? "En línea" : "Fuera de línea"}
          </Text>
        </View>

        <Text style={styles.tripText}>
          {activeTrips === 1
            ? "1 viaje activo"
            : `${activeTrips} viajes activos`}
        </Text>
      </View>

      <Text style={styles.description}>
        {nextDeliveryText ||
          "Cuando haya un Turbo disponible, vas a recibir una alerta para aceptarlo."}
      </Text>
      {enabled === false ? (
        <Text style={[styles.description, { color: theme.status.pending.text }]}>
          Todavía no estás habilitado para Turbo: pedíselo a tu coordinador.
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  card: {
    borderRadius: t.radius.xxl,
    backgroundColor: t.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: t.borders.medium,
    padding: t.spacing.lg,
    gap: t.spacing.md,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.md,
  },

  iconWrap: {
    width: t.sizes.iconLg,
    height: t.sizes.iconLg,
    borderRadius: t.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.overlays.primary,
    borderWidth: 1,
    borderColor: t.borders.primary,
  },

  textWrap: {
    flex: 1,
  },

  kicker: {
    ...t.typography.kicker,
  },

  title: {
    color: t.text.primary,
    fontSize: t.font.size.md,
    fontWeight: t.font.weight.black,
    marginTop: t.spacing.xxs,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.spacing.md,
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderRadius: t.radius.full,
    backgroundColor: t.surfaces.cardStrong,
    borderWidth: 1,
    borderColor: t.borders.medium,
  },

  statusDot: {
    width: t.spacing.sm,
    height: t.spacing.sm,
    borderRadius: t.radius.full,
  },

  statusText: {
    fontSize: t.font.size.xs,
    fontWeight: t.font.weight.black,
    textTransform: "uppercase",
  },

  tripText: {
    color: t.text.secondary,
    fontSize: t.font.size.xs,
    fontWeight: t.font.weight.bold,
  },

  description: {
    ...t.typography.bodySm,
  },
});

export default DriverTurboStatusCard;