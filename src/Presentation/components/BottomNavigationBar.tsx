// src/Presentation/components/BottomNavigationBar.tsx
// Barra inferior de la app (estética de la del chofer: tarjeta flotante con
// el botón central destacado). Solo dibuja: qué pestañas hay y a dónde lleva
// cada una lo decide quien la usa.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppTheme from "../theme/AppTheme";

export type BottomNavigationItem<K extends string> = {
  key: K;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isPrimary?: boolean;
  // Indicador sobre el ícono (por ejemplo, notificaciones sin ver). Solo se
  // dibuja si viene: la barra del chofer no lo usa.
  badge?: string | null;
};

type Props<K extends string> = {
  items: BottomNavigationItem<K>[];
  activeKey: K | null;
  onPress: (key: K) => void;
  // Margen extra sobre el borde inferior (barra de gestos de Android). El
  // chofer usa 0: su barra queda exactamente donde estaba.
  bottomInset?: number;
};

// Alto que una pantalla tiene que reservar abajo para que la barra no tape su
// contenido (el mismo que usan las pantallas del chofer).
export const BOTTOM_NAVIGATION_SPACE = 112;

export function BottomNavigationBar<K extends string>({ items, activeKey, onPress, bottomInset = 0 }: Props<K>) {
  return (
    <View style={bottomInset ? [styles.safeArea, { paddingBottom: AppTheme.spacing.md + bottomInset }] : styles.safeArea}>
      <View style={styles.container}>
        {items.map((tab) => {
          const active = activeKey === tab.key;

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

              {tab.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{tab.badge}</Text>
                </View>
              ) : null}
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

  badge: {
    position: "absolute",
    top: 2,
    left: "52%",
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: AppTheme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.colors.danger,
  },

  badgeText: {
    color: AppTheme.colors.white,
    fontSize: 10,
    fontWeight: AppTheme.font.weight.black,
  },

  primaryLabel: {
    color: AppTheme.text.primary,
    fontSize: AppTheme.font.size.xs,
    fontWeight: AppTheme.font.weight.black,
  },
});

export default BottomNavigationBar;
