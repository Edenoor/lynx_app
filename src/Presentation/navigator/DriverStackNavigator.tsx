import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { DriverScreen } from "../views/driver/landing/Driver";
import { EnviosScreen } from "../views/driver/Envios/EnviosScreen";
import NotificationsScreen from "../views/common/NotificationScreen";

import { OnboardingStackNavigator } from "../navigator/OnboardingStackNavigator";
import { useOnboarding } from "../onboarding/OnboardingContext";

// ✅ NUEVO: pantalla de escaneo driver
import DriverScanScreen from "../views/driver/scan/DriverScanScreen";

export type DriverStackParamList = {
  Onboarding: undefined;
  DriverScreen: undefined;
  EnviosScreen: undefined;
  NotificationsScreen: undefined;

  // ✅ NUEVO
  DriverScanScreen: { mode: "colecta" | "planta" | "asignarme" };
};

const Stack = createNativeStackNavigator<DriverStackParamList>();

export const DriverStackNavigator = () => {
  const { state } = useOnboarding();

  const onboardingCompleted = state.completedLocal;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* si NO completó onboarding → mostrar onboarding */}
      {!onboardingCompleted && (
        <Stack.Screen name="Onboarding" component={OnboardingStackNavigator} />
      )}

      {/* si completó onboarding → mostrar app normal */}
      {onboardingCompleted && (
        <>
          <Stack.Screen name="DriverScreen" component={DriverScreen} />
          <Stack.Screen name="EnviosScreen" component={EnviosScreen} />
          <Stack.Screen
            name="NotificationsScreen"
            component={NotificationsScreen}
          />

          {/* ✅ NUEVO: escaneo */}
          <Stack.Screen name="DriverScanScreen" component={DriverScanScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};
