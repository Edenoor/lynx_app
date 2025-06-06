import React, { useEffect }  from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useUserLocal } from '../../hooks/useUserLocal';
import useViewModel from './ViewModel';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigator/SellerStackNavigator';
interface Props extends StackScreenProps<RootStackParamList, 'ClientScreen'>{};

export const ClientScreen = ({navigation, route}: Props) => {
  const { user,removeUserSession } = useViewModel();
  useEffect(() => {
      if(user?.rol !== 'SELLER'){
        navigation.replace('HomeScreen',{rol:'SELLER'})
      }
    }, [user])
  return (
    <View style={{top:60}}>
        <Text>client</Text>
         <View style={{top:100}}>
          <TouchableOpacity onPress={ () =>  removeUserSession()}>
            <Text>remover sesion</Text>
          </TouchableOpacity>
        </View>
        <View style={{top:100}}>
          <TouchableOpacity onPress={ () =>  navigation.navigate('EtiquetaScreen')}>
            <Text>GENERAR ETIQUETA</Text>
          </TouchableOpacity>
        </View>  
    </View>
    
  )
}
