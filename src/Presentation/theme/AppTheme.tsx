import {
  BORDER_RADIUS,
  DARK_COLORS,
  FONT,
  LIGHT_COLORS,
  LAYOUT,
  SHADOWS,
  SIZES,
  SPACING,
  type ThemeMode,
} from "./global";

export const MyColors = DARK_COLORS;

export const getAppColors = (mode: ThemeMode = "dark") => {
  return mode === "dark" ? DARK_COLORS : LIGHT_COLORS;
};

export const AppTheme = {
  colors: DARK_COLORS,
  font: FONT,
  spacing: SPACING,
  radius: BORDER_RADIUS,
  layout: LAYOUT,
  sizes: SIZES,
  shadows: SHADOWS,

  surfaces: {
    screen: DARK_COLORS.background,
    screenAlt: DARK_COLORS.backgroundAlt,
    screenDeep: DARK_COLORS.backgroundDeep,

    card: DARK_COLORS.card,
    cardStrong: DARK_COLORS.cardStrong,
    cardElevated: DARK_COLORS.cardElevated,

    footer: DARK_COLORS.footerOverlay,
    input: DARK_COLORS.input,
    muted: DARK_COLORS.mutedBg,
  },

  text: {
    primary: DARK_COLORS.text,
    secondary: DARK_COLORS.textSecondary,
    muted: DARK_COLORS.textMuted,
    inverse: DARK_COLORS.black,
    accent: DARK_COLORS.primary,
  },

  borders: {
    default: DARK_COLORS.border,
    soft: DARK_COLORS.borderSoft,
    muted: DARK_COLORS.borderMuted,
    medium: DARK_COLORS.borderMedium,
    strong: DARK_COLORS.borderStrong,
    light: DARK_COLORS.borderLight,
    white: DARK_COLORS.borderWhite,
    primary: DARK_COLORS.primaryBorder,
  },

  overlays: {
    background: DARK_COLORS.overlay,
    camera: DARK_COLORS.overlayStrong,
    footer: DARK_COLORS.footerOverlay,
    primary: DARK_COLORS.primaryOverlay,
  },

  typography: {
    kicker: {
      color: DARK_COLORS.primary,
      fontSize: FONT.size.xxs,
      fontWeight: FONT.weight.black,
      letterSpacing: FONT.letterSpacing.wide,
    },

    titleLg: {
      color: DARK_COLORS.text,
      fontSize: 34,
      lineHeight: 38,
      fontWeight: FONT.weight.black,
      letterSpacing: FONT.letterSpacing.tight,
    },

    titleMd: {
      color: DARK_COLORS.text,
      fontSize: 28,
      lineHeight: 32,
      fontWeight: FONT.weight.black,
      letterSpacing: -1,
    },

    titleSm: {
      color: DARK_COLORS.text,
      fontSize: 24,
      lineHeight: 29,
      fontWeight: FONT.weight.black,
      letterSpacing: -0.7,
    },

    body: {
      color: DARK_COLORS.textSecondary,
      fontSize: FONT.size.sm,
      lineHeight: FONT.lineHeight.md,
      fontWeight: FONT.weight.medium,
    },

    bodySm: {
      color: DARK_COLORS.textSecondary,
      fontSize: 13,
      lineHeight: FONT.lineHeight.sm,
      fontWeight: FONT.weight.medium,
    },

    label: {
      color: DARK_COLORS.text,
      fontSize: FONT.size.sm,
      fontWeight: FONT.weight.bold,
    },

    button: {
      color: DARK_COLORS.text,
      fontSize: FONT.size.sm,
      fontWeight: FONT.weight.extrabold,
    },

    caption: {
      color: DARK_COLORS.textMuted,
      fontSize: FONT.size.xs,
      fontWeight: FONT.weight.semibold,
    },
  },
};

export default AppTheme;