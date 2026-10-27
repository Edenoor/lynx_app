// src/Presentation/components/SafeScreen.tsx
// Contenedor de pantalla que respeta las barras del sistema. La app es
// edge-to-edge en Android (edgeToEdgeEnabled): el SafeAreaView de react-native
// solo funciona en iOS y el contenido quedaba debajo de la barra de estado y
// de la de navegación. Este usa react-native-safe-area-context.

import React from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { Edge, SafeAreaView } from "react-native-safe-area-context";

import { useThemedStyles } from "../theme/ThemeContext";
import type { Theme } from "../theme/createTheme";

const ALL_EDGES: Edge[] = ["top", "bottom", "left", "right"];

// `edges` sin "bottom" en pantallas con barra inferior: la barra ya se corre
// sobre la barra de gestos.
export function SafeScreen({
  children,
  style,
  edges = ALL_EDGES,
}: React.PropsWithChildren<{ style?: StyleProp<ViewStyle>; edges?: Edge[] }>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <SafeAreaView edges={edges} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.surfaces.screen },
});
