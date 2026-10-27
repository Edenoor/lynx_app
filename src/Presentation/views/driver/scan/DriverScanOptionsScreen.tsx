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

import { useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import DriverBottomNavigation, { DriverTabKey } from "../../../components/DriverBottomNavigation";
import DriverQrActionGrid from "../../../components/DriverQrActionGrid";
import type { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import { LYNX_COLLECT_ENABLED, showCollectInLightData } from "../collectionMode";

type Props = NativeStackScreenProps<
  DriverStackParamList,
  "DriverScanOptionsScreen"
>;

export default function DriverScanOptionsScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const handleTabPress = (tab: DriverTabKey) => {
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
      <ThemedStatusBar />
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
                LYNX_COLLECT_ENABLED
                  ? navigation.navigate("DriverScanScreen", { mode: "colecta" })
                  : showCollectInLightData()
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

const makeStyles = (t: Theme) => StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: t.colors.background,
  },

  backgroundImage: {
    opacity: t.backdrop.imageOpacity,
  },

  safeArea: {
    flex: 1,
  },

  page: {
    flex: 1,
    paddingHorizontal: t.layout.screenPadding,
    paddingTop: t.spacing.lg,
    paddingBottom: 112,
  },

  header: {
    marginBottom: t.spacing.xl,
    paddingTop: t.spacing.lg,
  },


  headerText: {
    gap: t.spacing.xs,
  },

  eyebrow: {
    color: t.text.accent,
    fontSize: t.font.size.sm,
    fontWeight: t.font.weight.black,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  title: {
    color: t.text.primary,
    fontSize: t.font.size.xxl,
    fontWeight: t.font.weight.black,
  },

  subtitle: {
    color: t.text.secondary,
    fontSize: t.font.size.md,
    lineHeight: 22,
  },

  content: {
    marginTop: t.spacing.md,
  },
});