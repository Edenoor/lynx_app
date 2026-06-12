// src/Presentation/components/driver/DriverDeliveryStatCard.tsx

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppTheme from "../../theme/AppTheme";

type Props = {
  neto: string;
  entregados: number;
  pendientes: number;
  atencion: number;
  onPressNeto?: () => void;
};

export function DriverDeliveryStatCard({
  neto,
  entregados,
  pendientes,
  atencion,
  onPressNeto,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.mainRow}>
        <Pressable
          style={styles.mainMetric}
          onPress={onPressNeto}
          disabled={!onPressNeto}
        >
          <View style={styles.iconCirclePrimary}>
            <Ionicons
              name="wallet-outline"
              size={18}
              color={AppTheme.colors.primary}
            />
          </View>

          <Text style={styles.netoValue} numberOfLines={1}>
            {neto}
          </Text>

          <Text style={styles.metricLabel}>Neto</Text>
        </Pressable>

        <View style={styles.divider} />

        <View style={styles.metricsRow}>
          <Metric
            icon="checkmark-circle-outline"
            value={String(entregados)}
            label="Entregados"
            color={AppTheme.colors.success}
          />

          <Metric
            icon="time-outline"
            value={String(pendientes)}
            label="Pendientes"
            color={AppTheme.colors.warning}
          />

          <Metric
            icon="alert-circle-outline"
            value={String(atencion)}
            label="Atención"
            color={AppTheme.colors.danger}
          />
        </View>
      </View>
    </View>
  );
}

function Metric({
  icon,
  value,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.metric}>
      <View style={[styles.iconCircle, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>

      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>

      <Text style={styles.metricLabel} numberOfLines={1}>
        {label}
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
    paddingVertical: AppTheme.spacing.sm,
    paddingHorizontal: AppTheme.spacing.md,
    ...AppTheme.shadows.card,
  },

  mainRow: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.md,
  },

  mainMetric: {
    width: 92,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  divider: {
    width: 1,
    height: 62,
    backgroundColor: AppTheme.borders.soft,
  },

  metricsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: AppTheme.spacing.sm,
  },

  metric: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  iconCirclePrimary: {
    width: 31,
    height: 31,
    borderRadius: AppTheme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.overlays.primary,
  },

  iconCircle: {
    width: 29,
    height: 29,
    borderRadius: AppTheme.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },

  netoValue: {
    maxWidth: 88,
    color: AppTheme.text.primary,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: AppTheme.font.weight.black,
    letterSpacing: -0.7,
  },

  metricValue: {
    color: AppTheme.text.primary,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: AppTheme.font.weight.black,
    letterSpacing: -0.7,
  },

  metricLabel: {
    color: AppTheme.text.secondary,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: AppTheme.font.weight.bold,
    textAlign: "center",
  },
});

export default DriverDeliveryStatCard;