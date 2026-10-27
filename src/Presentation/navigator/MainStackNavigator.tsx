import React, { useContext } from "react";
import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { UserContext } from "../context/UserContext";
import { useAppTheme, useThemedStyles } from "../theme/ThemeProvider";
import type { Theme } from "../theme/createTheme";

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

const makeLoadingStyles = (t: Theme) => ({
  screen: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: t.colors.background,
  },
});

const AuthLoadingScreen = () => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeLoadingStyles);

  return (
    <View style={styles.screen}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
};

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