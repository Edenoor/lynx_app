// src/Presentation/theme/FixedTheme.tsx
// Tema fijo para una parte de la app, sin tocar la preferencia guardada: lo
// público (login, registro, onboarding) en Light, las áreas que todavía no se
// personalizan y el visor de la cámara en el oscuro de siempre. Debajo, las
// pantallas leen el tema con los mismos hooks y no pueden cambiar la
// apariencia. theme null = sigue la preferencia (el árbol no cambia, así que
// pasar de un área a otra no remonta nada).

import React, { useContext, useEffect, useMemo } from "react";

import { createTheme, Theme } from "./createTheme";
import { NativeSchemeContext, ThemeContext, ThemeContextValue } from "./ThemeContext";

// Pantallas públicas: Light + Classic + Equilibrado, sin depender del teléfono.
export const PUBLIC_THEME = createTheme({ scheme: "light" });
// Oscuro + Classic + Equilibrado: el mismo objeto que el AppTheme estático.
export const DEFAULT_THEME = createTheme({ scheme: "dark" });

const noop = () => {};

export function FixedTheme({
  theme,
  native = false,
  children,
}: React.PropsWithChildren<{ theme: Theme | null; native?: boolean }>) {
  const outer = useContext(ThemeContext);
  const lockNativeScheme = useContext(NativeSchemeContext);

  // native: Alert, teclado y selectores también en el esquema fijo.
  const nativeScheme = native && theme ? theme.scheme : null;
  useEffect(() => {
    if (!nativeScheme) return;
    lockNativeScheme(nativeScheme);
    return () => lockNativeScheme(null);
  }, [nativeScheme, lockNativeScheme]);

  const value = useMemo<ThemeContextValue>(
    () => (theme ? { ...outer, theme, setAppearance: noop, resetAppearance: noop } : outer),
    [theme, outer]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
