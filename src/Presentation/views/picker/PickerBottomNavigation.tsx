// src/Presentation/views/picker/PickerBottomNavigation.tsx
// Barra inferior del Picker (Inicio — QR — Alertas), con la misma estética
// que la del chofer. La campana muestra cuántas notificaciones sin ver hay,
// según el servidor.

import React from "react";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BOTTOM_NAVIGATION_SPACE, BottomNavigationBar, BottomNavigationItem } from "../../components/BottomNavigationBar";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { unreadBadge, useUnreadCount } from "./notificationsApi";

export type PickerTabKey = "home" | "scan" | "notifications";

type Props = {
  activeTab: PickerTabKey;
  // Para abrir Recepción con el Warehouse ya identificado.
  warehouseId: number | null;
};

export function PickerBottomNavigation({ activeTab, warehouseId }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<PickerStackParamList>>();
  const insets = useSafeAreaInsets();
  const unread = useUnreadCount();

  const tabs: BottomNavigationItem<PickerTabKey>[] = [
    { key: "home", label: "Inicio", icon: "home-outline" },
    { key: "scan", label: "QR", icon: "qr-code-outline", isPrimary: true },
    { key: "notifications", label: "Alertas", icon: "notifications-outline", badge: unreadBadge(unread) },
  ];

  const onPress = (tab: PickerTabKey) => {
    if (tab === activeTab) return;
    if (tab === "home") navigation.popTo("PickerHomeScreen");
    else if (tab === "scan") navigation.navigate("PickerScanOptionsScreen", { warehouseId });
    else navigation.navigate("PickerNotificationsScreen", { warehouseId });
  };

  return <BottomNavigationBar items={tabs} activeKey={activeTab} onPress={onPress} bottomInset={insets.bottom} />;
}

// Espacio que la pantalla reserva abajo para que la barra no tape el contenido.
export function usePickerBottomSpace() {
  return BOTTOM_NAVIGATION_SPACE + useSafeAreaInsets().bottom;
}
