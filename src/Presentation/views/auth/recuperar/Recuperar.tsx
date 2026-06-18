import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppTheme from "../../../theme/AppTheme";

export const RecuperarScreen = () => {
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconContainer}>
          <Ionicons
            name="lock-closed-outline"
            size={52}
            color={AppTheme.colors.primary}
          />
        </View>

        <Text style={styles.title}>Recuperar contraseña</Text>

        <Text style={styles.description}>
          Por el momento la recuperación de contraseña no se encuentra
          disponible desde la aplicación.
        </Text>

        <Text style={styles.description}>
          Por favor comunicate con soporte para solicitar el restablecimiento de
          tu acceso.
        </Text>

        <View style={styles.card}>
          <Ionicons
            name="headset-outline"
            size={20}
            color={AppTheme.colors.primary}
          />

          <Text style={styles.cardText}>
            Contactate con el equipo de soporte Lynx para recuperar tu cuenta.
          </Text>
        </View>

        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Entendido</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.surfaces.screen,
  },

  content: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
  },

  iconContainer: {
    alignSelf: "center",
    marginBottom: 24,
  },

  title: {
    color: AppTheme.text.primary,
    fontSize: 32,
    fontWeight: AppTheme.font.weight.black,
    textAlign: "center",
    marginBottom: 16,
  },

  description: {
    color: AppTheme.text.secondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 12,
  },

  card: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: AppTheme.surfaces.cardElevated,
    borderRadius: AppTheme.radius.xl,
    borderWidth: 1,
    borderColor: AppTheme.borders.soft,
    padding: 18,
  },

  cardText: {
    flex: 1,
    color: AppTheme.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },

  button: {
    marginTop: 32,
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radius.lg,
    paddingVertical: 16,
    alignItems: "center",
  },

  buttonText: {
    color: AppTheme.colors.white,
    fontSize: 16,
    fontWeight: AppTheme.font.weight.black,
  },
});