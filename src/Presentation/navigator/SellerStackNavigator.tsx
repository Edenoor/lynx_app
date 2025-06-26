import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { HomeScreen } from '../views/auth/home/Home';
import { ClientScreen } from '../views/client/Landing/Client';
import { RecuperarScreen } from '../views/auth/recuperar/Recuperar';
import { EnvioTurboScreen } from '../views/client/Landing/EnvioTurboScreen';
import { EnvioTradicionalScreen } from '../views/client/Landing/EnvioTradicionalScreen';
import { TiendasScreen } from '../views/client/Tiendas/Tiendas';
import { MercadoLibreLink } from '../views/client/Tiendas/MercadoLibreLink';
import { UserProvider } from '../context/UserContext';

export type RootStackParamList = {
  ClientScreen: undefined;
  HomeScreen: undefined;
  RegisterScreen: undefined;
  RecuperarScreen: undefined;
  EnvioTurboScreen: undefined;
  EnvioTradicionalScreen: undefined;
  TiendasScreen: undefined;
  MercadoLibreLink: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const SellerStackNavigator = () => {
  return (
    <UserState>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ClientScreen" component={ClientScreen} />
        <Stack.Screen name="HomeScreen" component={HomeScreen} />
        <Stack.Screen
          name="RecuperarScreen"
          component={RecuperarScreen}
          options={{
            headerShown: true,
            title: 'RECUPERAR',
          }}
        />
        <Stack.Screen
          name="EnvioTurboScreen"
          component={EnvioTurboScreen}
          options={{ headerShown: true, title: 'Envío Turbo' }}
        />
        <Stack.Screen
          name="EnvioTradicionalScreen"
          component={EnvioTradicionalScreen}
          options={{ headerShown: true, title: 'Envío Tradicional' }}
        />
        <Stack.Screen
          name="TiendasScreen"
          component={TiendasScreen}
          options={{ headerShown: true, title: 'Tiendas' }}
        />
        <Stack.Screen
          name="MercadoLibreLink"
          component={MercadoLibreLink}
          options={{ headerShown: true, title: 'Vincular MercadoLibre' }}
        />
      </Stack.Navigator>
    </UserState>
  );
};

const UserState = ({ children }: any) => {
  return <UserProvider>{children}</UserProvider>;
};
