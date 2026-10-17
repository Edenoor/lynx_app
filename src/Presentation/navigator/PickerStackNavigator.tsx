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

export type PickerStackParamList = {
  PickerHomeScreen: undefined;
  PickerScanOptionsScreen: { warehouseId: number | null };
  PickerNotificationsScreen: { warehouseId: number | null };
  PickerShelfScanScreen: { warehouseId: number | null };
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
  </Stack.Navigator>
);
