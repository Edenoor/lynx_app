// src/Presentation/components/QrActionGrid.tsx
// Grilla de operaciones de escaneo (tarjetas cuadradas de dos en dos). Cada
// perfil arma sus propias acciones.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppTheme from "../theme/AppTheme";

export type QrAction = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: number;
  // Aclaración bajo el nombre (por ejemplo "Próximamente" o "Maqueta").
  note?: string;
  // Atenuada y sin acción: la operación todavía no existe.
  disabled?: boolean;
  onPress: () => void;
};

function ActionItem({ icon, label, badge, note, disabled, onPress }: Omit<QrAction, "key">) {
  return (
    <Pressable style={disabled ? [styles.card, styles.cardDisabled] : styles.card} onPress={onPress} disabled={disabled}>
      <View style={styles.iconContainer}>
        <Ionicons
          name={icon}
          size={42}
          color={AppTheme.text.primary}
        />
      </View>

      <Text style={styles.label}>
        {label}

        {typeof badge === "number" && badge > 0 && (
          <Text style={styles.badge}> ({badge})</Text>
        )}
      </Text>

      {note ? <Text style={styles.note}>{note}</Text> : null}
    </Pressable>
  );
}

export function QrActionGrid({ actions }: { actions: QrAction[] }) {
  return (
    <View style={styles.grid}>
      {actions.map(({ key, ...action }) => (
        <ActionItem key={key} {...action} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: AppTheme.spacing.md,
  },

  card: {
    width: "48%",
    aspectRatio: 1,

    backgroundColor: AppTheme.surfaces.cardElevated,

    borderRadius: AppTheme.radius.xl,

    borderWidth: 1,
    borderColor: AppTheme.borders.medium,

    alignItems: "center",
    justifyContent: "center",

    padding: AppTheme.spacing.lg,

    ...AppTheme.shadows.card,
  },

  iconContainer: {
    marginBottom: AppTheme.spacing.md,
  },

  label: {
    color: AppTheme.text.primary,

    fontSize: AppTheme.font.size.md,
    fontWeight: AppTheme.font.weight.black,

    textAlign: "center",
  },

  badge: {
    color: AppTheme.colors.danger,
    fontWeight: AppTheme.font.weight.black,
  },

  cardDisabled: {
    opacity: 0.5,
  },

  note: {
    marginTop: AppTheme.spacing.xs,
    color: AppTheme.text.muted,
    fontSize: AppTheme.font.size.xs,
    fontWeight: AppTheme.font.weight.bold,
    textAlign: "center",
  },
});

export default QrActionGrid;
