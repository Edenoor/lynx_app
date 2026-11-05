import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BottomNavigationBar, BottomNavigationItem, BOTTOM_NAVIGATION_SPACE } from "./BottomNavigationBar";
import { useAppTheme, useThemedStyles } from "../theme/ThemeContext";
import type { Theme } from "../theme/createTheme";

// Perfil se abre desde Inicio (arriba a la derecha); los recorridos de reparto
// y las ofertas, desde Envíos.
export type DriverTabKey =
  | "home"
  | "deliveries"
  | "scan"
  | "collections"
  | "activity";

type DriverBottomNavigationProps = {
  activeTab: DriverTabKey;
  onPress: (tab: DriverTabKey) => void;
};

const tabs: BottomNavigationItem<DriverTabKey>[] = [
  {
    key: "home",
    label: "Inicio",
    icon: "home-outline",
  },
  {
    key: "deliveries",
    label: "Envíos",
    icon: "cube-outline",
  },
  {
    key: "scan",
    label: "QR",
    icon: "qr-code-outline",
    isPrimary: true,
  },
  {
    key: "collections",
    label: "Colectas",
    icon: "storefront-outline",
  },
  {
    key: "activity",
    label: "Alertas",
    icon: "notifications-outline",
  },
];

export function DriverBottomNavigation({
  activeTab,
  onPress,
}: DriverBottomNavigationProps) {
  // "Colectas" navega desde acá para no tocar el handler de cada pantalla.
  const navigation = useNavigation<any>();
  const handlePress = (tab: DriverTabKey) => {
    if (tab === "collections") {
      if (activeTab !== "collections") navigation.navigate("CollectionsScreen");
      return;
    }
    onPress(tab);
  };
  return (
    <>
      {/* En QR no: tapa el visor y los botones del escáner. */}
      {activeTab !== "scan" ? <AssistantButton onPress={() => navigation.navigate("DriverHelpScreen")} /> : null}
      <BottomNavigationBar items={tabs} activeKey={activeTab} onPress={handlePress} />
    </>
  );
}

// Ícono flotante del asistente de ayuda, sobre la barra, abajo a la derecha.
function AssistantButton({ onPress }: { onPress: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={styles.assistant}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Asistente de ayuda"
    >
      <MaterialCommunityIcons name="robot-happy-outline" size={28} color={theme.text.onPrimary} />
    </Pressable>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  assistant: {
    position: "absolute",
    right: t.layout.screenPaddingCompact + 4,
    bottom: BOTTOM_NAVIGATION_SPACE,
    width: 56,
    height: 56,
    borderRadius: t.radius.full,
    backgroundColor: t.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 41,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});

export default DriverBottomNavigation;
