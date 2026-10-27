// src/Presentation/theme/ThemeProvider.tsx
// Tema dinámico según la preferencia guardada y el esquema del sistema. Las
// pantallas migradas lo leen con useAppTheme / useThemedStyles; las demás
// siguen con el AppTheme estático (oscuro) hasta que se migren.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";

import { loadAppearance, saveAppearance } from "../../Data/sources/local/AppearanceStorage";
import { AppearancePreferences, ColorMode, DEFAULT_APPEARANCE, normalizeAppearance, resolveScheme } from "./appearance";
import { createTheme, Theme } from "./createTheme";

// El splash queda hasta saber qué esquema mostrar: si no, un usuario con el
// tema claro vería primero la app oscura.
SplashScreen.preventAutoHideAsync().catch(() => {});

// La lectura arranca al cargar el módulo, en paralelo con el resto del inicio.
const stored = loadAppearance();

// Si el almacenamiento no responde, se arranca con los valores por defecto en
// vez de dejar el splash colgado.
const HYDRATION_TIMEOUT_MS = 1500;

type Ctx = {
  theme: Theme;
  preferences: AppearancePreferences;
  setColorMode: (mode: ColorMode) => void;
  resetAppearance: () => void;
};

const ThemeContext = createContext<Ctx>({
  theme: createTheme({ scheme: "dark" }),
  preferences: DEFAULT_APPEARANCE,
  setColorMode: () => {},
  resetAppearance: () => {},
});

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

  // La apariencia cambia en el momento; si no se pudo guardar, al reabrir la
  // app vuelve la anterior.
  const update = useCallback((next: AppearancePreferences) => {
    setPreferences(next);
    saveAppearance(next).catch(() => {});
  }, []);

  const prefs = preferences ?? DEFAULT_APPEARANCE;
  const theme = createTheme({ scheme: resolveScheme(prefs.colorMode, system) });

  const value = useMemo<Ctx>(
    () => ({
      theme,
      preferences: prefs,
      setColorMode: (mode) => update({ ...prefs, colorMode: mode }),
      resetAppearance: () => update(DEFAULT_APPEARANCE),
    }),
    [theme, prefs, update]
  );

  if (!preferences) return null;

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />
      {children}
    </ThemeContext.Provider>
  );
}

export const useAppTheme = () => useContext(ThemeContext).theme;

export const useAppearance = () => useContext(ThemeContext);

// Para migrar una pantalla: el objeto de su StyleSheet.create pasa a ser una
// función del tema, definida fuera del componente para que sea estable.
//   const makeStyles = (t: Theme) => ({ screen: { backgroundColor: t.colors.background } });
//   const styles = useThemedStyles(makeStyles);
export function useThemedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  make: (theme: Theme) => T & StyleSheet.NamedStyles<any>
): T {
  const theme = useAppTheme();
  return useMemo(() => StyleSheet.create(make(theme)), [theme, make]);
}
