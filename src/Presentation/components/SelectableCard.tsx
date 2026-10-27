import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemedStyles } from "../theme/ThemeContext";
import type { Theme } from "../theme/createTheme";

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
  const styles = useThemedStyles(makeStyles);
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

const makeStyles = (t: Theme) => StyleSheet.create({
  card: {
    minHeight: 44,
    borderRadius: t.radius.md,
    paddingHorizontal: t.spacing.md,
    paddingVertical: 8,
    backgroundColor: t.surfaces.card,
    borderWidth: 1,
    borderColor: t.borders.default,
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.sm,
  },
  cardSelected: {
    backgroundColor: t.status.inTransit.background,
    borderColor: t.status.inTransit.border,
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
    color: t.text.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  titleSelected: {
    color: t.text.primary,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: t.borders.strong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: t.text.accent,
    backgroundColor: t.status.inTransit.background,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: t.text.accent,
  },
});