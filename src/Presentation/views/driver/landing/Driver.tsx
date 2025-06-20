import React, { useEffect } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import useViewModel from './ViewModel';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigator/DriverStackNavigator';
interface Props extends StackScreenProps<RootStackParamList, 'DriverScreen'>{};

export const DriverScreen = ({navigation, route}: Props) => {
  const { user,removeUserSession } = useViewModel();
  console.log(navigation.getState());
  useEffect(() => {
      if(user?.rol !== 'DRIVER'){
        navigation.replace('HomeScreen')
      }
    }, [user])
  return (
    <View style={{top:60}}>
        <Text>driver</Text>
         <View style={{top:100}}>
          <TouchableOpacity onPress={ () =>  removeUserSession()}>
            <Text>remover sesion</Text>
          </TouchableOpacity>
        </View>
        <View style={{top:100}}>
          {/* <TouchableOpacity onPress={ () => navigation.navigate('QrDisplayScreen')}>
            <Text>qr</Text>
          </TouchableOpacity> */}
        </View>  
    </View>
  )
}
