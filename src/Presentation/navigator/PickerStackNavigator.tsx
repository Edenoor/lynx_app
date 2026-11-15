import React, { useEffect } from "react";
import { createNativeStackNavigator, type NativeStackScreenProps } from "@react-navigation/native-stack";
import { createBottomTabNavigator, type BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps, NavigatorScreenParams } from "@react-navigation/native";

import PickerHomeScreen from "../views/picker/PickerHomeScreen";
import PickerScanScreen from "../views/picker/PickerScanScreen";
import PickerShelvesScreen from "../views/picker/PickerShelvesScreen";
import PickerShelfDetailScreen from "../views/picker/PickerShelfDetailScreen";
import PickerMisplacedScreen from "../views/picker/PickerMisplacedScreen";
import PickerScanOptionsScreen from "../views/picker/PickerScanOptionsScreen";
import PickerNotificationsScreen from "../views/picker/PickerNotificationsScreen";
import PickerShelfScanScreen from "../views/picker/PickerShelfScanScreen";
import PickerBulkyMockScreen from "../views/picker/PickerBulkyMockScreen";
import PickerReportMockScreen from "../views/picker/PickerReportMockScreen";
import PickerMoveShelfScreen from "../views/picker/PickerMoveShelfScreen";
import ChatScreen from "../views/driver/chat/ChatScreen";
import ChatPeopleScreen from "../views/driver/chat/ChatPeopleScreen";
import { backToPickerChatList, resetChatStore } from "../views/driver/chat/chatStore";

// El chat interno del picker: la misma charla que el chofer y el directorio,
// volviendo a la pestaña Mensajes de sus Alertas.
const PickerChatScreen = () => <ChatScreen onBack={backToPickerChatList} />;
const PickerChatPeopleScreen = () => <ChatPeopleScreen chatRoute="PickerChatScreen" onBack={backToPickerChatList} />;

// Las tres pestañas de la barra inferior. Cada una queda montada y recuerda su
// estado; para ir a una desde cualquier pantalla: goToPickerTab (tabNavigation).
// warehouseId falta si se llega sin pasar por Inicio (un push): vale como null.
export type PickerTabParamList = {
  PickerHomeScreen: undefined;
  PickerScanOptionsScreen: { warehouseId?: number | null } | undefined;
  // tab: la pestaña de Alertas que se abre (Mensajes, desde una charla o un push).
  PickerNotificationsScreen: { warehouseId?: number | null; tab?: "notifications" | "messages" } | undefined;
};

export type PickerStackParamList = {
  // El navegador de pestañas; lo demás se apila encima.
  PickerTabs: NavigatorScreenParams<PickerTabParamList> | undefined;
  // Chat interno: una charla y el directorio para empezar una de a uno.
  PickerChatScreen: { conversationId: number; title?: string };
  PickerChatPeopleScreen: undefined;
  // purpose "move": se escanea la estantería de origen para mover un paquete.
  PickerShelfScanScreen: { warehouseId: number | null; purpose?: "move" };
  // Maquetas: no guardan nada.
  PickerBulkyMockScreen: { warehouseId: number | null };
  PickerReportMockScreen: { warehouseId: number | null };
  // warehouseId null: no se pudo ver el ID (el servidor usa igual el
  // Warehouse asignado). target: un descolocado que se va a reubicar.
  PickerScanScreen: {
    warehouseId: number | null;
    target?: { tracking: string | null; expectedShelf: string };
  };
  PickerShelvesScreen: undefined;
  PickerShelfDetailScreen: { shelfId: number; code: string; warehouseId: number | null };
  PickerMisplacedScreen: undefined;
  // deliveryId: id interno del envío (no el tracking).
  PickerMoveShelfScreen: {
    deliveryId: number;
    tracking: string | null;
    fromShelf: { id: number; code: string; name: string | null };
    warehouseId: number | null;
  };
};

// Props de una pantalla-pestaña: navega entre pestañas y también apila
// pantallas del stack.
export type PickerTabScreenProps<K extends keyof PickerTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<PickerTabParamList, K>,
  NativeStackScreenProps<PickerStackParamList>
>;

const Stack = createNativeStackNavigator<PickerStackParamList>();
const Tab = createBottomTabNavigator<PickerTabParamList>();

// La barra la dibuja cada pantalla (PickerBottomNavigation). Atrás desde una
// pestaña vuelve a Inicio y desde Inicio sale de la app.
const noTabBar = () => null;
const PickerTabs = () => (
  <Tab.Navigator initialRouteName="PickerHomeScreen" backBehavior="firstRoute" tabBar={noTabBar} screenOptions={{ headerShown: false }}>
    <Tab.Screen name="PickerHomeScreen" component={PickerHomeScreen} />
    <Tab.Screen name="PickerScanOptionsScreen" component={PickerScanOptionsScreen} />
    <Tab.Screen name="PickerNotificationsScreen" component={PickerNotificationsScreen} />
  </Tab.Navigator>
);

export const PickerStackNavigator = () => {
  // Al cerrar sesión: los no leídos del chat no son del próximo usuario.
  useEffect(() => () => resetChatStore(), []);
  return (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="PickerTabs" component={PickerTabs} />
    <Stack.Screen name="PickerShelfScanScreen" component={PickerShelfScanScreen} />
    <Stack.Screen name="PickerBulkyMockScreen" component={PickerBulkyMockScreen} />
    <Stack.Screen name="PickerReportMockScreen" component={PickerReportMockScreen} />
    <Stack.Screen name="PickerScanScreen" component={PickerScanScreen} />
    <Stack.Screen name="PickerShelvesScreen" component={PickerShelvesScreen} />
    <Stack.Screen name="PickerShelfDetailScreen" component={PickerShelfDetailScreen} />
    <Stack.Screen name="PickerMisplacedScreen" component={PickerMisplacedScreen} />
    <Stack.Screen name="PickerMoveShelfScreen" component={PickerMoveShelfScreen} />
    <Stack.Screen name="PickerChatScreen" component={PickerChatScreen} getId={({ params }) => String(params.conversationId)} />
    <Stack.Screen name="PickerChatPeopleScreen" component={PickerChatPeopleScreen} />
  </Stack.Navigator>
  );
};
