import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ImageBackground,
  Pressable,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardingStackParamList } from "../navigator/OnboardingStackNavigator";
import { useOnboarding } from "../onboarding/OnboardingContext";
import { RoundedButton } from "../components/RoundedButton";
import { useThemedStyles } from "../theme/ThemeContext";
import type { Theme } from "../theme/createTheme";
import { ThemedStatusBar } from "../theme/ThemedStatusBar";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Terms">;

export function TermsScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { dispatch } = useOnboarding();
  const [accepted, setAccepted] = useState(false);

  const accept = () => {
    if (!accepted) return;

    dispatch({ type: "ACCEPT_TERMS", value: true });
    navigation.navigate("Vehicle");
  };

  return (
    <ImageBackground
      source={require("../../../assets/background-1.png")}
      style={styles.background}
      resizeMode="cover"
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safe}>
        <ThemedStatusBar />

        <View style={styles.screen}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.kicker}>VALIDACIÓN</Text>
              <Text style={styles.title}>Términos y condiciones</Text>
              <Text style={styles.subtitle}>
                Antes de continuar, necesitamos que aceptes las condiciones de
                uso para operar como conductor en Lynx.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Resumen importante</Text>

              <View style={styles.item}>
                <Text style={styles.itemNumber}>01</Text>
                <Text style={styles.itemText}>
                  La documentación enviada será utilizada para validar tu
                  identidad y habilitar tu cuenta.
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.item}>
                <Text style={styles.itemNumber}>02</Text>
                <Text style={styles.itemText}>
                  La información debe ser real, vigente y coincidir con los
                  datos del conductor registrado.
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.item}>
                <Text style={styles.itemNumber}>03</Text>
                <Text style={styles.itemText}>
                  Lynx podrá revisar, aprobar o rechazar la documentación antes
                  de habilitar viajes.
                </Text>
              </View>
            </View>

            <View style={styles.termsBox}>
              <Text style={styles.termsTitle}>Términos completos</Text>
              <Text style={styles.termsText}>
                Placeholder: aquí se incorporarán los términos y condiciones
                definitivos. Por ahora, el objetivo es guardar la aceptación y
                permitir continuar con el alta del conductor.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={styles.checkboxRow}
              onPress={() => setAccepted((current) => !current)}
            >
              <View
                style={[
                  styles.checkbox,
                  accepted && styles.checkboxActive,
                ]}
              >
                {accepted && <Text style={styles.checkmark}>✓</Text>}
              </View>

              <Text style={styles.checkboxText}>
                Acepto los términos y condiciones de uso de Lynx.
              </Text>
            </Pressable>

            <View style={!accepted && styles.disabledButton}>
              <RoundedButton
                text={accepted ? "Acepto y continúo" : "Aceptar para continuar"}
                onPress={accept}
                disabled={!accepted}
              />
            </View>

            <Text style={styles.footerText}>
              Podrás revisar esta información nuevamente más adelante.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  // Imagen de fondo como en las pantallas del chofer: tenue y solo en Classic.
  backgroundImage: {
    opacity: t.backdrop.imageOpacity,
  },
  background: {
    flex: 1,
    backgroundColor: t.surfaces.screen,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.overlays.background,
  },
  safe: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 44,
    paddingBottom: 24,
    gap: 22,
  },

  header: {
    gap: 10,
  },
  kicker: {
    color: t.text.accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
  },
  title: {
    color: t.text.primary,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -1.1,
  },
  subtitle: {
    color: t.text.secondary,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    maxWidth: 340,
  },

  card: {
    borderRadius: 24,
    backgroundColor: t.surfaces.cardStrong,
    borderWidth: 1,
    borderColor: t.borders.strong,
    padding: 18,
    gap: 14,
  },
  cardTitle: {
    color: t.text.primary,
    fontSize: 17,
    fontWeight: "900",
  },
  item: {
    flexDirection: "row",
    gap: 12,
  },
  itemNumber: {
    width: 34,
    color: t.text.accent,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  itemText: {
    flex: 1,
    color: t.text.secondary,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: t.separator.color,
  },

  termsBox: {
    borderRadius: 22,
    backgroundColor: t.surfaces.card,
    borderWidth: 1,
    borderColor: t.borders.default,
    padding: 18,
    gap: 8,
  },
  termsTitle: {
    color: t.text.primary,
    fontSize: 15,
    fontWeight: "900",
  },
  termsText: {
    color: t.text.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
  },

  footer: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 14,
    backgroundColor: t.surfaces.footer,
    borderTopWidth: 1,
    borderTopColor: t.borders.muted,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: t.borders.strong,
    backgroundColor: t.surfaces.card,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
  checkmark: {
    color: t.text.onPrimary,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 18,
  },
  checkboxText: {
    flex: 1,
    color: t.text.secondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.45,
  },
  footerText: {
    color: t.text.muted,
    fontSize: 12,
    textAlign: "center",
    fontWeight: "600",
  },
});