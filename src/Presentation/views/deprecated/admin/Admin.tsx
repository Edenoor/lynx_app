import React, { useEffect } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import useViewModel from './ViewModel';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigator/MainStackNavigator';


interface Props extends StackScreenProps<RootStackParamList>{};

export const AdminScreen = ({navigation, route}: Props) => {
  const { user, removeUserSession } = useViewModel();
  useEffect(() => {
    if(user?.rol !== 'ADMIN'){
      navigation.replace('HomeScreen')
    }
  }, [user])
  
  return (
    <View style={{top:60}}>
        <Text>Admin</Text>
         <View style={{top:100}}>
          <TouchableOpacity onPress={ () =>  removeUserSession()}>
            <Text>remover sesion</Text>
          </TouchableOpacity>
        </View> 
    </View>
  )
}
