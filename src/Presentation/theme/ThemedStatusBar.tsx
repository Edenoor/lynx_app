// src/Presentation/theme/ThemedStatusBar.tsx
// Barra de estado de una pantalla migrada: sigue al esquema del tema mientras
// la pantalla está enfocada. Al salir hacia una pantalla legacy vuelve la
// global de ThemeProvider (iconos claros, para fondos oscuros).

import React from "react";
import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";

import { useAppTheme } from "./ThemeContext";

export function ThemedStatusBar() {
  const focused = useIsFocused();
  const theme = useAppTheme();
  return focused ? <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} /> : null;
}
