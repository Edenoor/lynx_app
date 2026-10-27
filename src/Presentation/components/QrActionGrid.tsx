// src/Presentation/components/QrActionGrid.tsx
// Grilla de operaciones de escaneo (tarjetas cuadradas de dos en dos). Cada
// perfil arma sus propias acciones.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme, useThemedStyles } from "../theme/ThemeContext";
import type { Theme } from "../theme/createTheme";

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
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable style={disabled ? [styles.card, styles.cardDisabled] : styles.card} onPress={onPress} disabled={disabled}>
      <View style={styles.iconContainer}>
        <Ionicons
          name={icon}
          size={42}
          color={theme.text.primary}
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
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.grid}>
      {actions.map(({ key, ...action }) => (
        <ActionItem key={key} {...action} />
      ))}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: t.spacing.md,
  },

  card: {
    width: "48%",
    aspectRatio: 1,

    backgroundColor: t.surfaces.cardElevated,

    borderRadius: t.radius.xl,

    borderWidth: 1,
    borderColor: t.borders.medium,

    alignItems: "center",
    justifyContent: "center",

    padding: t.spacing.lg,

    ...t.shadows.card,
  },

  iconContainer: {
    marginBottom: t.spacing.md,
  },

  label: {
    color: t.text.primary,

    fontSize: t.font.size.md,
    fontWeight: t.font.weight.black,

    textAlign: "center",
  },

  badge: {
    color: t.status.rejected.text,
    fontWeight: t.font.weight.black,
  },

  cardDisabled: {
    opacity: 0.5,
  },

  note: {
    marginTop: t.spacing.xs,
    color: t.text.muted,
    fontSize: t.font.size.xs,
    fontWeight: t.font.weight.bold,
    textAlign: "center",
  },
});

export default QrActionGrid;
