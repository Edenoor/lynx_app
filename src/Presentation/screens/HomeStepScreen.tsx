// src/Presentation/screens/HomeStepScreen.tsx
// Paso «Tu domicilio» del alta: la misma pantalla que Perfil › Mi domicilio,
// con «Continuar» / «Ahora no» hacia las fotos.

import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { OnboardingStackParamList } from "../navigator/OnboardingStackNavigator";
import DriverHomeScreen from "../views/driver/account/DriverHomeScreen";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Home">;

export function HomeStepScreen({ navigation }: Props) {
  return <DriverHomeScreen step={{ onNext: () => navigation.navigate("Selfie") }} />;
}
