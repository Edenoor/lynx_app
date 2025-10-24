import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DriverScreen } from '../views/driver/landing/Driver';
import { EnviosScreen } from '../views/driver/Envios/EnviosScreen';
import NotificationsScreen from '../views/common/NotificationScreen'; // corregido: ruta plural y consistente

export type RootStackParamList = {
  DriverScreen: undefined;
  EnviosScreen: undefined;
  NotificationsScreen: undefined; // corregido: plural
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const DriverStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriverScreen" component={DriverScreen} />
      <Stack.Screen name="EnviosScreen" component={EnviosScreen} />
      <Stack.Screen
        name="NotificationsScreen"
        component={NotificationsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};
