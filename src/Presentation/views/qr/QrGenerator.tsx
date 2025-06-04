import React, { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, ToastAndroid, TouchableOpacity, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import useViewModel from './ViewModel'
import { CustomTextInput } from '../../components/CustomTextInput'
import { RoundedButton } from '../../components/RoundedButton'
import MapView from 'react-native-maps'
import { RootStackParamList } from '../../navigator/DriverStackNavigator'
import { StackScreenProps } from '@react-navigation/stack'

interface Props extends StackScreenProps<RootStackParamList, 'QrGeneratorScreen'>{};

export const QrGeneratorScreen = ({navigation, route}: Props) => {
  // const { email, password, confirmPassword, errorMessage, onChange, register, user, loading } = useViewModel();
  
  // useEffect(() => {
  //   if (errorMessage != '') {
  //     ToastAndroid.show(errorMessage, ToastAndroid.LONG);
  //   }
  // }, [errorMessage])
  // const [modalVisible, setModalVisible] = useState(false);

  const onSuccess = (e: { data: any }) => {
    console.log(e.data);
    // e.data contains the QR code data
  };
  const qr = {
    lat: '12341234',
    long: '12341234',
    address: 'adfasdf'
  }
  return (
    <View style={styles.container}>
      <QRCode
      size={256}
      value={JSON.stringify(qr)}
      />
    <View>
    <TouchableOpacity
    
    onPress={() => navigation.navigate('QrDisplayScreen')}>
      <Text>LEER QR</Text>
      </TouchableOpacity>  
    </View>
    </View>
   
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
});