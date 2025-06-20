import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react'
import { HomeScreen } from '../views/auth/home/Home';
import { UserProvider } from '../context/UserContext';
import { ClientScreen } from '../views/client/Landing/Client';
import { RecuperarScreen } from '../views/auth/recuperar/Recuperar';

const Stack = createNativeStackNavigator<RootStackParamList>();

export type RootStackParamList = {
    ClientScreen: undefined,
    HomeScreen: undefined,
    RegisterScreen: undefined,
    RecuperarScreen: undefined,
}


export const SellerStackNavigator = () => {
  return (
    <UserState>
    <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen
        name="ClientScreen"
        component={ClientScreen}
        />
        <Stack.Screen
        name="HomeScreen"
        component={HomeScreen}
        />
        <Stack.Screen
        name="RecuperarScreen"
        component={RecuperarScreen}
        options={{
          headerShown: true,
          title: 'RECUPERAR'
         }}
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