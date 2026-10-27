// src/Presentation/theme/createTheme.ts
// Arma el tema completo para un esquema de color. Tiene la misma forma que el
// AppTheme estático: una pantalla se migra cambiando de dónde lo lee, no cómo.
// Sin React: se prueba con node.

import {
  BORDER_RADIUS,
  DARK_COLORS,
  FONT,
  LAYOUT,
  LIGHT_COLORS,
  SHADOWS,
  SIZES,
  SPACING,
  type ThemeMode,
} from "./global";

export type ThemeOptions = { scheme: ThemeMode };

function buildTheme({ scheme }: ThemeOptions) {
  const c = scheme === "dark" ? DARK_COLORS : LIGHT_COLORS;

  return {
    scheme,
    colors: c,
    font: FONT,
    spacing: SPACING,
    radius: BORDER_RADIUS,
    layout: LAYOUT,
    sizes: SIZES,
    shadows: SHADOWS,

    surfaces: {
      screen: c.background,
      screenAlt: c.backgroundAlt,
      screenDeep: c.backgroundDeep,

      card: c.card,
      cardStrong: c.cardStrong,
      cardElevated: c.cardElevated,

      footer: c.footerOverlay,
      input: c.input,
      muted: c.mutedBg,
    },

    text: {
      primary: c.text,
      secondary: c.textSecondary,
      muted: c.textMuted,
      inverse: scheme === "dark" ? c.black : c.white,
      accent: c.primary,
    },

    borders: {
      default: c.border,
      soft: c.borderSoft,
      muted: c.borderMuted,
      medium: c.borderMedium,
      strong: c.borderStrong,
      light: c.borderLight,
      white: c.borderWhite,
      primary: c.primaryBorder,
    },

    overlays: {
      background: c.overlay,
      camera: c.overlayStrong,
      footer: c.footerOverlay,
      primary: c.primaryOverlay,
    },

    typography: {
      kicker: {
        color: c.primary,
        fontSize: FONT.size.xxs,
        fontWeight: FONT.weight.black,
        letterSpacing: FONT.letterSpacing.wide,
      },

      titleLg: {
        color: c.text,
        fontSize: 34,
        lineHeight: 38,
        fontWeight: FONT.weight.black,
        letterSpacing: FONT.letterSpacing.tight,
      },

      titleMd: {
        color: c.text,
        fontSize: 28,
        lineHeight: 32,
        fontWeight: FONT.weight.black,
        letterSpacing: -1,
      },

      titleSm: {
        color: c.text,
        fontSize: 24,
        lineHeight: 29,
        fontWeight: FONT.weight.black,
        letterSpacing: -0.7,
      },

      body: {
        color: c.textSecondary,
        fontSize: FONT.size.sm,
        lineHeight: FONT.lineHeight.md,
        fontWeight: FONT.weight.medium,
      },

      bodySm: {
        color: c.textSecondary,
        fontSize: 13,
        lineHeight: FONT.lineHeight.sm,
        fontWeight: FONT.weight.medium,
      },

      label: {
        color: c.text,
        fontSize: FONT.size.sm,
        fontWeight: FONT.weight.bold,
      },

      button: {
        color: c.text,
        fontSize: FONT.size.sm,
        fontWeight: FONT.weight.extrabold,
      },

      caption: {
        color: c.textMuted,
        fontSize: FONT.size.xs,
        fontWeight: FONT.weight.semibold,
      },
    },
  };
}

export type Theme = ReturnType<typeof buildTheme>;

// Un objeto por combinación: el mismo tema conserva su identidad entre renders
// (los estilos memoizados no se recalculan) y el AppTheme estático es el mismo
// objeto que el tema dinámico oscuro.
const cache = new Map<string, Theme>();

export function createTheme(options: ThemeOptions): Theme {
  const key = options.scheme;
  let theme = cache.get(key);
  if (!theme) {
    theme = buildTheme(options);
    cache.set(key, theme);
  }
  return theme;
}
