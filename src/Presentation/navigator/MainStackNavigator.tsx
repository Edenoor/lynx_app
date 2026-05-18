import React, { useContext } from "react";
import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { UserContext } from "../context/UserContext";

import { HomeScreen } from "../views/auth/home/Home";
import { RecuperarScreen } from "../views/auth/recuperar/Recuperar";
import { RegisterScreen } from "../views/auth/register/Register";
import { DriverStackNavigator } from "./DriverStackNavigator";
import { SellerStackNavigator } from "./SellerStackNavigator";

export type RootStackParamList = {
  HomeScreen: undefined;
  RegisterScreen: undefined;
  RecuperarScreen: undefined;
  DriverStackNavigator: undefined;
  SellerStackNavigator: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AuthLoadingScreen = () => {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
      }}
    >
      <ActivityIndicator size="large" />
    </View>
  );
};

export const MainStackNavigator = () => {
  const { user, isAuthLoading } = useContext(UserContext);

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  const normalizedRol = user?.rol?.toUpperCase();

  const initialRouteName =
    normalizedRol === "DRIVER"
      ? "DriverStackNavigator"
      : normalizedRol === "SELLER" || normalizedRol === "ADMIN"
      ? "SellerStackNavigator"
      : "HomeScreen";

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false }}
    >
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

      <Stack.Screen name="DriverStackNavigator" component={DriverStackNavigator} />
      <Stack.Screen name="SellerStackNavigator" component={SellerStackNavigator} />
    </Stack.Navigator>
  );
};