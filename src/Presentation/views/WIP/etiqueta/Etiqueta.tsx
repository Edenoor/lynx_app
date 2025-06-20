import React, { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, ToastAndroid, TouchableOpacity, View } from 'react-native'
import { CustomTextInput } from '../../../components/CustomTextInput'
import useViewModel from './ViewModel';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigator/SellerStackNavigator';
import { RoundedButton } from '../../../components/RoundedButton';


interface Props extends StackScreenProps<RootStackParamList, 'EtiquetaScreen'>{};
  let latOrg = 0.0
  let longOrg = 0.0
  let latDes = 0.0
  let longDes = 0.0
  let refPointOrg = ''
  let refPointDes = ''
export const EtiquetaScreen = ({navigation, route}: Props) => {
  

  const { address,neighbourhood,errorMessage, onChange, register, loading } = useViewModel();
  useEffect(() => {
    if(route.params?.refPoint && route.params.addressType === 'origin'){
      latOrg = route.params.latitude
      longOrg = route.params.longitude
      refPointOrg = route.params.refPoint
      onChange('refPointOrg', route.params.refPoint)
      
    }
  }, [route.params?.refPoint])


  useEffect(() => {
    if(route.params?.refPoint && route.params.addressType === 'delivery'){
      latDes = route.params.latitude
      longDes = route.params.longitude
      refPointDes = route.params.refPoint
      onChange('refPointDes', route.params.refPoint)
      
    }
  }, [route.params?.refPoint])
  
  
  useEffect(() => {
    if (errorMessage != '') {
      ToastAndroid.show(errorMessage, ToastAndroid.LONG);
    }
  }, [errorMessage])
  const [modalVisible, setModalVisible] = useState(false);
      
  return (
    <View >
          

        <View >

          <ScrollView>

            <Text >DIRECCION</Text>
            
            
            <CustomTextInput 
              placeholder='Nombre Direccion'
              keyboardType='email-address'
              image={ require('../../../../assets/email.png') }
              property='address'
              onChangeText={ onChange }
              value={ address }
              />

            
            
            <CustomTextInput 
              placeholder='barrio'
              keyboardType='default'
              image={ require('../../../../assets/password.png') }
              property='neighbourhood'
              onChangeText={ onChange }
              value={ neighbourhood }
              />
            <TouchableOpacity
            onPress={() => navigation.navigate('MapScreen', {addressType: 'origin'})}
            >
            <CustomTextInput 
              placeholder='Punto de referencia origen'
              keyboardType='default'
              image={ require('../../../../assets/confirm_password.png') }
              property='refPointOrg'
              onChangeText={ onChange }
              value={ refPointOrg }
              editable ={false}
              />
             </TouchableOpacity>

             <TouchableOpacity
            onPress={() => navigation.navigate('MapScreen', {addressType: 'delivery'})}
            >
            <CustomTextInput 
              placeholder='Punto de referencia envio'
              keyboardType='default'
              image={ require('../../../../assets/confirm_password.png') }
              property='refPointDes'
              onChangeText={ onChange }
              value={ refPointDes }
              editable ={false}
              />
             </TouchableOpacity>

             
            <View style={{ marginTop: 30 }}>
                
                <RoundedButton text='CREAR ETIQUETA' onPress={ () => navigation.navigate('DisplayEtiquetaScreen', {latOrg: latOrg, longOrg: longOrg, latDes: latDes, longDes: longDes, refPointOrg: refPointOrg, refPointDes: refPointDes })} />

            </View>

          </ScrollView>

        </View>
        {
          loading &&
          <ActivityIndicator style={{position: 'absolute',top: 0,bottom: 0,left: 0,right: 0}} size="large" color='#F4991A' />
        }
        
    </View>
  )
}
