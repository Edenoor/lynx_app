import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import global from '../../../theme/global';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigator/SellerStackNavigator';

type Props = StackScreenProps<RootStackParamList, 'TiendasScreen'>;

export const TiendasScreen = ({ navigation }: Props) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Conectá tu tienda con Lynx</Text>
      <Text style={styles.subtitle}>
        Trabajamos con los principales e-commerce del país. Elegí tu plataforma para comenzar:
      </Text>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('MercadoLibreLink')}
        >
          <Image
            source={require('../../../../../assets/mercadolibre.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.button}>
          <Image
            source={require('../../../../../assets/tiendanube.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.button}>
          <Image
            source={require('../../../../../assets/woocommerce.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.button}>
          <Image
            source={require('../../../../../assets/shopify.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: global.COLORS.background,
    padding: 20,
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: global.FONT.size.xl,
    fontWeight: 'bold',
    color: global.COLORS.text,
    textAlign: 'center',
    marginTop: 40,
  },
  subtitle: {
    fontSize: global.FONT.size.md,
    color: global.COLORS.text,
    textAlign: 'center',
    marginVertical: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  button: {
    width: '40%',
    backgroundColor: global.COLORS.white,
    padding: 15,
    marginVertical: 10,
    borderRadius: global.BORDER_RADIUS.md,
    alignItems: 'center',
    elevation: 2,
  },
  logo: {
    width: 80,
    height: 40,
  },
});


