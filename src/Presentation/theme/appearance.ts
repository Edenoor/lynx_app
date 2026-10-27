// src/Presentation/theme/appearance.ts
// Preferencias de apariencia del dispositivo y cómo se resuelven en un
// esquema de color. Sin React: se prueba con node.

import type { ThemeMode } from "./global";

export type ColorMode = "light" | "dark" | "system";

export type AppearancePreferences = {
  version: 1;
  colorMode: ColorMode;
};

export const APPEARANCE_VERSION = 1;

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  version: APPEARANCE_VERSION,
  colorMode: "dark",
};

const COLOR_MODES: readonly ColorMode[] = ["light", "dark", "system"];

// Lo guardado puede estar roto, venir de otra versión o traer valores que esta
// versión no conoce: cada campo inválido o ausente vuelve a su valor por defecto.
export function normalizeAppearance(raw: unknown): AppearancePreferences {
  const saved = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const colorMode = COLOR_MODES.find((m) => m === saved.colorMode) ?? DEFAULT_APPEARANCE.colorMode;
  return { version: APPEARANCE_VERSION, colorMode };
}

// Si el sistema no informa su esquema (null), se usa el oscuro, el de siempre.
export const resolveScheme = (mode: ColorMode, system: string | null | undefined): ThemeMode =>
  mode === "system" ? (system === "light" ? "light" : "dark") : mode;
