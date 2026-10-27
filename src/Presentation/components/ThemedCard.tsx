// src/Presentation/components/ThemedCard.tsx
// Contenedor del tema dinámico. "card" para paneles; "row" para ítems de una
// lista: en Minimal la fila deja de ser tarjeta y queda con separador inferior.

import React from "react";
import { View, ViewProps } from "react-native";

import { useAppTheme } from "../theme/ThemeContext";

type Props = ViewProps & { variant?: "card" | "row" };

export function ThemedCard({ variant = "card", style, ...rest }: Props) {
  const theme = useAppTheme();
  return <View {...rest} style={[variant === "row" ? theme.listItem : theme.card, style]} />;
}

export default ThemedCard;
