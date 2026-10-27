import React from "react";
import { useNavigation } from "@react-navigation/native";
import { BottomNavigationBar, BottomNavigationItem } from "./BottomNavigationBar";

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
  return <BottomNavigationBar items={tabs} activeKey={activeTab} onPress={handlePress} />;
}

export default DriverBottomNavigation;
