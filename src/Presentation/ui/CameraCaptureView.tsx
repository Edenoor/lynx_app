import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
  LayoutRectangle,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

type OverlayMode = "none" | "selfie" | "document";

type Props = {
  title: string;
  subtitle?: string;
  facing?: "front" | "back";
  overlayMode?: OverlayMode;
  allowFlip?: boolean; // 👈 NUEVO (para emulador)
  onCaptured: (tmpUri: string, w?: number, h?: number) => Promise<void> | void;
};

export function CameraCaptureView({
  title,
  subtitle,
  facing = "back",
  overlayMode = "none",
  allowFlip = false,
  onCaptured,
}: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [busy, setBusy] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const [currentFacing, setCurrentFacing] = useState<"front" | "back">(facing);
  const [cameraLayout, setCameraLayout] = useState<LayoutRectangle | null>(null);

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Permiso de cámara</Text>
        <Text style={styles.sub}>Necesitamos acceso a la cámara para continuar.</Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Dar permiso</Text>
        </Pressable>
      </View>
    );
  }

  const takePicture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      setPreviewUri(photo.uri);
      await onCaptured(photo.uri, photo.width, photo.height);
    } finally {
      setBusy(false);
    }
  };

  const toggleFacing = () => {
    setCurrentFacing((p) => (p === "front" ? "back" : "front"));
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.title}>{title}</Text>

          {allowFlip && (
            <Pressable style={styles.flipBtn} onPress={toggleFacing}>
              <Text style={styles.flipText}>Cambiar</Text>
            </Pressable>
          )}
        </View>

        {!!subtitle && <Text style={styles.sub}>{subtitle}</Text>}
      </View>

      {/* Área cámara real */}
      <View
        style={{ flex: 1 }}
        onLayout={(e) => setCameraLayout(e.nativeEvent.layout)}
      >
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing={currentFacing} />

        {/* Overlay centrado en el área de cámara */}
        {overlayMode !== "none" && !previewUri && cameraLayout && (
          <GuidanceOverlay mode={overlayMode} layout={cameraLayout} />
        )}

        {/* Preview miniatura */}
        {previewUri && (
          <View style={styles.previewWrap}>
            <Image source={{ uri: previewUri }} style={styles.preview} />
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Pressable style={[styles.btn, busy && { opacity: 0.6 }]} onPress={takePicture}>
          {busy ? <ActivityIndicator /> : <Text style={styles.btnText}>Capturar</Text>}
        </Pressable>

        {previewUri && (
          <Pressable style={styles.btnSecondary} onPress={() => setPreviewUri(null)}>
            <Text style={styles.btnTextSecondary}>Repetir</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function GuidanceOverlay({
  mode,
  layout,
}: {
  mode: "selfie" | "document";
  layout: LayoutRectangle; // layout del área de cámara
}) {
  const { width, height } = layout;

  // Tamaños del "hueco" (centrados en el área de cámara)
  const holeWidth =
    mode === "selfie"
      ? Math.min(width * 0.62, 320)
      : Math.min(width * 0.92, 520); // 👈 más ancho para docs

  const holeHeight =
    mode === "selfie"
      ? holeWidth * 1.25
      : holeWidth * 0.58; // 👈 más horizontal (ID-card feel)

  const top = (height - holeHeight) / 2;
  const left = (width - holeWidth) / 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* oscurecer alrededor (dentro del área cámara) */}
      <View style={[overlayStyles.dim, { top: 0, left: 0, right: 0, height: top }]} />
      <View style={[overlayStyles.dim, { top: top + holeHeight, left: 0, right: 0, bottom: 0 }]} />
      <View style={[overlayStyles.dim, { top, left: 0, width: left, height: holeHeight }]} />
      <View style={[overlayStyles.dim, { top, right: 0, width: left, height: holeHeight }]} />

      {/* frame */}
      {mode === "selfie" ? (
        <View
          style={[
            overlayStyles.ovalFrame,
            { top, left, width: holeWidth, height: holeHeight, borderRadius: holeWidth },
          ]}
        />
      ) : (
        <View style={[overlayStyles.docFrame, { top, left, width: holeWidth, height: holeHeight }]}>
          <CornerTL />
          <CornerTR />
          <CornerBL />
          <CornerBR />
        </View>
      )}

      {/* hint */}
      <View style={[overlayStyles.hintWrap, { top: top + holeHeight + 16 }]}>
        <Text style={overlayStyles.hintText}>
          {mode === "selfie"
            ? "Alineá tu cara dentro del óvalo"
            : "Alineá el documento dentro del rectángulo"}
        </Text>
      </View>
    </View>
  );
}

function CornerTL() {
  return <View style={[cornerStyles.base, cornerStyles.tl]} />;
}
function CornerTR() {
  return <View style={[cornerStyles.base, cornerStyles.tr]} />;
}
function CornerBL() {
  return <View style={[cornerStyles.base, cornerStyles.bl]} />;
}
function CornerBR() {
  return <View style={[cornerStyles.base, cornerStyles.br]} />;
}

const overlayStyles = StyleSheet.create({
  dim: { position: "absolute", backgroundColor: "rgba(0,0,0,0.55)" },
  ovalFrame: { position: "absolute", borderWidth: 3, borderColor: "rgba(255,255,255,0.95)" },
  docFrame: {
    position: "absolute",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    overflow: "hidden",
  },
  hintWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  hintText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
});

const CORNER = 26;
const THICK = 4;

const cornerStyles = StyleSheet.create({
  base: { position: "absolute", width: CORNER, height: CORNER, borderColor: "rgba(255,255,255,0.95)" },
  tl: { top: 0, left: 0, borderLeftWidth: THICK, borderTopWidth: THICK, borderTopLeftRadius: 14 },
  tr: { top: 0, right: 0, borderRightWidth: THICK, borderTopWidth: THICK, borderTopRightRadius: 14 },
  bl: { bottom: 0, left: 0, borderLeftWidth: THICK, borderBottomWidth: THICK, borderBottomLeftRadius: 14 },
  br: { bottom: 0, right: 0, borderRightWidth: THICK, borderBottomWidth: THICK, borderBottomRightRadius: 14 },
});

const styles = StyleSheet.create({
  header: { padding: 16, gap: 6 },
  title: { fontSize: 18, fontWeight: "700" },
  sub: { fontSize: 13, opacity: 0.75 },
  footer: { padding: 16, gap: 10 },
  btn: { backgroundColor: "black", padding: 14, borderRadius: 12, alignItems: "center" },
  btnText: { color: "white", fontWeight: "700" },
  btnSecondary: { borderWidth: 1, borderColor: "black", padding: 14, borderRadius: 12, alignItems: "center" },
  btnTextSecondary: { color: "black", fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  previewWrap: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 90,
    height: 140,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
  },
  preview: { width: "100%", height: "100%" },

  flipBtn: {
    borderWidth: 1,
    borderColor: "black",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  flipText: { fontWeight: "700" },
});
