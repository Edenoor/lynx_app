// src/Presentation/views/picker/PickerBottomNavigation.tsx
// Barra inferior del Picker (Inicio — QR — Alertas), con la misma estética
// que la del chofer. La campana suma las notificaciones sin ver y los
// mensajes del chat sin leer (las dos pestañas de Alertas), según el servidor.

import React from "react";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BOTTOM_NAVIGATION_SPACE, BottomNavigationBar, BottomNavigationItem } from "../../components/BottomNavigationBar";
import { goToPickerTab } from "../../navigator/tabNavigation";
import { alertsBadge, useUnreadCount } from "./notificationsApi";
import { useChatUnread } from "../driver/chat/chatStore";

export type PickerTabKey = "home" | "scan" | "notifications";

type Props = {
  activeTab: PickerTabKey;
  // Para abrir Recepción con el Warehouse ya identificado.
  warehouseId: number | null;
};

export function PickerBottomNavigation({ activeTab, warehouseId }: Props) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const unread = useUnreadCount();
  const chatUnread = useChatUnread();

  const tabs: BottomNavigationItem<PickerTabKey>[] = [
    { key: "home", label: "Inicio", icon: "home-outline" },
    { key: "scan", label: "QR", icon: "qr-code-outline", isPrimary: true },
    { key: "notifications", label: "Alertas", icon: "notifications-outline", badge: alertsBadge(unread, chatUnread) },
  ];

  const onPress = (tab: PickerTabKey) => {
    if (tab === activeTab) return;
    // Cada pestaña queda montada: se vuelve a ella, no se apila otra.
    if (tab === "home") goToPickerTab(navigation, "PickerHomeScreen");
    else if (tab === "scan") goToPickerTab(navigation, "PickerScanOptionsScreen", { warehouseId });
    else goToPickerTab(navigation, "PickerNotificationsScreen", { warehouseId });
  };

  return <BottomNavigationBar items={tabs} activeKey={activeTab} onPress={onPress} bottomInset={insets.bottom} />;
}

// Espacio que la pantalla reserva abajo para que la barra no tape el contenido.
export function usePickerBottomSpace() {
  return BOTTOM_NAVIGATION_SPACE + useSafeAreaInsets().bottom;
}
