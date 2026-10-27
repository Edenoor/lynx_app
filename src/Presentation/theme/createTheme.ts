// src/Presentation/theme/createTheme.ts
// Arma el tema completo para una combinación de esquema (claro/oscuro), estilo
// (Classic/Minimal/Marble) y redondeo. Tiene la misma forma que el AppTheme
// estático: una pantalla se migra cambiando de dónde lo lee, no cómo. Las
// diferencias entre estilos se resuelven acá, no en las pantallas.
// Sin React: se prueba con node.

import { StyleSheet } from "react-native";

import {
  BORDER_RADIUS,
  DARK_COLORS,
  FONT,
  LAYOUT,
  LIGHT_COLORS,
  MARBLE_DARK_COLORS,
  MARBLE_LIGHT_COLORS,
  SHADOWS,
  SIZES,
  SPACING,
  type ThemeMode,
} from "./global";
import type { RadiusPreset, VisualStyle } from "./appearance";

export type ThemeOptions = { scheme: ThemeMode; style?: VisualStyle; radius?: RadiusPreset };

// Estados operativos. Sus colores salen de la paleta del esquema: ni el estilo
// ni el usuario los cambian.
export type StatusKey = "delivered" | "pending" | "confirmed" | "incident" | "rejected" | "cancelled" | "inTransit";

const PALETTES = {
  dark: { classic: DARK_COLORS, minimal: DARK_COLORS, marble: MARBLE_DARK_COLORS },
  light: { classic: LIGHT_COLORS, minimal: LIGHT_COLORS, marble: MARBLE_LIGHT_COLORS },
};

// Equilibrado es la escala de siempre. Los demás la escalan: 999 (círculos y
// píldoras) no se toca y nada pasa de 32.
const RADIUS_FACTOR: Record<RadiusPreset, number> = { square: 0.35, balanced: 1, rounded: 1.4 };
const RADIUS_MAX = 32;

export function radiusScale(preset: RadiusPreset) {
  const f = RADIUS_FACTOR[preset];
  const scale = (n: number) => (f === 1 ? n : Math.min(RADIUS_MAX, Math.max(2, Math.round(n * f))));
  return {
    xs: scale(BORDER_RADIUS.xs),
    sm: scale(BORDER_RADIUS.sm),
    md: scale(BORDER_RADIUS.md),
    lg: scale(BORDER_RADIUS.lg),
    xl: scale(BORDER_RADIUS.xl),
    xxl: scale(BORDER_RADIUS.xxl),
    full: BORDER_RADIUS.full,
  };
}

// "#RRGGBB" + opacidad → "rgba(...)".
const withAlpha = (hex: string, alpha: number) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
};

