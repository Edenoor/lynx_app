import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  SafeAreaView,
  StatusBar,
  ImageBackground,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardingStackParamList } from "../navigator/OnboardingStackNavigator";
import { RoundedButton } from "../components/RoundedButton";
import AppTheme from "../theme/AppTheme";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Intro">;

const requirements = [
  { number: "01", title: "Selfie de verificación" },
  { number: "02", title: "DNI frente y dorso" },
  { number: "03", title: "Registro frente y dorso" },
  { number: "04", title: "Cédula frente y dorso" },
];

export function IntroScreen({ navigation }: Props) {
  return (
    <ImageBackground
      source={require("../../../assets/background-1.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safe}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={AppTheme.surfaces.screen}
        />

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

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: AppTheme.surfaces.screen,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: AppTheme.overlays.background,
  },

  safe: {
    flex: 1,
  },

  wrap: {
    flex: 1,
    paddingHorizontal: AppTheme.layout.screenPadding,
    paddingTop: AppTheme.layout.headerTopPadding,
    paddingBottom: AppTheme.layout.footerPaddingBottom,
  },

  header: {
    alignItems: "center",
    marginBottom: AppTheme.spacing.md,
  },

  logo: {
    width: AppTheme.sizes.logoLg,
    height: AppTheme.sizes.logoLg,
  },

  content: {
    flex: 1,
    justifyContent: "center",
    gap: AppTheme.spacing.xl,
  },

  hero: {
    gap: AppTheme.spacing.md,
  },

  kicker: {
    ...AppTheme.typography.kicker,
  },

  title: {
    ...AppTheme.typography.titleLg,
  },

  titleAccent: {
    color: AppTheme.text.accent,
  },

  subtitle: {
    ...AppTheme.typography.body,
    maxWidth: 320,
  },

  section: {
    gap: AppTheme.spacing.md,
  },

  sectionTitle: {
    color: AppTheme.text.primary,
    fontSize: AppTheme.font.size.md,
    fontWeight: AppTheme.font.weight.black,
  },

  card: {
    borderRadius: AppTheme.radius.xl,
    backgroundColor: AppTheme.surfaces.cardStrong,
    borderWidth: 1,
    borderColor: AppTheme.borders.strong,
    overflow: "hidden",
  },

  item: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: AppTheme.spacing.base,
    gap: AppTheme.spacing.md,
  },

  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.borders.muted,
  },

  itemIcon: {
    width: AppTheme.sizes.iconMd,
    height: AppTheme.sizes.iconMd,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.overlays.primary,
    borderWidth: 1,
    borderColor: AppTheme.borders.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  itemIconText: {
    color: AppTheme.text.accent,
    fontSize: AppTheme.font.size.xxs,
    fontWeight: AppTheme.font.weight.black,
  },

  itemText: {
    flex: 1,
    color: AppTheme.text.primary,
    fontSize: AppTheme.font.size.sm,
    fontWeight: AppTheme.font.weight.bold,
  },

  chevron: {
    color: AppTheme.text.muted,
    fontSize: AppTheme.font.size.xl,
    fontWeight: AppTheme.font.weight.regular,
    marginTop: -AppTheme.spacing.xxs,
  },

  footer: {
    gap: AppTheme.spacing.md,
  },

  footerText: {
    ...AppTheme.typography.caption,
    textAlign: "center",
  },
});