// src/Presentation/theme/appearance.ts
// Preferencias de apariencia del dispositivo y cómo se resuelven en un
// esquema de color. Sin React: se prueba con node.

import type { ThemeMode } from "./global";

export type ColorMode = "light" | "dark" | "system";
export type VisualStyle = "classic" | "minimal" | "marble";
export type RadiusPreset = "square" | "balanced" | "rounded";

export const COLOR_MODES: readonly ColorMode[] = ["light", "dark", "system"];
export const VISUAL_STYLES: readonly VisualStyle[] = ["classic", "minimal", "marble"];
export const RADIUS_PRESETS: readonly RadiusPreset[] = ["square", "balanced", "rounded"];

export type AppearancePreferences = {
  version: 1;
  colorMode: ColorMode;
  style: VisualStyle;
  radius: RadiusPreset;
};

export const APPEARANCE_VERSION = 1;

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  version: APPEARANCE_VERSION,
  colorMode: "dark",
  style: "classic",
  radius: "balanced",
};

const pick = <T extends string>(options: readonly T[], value: unknown, fallback: T): T =>
  options.find((o) => o === value) ?? fallback;

// Lo guardado puede estar roto, venir de otra versión (la Fase 1 solo guardaba
// colorMode) o traer valores que esta versión no conoce: cada campo inválido o
// ausente vuelve a su valor por defecto.
export function normalizeAppearance(raw: unknown): AppearancePreferences {
  const saved = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    version: APPEARANCE_VERSION,
    colorMode: pick(COLOR_MODES, saved.colorMode, DEFAULT_APPEARANCE.colorMode),
    style: pick(VISUAL_STYLES, saved.style, DEFAULT_APPEARANCE.style),
    radius: pick(RADIUS_PRESETS, saved.radius, DEFAULT_APPEARANCE.radius),
  };
}

// Si el sistema no informa su esquema (null), se usa el oscuro, el de siempre.
export const resolveScheme = (mode: ColorMode, system: string | null | undefined): ThemeMode =>
  mode === "system" ? (system === "light" ? "light" : "dark") : mode;
