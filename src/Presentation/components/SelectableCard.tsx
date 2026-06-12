import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import global from "../theme/global";

type SelectableCardProps = {
  title: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function SelectableCard({
  title,
  selected = false,
  disabled = false,
  onPress,
}: SelectableCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        disabled && styles.cardDisabled,
        pressed && !disabled && styles.cardPressed,
      ]}
    >
      <Text style={[styles.title, selected && styles.titleSelected]}>
        {title}
      </Text>

      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 44,
    borderRadius: global.BORDER_RADIUS.md,
    paddingHorizontal: global.SPACING.md,
    paddingVertical: 8,
    backgroundColor: "rgba(13,22,35,0.62)",
    borderWidth: 1,
    borderColor: "rgba(248,250,252,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: global.SPACING.sm,
  },
  cardSelected: {
    backgroundColor: "rgba(0,184,255,0.14)",
    borderColor: global.COLORS.blue,
  },
  cardDisabled: {
    opacity: 0.42,
  },
  cardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  title: {
    flex: 1,
    color: global.COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },
  titleSelected: {
    color: "#F8FAFC",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(248,250,252,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: global.COLORS.blue,
    backgroundColor: "rgba(0,184,255,0.16)",
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: global.COLORS.blue,
  },
});