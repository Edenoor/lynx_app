// src/Presentation/components/QrScanner.tsx
//
// Cámara para escaneo continuo de QR: misma configuración que el escáner del
// chofer (expo-camera, solo QR). Mientras se procesa una lectura no acepta
// otra, y el mismo código no se vuelve a procesar mientras siga a la vista:
// recién cuando deja de leerse REPEAT_WINDOW_MS se puede escanear de nuevo.
//
// Linterna: manual y apagada al empezar. Se apaga sola cuando la cámara se
// desactiva (pantalla sin foco, resultado abierto) o la app pasa a segundo
// plano; al volver, queda apagada. En un teléfono sin flash expo-camera ignora
// el pedido (no hay forma de saberlo antes desde JS): el botón no hace nada.

import React, { useEffect, useRef, useState } from "react";
import { AppState, LayoutChangeEvent, Linking, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";

import AppTheme from "../theme/AppTheme";
import { LynxPulseLoader } from "./LynxPulseLoader";

const REPEAT_WINDOW_MS = 2_000;

type Props = {
  // false apaga la cámara (pantalla sin foco): no gasta batería ni lee.
  active: boolean;
  onScan: (raw: string) => Promise<void>;
  // Dónde va el botón de la linterna si arriba a la derecha tapa algo de la pantalla.
  torchStyle?: StyleProp<ViewStyle>;
};

export function QrScanner({ active, onScan, torchStyle }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const busy = useRef(false);
  const last = useRef<{ raw: string; at: number } | null>(null);
  const [torch, setTorch] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!active) setTorch(false);
  }, [active]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") setTorch(false);
    });
    return () => sub.remove();
  }, []);

  // El recuadro guía se ajusta al lado más corto del espacio de la cámara:
  // en teléfonos chicos o con la tarjeta de resultado abierta no se sale.
  const [frameSize, setFrameSize] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setFrameSize(Math.round(Math.min(width * 0.62, height * 0.8)));
  };

  // Lo leído se entrega tal cual (sin recortar ni normalizar): interpretar la
  // etiqueta es cosa del servidor.
  const handle = async ({ data }: BarcodeScanningResult) => {
    const raw = String(data ?? "");
    if (!raw.trim() || busy.current) return;
    if (last.current?.raw === raw && Date.now() - last.current.at < REPEAT_WINDOW_MS) {
      last.current.at = Date.now();
      return;
    }

    busy.current = true;
    try {
      await onScan(raw);
    } finally {
      last.current = { raw, at: Date.now() };
      busy.current = false;
    }
  };

  if (!permission) return <View style={styles.center}><LynxPulseLoader message="Preparando cámara..." /></View>;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Lynx necesita la cámara para leer las etiquetas.</Text>
        <Pressable
          style={styles.button}
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
        >
          <Text style={styles.buttonText}>{permission.canAskAgain ? "Permitir cámara" : "Abrir configuración"}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {active ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={handle}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          enableTorch={torch}
        />
      ) : null}
      {frameSize > 0 ? <View pointerEvents="none" style={[styles.frame, { width: frameSize, height: frameSize }]} /> : null}
      {active ? (
        <Pressable
          onPress={() => setTorch((on) => !on)}
          style={[styles.torch, torch && styles.torchOn, torchStyle]}
          hitSlop={8}
          accessibilityRole="switch"
          accessibilityLabel="Linterna"
          accessibilityState={{ checked: torch }}
          accessibilityHint={torch ? "Apaga la linterna" : "Enciende la linterna para escanear con poca luz"}
        >
          <Ionicons name={torch ? "flashlight" : "flashlight-outline"} size={24} color={torch ? TORCH_ON.onSolid : AppTheme.colors.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

const TORCH_ON = AppTheme.status.pending;

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: AppTheme.colors.black, alignItems: "center", justifyContent: "center" },
  frame: {
    borderWidth: 3,
    borderRadius: AppTheme.radius.lg,
    borderColor: AppTheme.colors.white,
    opacity: 0.8,
  },
  torch: {
    position: "absolute",
    top: AppTheme.spacing.md,
    right: AppTheme.spacing.md,
    width: 48,
    height: 48,
    borderRadius: AppTheme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  torchOn: { backgroundColor: TORCH_ON.solid, borderColor: TORCH_ON.solid },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24, backgroundColor: AppTheme.surfaces.screen },
  text: { color: AppTheme.text.primary, fontSize: 15, textAlign: "center" },
  button: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: AppTheme.radius.md, backgroundColor: AppTheme.colors.primary },
  buttonText: { color: AppTheme.colors.white, fontWeight: "700" },
});
