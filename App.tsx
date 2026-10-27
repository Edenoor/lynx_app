import React, { useContext, useMemo } from "react";
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme as NavigationTheme } from "@react-navigation/native";

import { MainStackNavigator } from "./src/Presentation/navigator/MainStackNavigator";
import { AppArea, resolveAppArea } from "./src/Presentation/navigator/appArea";

import { UserContext, UserProvider } from "./src/Presentation/context/UserContext";
import { OnboardingProvider } from "./src/Presentation/onboarding/OnboardingContext";
import { AppVersionGate } from "./src/Presentation/components/AppVersionGate";
import { ThemeProvider } from "./src/Presentation/theme/ThemeProvider";
import { DEFAULT_THEME, FixedTheme, PUBLIC_THEME } from "./src/Presentation/theme/FixedTheme";
import { useAppTheme } from "./src/Presentation/theme/ThemeContext";
import type { Theme } from "./src/Presentation/theme/createTheme";

// Fondo de las transiciones y headers nativos con los colores de Lynx: sin
// tema, React Navigation usa su claro por defecto y se ven flashes blancos.
const navigationTheme = (t: Theme): NavigationTheme => {
  const base = t.scheme === "dark" ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: t.colors.primary,
      background: t.colors.background,
      card: t.colors.surface,
      text: t.text.primary,
      border: t.borders.default,
      notification: t.colors.danger,
    },
  };
};

// Tema de cada área. Lo público (login, registro, recuperar) va en Light fijo;
// Seller, Picker y la Web de admin todavía no se personalizan: quedan con el
// oscuro de siempre aunque el dispositivo tenga otra preferencia. Driver sigue
// la preferencia guardada.
const AREA_THEME: Record<AppArea, Theme | null> = {
  auth: PUBLIC_THEME,
  driver: null,
  picker: DEFAULT_THEME,
  seller: DEFAULT_THEME,
  adminWeb: DEFAULT_THEME,
};

function Navigation() {
  const theme = useAppTheme();
  const navTheme = useMemo(() => navigationTheme(theme), [theme]);

  return (
    <NavigationContainer theme={navTheme}>
      <MainStackNavigator />
    </NavigationContainer>
  );
}

function ThemedNavigation() {
  const { user, isAuthLoading } = useContext(UserContext);

  // Mientras se lee la sesión se ve la continuación del splash: lo nativo
  // no se fija todavía, para no alternar de esquema si después entra un chofer.
  return (
    <FixedTheme theme={AREA_THEME[resolveAppArea(user)]} native={!isAuthLoading}>
      <Navigation />
    </FixedTheme>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppVersionGate>
        <UserProvider>
          <OnboardingProvider>
            <ThemedNavigation />
          </OnboardingProvider>
        </UserProvider>
      </AppVersionGate>
    </ThemeProvider>
  );
}
