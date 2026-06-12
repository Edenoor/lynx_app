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
import global from "../../../theme/global";

type Props = NativeStackScreenProps<RootStackParamList, "HomeScreen">;

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
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
              placeholderTextColor={global.COLORS.placeholder}
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
              placeholderTextColor={global.COLORS.placeholder}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: global.COLORS.background,
  },

  content: {
    flex: 1,
    paddingHorizontal: global.SPACING.lg,
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
    backgroundColor: "rgba(255,255,255,0.045)",
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
    backgroundColor: global.COLORS.primary,
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
    backgroundColor: global.COLORS.primary,
    opacity: 0.7,
  },

  header: {
    alignItems: "center",
    marginBottom: global.SPACING.xl,
  },

  logo: {
    width: 104,
    height: 104,
    marginBottom: global.SPACING.sm,
  },

  brand: {
    color: global.COLORS.text,
    fontSize: global.FONT.size.xl,
    fontWeight: "900",
    letterSpacing: 9,
    marginBottom: global.SPACING.xl,
  },

  title: {
    color: global.COLORS.text,
    fontSize: global.FONT.size.xxl,
    fontWeight: "400",
    letterSpacing: -0.8,
  },

  titleAccent: {
    color: global.COLORS.primary,
    fontWeight: "800",
  },

  subtitle: {
    color: global.COLORS.textMuted,
    fontSize: global.FONT.size.md,
    marginTop: global.SPACING.sm,
  },

  formPanel: {
    borderRadius: global.BORDER_RADIUS.xl,
    backgroundColor: global.COLORS.card,
    borderWidth: 1,
    borderColor: global.COLORS.borderStrong,
    padding: global.SPACING.lg,
    gap: global.SPACING.md,
    ...global.SHADOWS.card,
  },

  inputGroup: {
    gap: global.SPACING.sm,
  },

  label: {
    color: global.COLORS.textSecondary,
    fontSize: global.FONT.size.md,
    fontWeight: "500",
  },

  input: {
    height: 54,
    borderRadius: global.BORDER_RADIUS.lg,
    backgroundColor: global.COLORS.input,
    borderWidth: 1,
    borderColor: global.COLORS.border,
    color: global.COLORS.text,
    fontSize: global.FONT.size.md,
    paddingHorizontal: global.SPACING.md,
  },

  separator: {
    height: 1,
    backgroundColor: global.COLORS.border,
    opacity: 0.5,
  },

  primaryButton: {
    height: 58,
    borderRadius: global.BORDER_RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: global.SPACING.sm,
    backgroundColor: global.COLORS.primary,
    ...global.SHADOWS.glow,
  },

  primaryButtonDisabled: {
    opacity: 0.85,
  },

  primaryButtonText: {
    color: global.COLORS.white,
    fontSize: global.FONT.size.lg,
    fontWeight: "800",
  },

  footer: {
    marginTop: global.SPACING.xl,
    alignItems: "center",
    gap: global.SPACING.md,
  },

  link: {
    color: global.COLORS.primarySoft,
    fontSize: global.FONT.size.md,
    fontWeight: "700",
  },

  footerDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: global.SPACING.sm,
    opacity: 0.55,
  },

  footerLine: {
    width: 86,
    height: 1,
    backgroundColor: global.COLORS.borderStrong,
  },

  footerDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: global.COLORS.textSecondary,
  },

  secondaryLink: {
    color: global.COLORS.textMuted,
    fontSize: global.FONT.size.md,
    fontWeight: "500",
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
    backgroundColor: "rgba(5, 8, 14, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: global.SPACING.lg,
  },

  loadingCard: {
    width: "100%",
    maxWidth: 260,
    borderRadius: global.BORDER_RADIUS.xxl,
    backgroundColor: global.COLORS.cardElevated,
    borderWidth: 1,
    borderColor: global.COLORS.borderStrong,
    paddingVertical: global.SPACING.xl,
    paddingHorizontal: global.SPACING.lg,
    ...global.SHADOWS.card,
  },
});