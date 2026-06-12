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
  Vehicle: undefined;
  Selfie: undefined;
  Doc: { docKey: DocKey };
  Review: undefined;
  Submit: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Intro" component={IntroScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Vehicle" component={VehicleScreen} />
      <Stack.Screen name="Selfie" component={CaptureSelfieScreen} />
      <Stack.Screen name="Doc" component={CaptureDocumentScreen} />
      <Stack.Screen name="Review" component={ReviewSubmitScreen} />
      <Stack.Screen name="Submit" component={SubmitScreen} />
    </Stack.Navigator>
  );
}