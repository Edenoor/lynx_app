// src/Presentation/components/driver/ContinueBar.tsx
// Barra «Continuar» sobre la barra de navegación (Envíos, Colectas): vuelve
// al recorrido en curso con un toque. Con varios en curso lleva al primero y
// ofrece verlos todos en Inicio.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme, useThemedStyles } from "../../theme/ThemeContext";
import type { Theme } from "../../theme/createTheme";
import type { Mission } from "../../views/driver/work/driverWork";

// Lo que la barra ocupa: las listas lo suman a su margen de abajo.
export const CONTINUE_BAR_SPACE = 72;

type Props = { missions: Mission[]; onOpen: (m: Mission) => void; onSeeAll: () => void };

export function ContinueBar({ missions, onOpen, onSeeAll }: Props) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const first = missions[0];
  if (!first) return null;
  const more = missions.length - 1;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        <Pressable style={styles.main} onPress={() => onOpen(first)} accessibilityRole="button" accessibilityLabel={`Continuar ${first.title}`}>
          <Ionicons name="navigate" size={18} color={theme.text.onPrimary} />
          <View style={styles.flex}>
            <Text style={styles.title} numberOfLines={1}>Continuar · {first.title}</Text>
            <Text style={styles.sub} numberOfLines={1}>{first.nextAction}</Text>
          </View>
        </Pressable>
        {more > 0 ? (
          <Pressable style={styles.more} onPress={onSeeAll} accessibilityRole="button" accessibilityLabel="Ver todos los recorridos en curso">
            <Text style={styles.moreText}>+{more}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  wrap: { position: "absolute", left: t.spacing.md, right: t.spacing.md, bottom: 100 },
  bar: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 56, borderRadius: t.radius.lg, backgroundColor: t.colors.primary, paddingHorizontal: t.spacing.md, paddingVertical: 8 },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  flex: { flex: 1 },
  title: { color: t.text.onPrimary, fontSize: 14, fontWeight: "800" },
  sub: { color: t.text.onPrimary, fontSize: 12 },
  more: { minWidth: 44, minHeight: 44, borderRadius: 999, borderWidth: 1, borderColor: t.text.onPrimary, alignItems: "center", justifyContent: "center" },
  moreText: { color: t.text.onPrimary, fontSize: 14, fontWeight: "800" },
});

export default ContinueBar;
