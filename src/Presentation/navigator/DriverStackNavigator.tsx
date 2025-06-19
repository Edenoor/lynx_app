import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react'
import { HomeScreen } from '../views/home/Home';
import { RegisterScreen } from '../views/auth/register/Register';
import { UserProvider } from '../context/UserContext';
import { DriverScreen } from '../views/driver/Driver';
import { ClientScreen } from '../views/client/Client';
import { AdminScreen } from '../views/admin/Admin';
import { ErrorScreen } from '../views/home/Error';
import { RecuperarScreen } from '../views/recuperar/Recuperar';
import { QrGeneratorScreen } from '../views/qr/QrGenerator';
import { QrDisplayScreen } from '../views/qr/QrDisplayScreen';
import { EtiquetaScreen } from '../views/etiqueta/Etiqueta';

const Stack = createNativeStackNavigator<RootStackParamList>();

export type RootStackParamList = {
  DriverScreen:undefined,
  HomeScreen: undefined
}

export const DriverStackNavigator = () => {
  return (
    <UserState>
    <Stack.Navigator screenOptions={{headerShown: false}}>
         <Stack.Screen
          name="DriverScreen"
          component={DriverScreen}
          />
          <Stack.Screen
          name="HomeScreen"
          component={HomeScreen}
          />
    </Stack.Navigator>
    </UserState>
  )
}

const UserState = ({children}: any) => {
  return(
    <UserProvider>
      { children }
    </UserProvider>
  )
}