import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";

export const RegisterScreen = () => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      <ThemedStatusBar />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconContainer}>
          <Ionicons
            name="person-add-outline"
            size={52}
            color={theme.text.accent}
          />
        </View>

        <Text style={styles.title}>Crear cuenta</Text>

        <Text style={styles.description}>
          El registro de nuevas cuentas aún no se encuentra disponible desde la
          aplicación.
        </Text>

        <Text style={styles.description}>
          Si necesitás acceso a Lynx, comunicate con soporte para que podamos
          crear tu usuario y asignar los permisos correspondientes.
        </Text>

        <View style={styles.card}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={theme.text.accent}
          />

          <Text style={styles.cardText}>
            Drivers y Sellers deben solicitar el alta de usuario a soporte.
          </Text>
        </View>

        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Entendido</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const makeStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.surfaces.screen,
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
    color: t.text.primary,
    fontSize: 32,
    fontWeight: t.font.weight.black,
    textAlign: "center",
    marginBottom: 16,
  },

  description: {
    color: t.text.secondary,
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
    backgroundColor: t.surfaces.cardElevated,
    borderRadius: t.radius.xl,
    borderWidth: 1,
    borderColor: t.borders.soft,
    padding: 18,
  },

  cardText: {
    flex: 1,
    color: t.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },

  button: {
    marginTop: 32,
    backgroundColor: t.colors.primary,
    borderRadius: t.radius.lg,
    paddingVertical: 16,
    alignItems: "center",
  },

  buttonText: {
    color: t.text.onPrimary,
    fontSize: 16,
    fontWeight: t.font.weight.black,
  },
});