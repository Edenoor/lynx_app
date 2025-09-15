import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../views/auth/home/Home';
import { RecuperarScreen } from '../views/auth/recuperar/Recuperar';
import { RegisterScreen } from '../views/auth/register/Register';
import { DriverStackNavigator } from './DriverStackNavigator';
import { SellerStackNavigator } from './SellerStackNavigator';
import { UserProvider } from '../context/UserContext';

export type RootStackParamList = {
  HomeScreen: undefined;
  RegisterScreen: undefined;
  RecuperarScreen: undefined;
  DriverStackNavigator: undefined;
  SellerStackNavigator: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const MainStackNavigator = () => {
  return (
    <UserProvider>
      <Stack.Navigator
        initialRouteName="HomeScreen"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="HomeScreen" component={HomeScreen} />
        <Stack.Screen
          name="RegisterScreen"
          component={RegisterScreen}
          options={{ headerShown: true, title: 'Crear cuenta' }}
        />
        <Stack.Screen
          name="RecuperarScreen"
          component={RecuperarScreen}
          options={{ headerShown: true, title: 'Recuperar contraseña' }}
        />
        <Stack.Screen name="DriverStackNavigator" component={DriverStackNavigator} />
        <Stack.Screen name="SellerStackNavigator" component={SellerStackNavigator} />
      </Stack.Navigator>
    </UserProvider>
  );
};
