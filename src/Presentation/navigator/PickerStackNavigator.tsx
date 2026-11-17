import React, { useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

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
import PickerBaulScreen from "../views/picker/PickerBaulScreen";
import PickerBaulDriverScreen from "../views/picker/PickerBaulDriverScreen";
import PickerBaulScanScreen from "../views/picker/PickerBaulScanScreen";
import ChatScreen from "../views/driver/chat/ChatScreen";
import ChatPeopleScreen from "../views/driver/chat/ChatPeopleScreen";
import { backToPickerChatList, resetChatStore } from "../views/driver/chat/chatStore";

// El chat interno del picker: la misma charla que el chofer y el directorio,
// volviendo a la pestaña Mensajes de sus Alertas.
const PickerChatScreen = () => <ChatScreen onBack={backToPickerChatList} />;
const PickerChatPeopleScreen = () => <ChatPeopleScreen chatRoute="PickerChatScreen" onBack={backToPickerChatList} />;

export type PickerStackParamList = {
  PickerHomeScreen: undefined;
  PickerScanOptionsScreen: { warehouseId: number | null };
  // tab: la pestaña de Alertas que se abre (Mensajes, desde una charla o un push).
  PickerNotificationsScreen: { warehouseId: number | null; tab?: "notifications" | "messages" };
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
  // Baúl de los choferes (lo que entregan en el depósito del Picker).
  PickerBaulScreen: undefined;
  PickerBaulDriverScreen: { driverId: number; name: string };
  // driverId: abierto desde un chofer, solo se confirma lo suyo.
  PickerBaulScanScreen: { driverId?: number; name?: string };
};

const Stack = createNativeStackNavigator<PickerStackParamList>();

export const PickerStackNavigator = () => {
  // Al cerrar sesión: los no leídos del chat no son del próximo usuario.
  useEffect(() => () => resetChatStore(), []);
  return (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="PickerHomeScreen" component={PickerHomeScreen} />
    <Stack.Screen name="PickerScanOptionsScreen" component={PickerScanOptionsScreen} />
    <Stack.Screen name="PickerNotificationsScreen" component={PickerNotificationsScreen} />
    <Stack.Screen name="PickerShelfScanScreen" component={PickerShelfScanScreen} />
    <Stack.Screen name="PickerBulkyMockScreen" component={PickerBulkyMockScreen} />
    <Stack.Screen name="PickerReportMockScreen" component={PickerReportMockScreen} />
    <Stack.Screen name="PickerScanScreen" component={PickerScanScreen} />
    <Stack.Screen name="PickerShelvesScreen" component={PickerShelvesScreen} />
    <Stack.Screen name="PickerShelfDetailScreen" component={PickerShelfDetailScreen} />
    <Stack.Screen name="PickerMisplacedScreen" component={PickerMisplacedScreen} />
    <Stack.Screen name="PickerMoveShelfScreen" component={PickerMoveShelfScreen} />
    <Stack.Screen name="PickerBaulScreen" component={PickerBaulScreen} />
    <Stack.Screen name="PickerBaulDriverScreen" component={PickerBaulDriverScreen} />
    <Stack.Screen name="PickerBaulScanScreen" component={PickerBaulScanScreen} />
    <Stack.Screen name="PickerChatScreen" component={PickerChatScreen} getId={({ params }) => String(params.conversationId)} />
    <Stack.Screen name="PickerChatPeopleScreen" component={PickerChatPeopleScreen} />
  </Stack.Navigator>
  );
};
