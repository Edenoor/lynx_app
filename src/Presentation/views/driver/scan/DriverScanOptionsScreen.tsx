import React from "react";
import {
  ImageBackground,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../../theme/AppTheme";
import DriverBottomNavigation from "../../../components/DriverBottomNavigation";
import DriverQrActionGrid from "../../../components/DriverQrActionGrid";
import type { DriverStackParamList } from "../../../navigator/DriverStackNavigator";

type Props = NativeStackScreenProps<
  DriverStackParamList,
  "DriverScanOptionsScreen"
>;

export default function DriverScanOptionsScreen({ navigation }: Props) {
  const handleTabPress = (
    tab: "home" | "deliveries" | "scan" | "activity" | "profile"
  ) => {
    switch (tab) {
      case "home":
        navigation.navigate("DriverScreen");
        break;
      case "deliveries":
        navigation.navigate("EnviosScreen");
        break;
      case "scan":
        break;
      case "activity":
        navigation.navigate("NotificationsScreen");
        break;
      case "profile":
        navigation.navigate("DriverAccountScreen");
        break;
      default:
        break;
    }
  };

  return (
    <ImageBackground
      source={require("../../../../../assets/background-1.png")}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.page}>
          <View style={styles.header}>


            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>Escaneo QR</Text>
              <Text style={styles.title}>¿Qué querés hacer?</Text>
              <Text style={styles.subtitle}>
                Elegí el tipo de operación antes de abrir la cámara.
              </Text>
            </View>
          </View>

          <View style={styles.content}>
            <DriverQrActionGrid
              pendingCount={0}
              onCollect={() =>
                navigation.navigate("DriverScanScreen", { mode: "colecta" })
              }
              onAssign={() =>
                navigation.navigate("DriverScanScreen", { mode: "asignarme" })
              }
              onPlant={() =>
                navigation.navigate("DriverScanScreen", { mode: "planta" })
              }
              onPending={() => navigation.navigate("EnviosScreen")}
            />
          </View>
        </View>

        <DriverBottomNavigation activeTab="scan" onPress={handleTabPress} />
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
  },

  backgroundImage: {
    opacity: 0.18,
  },

  safeArea: {
    flex: 1,
  },

  page: {
    flex: 1,
    paddingHorizontal: AppTheme.layout.screenPadding,
    paddingTop: AppTheme.spacing.lg,
    paddingBottom: 112,
  },

  header: {
    marginBottom: AppTheme.spacing.xl,
    paddingTop: AppTheme.spacing.lg,
  },


  headerText: {
    gap: AppTheme.spacing.xs,
  },

  eyebrow: {
    color: AppTheme.text.accent,
    fontSize: AppTheme.font.size.sm,
    fontWeight: AppTheme.font.weight.black,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  title: {
    color: AppTheme.text.primary,
    fontSize: AppTheme.font.size.xxl,
    fontWeight: AppTheme.font.weight.black,
  },

  subtitle: {
    color: AppTheme.text.secondary,
    fontSize: AppTheme.font.size.md,
    lineHeight: 22,
  },

  content: {
    marginTop: AppTheme.spacing.md,
  },
});