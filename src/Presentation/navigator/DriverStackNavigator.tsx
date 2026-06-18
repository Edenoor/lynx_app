import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { DriverScreen } from "../views/driver/landing/Driver";
import { EnviosScreen } from "../views/driver/Envios/EnviosScreen";
import NotificationsScreen from "../views/common/NotificationScreen";
import DriverAccountScreen from "../views/driver/account/DriverAccountScreen";

import { OnboardingStackNavigator } from "../navigator/OnboardingStackNavigator";
import { useOnboarding } from "../onboarding/OnboardingContext";

import DriverScanScreen from "../views/driver/scan/DriverScanScreen";
import DriverScanOptionsScreen from "../views/driver/scan/DriverScanOptionsScreen";

export type DriverScanMode = "colecta" | "planta" | "asignarme";

export type DriverStackParamList = {
  Onboarding: undefined;
  DriverScreen: undefined;
  EnviosScreen: undefined;
  NotificationsScreen: undefined;
  DriverAccountScreen: undefined;
  DriverScanOptionsScreen: undefined;
  DriverScanScreen: { mode: DriverScanMode };
};

const Stack = createNativeStackNavigator<DriverStackParamList>();

export const DriverStackNavigator = () => {
  const { state } = useOnboarding();

  const onboardingCompleted = state.completedLocal === true;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!onboardingCompleted ? (
        <Stack.Screen name="Onboarding" component={OnboardingStackNavigator} />
      ) : (
        <>
          <Stack.Screen name="DriverScreen" component={DriverScreen} />
          <Stack.Screen name="EnviosScreen" component={EnviosScreen} />
          <Stack.Screen
            name="NotificationsScreen"
            component={NotificationsScreen}
          />
          <Stack.Screen
            name="DriverAccountScreen"
            component={DriverAccountScreen}
          />
          <Stack.Screen
            name="DriverScanOptionsScreen"
            component={DriverScanOptionsScreen}
          />
          <Stack.Screen name="DriverScanScreen" component={DriverScanScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};