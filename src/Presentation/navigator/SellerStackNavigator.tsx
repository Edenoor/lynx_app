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
import { EtiquetaScreen } from '../views/etiqueta/Etiqueta';
import { MapScreen } from '../views/map/Map';
import { DisplayEtiquetaScreen } from '../views/etiqueta/DisplayEtiqueta';
import { QrGeneratorScreen } from '../views/qr/QrGenerator';
import { QrDisplayScreen } from '../views/qr/QrDisplayScreen';
import { QrHandleScreen } from '../views/qr/QrHandleScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export type RootStackParamList = {
    ClientScreen: undefined
}

export const SellerStackNavigator = () => {
  return (
    <UserState>
    <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen
        name="ClientScreen"
        component={ClientScreen}
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