// src/Presentation/components/driver/DriverDeliveryStatCard.tsx

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme, useThemedStyles } from "../../theme/ThemeContext";
import type { StatusTone, Theme } from "../../theme/createTheme";

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
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
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
              color={theme.text.accent}
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
            tone={theme.status.delivered}
          />

          <Metric
            icon="time-outline"
            value={String(pendientes)}
            label="Pendientes"
            tone={theme.status.pending}
          />

          <Metric
            icon="alert-circle-outline"
            value={String(atencion)}
            label="Atención"
            tone={theme.status.rejected}
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
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  tone: StatusTone;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.metric}>
      <View style={[styles.iconCircle, { backgroundColor: tone.background }]}>
        <Ionicons name={icon} size={15} color={tone.icon} />
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

const makeStyles = (t: Theme) => StyleSheet.create({
  card: {
    borderRadius: t.radius.xxl,
    backgroundColor: t.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: t.borders.medium,
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    ...t.shadows.card,
  },

  mainRow: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.md,
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
    backgroundColor: t.borders.soft,
  },

  metricsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.spacing.sm,
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
    borderRadius: t.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.overlays.primary,
  },

  iconCircle: {
    width: 29,
    height: 29,
    borderRadius: t.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },

  netoValue: {
    maxWidth: 88,
    color: t.text.primary,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: t.font.weight.black,
    letterSpacing: -0.7,
  },

  metricValue: {
    color: t.text.primary,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: t.font.weight.black,
    letterSpacing: -0.7,
  },

  metricLabel: {
    color: t.text.secondary,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: t.font.weight.bold,
    textAlign: "center",
  },
});

export default DriverDeliveryStatCard;