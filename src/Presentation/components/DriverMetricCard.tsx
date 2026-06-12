import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppTheme from "../theme/AppTheme";

type DriverMetricCardProps = {
  label: string;
  value: string | number;
  helper?: string;
  accent?: boolean;
};

export function DriverMetricCard({
  label,
  value,
  helper,
  accent = false,
}: DriverMetricCardProps) {
  return (
    <View style={[styles.card, accent && styles.cardAccent]}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>

      {!!helper && <Text style={styles.helper}>{helper}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 118,
    borderRadius: AppTheme.radius.xl,
    backgroundColor: AppTheme.surfaces.cardStrong,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    padding: AppTheme.spacing.lg,
    justifyContent: "space-between",
  },

  cardAccent: {
    borderColor: AppTheme.borders.primary,
    backgroundColor: AppTheme.surfaces.cardElevated,
  },

  value: {
    color: AppTheme.text.primary,
    fontSize: AppTheme.font.size.xl,
    lineHeight: AppTheme.font.lineHeight.xl,
    fontWeight: AppTheme.font.weight.black,
    letterSpacing: -1,
  },

  label: {
    color: AppTheme.text.secondary,
    fontSize: AppTheme.font.size.sm,
    fontWeight: AppTheme.font.weight.bold,
  },

  helper: {
    marginTop: AppTheme.spacing.sm,
    color: AppTheme.text.muted,
    fontSize: AppTheme.font.size.xs,
    fontWeight: AppTheme.font.weight.semibold,
  },
});