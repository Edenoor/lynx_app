// src/Presentation/components/DriverTurboStatusCard.tsx

import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppTheme from "../theme/AppTheme";

type DriverTurboStatusCardProps = {
  active: boolean;
  saving?: boolean;
  activeTrips?: number;
  nextDeliveryText?: string;
  onToggle: (value: boolean) => void;
};

export function DriverTurboStatusCard({
  active,
  saving = false,
  activeTrips = 0,
  nextDeliveryText,
  onToggle,
}: DriverTurboStatusCardProps) {
  const statusColor = active ? AppTheme.colors.success : AppTheme.colors.danger;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons
            name="flash-outline"
            size={24}
            color={AppTheme.text.accent}
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
          thumbColor={AppTheme.text.primary}
          trackColor={{
            false: AppTheme.borders.medium,
            true: AppTheme.overlays.primary,
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: AppTheme.radius.xxl,
    backgroundColor: AppTheme.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    padding: AppTheme.spacing.lg,
    gap: AppTheme.spacing.md,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.md,
  },

  iconWrap: {
    width: AppTheme.sizes.iconLg,
    height: AppTheme.sizes.iconLg,
    borderRadius: AppTheme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.overlays.primary,
    borderWidth: 1,
    borderColor: AppTheme.borders.primary,
  },

  textWrap: {
    flex: 1,
  },

  kicker: {
    ...AppTheme.typography.kicker,
  },

  title: {
    color: AppTheme.text.primary,
    fontSize: AppTheme.font.size.md,
    fontWeight: AppTheme.font.weight.black,
    marginTop: AppTheme.spacing.xxs,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: AppTheme.spacing.md,
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.xs,
    paddingHorizontal: AppTheme.spacing.md,
    paddingVertical: AppTheme.spacing.sm,
    borderRadius: AppTheme.radius.full,
    backgroundColor: AppTheme.surfaces.cardStrong,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
  },

  statusDot: {
    width: AppTheme.spacing.sm,
    height: AppTheme.spacing.sm,
    borderRadius: AppTheme.radius.full,
  },

  statusText: {
    fontSize: AppTheme.font.size.xs,
    fontWeight: AppTheme.font.weight.black,
    textTransform: "uppercase",
  },

  tripText: {
    color: AppTheme.text.secondary,
    fontSize: AppTheme.font.size.xs,
    fontWeight: AppTheme.font.weight.bold,
  },

  description: {
    ...AppTheme.typography.bodySm,
  },
});

export default DriverTurboStatusCard;