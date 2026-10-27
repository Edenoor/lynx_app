// src/Presentation/theme/ThemeContext.ts
// Contexto y hooks del tema dinámico, sin nada nativo: lo que importan las
// pantallas. El valor lo pone ThemeProvider; sin provider vale el tema por
// defecto (oscuro, Classic, Equilibrado), igual que el AppTheme estático.

import { createContext, useContext, useMemo } from "react";

import { AppearancePreferences, DEFAULT_APPEARANCE } from "./appearance";
import { createTheme, Theme } from "./createTheme";
import type { ThemeMode } from "./global";

export type AppearancePatch = Partial<Omit<AppearancePreferences, "version">>;

export type ThemeContextValue = {
  theme: Theme;
  preferences: AppearancePreferences;
  setAppearance: (patch: AppearancePatch) => void;
  resetAppearance: () => void;
};

export const ThemeContext = createContext<ThemeContextValue>({
  theme: createTheme({ scheme: "dark" }),
  preferences: DEFAULT_APPEARANCE,
  setAppearance: () => {},
  resetAppearance: () => {},
});

// Fija el esquema de lo nativo (Alert, teclado, selectores) mientras se ve una
// parte de la app con tema fijo; null vuelve a la preferencia. Lo pone
// ThemeProvider y lo usa FixedTheme.
export const NativeSchemeContext = createContext<(scheme: ThemeMode | null) => void>(() => {});

export const useAppTheme = () => useContext(ThemeContext).theme;

export const useAppearance = () => useContext(ThemeContext);

// Para migrar una pantalla: su StyleSheet.create pasa a ser una función del
// tema, definida fuera del componente para que sea estable.
//   const makeStyles = (t: Theme) => StyleSheet.create({ screen: { backgroundColor: t.colors.background } });
//   const styles = useThemedStyles(makeStyles);
export function useThemedStyles<T>(make: (theme: Theme) => T): T {
  const theme = useAppTheme();
  return useMemo(() => make(theme), [theme, make]);
}
