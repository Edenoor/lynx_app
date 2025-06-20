import React, { useEffect } from 'react'
import { Button, Text, ToastAndroid, View, StyleSheet } from 'react-native'
import MapView from 'react-native-maps'
import useViewModel from './ViewModel';
import { RootStackParamList } from '../../../navigator/SellerStackNavigator';
import { StackScreenProps } from '@react-navigation/stack';

interface Props extends StackScreenProps<RootStackParamList, 'MapScreen'>{};

export const MapScreen = ({navigation, route}: Props) => {
  const {messagePermissions, position, mapRef, name, longitude, latitude, onRegionChangeComplete} = useViewModel()

  useEffect(() => {
    if(messagePermissions != ''){
      ToastAndroid.show(messagePermissions, ToastAndroid.LONG)
    }
  }, [messagePermissions])

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        onRegionChangeComplete={(region) => {
          onRegionChangeComplete(region.latitude, region.longitude)
        }}
      />
      
      <View style={styles.buttonContainer}>
        <View style={styles.buttonWrapper}>
          <Button
            title='SELECCIONAR ORIGEN'
            onPress={() => {
              navigation.navigate({
                name: 'EtiquetaScreen',
                merge: true,
                params: {
                  refPoint: name, 
                  longitude: longitude, 
                  latitude: latitude, 
                  addressType: 'origin'
                }
              })
            }}
          />
        </View>
        
        <View style={styles.buttonWrapper}>
          <Button
            title='SELECCIONAR DELIVERY'
            onPress={() => {
              navigation.navigate({
                name: 'EtiquetaScreen',
                merge: true,
                params: {
                  refPoint: name, 
                  longitude: longitude, 
                  latitude: latitude, 
                  addressType: 'delivery'
                }
              })
            }}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative'
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  buttonWrapper: {
    marginVertical: 5,
    borderRadius: 5,
    overflow: 'hidden', // This ensures the button respects borderRadius
  }
})


