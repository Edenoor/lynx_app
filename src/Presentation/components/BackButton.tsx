// src/Presentation/components/BackButton.tsx
// El «volver» de los encabezados (Driver y Picker): la misma flecha, el mismo
// tamaño y un área de toque de 44 pt en todas las pantallas (sin hitSlop: no
// pisa a un botón vecino). A dónde vuelve
// lo decide quien lo usa.

import React from "react";
import { Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeContext";

type Props = {
  onPress: () => void;
  // Para lectores de pantalla, si conviene decir a dónde vuelve.
  label?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export const BACK_BUTTON_SIZE = 44;
const ICON_SIZE = 24;

export function BackButton({ onPress, label = "Volver", color, style }: Props) {
  const theme = useAppTheme();
  return (
    <Pressable onPress={onPress} style={[styles.button, style]} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name="arrow-back" size={ICON_SIZE} color={color ?? theme.text.primary} />
    </Pressable>
  );
}

// El margen negativo deja la flecha alineada con el borde del contenido.
const styles = StyleSheet.create({
  button: {
    width: BACK_BUTTON_SIZE,
    height: BACK_BUTTON_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -(BACK_BUTTON_SIZE - ICON_SIZE) / 2,
  },
});

export default BackButton;
