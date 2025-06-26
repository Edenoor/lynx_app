import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import global from '../../../theme/global';

export const EnvioTradicionalScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nuevo Envío</Text>

      <TextInput placeholder="Dirección de origen" style={styles.input} />
      <TextInput placeholder="Dirección de entrega" style={styles.input} />

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Continuar</Text>
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
    marginBottom: 20,
    textAlign: 'center',
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
  },
  buttonText: {
    textAlign: 'center',
    fontWeight: 'bold',
    color: global.COLORS.text,
  },
});
