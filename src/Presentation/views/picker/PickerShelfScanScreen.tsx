// src/Presentation/views/picker/PickerShelfScanScreen.tsx
// Escanear el QR de una estantería para ver su contenido. Solo consulta: no
// llama a /receive ni mueve nada. La estantería se busca entre las del
// Warehouse del Picker; una de otro Warehouse no se reconoce.

import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";

import AppTheme from "../../theme/AppTheme";
import { QrScanner } from "../../components/QrScanner";
import { SafeScreen } from "../../components/SafeScreen";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { fetchShelves, matchShelfQr } from "./warehouseApi";
import { PickerHeader, useFocusQuery, warehouseLabel } from "./pickerUi";
import { playScanError, playScanSuccess } from "../../config/ScanSound";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerShelfScanScreen">;

const MESSAGES = {
  not_shelf: "Ese QR no es de una estantería. Escaneá la etiqueta de la estantería.",
  unknown: "Esa estantería no es de tu warehouse o no existe.",
};

export default function PickerShelfScanScreen({ navigation, route }: Props) {
  const focused = useIsFocused();
  const { data, error, loading } = useFocusQuery(fetchShelves);
  const [message, setMessage] = useState<string | null>(null);
  const navigated = useRef(false);
  const warehouseId = data?.warehouse_id ?? route.params.warehouseId;

  const onScan = useCallback(
    async (raw: string) => {
      if (!data || navigated.current) return;
      const result = matchShelfQr(data.shelves, raw);
      if (result.kind !== "shelf") {
        setMessage(MESSAGES[result.kind]);
        playScanError();
        return;
      }
      navigated.current = true;
      playScanSuccess();
      navigation.replace("PickerShelfDetailScreen", { shelfId: result.shelf.id, code: result.shelf.code, warehouseId });
    },
    [data, navigation, warehouseId],
  );

  const hint = loading
    ? "Cargando las estanterías de tu warehouse…"
    : !data
    ? error ?? "No se pudieron cargar las estanterías."
    : message ??
      (route.params.purpose === "move"
        ? "Escaneá la estantería donde está el paquete y tocá «Mover» en él."
        : "Escaneá el QR de la estantería para ver qué tiene.");

  return (
    <SafeScreen>
      <PickerHeader title={route.params.purpose === "move" ? "Mover de estantería" : "Escanear estantería"} subtitle={warehouseLabel(warehouseId)} onBack={() => navigation.goBack()} />
      <View style={styles.camera}>
        <QrScanner active={focused && !!data} onScan={onScan} />
      </View>
      <View style={styles.panel}>
        <Text style={[styles.hint, message || (!loading && !data) ? styles.hintError : null]}>{hint}</Text>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1, minHeight: 180 },
  panel: { padding: AppTheme.spacing.md, minHeight: 96, justifyContent: "center" },
  hint: { color: AppTheme.text.secondary, fontSize: 15, textAlign: "center" },
  hintError: { color: AppTheme.colors.danger },
});
