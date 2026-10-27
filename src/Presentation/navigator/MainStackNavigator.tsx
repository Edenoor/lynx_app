import React, { useContext } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { UserContext } from "../context/UserContext";
import { DARK_COLORS, SPLASH_BACKGROUND } from "../theme/global";

import { HomeScreen } from "../views/auth/home/Home";
import { RecuperarScreen } from "../views/auth/recuperar/Recuperar";
import { RegisterScreen } from "../views/auth/register/Register";
import { DriverStackNavigator } from "./DriverStackNavigator";
import { SellerStackNavigator } from "./SellerStackNavigator";
import { PickerStackNavigator } from "./PickerStackNavigator";
import { AdminWebScreen } from "../views/admin/AdminWebScreen";
import { resolveAppArea } from "./appArea";

export type RootStackParamList = {
  HomeScreen: undefined;
  RegisterScreen: undefined;
  RecuperarScreen: undefined;
  DriverStackNavigator: undefined;
  SellerStackNavigator: undefined;
  PickerStackNavigator: undefined;
  AdminWebScreen: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Mientras se lee la sesión: continúa el splash nativo (mismo fondo), para que
// al entrar haya un solo cambio de color, al login (Light) o a la apariencia
// del chofer, y no dos.
const loadingStyles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SPLASH_BACKGROUND,
  },
});

const AuthLoadingScreen = () => (
  <View style={loadingStyles.screen}>
    <ActivityIndicator size="large" color={DARK_COLORS.accent} />
  </View>
);

export const MainStackNavigator = () => {
  const { user, isAuthLoading } = useContext(UserContext);

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  const area = resolveAppArea(user);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {area === "auth" ? (
        <>
          <Stack.Screen name="HomeScreen" component={HomeScreen} />

          <Stack.Screen
            name="RegisterScreen"
            component={RegisterScreen}
            options={{ headerShown: true, title: "Crear cuenta" }}
          />

          <Stack.Screen
            name="RecuperarScreen"
            component={RecuperarScreen}
            options={{ headerShown: true, title: "Recuperar contraseña" }}
          />
        </>
      ) : area === "driver" ? (
        <Stack.Screen
          name="DriverStackNavigator"
          component={DriverStackNavigator}
        />
      ) : area === "picker" ? (
        <Stack.Screen
          name="PickerStackNavigator"
          component={PickerStackNavigator}
        />
      ) : area === "adminWeb" ? (
        <Stack.Screen name="AdminWebScreen" component={AdminWebScreen} />
      ) : (
        <Stack.Screen
          name="SellerStackNavigator"
          component={SellerStackNavigator}
        />
      )}
    </Stack.Navigator>
  );
};