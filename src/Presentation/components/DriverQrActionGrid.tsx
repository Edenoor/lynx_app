// src/Presentation/components/DriverQrActionGrid.tsx

import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppTheme from "../theme/AppTheme";

type DriverQrActionGridProps = {
  pendingCount?: number;

  onCollect: () => void;
  onAssign: () => void;
  onPlant: () => void;
  onPending: () => void;
};

type ActionItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: number;
  onPress: () => void;
};

function ActionItem({
  icon,
  label,
  badge,
  onPress,
}: ActionItemProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
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
    </Pressable>
  );
}

export function DriverQrActionGrid({
  pendingCount = 0,
  onCollect,
  onAssign,
  onPlant,
  onPending,
}: DriverQrActionGridProps) {
  return (
    <View style={styles.grid}>
      <ActionItem
        icon="cube-outline"
        label="Colectar"
        onPress={onCollect}
      />

      <ActionItem
        icon="person-add-outline"
        label="Asignar"
        onPress={onAssign}
      />

      <ActionItem
        icon="business-outline"
        label="Planta"
        onPress={onPlant}
      />

      <ActionItem
        icon="car-outline"
        label="Pendientes"
        badge={pendingCount}
        onPress={onPending}
      />
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
});

export default DriverQrActionGrid;