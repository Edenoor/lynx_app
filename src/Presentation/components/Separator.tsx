// src/Presentation/components/Separator.tsx
// Línea fina entre bloques, con el color y grosor del tema.

import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";

import { useAppTheme } from "../theme/ThemeContext";

export function Separator({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useAppTheme();
  return <View style={[{ height: theme.separator.width, backgroundColor: theme.separator.color }, style]} />;
}

export default Separator;
