import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppTheme from "../theme/AppTheme";

type DriverActionCardProps = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  badge?: string;
  rightText?: string;
  primary?: boolean;
  disabled?: boolean;
  loading?: boolean;
  showChevron?: boolean;
  onPress: () => void;
};

export function DriverActionCard({
  title,
  subtitle,
  icon = "arrow-forward-outline",
  badge,
  rightText,
  primary = false,
  disabled = false,
  loading = false,
  showChevron = true,
  onPress,
}: DriverActionCardProps) {
  return (
    <Pressable
      style={[
        styles.card,
        primary && styles.cardPrimary,
        disabled && styles.cardDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      <View style={[styles.iconWrap, primary && styles.iconWrapPrimary]}>
        <Ionicons
          name={icon}
          size={24}
          color={primary ? AppTheme.text.accent : AppTheme.text.primary}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>

          {!!badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>

        {!!subtitle && (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>

      <View style={styles.rightSection}>
        {!!rightText && (
          <Text style={styles.rightText} numberOfLines={1}>
            {rightText}
          </Text>
        )}

        {loading ? (
          <ActivityIndicator size="small" color={AppTheme.text.accent} />
        ) : (
          showChevron && (
            <Ionicons
              name="chevron-forward-outline"
              size={24}
              color={AppTheme.text.muted}
            />
          )
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: AppTheme.radius.xl,
    backgroundColor: AppTheme.surfaces.cardStrong,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    paddingHorizontal: AppTheme.spacing.lg,
    paddingVertical: AppTheme.spacing.md,
    gap: AppTheme.spacing.md,
  },

  cardPrimary: {
    backgroundColor: AppTheme.surfaces.cardElevated,
    borderColor: AppTheme.borders.primary,
  },

  cardDisabled: {
    opacity: 0.45,
  },

  iconWrap: {
    width: AppTheme.sizes.iconLg,
    height: AppTheme.sizes.iconLg,
    borderRadius: AppTheme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.surfaces.muted,
    borderWidth: 1,
    borderColor: AppTheme.borders.soft,
  },

  iconWrapPrimary: {
    backgroundColor: AppTheme.overlays.primary,
    borderColor: AppTheme.borders.primary,
  },

  content: {
    flex: 1,
    gap: AppTheme.spacing.xs,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.sm,
  },

  title: {
    flexShrink: 1,
    color: AppTheme.text.primary,
    fontSize: AppTheme.font.size.md,
    fontWeight: AppTheme.font.weight.black,
  },

  subtitle: {
    color: AppTheme.text.secondary,
    fontSize: AppTheme.font.size.xs,
    fontWeight: AppTheme.font.weight.medium,
  },

  badge: {
    paddingHorizontal: AppTheme.spacing.sm,
    paddingVertical: 2,
    borderRadius: AppTheme.radius.full,
    backgroundColor: AppTheme.overlays.primary,
    borderWidth: 1,
    borderColor: AppTheme.borders.primary,
  },

  badgeText: {
    color: AppTheme.text.accent,
    fontSize: 10,
    fontWeight: AppTheme.font.weight.black,
    textTransform: "uppercase",
  },

  rightSection: {
    minWidth: 32,
    alignItems: "flex-end",
    justifyContent: "center",
    gap: AppTheme.spacing.xs,
  },

  rightText: {
    color: AppTheme.text.accent,
    fontSize: AppTheme.font.size.sm,
    fontWeight: AppTheme.font.weight.black,
  },
});