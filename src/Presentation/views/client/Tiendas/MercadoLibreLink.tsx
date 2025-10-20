import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, Platform, ToastAndroid } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import global from '../../../theme/global';

const extra = (Constants.expoConfig?.extra ?? (Constants as any).manifest?.extra) || {};
const APP_ID = String(extra.MLI_APP_ID || '');
const REDIRECT_URI = String(extra.MLI_REDIRECT_URI || '');
const AUTH_BASE = 'https://auth.mercadolibre.com.ar/authorization';

function buildAuthUrl() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

export const MercadoLibreLink = () => {
  const handleRedirect = async () => {
    if (!APP_ID || !REDIRECT_URI) {
      Alert.alert(
        'Configuración incompleta',
        'Revisá app.json → expo.extra: MLI_APP_ID y MLI_REDIRECT_URI'
      );
      return;
    }

    const authUrl = buildAuthUrl();

    // Copiar link al portapapeles (feedback opcional en Android)
    try {
      await Clipboard.setStringAsync(authUrl);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Link copiado al portapapeles', ToastAndroid.SHORT);
      }
    } catch {}

    // Abrir navegador
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
