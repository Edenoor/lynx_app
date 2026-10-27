// src/Presentation/theme/ThemeProvider.tsx
// Tema dinámico según la preferencia guardada y el esquema del sistema. Las
// pantallas migradas lo leen con los hooks de ThemeContext; las demás siguen
// con el AppTheme estático (oscuro) hasta que se migren.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Appearance, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";

import { loadAppearance, saveAppearance } from "../../Data/sources/local/AppearanceStorage";
import { AppearancePreferences, DEFAULT_APPEARANCE, normalizeAppearance, resolveScheme } from "./appearance";
import { createTheme } from "./createTheme";
import { AppearancePatch, ThemeContext, ThemeContextValue } from "./ThemeContext";

// El splash queda hasta saber qué apariencia mostrar: si no, un usuario con el
// tema claro vería primero la app oscura.
SplashScreen.preventAutoHideAsync().catch(() => {});

// La lectura arranca al cargar el módulo, en paralelo con el resto del inicio.
const stored = loadAppearance();

// Si el almacenamiento no responde, se arranca con los valores por defecto en
// vez de dejar el splash colgado.
const HYDRATION_TIMEOUT_MS = 1500;

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const [preferences, setPreferences] = useState<AppearancePreferences | null>(null);
  const system = useColorScheme();

  useEffect(() => {
    let done = false;
    const finish = (prefs: AppearancePreferences) => {
      if (done) return;
      done = true;
      setPreferences(prefs);
    };
    stored.then((raw) => finish(normalizeAppearance(raw)));
    const timeout = setTimeout(() => finish(DEFAULT_APPEARANCE), HYDRATION_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, []);

  const colorMode = preferences?.colorMode;

  // Teclado, Alert y selectores nativos siguen el modo elegido; null vuelve a
  // seguir al sistema (y useColorScheme informa el del sistema otra vez).
  useEffect(() => {
    if (colorMode) Appearance.setColorScheme(colorMode === "system" ? null : colorMode);
  }, [colorMode]);

  useEffect(() => {
    if (preferences) SplashScreen.hideAsync().catch(() => {});
  }, [preferences !== null]);

  const prefs = preferences ?? DEFAULT_APPEARANCE;

  // La apariencia cambia en el momento; si no se pudo guardar, al reabrir la
  // app vuelve la anterior.
  const save = useCallback((next: AppearancePreferences) => {
    setPreferences(next);
    saveAppearance(next).catch(() => {});
  }, []);
  const setAppearance = useCallback((patch: AppearancePatch) => save({ ...prefs, ...patch }), [prefs, save]);
  const resetAppearance = useCallback(() => save(DEFAULT_APPEARANCE), [save]);

  const theme = createTheme({ scheme: resolveScheme(prefs.colorMode, system), style: prefs.style, radius: prefs.radius });

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, preferences: prefs, setAppearance, resetAppearance }),
    [theme, prefs, setAppearance, resetAppearance]
  );

  if (!preferences) return null;

  // Iconos claros por defecto: la mayoría de las pantallas todavía son legacy
  // (oscuras). Las migradas ponen la suya con ThemedStatusBar.
  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style="light" />
      {children}
    </ThemeContext.Provider>
  );
}
