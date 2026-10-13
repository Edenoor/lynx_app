// src/Presentation/components/SafeScreen.tsx
// Contenedor de pantalla que respeta las barras del sistema. La app es
// edge-to-edge en Android (edgeToEdgeEnabled): el SafeAreaView de react-native
// solo funciona en iOS y el contenido quedaba debajo de la barra de estado y
// de la de navegación. Este usa react-native-safe-area-context.

import React from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppTheme from "../theme/AppTheme";

export function SafeScreen({ children, style }: React.PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return (
    <SafeAreaView edges={["top", "bottom", "left", "right"]} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppTheme.surfaces.screen },
});
