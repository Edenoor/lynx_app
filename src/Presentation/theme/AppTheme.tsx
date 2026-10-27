import { DARK_COLORS, LIGHT_COLORS, type ThemeMode } from "./global";
import { createTheme } from "./createTheme";

export const MyColors = DARK_COLORS;

export const getAppColors = (mode: ThemeMode = "dark") => {
  return mode === "dark" ? DARK_COLORS : LIGHT_COLORS;
};

// Tema estático (oscuro) para las pantallas que todavía no leen el dinámico
// (useAppTheme / useThemedStyles en ThemeProvider). Sale de la misma fábrica.
export const AppTheme = createTheme({ scheme: "dark" });

export default AppTheme;
