import { StackScreenProps } from '@react-navigation/stack';
import React from 'react'
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { RootStackParamList } from '../../../navigator/SellerStackNavigator';

interface Props extends StackScreenProps<RootStackParamList, 'QrHandleScreen'>{};

export const QrHandleScreen = ({navigation, route}: Props) => {

    const {data} = route.params

    const locationData = JSON.parse(data)
 const initialRegion = {
    latitude: (locationData.latOrg + locationData.latDes) / 2,
    longitude: (locationData.longOrg + locationData.longDes) / 2,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
      >
        {/* Origin Marker */}
        <Marker
          coordinate={{
            latitude: locationData.latOrg,
            longitude: locationData.longOrg,
          }}
          title="Origin"
          description={locationData.refPointOrg}
          pinColor="blue" // Optional: different color for origin
        />
        
        {/* Destination Marker */}
        <Marker
          coordinate={{
            latitude: locationData.latDes,
            longitude: locationData.longDes,
          }}
          title="Destination"
          description={locationData.refPointDes}
          pinColor="red" // Optional: different color for destination
        />
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
