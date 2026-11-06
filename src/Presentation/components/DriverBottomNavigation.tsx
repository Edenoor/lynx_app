import React from "react";
import { useNavigation } from "@react-navigation/native";
import { BottomNavigationBar, BottomNavigationItem } from "./BottomNavigationBar";
import { useOfferCount } from "../views/driver/offers/offerStore";

// Perfil se abre desde Inicio (arriba a la derecha); los recorridos de reparto,
// desde Envíos. Alertas lleva el contador de ofertas sin contestar (la bandeja
// es su pestaña «Ofertas»).
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
  const offerCount = useOfferCount();
  const items = offerCount ? tabs.map((t) => (t.key === "activity" ? { ...t, badge: offerCount > 99 ? "99+" : String(offerCount) } : t)) : tabs;
  const handlePress = (tab: DriverTabKey) => {
    if (tab === "collections") {
      if (activeTab !== "collections") navigation.navigate("CollectionsScreen");
      return;
    }
    onPress(tab);
  };
  return <BottomNavigationBar items={items} activeKey={activeTab} onPress={handlePress} />;
}

export default DriverBottomNavigation;
