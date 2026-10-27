import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  SafeAreaView,
  ImageBackground,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardingStackParamList } from "../navigator/OnboardingStackNavigator";
import { RoundedButton } from "../components/RoundedButton";
import { useThemedStyles } from "../theme/ThemeContext";
import type { Theme } from "../theme/createTheme";
import { ThemedStatusBar } from "../theme/ThemedStatusBar";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Intro">;

const requirements = [
  { number: "01", title: "Selfie de verificación" },
  { number: "02", title: "DNI frente y dorso" },
  { number: "03", title: "Registro frente y dorso" },
  { number: "04", title: "Cédula frente y dorso" },
];

export function IntroScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
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

        <View style={styles.wrap}>
          <View style={styles.header}>
            <Image
              source={require("../../../assets/adaptive-icon-white.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.content}>
            <View style={styles.hero}>
              <Text style={styles.kicker}>LYNX DRIVER</Text>

              <Text style={styles.title}>
                Tu operación,{"\n"}
                <Text style={styles.titleAccent}>sin límites.</Text>
              </Text>

              <Text style={styles.subtitle}>
                Para habilitar tu cuenta necesitamos validar tu identidad y
                documentación.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vas a necesitar</Text>

              <View style={styles.card}>
                {requirements.map((item, index) => (
                  <View
                    key={item.number}
                    style={[
                      styles.item,
                      index !== requirements.length - 1 && styles.itemBorder,
                    ]}
                  >
                    <View style={styles.itemIcon}>
                      <Text style={styles.itemIconText}>{item.number}</Text>
                    </View>

                    <Text style={styles.itemText}>{item.title}</Text>

                    <Text style={styles.chevron}>›</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <RoundedButton
              text="Continuar"
              onPress={() => navigation.navigate("Terms")}
            />

            <Text style={styles.footerText}>
              Tu información está protegida y es confidencial.
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

  wrap: {
    flex: 1,
    paddingHorizontal: t.layout.screenPadding,
    paddingTop: t.layout.headerTopPadding,
    paddingBottom: t.layout.footerPaddingBottom,
  },

  header: {
    alignItems: "center",
    marginBottom: t.spacing.md,
  },

  // Logo blanco teñido con el acento: se ve sobre el fondo claro.
  logo: {
    width: t.sizes.logoLg,
    height: t.sizes.logoLg,
    tintColor: t.text.accent,
  },

  content: {
    flex: 1,
    justifyContent: "center",
    gap: t.spacing.xl,
  },

  hero: {
    gap: t.spacing.md,
  },

  kicker: {
    ...t.typography.kicker,
  },

  title: {
    ...t.typography.titleLg,
  },

  titleAccent: {
    color: t.text.accent,
  },

  subtitle: {
    ...t.typography.body,
    maxWidth: 320,
  },

  section: {
    gap: t.spacing.md,
  },

  sectionTitle: {
    color: t.text.primary,
    fontSize: t.font.size.md,
    fontWeight: t.font.weight.black,
  },

  card: {
    borderRadius: t.radius.xl,
    backgroundColor: t.surfaces.cardStrong,
    borderWidth: 1,
    borderColor: t.borders.strong,
    overflow: "hidden",
  },

  item: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: t.spacing.base,
    gap: t.spacing.md,
  },

  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: t.borders.muted,
  },

  itemIcon: {
    width: t.sizes.iconMd,
    height: t.sizes.iconMd,
    borderRadius: t.radius.md,
    backgroundColor: t.overlays.primary,
    borderWidth: 1,
    borderColor: t.borders.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  itemIconText: {
    color: t.text.accent,
    fontSize: t.font.size.xxs,
    fontWeight: t.font.weight.black,
  },

  itemText: {
    flex: 1,
    color: t.text.primary,
    fontSize: t.font.size.sm,
    fontWeight: t.font.weight.bold,
  },

  chevron: {
    color: t.text.muted,
    fontSize: t.font.size.xl,
    fontWeight: t.font.weight.regular,
    marginTop: -t.spacing.xxs,
  },

  footer: {
    gap: t.spacing.md,
  },

  footerText: {
    ...t.typography.caption,
    textAlign: "center",
  },
});