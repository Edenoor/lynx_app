import React from "react";
import { useNavigation } from "@react-navigation/native";
import { BottomNavigationBar, BottomNavigationItem } from "./BottomNavigationBar";

export type DriverTabKey =
  | "home"
  | "deliveries"
  | "scan"
  | "routes"
  | "activity"
  | "profile";

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
    key: "routes",
    label: "Rutas",
    icon: "map-outline",
  },
  {
    key: "activity",
    label: "Alertas",
    icon: "notifications-outline",
  },
  {
    key: "profile",
    label: "Perfil",
    icon: "person-outline",
  },
];

export function DriverBottomNavigation({
  activeTab,
  onPress,
}: DriverBottomNavigationProps) {
  // "Rutas" navega desde acá para no tocar el handler de cada pantalla.
  const navigation = useNavigation<any>();
  const handlePress = (tab: DriverTabKey) => {
    if (tab === "routes") {
      if (activeTab !== "routes") navigation.navigate("RoutesScreen");
      return;
    }
    onPress(tab);
  };
  return <BottomNavigationBar items={tabs} activeKey={activeTab} onPress={handlePress} />;
}

export default DriverBottomNavigation;
