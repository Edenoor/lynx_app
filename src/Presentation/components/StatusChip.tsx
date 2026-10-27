// src/Presentation/components/StatusChip.tsx
// Estado operativo con color, ícono y texto: no depende solo del color. Los
// colores salen de theme.status (fijos por esquema); el texto lo decide quien
// lo usa, igual que antes.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme } from "../theme/ThemeContext";
import type { StatusKey } from "../theme/createTheme";

const ICONS: Record<StatusKey, keyof typeof Ionicons.glyphMap> = {
  delivered: "checkmark-circle",
  confirmed: "checkmark-circle-outline",
  pending: "time-outline",
  incident: "alert-circle-outline",
  rejected: "close-circle-outline",
  cancelled: "ban-outline",
  inTransit: "navigate-outline",
};

export function StatusChip({ status, label }: { status: StatusKey; label: string }) {
  const tone = useAppTheme().status[status];
  return (
    <View style={[styles.chip, { backgroundColor: tone.background, borderColor: tone.border }]} accessibilityLabel={`Estado: ${label}`}>
      <Ionicons name={ICONS[status]} size={13} color={tone.icon} />
      <Text style={[styles.text, { color: tone.text }]}>{label}</Text>
    </View>
  );
}

// Píldora: su radio no cambia con el preset de bordes.
const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  text: { fontSize: 11, fontWeight: "700" },
});

export default StatusChip;
