import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppTheme from "../theme/AppTheme";

export type DriverTabKey =
  | "home"
  | "deliveries"
  | "scan"
  | "activity"
  | "profile";

type DriverBottomNavigationProps = {
  activeTab: DriverTabKey;
  onPress: (tab: DriverTabKey) => void;
};

const tabs: Array<{
  key: DriverTabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isPrimary?: boolean;
}> = [
  {
    key: "home",
    label: "Inicio",
    icon: "home-outline",
  },
  {
    key: "deliveries",
    label: "Envíos",
    icon: "cube-outline",
  },
  {
    key: "scan",
    label: "QR",
    icon: "qr-code-outline",
    isPrimary: true,
  },
  {
    key: "activity",
    label: "Alertas",
    icon: "notifications-outline",
  },
  {
    key: "profile",
    label: "Perfil",
    icon: "person-outline",
  },
];

export function DriverBottomNavigation({
  activeTab,
  onPress,
}: DriverBottomNavigationProps) {
  return (
    <View style={styles.safeArea}>
      <View style={styles.container}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;

          if (tab.isPrimary) {
            return (
              <Pressable
                key={tab.key}
                style={styles.primaryItem}
                onPress={() => onPress(tab.key)}
              >
                <View
                  style={[
                    styles.primaryButton,
                    active && styles.primaryButtonActive,
                  ]}
                >
                  <Ionicons
                    name={tab.icon}
                    size={28}
                    color={AppTheme.colors.black}
                  />
                </View>

                <Text style={[styles.primaryLabel, active && styles.labelActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={tab.key}
              style={styles.item}
              onPress={() => onPress(tab.key)}
            >
              <Ionicons
                name={tab.icon}
                size={22}
                color={active ? AppTheme.text.accent : AppTheme.text.muted}
              />

              <Text style={[styles.label, active && styles.labelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: AppTheme.layout.screenPaddingCompact,
    paddingBottom: AppTheme.spacing.md,
    zIndex: 40,
  },

  container: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: AppTheme.radius.xl,
    backgroundColor: AppTheme.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    paddingHorizontal: AppTheme.spacing.sm,
    paddingVertical: AppTheme.spacing.sm,
    ...AppTheme.shadows.card,
  },

  item: {
    flex: 1,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: AppTheme.spacing.xs,
  },

  label: {
    color: AppTheme.text.muted,
    fontSize: AppTheme.font.size.xs,
    fontWeight: AppTheme.font.weight.bold,
  },

  labelActive: {
    color: AppTheme.text.primary,
  },

  primaryItem: {
    flex: 1,
    minHeight: 66,
    alignItems: "center",
    justifyContent: "center",
    gap: AppTheme.spacing.xs,
    marginTop: -AppTheme.spacing.xl,
  },

  primaryButton: {
    width: 58,
    height: 58,
    borderRadius: AppTheme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.text.accent,
    borderWidth: 1,
    borderColor: AppTheme.borders.primary,
    ...AppTheme.shadows.glow,
  },

  primaryButtonActive: {
    backgroundColor: AppTheme.colors.primarySoft,
  },

  primaryLabel: {
    color: AppTheme.text.primary,
    fontSize: AppTheme.font.size.xs,
    fontWeight: AppTheme.font.weight.black,
  },
});

export default DriverBottomNavigation;