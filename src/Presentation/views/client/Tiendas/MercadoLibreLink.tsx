import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import global from '../../../theme/global';

export const MercadoLibreLink = () => {
  const handleRedirect = () => {
    const authUrl = 'https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=XXXX&redirect_uri=YYYY';
    Linking.openURL(authUrl);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Integración con MercadoLibre</Text>

      <Text style={styles.text}>Conectá tu cuenta para gestionar tus envíos desde Lynx.</Text>
      <Text style={styles.text}>Sincroniza pedidos de forma segura.</Text>

      <TouchableOpacity style={styles.button} onPress={handleRedirect}>
        <Text style={styles.buttonText}>Continuar a MercadoLibre</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: global.SPACING.lg,
    justifyContent: 'center',
    backgroundColor: global.COLORS.background,
  },
  title: {
    fontSize: global.FONT.size.xl,
    fontWeight: 'bold',
    marginBottom: global.SPACING.md,
    color: global.COLORS.text,
  },
  text: {
    fontSize: global.FONT.size.md,
    marginBottom: global.SPACING.sm,
    color: global.COLORS.text,
  },
  button: {
    marginTop: global.SPACING.lg,
    backgroundColor: global.COLORS.primary,
    padding: global.SPACING.md,
    borderRadius: global.BORDER_RADIUS.md,
  },
  buttonText: {
    textAlign: 'center',
    color: global.COLORS.text,
    fontWeight: 'bold',
  },
});
