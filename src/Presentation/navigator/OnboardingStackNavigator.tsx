import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { IntroScreen } from "../screens/IntroScreen";
import { TermsScreen } from "../screens/TermsScreen";
import { VehicleScreen } from "../screens/VehicleScreen";
import { CaptureSelfieScreen } from "../screens/CaptureSelfieScreen";
import { CaptureDocumentScreen } from "../screens/CaptureDocumentScreen";
import { ReviewSubmitScreen } from "../screens/ReviewSubmitScreen";
import { SubmitScreen } from "../screens/SubmitScreen";
import { DocKey } from "../onboarding/types";

export type OnboardingStackParamList = {
  Intro: undefined;
  Terms: undefined;
  Vehicle: undefined; // ✅ NUEVO
  Selfie: undefined;
  Doc: { docKey: DocKey };
  Review: undefined;
  Submit: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerTitleAlign: "center" }}>
      <Stack.Screen name="Intro" component={IntroScreen} options={{ title: "Onboarding" }} />
      <Stack.Screen name="Terms" component={TermsScreen} options={{ title: "Términos" }} />
      <Stack.Screen name="Vehicle" component={VehicleScreen} options={{ title: "Vehículo" }} />
      <Stack.Screen name="Selfie" component={CaptureSelfieScreen} options={{ title: "Selfie" }} />
      <Stack.Screen name="Doc" component={CaptureDocumentScreen} options={{ title: "Documento" }} />
      <Stack.Screen name="Review" component={ReviewSubmitScreen} options={{ title: "Revisión" }} />
      <Stack.Screen name="Submit" component={SubmitScreen} options={{ title: "Enviar" }} />
    </Stack.Navigator>
  );
}
