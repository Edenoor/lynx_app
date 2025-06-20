import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react'
import { HomeScreen } from '../views/auth/home/Home';
import { UserProvider } from '../context/UserContext';
import { DriverScreen } from '../views/driver/landing/Driver';

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