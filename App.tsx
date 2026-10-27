import React, { useMemo } from "react";
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme as NavigationTheme } from "@react-navigation/native";

import { MainStackNavigator } from "./src/Presentation/navigator/MainStackNavigator";

import { UserProvider } from "./src/Presentation/context/UserContext";
import { OnboardingProvider } from "./src/Presentation/onboarding/OnboardingContext";
import { AppVersionGate } from "./src/Presentation/components/AppVersionGate";
import { ThemeProvider } from "./src/Presentation/theme/ThemeProvider";
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

function ThemedNavigation() {
  const theme = useAppTheme();
  const navTheme = useMemo(() => navigationTheme(theme), [theme]);

  return (
    <NavigationContainer theme={navTheme}>
      <MainStackNavigator />
    </NavigationContainer>
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
