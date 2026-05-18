import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { StackScreenProps } from "@react-navigation/stack";
import { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import global from "../../../theme/global";

type Props = StackScreenProps<DriverStackParamList, "DriverScanScreen">;

const TITLES: Record<NonNullable<Props["route"]["params"]>["mode"], string> = {
  colecta: "Escaneo de Colecta",
  planta: "Escaneo En Planta",
  asignarme: "Escaneo para Asignarme",
};

const HINTS: Record<NonNullable<Props["route"]["params"]>["mode"], string> = {
  colecta: "Escaneá el QR del envío para marcarlo como RETIRADO (más adelante).",
  planta: "Escaneá el QR del envío para marcarlo EN PLANTA (más adelante).",
  asignarme: "Escaneá el QR del envío para asignártelo (más adelante).",
};

export default function DriverScanScreen({ navigation, route }: Props) {
  const mode = route.params.mode;
  const title = useMemo(() => TITLES[mode], [mode]);
  const hint = useMemo(() => HINTS[mode], [mode]);

  const [permission, requestPermission] = useCameraPermissions();
  const [open, setOpen] = useState(true);
  const [scanned, setScanned] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    navigation.goBack();
  }, [navigation]);

  const ensurePermission = useCallback(async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert("Permiso requerido", "Necesitamos acceso a la cámara para escanear.");
        close();
        return false;
      }
    }
    return true;
  }, [permission?.granted, requestPermission, close]);

  const onBarcodeScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (scanned) return;
      setScanned(true);

      const data = String(result.data ?? "");

      // Por ahora no pegamos a backend: solo mostramos el QR leído + modo
      setTimeout(() => {
        Alert.alert(
          "QR leído ✅",
          `Modo: ${mode}\n\nContenido:\n${data || "(vacío)"}`
        );
        setScanned(false);
        close();
      }, 150);
    },
    [scanned, mode, close]
  );

  // Pedimos permiso al abrir
  React.useEffect(() => {
    ensurePermission();
  }, [ensurePermission]);

  return (
    <Modal visible={open} animationType="slide" onRequestClose={close}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{hint}</Text>
          </View>
          <Pressable onPress={close} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Cerrar</Text>
          </Pressable>
        </View>

        {!permission ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Cargando permisos…</Text>
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              onBarcodeScanned={onBarcodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            />
            <View pointerEvents="none" style={styles.overlay}>
              <View style={styles.frame} />
              <Text style={styles.overlayText}>Alineá el QR dentro del recuadro</Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#111",
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 4 },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#222",
  },
  closeBtnText: { color: "#fff", fontWeight: "800" },
  cameraWrap: { flex: 1, position: "relative" },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  frame: {
    width: 260,
    height: 260,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  overlayText: { color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "700" },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: "#fff" },
});
