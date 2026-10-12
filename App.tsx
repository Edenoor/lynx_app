import React from "react";
import { NavigationContainer } from "@react-navigation/native";

import { MainStackNavigator } from "./src/Presentation/navigator/MainStackNavigator";

import { UserProvider } from "./src/Presentation/context/UserContext";
import { OnboardingProvider } from "./src/Presentation/onboarding/OnboardingContext";
import { AppVersionGate } from "./src/Presentation/components/AppVersionGate";

export default function App() {
  return (
    <AppVersionGate>
      <UserProvider>
        <OnboardingProvider>
          <NavigationContainer>
            <MainStackNavigator />
          </NavigationContainer>
        </OnboardingProvider>
      </UserProvider>
    </AppVersionGate>
  );
}