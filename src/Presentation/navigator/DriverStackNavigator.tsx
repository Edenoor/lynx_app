import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DriverScreen } from '../views/driver/landing/Driver';

export type RootStackParamList = {
  DriverScreen: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const DriverStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriverScreen" component={DriverScreen} />
    </Stack.Navigator>
  );
};
