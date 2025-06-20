import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { RootStackParamList } from '../../../navigator/SellerStackNavigator';
import { StackScreenProps } from '@react-navigation/stack';
import QRCode from 'react-native-qrcode-svg';

interface Props extends StackScreenProps<RootStackParamList, 'DisplayEtiquetaScreen'>{};

export const DisplayEtiquetaScreen = ({navigation, route}: Props) => {
    const {latDes,latOrg,longDes,longOrg,refPointOrg, refPointDes} = route.params

    const qr = {
        latOrg,
        longOrg,
        refPointOrg,
        latDes,
        longDes,
        refPointDes,
    }
  return (
    <View>
    <View style={styles.container}>
      <QRCode
      size={256}
      value={JSON.stringify(qr)}
      />
    </View>
    </View>
  )
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'absolute',
    alignContent: 'center',
    alignItems: 'center',
    top: 100
  },
  map: {
    width: '100%',
    height: '100%',
  },
});