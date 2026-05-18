import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import global from "../../../theme/global";

export const EnvioTurboScreen = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastQr, setLastQr] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);

  const openScanner = useCallback(async () => {
    // Pedimos permiso al abrir (más simple de testear)
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert("Permiso requerido", "Necesitamos acceso a la cámara para escanear el QR.");
        return;
      }
    }

    setScanned(false);
    setScannerOpen(true);
  }, [permission?.granted, requestPermission]);

  const closeScanner = useCallback(() => {
    setScannerOpen(false);
    setScanned(false);
  }, []);

  const onBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (scanned) return;
      setScanned(true);

      const data = String(result.data ?? "");
      setLastQr(data);

      // Cerramos el modal y mostramos el resultado
      setTimeout(() => {
        setScannerOpen(false);
        Alert.alert("QR leído ✅", data.length ? data : "(vacío)");
        setScanned(false);
      }, 150);
    },
    [scanned]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nuevo Envío Turbo</Text>
      <Text style={styles.subtitle}>Envíos en menos de 2hs</Text>

      {/* Acá podés dejar tus inputs reales si los tenías (dirección, etc).
          Este archivo antes estaba muy básico; lo mantengo simple para no romper nada. */}

      <TouchableOpacity style={styles.button} onPress={() => Alert.alert("Continuar", "Luego conectamos esto al flujo real.")}>
        <Text style={styles.buttonText}>Continuar</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.qrButton} onPress={openScanner}>
        <Text style={styles.qrText}>📷 Escanear QR</Text>
        {lastQr ? <Text style={styles.qrHint}>Último QR: {truncate(lastQr, 38)}</Text> : null}
      </TouchableOpacity>

      <Modal visible={scannerOpen} animationType="slide" onRequestClose={closeScanner}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Escanear QR</Text>
            <Pressable onPress={closeScanner} style={styles.closeBtn}>
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
                barcodeScannerSettings={{
                  barcodeTypes: ["qr"],
                }}
              />

              {/* Overlay simple (cuadro) */}
              <View pointerEvents="none" style={styles.overlay}>
                <View style={styles.scanFrame} />
                <Text style={styles.overlayText}>Alineá el QR dentro del recuadro</Text>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: global.COLORS.background,
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: global.FONT.size.xl,
    fontWeight: "bold",
    color: global.COLORS.text,
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: global.FONT.size.md,
    color: global.COLORS.gray,
    textAlign: "center",
    marginBottom: 30,
  },
  button: {
    backgroundColor: global.COLORS.primary,
    padding: 15,
    borderRadius: global.BORDER_RADIUS.md,
    marginBottom: 28,
  },
  buttonText: {
    textAlign: "center",
    fontWeight: "bold",
    color: global.COLORS.text,
  },
  qrButton: {
    alignItems: "center",
    gap: 6,
  },
  qrText: {
    fontSize: global.FONT.size.md,
    color: global.COLORS.text,
    fontWeight: "bold",
  },
  qrHint: {
    fontSize: global.FONT.size.sm,
    color: global.COLORS.gray,
    textAlign: "center",
  },

  // Modal / Scanner
  modalContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  modalHeader: {
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#222",
  },
  closeBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  cameraWrap: {
    flex: 1,
    position: "relative",
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  scanFrame: {
    width: 260,
    height: 260,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  overlayText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "600",
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: "#fff",
  },
});
