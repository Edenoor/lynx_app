import React from "react";
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
import PickerColectasScreen from "../views/picker/PickerColectasScreen";
import PickerColectaDetailScreen from "../views/picker/PickerColectaDetailScreen";

export type PickerStackParamList = {
  PickerHomeScreen: undefined;
  PickerScanOptionsScreen: { warehouseId: number | null };
  PickerNotificationsScreen: { warehouseId: number | null };
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
    // Recepción por colecta: cada paquete viaja con colecta_route_id = routeId.
    // date: el día de la lista de colectas (AAAA-MM-DD, Argentina).
    colecta?: { routeId: number; date: string; name: string };
  };
  // Recepción por colecta: lista del día y detalle de una.
  PickerColectasScreen: { warehouseId: number | null };
  PickerColectaDetailScreen: { warehouseId: number | null; routeId: number; date: string; name: string };
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

export const PickerStackNavigator = () => (
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
    <Stack.Screen name="PickerColectasScreen" component={PickerColectasScreen} />
    <Stack.Screen name="PickerColectaDetailScreen" component={PickerColectaDetailScreen} />
  </Stack.Navigator>
);
