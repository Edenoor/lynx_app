import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Image } from 'react-native';
import global from '../../../theme/global';

export const EnvioTurboScreen = () => {
  const handleScanQR = () => {
    // Aquí más adelante se puede integrar el escáner
    console.log('Abrir cámara para escanear QR');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nuevo Envío Turbo</Text>
      <Text style={styles.subtitle}>Envíos en menos de 2hs</Text>

      <TextInput placeholder="Dirección de origen" style={styles.input} />
      <TextInput placeholder="Dirección de entrega" style={styles.input} />

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Continuar</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.qrButton} onPress={handleScanQR}>
        <Image
          source={require('../../../../../assets/qr.png')}
          style={styles.qrIcon}
        />
        <Text style={styles.qrText}>Escanear QR</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: global.COLORS.background,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: global.FONT.size.xl,
    fontWeight: 'bold',
    color: global.COLORS.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: global.FONT.size.md,
    color: global.COLORS.gray,
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: global.COLORS.gray,
    padding: 10,
    borderRadius: global.BORDER_RADIUS.md,
    marginBottom: 20,
    backgroundColor: global.COLORS.white,
  },
  button: {
    backgroundColor: global.COLORS.primary,
    padding: 15,
    borderRadius: global.BORDER_RADIUS.md,
    marginBottom: 40,
  },
  buttonText: {
    textAlign: 'center',
    fontWeight: 'bold',
    color: global.COLORS.text,
  },
  qrButton: {
    alignItems: 'center',
  },
  qrIcon: {
    width: 50,
    height: 50,
    marginBottom: 8,
  },
  qrText: {
    fontSize: global.FONT.size.md,
    color: global.COLORS.text,
  },
});

