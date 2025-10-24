import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ClientScreen } from '../views/client/Landing/Client';
import { EnvioTurboScreen } from '../views/client/Landing/EnvioTurboScreen';
import { EnvioTradicionalScreen } from '../views/client/Landing/EnvioTradicionalScreen';
import { TiendasScreen } from '../views/client/Tiendas/Tiendas';
import { MercadoLibreLink } from '../views/client/Tiendas/MercadoLibreLink';
import { EnviosScreen } from '../views/client/Envios/EnviosScreen';
import NotificationsScreen from '../views/common/NotificationScreen'; // 👈 nuevo import

export type RootStackParamList = {
  ClientScreen: undefined;
  EnvioTurboScreen: undefined;
  EnvioTradicionalScreen: undefined;
  TiendasScreen: undefined;
  MercadoLibreLink: undefined;
  EnviosScreen: undefined;
  NotificationsScreen: undefined; // 👈 nuevo
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const SellerStackNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="ClientScreen"
      screenOptions={{ headerShown: true }}
    >
      <Stack.Screen
        name="ClientScreen"
        component={ClientScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EnvioTurboScreen"
        component={EnvioTurboScreen}
        options={{ title: 'Envío Turbo' }}
      />
      <Stack.Screen
        name="EnvioTradicionalScreen"
        component={EnvioTradicionalScreen}
        options={{ title: 'Envío Tradicional' }}
      />
      <Stack.Screen
        name="TiendasScreen"
        component={TiendasScreen}
        options={{ title: 'Tiendas vinculadas' }}
      />
      <Stack.Screen
        name="MercadoLibreLink"
        component={MercadoLibreLink}
        options={{ title: 'Vincular MercadoLibre' }}
      />
      <Stack.Screen
        name="EnviosScreen"
        component={EnviosScreen}
        options={{ title: 'Mis envíos' }}
      />
      <Stack.Screen
        name="NotificationsScreen"
        component={NotificationsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};
