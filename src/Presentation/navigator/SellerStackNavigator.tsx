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
    HomeScreen: {rol:string},
    RegisterScreen: {rol:string}, 
    DriverScreen: undefined,
    ClientScreen: undefined,
    AdminScreen: undefined,
    ErrorScreen: undefined,
    RecuperarScreen: undefined,
    EtiquetaScreen: {refPoint: string, latitude: number, longitude: number , addressType?: 'origin' | 'delivery'} | undefined,
    MapScreen: {addressType?: 'origin' | 'delivery'} | undefined,
    DisplayEtiquetaScreen: {latOrg: number, longOrg: number, latDes: number, longDes: number, refPointOrg: string, refPointDes: string}
    QrGeneratorScreen: undefined,
    QrDisplayScreen: undefined,
    QrHandleScreen: {data: string}
}

export const SellerStackNavigator = () => {
  return (
    <UserState>
    <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen
          name="HomeScreen"
          component={HomeScreen}
          options={{
            headerShown: true,
          }}
          initialParams={{rol:'SELLER'}}
        />
         <Stack.Screen 
         name="RegisterScreen" 
         component={RegisterScreen}
         options={{
          headerShown: true,
          title: 'Nuevo Usuario'
         }}
         initialParams={{rol:'SELLER'}}
         />
         <Stack.Screen 
         name="RecuperarScreen" 
         component={RecuperarScreen}
         options={{
          headerShown: true,
          title: 'Recuperar Contraseña'
         }} 
         />
         <Stack.Screen
         name="DriverScreen"
         component={DriverScreen}
         />
         <Stack.Screen
         name="ClientScreen"
         component={ClientScreen}
         />
         <Stack.Screen
         name="AdminScreen"
         component={AdminScreen}
         />
         <Stack.Screen
         name="ErrorScreen"
         component={ErrorScreen}
         />
         <Stack.Screen
         name="EtiquetaScreen"
         component={EtiquetaScreen}
         />
          <Stack.Screen
         name="MapScreen"
         component={MapScreen}
         />
         <Stack.Screen
         name="DisplayEtiquetaScreen"
         component={DisplayEtiquetaScreen}
         />
         <Stack.Screen
          name="QrGeneratorScreen"
          component={QrGeneratorScreen}
          />
          <Stack.Screen
          name="QrDisplayScreen"
          component={QrDisplayScreen}
          />
          <Stack.Screen
          name="QrHandleScreen"
          component={QrHandleScreen}
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