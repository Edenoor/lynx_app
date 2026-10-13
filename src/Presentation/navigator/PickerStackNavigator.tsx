import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import PickerHomeScreen from "../views/picker/PickerHomeScreen";
import PickerScanScreen from "../views/picker/PickerScanScreen";

export type PickerStackParamList = {
  PickerHomeScreen: undefined;
  // null: no se pudo ver el ID (el servidor usa igual el Warehouse asignado).
  PickerScanScreen: { warehouseId: number | null };
};

const Stack = createNativeStackNavigator<PickerStackParamList>();

export const PickerStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="PickerHomeScreen" component={PickerHomeScreen} />
    <Stack.Screen name="PickerScanScreen" component={PickerScanScreen} />
  </Stack.Navigator>
);