// Blanco o negro, el que más contraste dé sobre un relleno "#RRGGBB".
const luminance = (hex: string) =>
  [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
const readableOn = (hex: string) => (1.05 / (luminance(hex) + 0.05) >= (luminance(hex) + 0.05) / 0.05 ? "#FFFFFF" : "#000000");

const NO_SHADOW = {
  shadowColor: "transparent",
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
};

function buildTheme(scheme: ThemeMode, style: VisualStyle, radiusPreset: RadiusPreset) {
  const c = PALETTES[scheme][style];
  const radius = radiusScale(radiusPreset);
  const minimal = style === "minimal";
  const marble = style === "marble";

  // Marble: sombras difusas y bajas; elevation chica porque las superficies
  // son opacas (en Android la sombra de una superficie translúcida se ve sucia).
  const shadows = minimal
    ? { card: NO_SHADOW, glow: NO_SHADOW, none: NO_SHADOW }
    : marble
      ? {
          card: { shadowColor: "#000", shadowOpacity: scheme === "dark" ? 0.3 : 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
          glow: { shadowColor: c.primary, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
          none: NO_SHADOW,
        }
      : { ...SHADOWS, none: NO_SHADOW };

  // Minimal: las cards se funden con el fondo y no tienen contorno. Las
  // superficies que flotan sobre contenido (barra inferior, hojas) siguen opacas.
  const surfaces = {
    screen: c.background,
    screenAlt: c.backgroundAlt,
    screenDeep: c.backgroundDeep,

    card: minimal ? c.mutedBg : c.card,
    cardStrong: minimal ? c.mutedBg : c.cardStrong,
    cardElevated: minimal ? c.surface : c.cardElevated,

    footer: c.footerOverlay,
    input: c.input,
    muted: c.mutedBg,
  };

  const borders = {
    default: c.border,
    soft: c.borderSoft,
    muted: c.borderMuted,
    medium: minimal ? "transparent" : c.borderMedium,
    strong: c.borderStrong,
    light: c.borderLight,
    white: c.borderWhite,
    primary: minimal ? "transparent" : c.primaryBorder,
  };

  const separator = { color: minimal ? c.border : c.borderSoft, width: StyleSheet.hairlineWidth };

  // Contenedor genérico (paneles) y fila de lista. En Minimal la fila no es
  // tarjeta: es una franja con separador inferior.
  const cardBorderWidth = minimal ? 0 : 1;
  const cardBorderColor = marble ? c.borderSoft : c.border;
  const card = {
    backgroundColor: surfaces.card,
    borderRadius: radius.lg,
    borderWidth: cardBorderWidth,
    borderColor: cardBorderColor,
    borderBottomWidth: cardBorderWidth,
    borderBottomColor: cardBorderColor,
    ...(marble ? shadows.card : NO_SHADOW),
  };

  const listItem = minimal
    ? {
        backgroundColor: "transparent",
        borderRadius: 0,
        borderWidth: 0,
        borderColor: "transparent",
        borderBottomWidth: separator.width,
        borderBottomColor: separator.color,
        ...NO_SHADOW,
      }
    : card;

  // text/icon: el color sobre superficies; solid: relleno (botones, contadores).
  const tone = (fg: string, solid: string) => ({
    text: fg,
    icon: fg,
    background: withAlpha(fg, 0.12),
    border: withAlpha(fg, 0.42),
    solid,
    onSolid: readableOn(solid),
  });
  const success = tone(c.successText, c.success);
  const warning = tone(c.warning, c.warning);
  // Relleno rojo profundo de marca: el rojo de texto es claro para fondos oscuros.
  const danger = tone(c.danger, c.red);
  const info = tone(c.accent, c.primary);
  const status: Record<StatusKey, ReturnType<typeof tone>> = {
    delivered: success,
    confirmed: success,
    pending: warning,
    incident: warning,
    rejected: danger,
    cancelled: danger,
    inTransit: info,
  };

  // Marble: títulos un poco menos pesados y menos apretados.
  const titleWeight = marble ? FONT.weight.extrabold : FONT.weight.black;
  const tighten = (n: number) => (marble ? n * 0.6 : n);

  return {
    scheme,
    style,
    radiusPreset,
    colors: c,
    font: FONT,
    spacing: SPACING,
    radius,
    layout: LAYOUT,
    sizes: SIZES,
    shadows,
    surfaces,

    text: {
      primary: c.text,
      secondary: c.textSecondary,
      muted: c.textMuted,
      inverse: scheme === "dark" ? c.black : c.white,
      accent: c.accent,
      onPrimary: c.white,
    },

    borders,

    overlays: {
      background: c.overlay,
      camera: c.overlayStrong,
      footer: c.footerOverlay,
      primary: c.primaryOverlay,
      // Velo sobre el mapa del inicio: oscurece en oscuro, aclara en claro.
      map: scheme === "dark" ? c.overlayStrong : withAlpha(c.background, 0.82),
    },

    card,
    listItem,
    list: { gap: minimal ? 0 : 10 },
    separator,
    status,
    // Imagen de fondo de las pantallas de colectas: solo en Classic.
    backdrop: { imageOpacity: style === "classic" ? 0.18 : 0 },

    typography: {
      kicker: {
        color: c.accent,
        fontSize: FONT.size.xxs,
        fontWeight: FONT.weight.black,
        letterSpacing: FONT.letterSpacing.wide,
      },

      titleLg: {
        color: c.text,
        fontSize: 34,
        lineHeight: 38,
        fontWeight: titleWeight,
        letterSpacing: tighten(FONT.letterSpacing.tight),
      },

      titleMd: {
        color: c.text,
        fontSize: 28,
        lineHeight: 32,
        fontWeight: titleWeight,
        letterSpacing: tighten(-1),
      },

      titleSm: {
        color: c.text,
        fontSize: 24,
        lineHeight: 29,
        fontWeight: titleWeight,
        letterSpacing: tighten(-0.7),
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
export type StatusTone = Theme["status"][StatusKey];

// Un objeto por combinación: el mismo tema conserva su identidad entre renders
// (los estilos memoizados no se recalculan) y el AppTheme estático es el mismo
// objeto que el tema dinámico oscuro Classic Equilibrado.
const cache = new Map<string, Theme>();

export function createTheme({ scheme, style = "classic", radius = "balanced" }: ThemeOptions): Theme {
  const key = `${scheme}.${style}.${radius}`;
  let theme = cache.get(key);
  if (!theme) {
    theme = buildTheme(scheme, style, radius);
    cache.set(key, theme);
  }
  return theme;
}
