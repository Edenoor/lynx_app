import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ToastAndroid,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LynxPulseLoader } from "../../../components/LynxPulseLoader";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigator/MainStackNavigator";
import useViewModel from "./ViewModel";
import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";

type Props = NativeStackScreenProps<RootStackParamList, "HomeScreen">;

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { values, onChange, login, errorMessage, clearError } = useViewModel();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (errorMessage) {
      ToastAndroid.show(errorMessage, ToastAndroid.LONG);
      clearError();
    }
  }, [errorMessage, clearError]);

const onPressLogin = async () => {
  if (loading) return;

  setLoading(true);

  try {
    const [result] = await Promise.all([login(), sleep(850)]);

    if (!result.ok) return;
  } finally {
    setLoading(false);
  }
};

  return (
    <SafeAreaView style={styles.container}>
      <ThemedStatusBar />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.content}
      >
        <View pointerEvents="none" style={styles.mapLayer}>
          <View style={[styles.mapLine, styles.mapLineOne]} />
          <View style={[styles.mapLine, styles.mapLineTwo]} />
          <View style={[styles.mapLine, styles.mapLineThree]} />
          <View style={[styles.routeLine, styles.routeLineOne]} />
          <View style={[styles.routeLine, styles.routeLineTwo]} />
          <View style={styles.routeDotTop} />
        </View>

        <View style={styles.header}>
          <Image
            source={require("../../../../../assets/adaptive-icon-white.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.brand}>LYNX</Text>

          <Text style={styles.subtitle}>Preciso. Inteligente. Ágil.</Text>
        </View>

        <View style={styles.formPanel}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Usuario</Text>
            <TextInput
              value={values.username}
              placeholder="Ingresá tu usuario"
              placeholderTextColor={theme.colors.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              style={styles.input}
              onChangeText={(text) => onChange("username", text)}
            />
          </View>

          <View style={styles.separator} />

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              value={values.password}
              placeholder="Ingresá tu contraseña"
              placeholderTextColor={theme.colors.placeholder}
              secureTextEntry
              editable={!loading}
              style={styles.input}
              onChangeText={(text) => onChange("password", text)}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            style={[
              styles.primaryButton,
              loading && styles.primaryButtonDisabled,
            ]}
            onPress={onPressLogin}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? "Ingresando..." : "Ingresar"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.75}
            disabled={loading}
            onPress={() => navigation.navigate("RecuperarScreen")}
          >
            <Text style={styles.link}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <View style={styles.footerDivider}>
            <View style={styles.footerLine} />
            <View style={styles.footerDot} />
            <View style={styles.footerLine} />
          </View>

          <TouchableOpacity
            activeOpacity={0.75}
            disabled={loading}
            onPress={() => navigation.navigate("RegisterScreen")}
          >
            <Text style={styles.secondaryLink}>Crear cuenta</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <LynxPulseLoader compact message="Ingresando a Lynx..." />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const makeStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },

  content: {
    flex: 1,
    paddingHorizontal: t.spacing.lg,
    justifyContent: "center",
    overflow: "hidden",
  },

  mapLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,
  },

  mapLine: {
    position: "absolute",
    height: 1,
    backgroundColor: t.borders.soft,
  },

  mapLineOne: {
    width: 520,
    top: 150,
    left: -120,
    transform: [{ rotate: "-18deg" }],
  },

  mapLineTwo: {
    width: 460,
    top: 330,
    right: -160,
    transform: [{ rotate: "24deg" }],
  },

  mapLineThree: {
    width: 580,
    bottom: 170,
    left: -180,
    transform: [{ rotate: "15deg" }],
  },

  routeLine: {
    position: "absolute",
    width: 2,
    borderRadius: 999,
    backgroundColor: t.colors.primary,
  },

  routeLineOne: {
    height: 190,
    top: 120,
    right: 52,
    opacity: 0.18,
    transform: [{ rotate: "38deg" }],
  },

  routeLineTwo: {
    height: 160,
    bottom: 90,
    left: 64,
    opacity: 0.1,
    transform: [{ rotate: "-34deg" }],
  },

  routeDotTop: {
    position: "absolute",
    top: 102,
    right: 66,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: t.colors.primary,
    opacity: 0.7,
  },

  header: {
    alignItems: "center",
    marginBottom: t.spacing.xl,
  },

  // Silueta blanca: se tiñe con el color de marca para verse sobre fondo claro.
  logo: {
    width: 104,
    height: 104,
    marginBottom: t.spacing.sm,
    tintColor: t.colors.primary,
  },

  brand: {
    color: t.colors.text,
    fontSize: t.font.size.xl,
    fontWeight: "900",
    letterSpacing: 9,
    marginBottom: t.spacing.xl,
  },

  title: {
    color: t.colors.text,
    fontSize: t.font.size.xxl,
    fontWeight: "400",
    letterSpacing: -0.8,
  },

  titleAccent: {
    color: t.colors.primary,
    fontWeight: "800",
  },

  subtitle: {
    color: t.colors.textMuted,
    fontSize: t.font.size.md,
    marginTop: t.spacing.sm,
  },

  // Un solo panel opaco y sin sombra: en Android la sombra (elevation) de una
  // superficie translúcida se ve a través de ella como un segundo recuadro.
  formPanel: {
    borderRadius: t.radius.xl,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.borders.default,
    padding: t.spacing.lg,
    gap: t.spacing.md,
  },

  inputGroup: {
    gap: t.spacing.sm,
  },

  label: {
    color: t.colors.textSecondary,
    fontSize: t.font.size.md,
    fontWeight: "500",
  },

  input: {
    height: 54,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: t.borders.medium,
    color: t.colors.text,
    fontSize: t.font.size.md,
    paddingHorizontal: t.spacing.md,
  },

  separator: {
    height: 1,
    backgroundColor: t.colors.border,
    opacity: 0.5,
  },

  primaryButton: {
    height: 58,
    borderRadius: t.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: t.spacing.sm,
    backgroundColor: t.colors.primary,
    ...t.shadows.glow,
  },

  primaryButtonDisabled: {
    opacity: 0.85,
  },

  primaryButtonText: {
    color: t.text.onPrimary,
    fontSize: t.font.size.lg,
    fontWeight: "800",
  },

  footer: {
    marginTop: t.spacing.xl,
    alignItems: "center",
    gap: t.spacing.md,
  },

  link: {
    color: t.text.accent,
    fontSize: t.font.size.md,
    fontWeight: "700",
  },

  footerDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.sm,
    opacity: 0.55,
  },

  footerLine: {
    width: 86,
    height: 1,
    backgroundColor: t.colors.borderStrong,
  },

  footerDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: t.colors.textSecondary,
  },

  secondaryLink: {
    color: t.colors.textMuted,
    fontSize: t.font.size.md,
    fontWeight: "500",
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
    backgroundColor: t.overlays.camera,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: t.spacing.lg,
  },

  loadingCard: {
    width: "100%",
    maxWidth: 260,
    borderRadius: t.radius.xxl,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.borders.default,
    paddingVertical: t.spacing.xl,
    paddingHorizontal: t.spacing.lg,
  },
});