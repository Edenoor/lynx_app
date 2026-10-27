// src/Presentation/components/BottomNavigationBar.tsx
// Barra inferior de la app (estética de la del chofer: tarjeta flotante con
// el botón central destacado). Solo dibuja: qué pestañas hay y a dónde lleva
// cada una lo decide quien la usa.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme, useThemedStyles } from "../theme/ThemeContext";
import type { Theme } from "../theme/createTheme";

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
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={bottomInset ? [styles.safeArea, { paddingBottom: theme.spacing.md + bottomInset }] : styles.safeArea}>
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
                    color={theme.colors.black}
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
                color={active ? theme.text.accent : theme.text.muted}
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

const makeStyles = (t: Theme) => StyleSheet.create({
  safeArea: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: t.layout.screenPaddingCompact,
    paddingBottom: t.spacing.md,
    zIndex: 40,
  },

  container: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: t.radius.xl,
    backgroundColor: t.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: t.borders.medium,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.sm,
    ...t.shadows.card,
  },

  item: {
    flex: 1,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: t.spacing.xs,
  },

  label: {
    color: t.text.muted,
    fontSize: t.font.size.xs,
    fontWeight: t.font.weight.bold,
  },

  labelActive: {
    color: t.text.primary,
  },

  primaryItem: {
    flex: 1,
    minHeight: 66,
    alignItems: "center",
    justifyContent: "center",
    gap: t.spacing.xs,
    marginTop: -t.spacing.xl,
  },

  primaryButton: {
    width: 58,
    height: 58,
    borderRadius: t.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.primary,
    borderWidth: 1,
    borderColor: t.borders.primary,
    ...t.shadows.glow,
  },

  primaryButtonActive: {
    backgroundColor: t.colors.primarySoft,
  },

  badge: {
    position: "absolute",
    top: 2,
    left: "52%",
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: t.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.status.rejected.solid,
  },

  badgeText: {
    color: t.status.rejected.onSolid,
    fontSize: 10,
    fontWeight: t.font.weight.black,
  },

  primaryLabel: {
    color: t.text.primary,
    fontSize: t.font.size.xs,
    fontWeight: t.font.weight.black,
  },
});

export default BottomNavigationBar;
