import React from "react";
import { useNavigation } from "@react-navigation/native";
import { BottomNavigationBar, BottomNavigationItem } from "./BottomNavigationBar";
import { useOfferCount } from "../views/driver/offers/offerStore";
import { goToDriverTab } from "../navigator/driverTabs";
import { useChatUnread } from "../views/driver/chat/chatStore";

// Perfil se abre desde Inicio (arriba a la derecha); los recorridos de reparto,
// desde Envíos. Alertas lleva el contador de ofertas sin contestar y de
// mensajes sin leer (la bandeja y los chats son sus pestañas «Ofertas» y
// «Mensajes»).
export type DriverTabKey =
  | "home"
  | "deliveries"
  | "scan"
  | "collections"
  | "activity";

type DriverBottomNavigationProps = {
  activeTab: DriverTabKey;
  // Lo que la pantalla tiene que hacer antes de que la barra navegue (el
  // escáner cierra la cámara; Alertas vuelve a su pestaña de avisos).
  onPress?: (tab: DriverTabKey) => void;
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
  // La barra cambia de sección (driverTabs.ts): sin acumular historial y, en
  // un detalle, la pestaña activa vuelve a la raíz de su sección. Antes se le
  // avisa a la pantalla (onPress).
  const navigation = useNavigation<any>();
  const offerCount = useOfferCount();
  // Los dos números los piden Inicio y Envíos (y el chat, al leer): la barra no suma pedidos.
  const chatUnread = useChatUnread();
  const pending = (offerCount ?? 0) + (chatUnread ?? 0);
  const items = pending ? tabs.map((t) => (t.key === "activity" ? { ...t, badge: pending > 99 ? "99+" : String(pending) } : t)) : tabs;
  const handlePress = (tab: DriverTabKey) => {
    onPress?.(tab);
    goToDriverTab(navigation, tab);
  };
  return <BottomNavigationBar items={items} activeKey={activeTab} onPress={handlePress} />;
}

export default DriverBottomNavigation;
