import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  LayoutRectangle,
  StatusBar,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { RoundedButton } from "../components/RoundedButton";
import { LynxLoader } from "../components/LynxLoader";
import AppTheme from "../theme/AppTheme";

type OverlayMode = "none" | "selfie" | "document";

type Props = {
  title: string;
  subtitle?: string;
  facing?: "front" | "back";
  overlayMode?: OverlayMode;
  allowFlip?: boolean;
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
      <View style={styles.permissionScreen}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={AppTheme.surfaces.screen}
        />

        <View style={styles.permissionCard}>
          <Text style={styles.kicker}>CÁMARA</Text>
          <Text style={styles.permissionTitle}>Permiso de cámara</Text>
          <Text style={styles.permissionText}>
            Necesitamos acceso a la cámara para validar tu documentación y
            continuar con el alta.
          </Text>

          <RoundedButton text="Dar permiso" onPress={requestPermission} />
        </View>
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
    setCurrentFacing((previous) => (previous === "front" ? "back" : "front"));
  };

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={AppTheme.surfaces.screen}
      />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>VALIDACIÓN</Text>
            <Text style={styles.title}>{title}</Text>
          </View>

          {allowFlip && (
            <Pressable
              style={[styles.flipButton, busy && styles.disabledButton]}
              onPress={toggleFacing}
              disabled={busy}
            >
              <Text style={styles.flipText}>Cambiar</Text>
            </Pressable>
          )}
        </View>

        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      <View
        style={styles.cameraWrap}
        onLayout={(event) => setCameraLayout(event.nativeEvent.layout)}
      >
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={currentFacing}
        />

        {overlayMode !== "none" && !previewUri && cameraLayout && !busy && (
          <GuidanceOverlay mode={overlayMode} layout={cameraLayout} />
        )}

        {previewUri && (
          <View style={styles.previewWrap}>
            <Image source={{ uri: previewUri }} style={styles.preview} />
          </View>
        )}

        {busy && (
          <View style={styles.captureLoaderOverlay} pointerEvents="auto">
            <View style={styles.captureLoaderCard}>
              <LynxLoader compact message="Procesando captura..." />
            </View>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View style={busy && styles.disabledButton}>
          <RoundedButton
            text={busy ? "Procesando..." : "Capturar"}
            onPress={takePicture}
            disabled={busy}
          />
        </View>

        {previewUri && !busy && (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => setPreviewUri(null)}
          >
            <Text style={styles.secondaryButtonText}>Repetir captura</Text>
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
  layout: LayoutRectangle;
}) {
  const { width, height } = layout;

  const holeWidth =
    mode === "selfie" ? Math.min(width * 0.62, 320) : Math.min(width * 0.9, 520);

  const holeHeight = mode === "selfie" ? holeWidth * 1.25 : holeWidth * 0.58;

  const top = (height - holeHeight) / 2;
  const left = (width - holeWidth) / 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[overlayStyles.dim, { top: 0, left: 0, right: 0, height: top }]} />

      <View
        style={[
          overlayStyles.dim,
          { top: top + holeHeight, left: 0, right: 0, bottom: 0 },
        ]}
      />

      <View style={[overlayStyles.dim, { top, left: 0, width: left, height: holeHeight }]} />

      <View
        style={[overlayStyles.dim, { top, right: 0, width: left, height: holeHeight }]}
      />

      {mode === "selfie" ? (
        <View
          style={[
            overlayStyles.ovalFrame,
            {
              top,
              left,
              width: holeWidth,
              height: holeHeight,
              borderRadius: holeWidth,
            },
          ]}
        />
      ) : (
        <View
          style={[
            overlayStyles.docFrame,
            { top, left, width: holeWidth, height: holeHeight },
          ]}
        >
          <CornerTL />
          <CornerTR />
          <CornerBL />
          <CornerBR />
        </View>
      )}

      <View
        style={[
          overlayStyles.hintWrap,
          { top: top + holeHeight + AppTheme.spacing.md },
        ]}
      >
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppTheme.surfaces.screen,
  },

  header: {
    paddingHorizontal: AppTheme.layout.screenPadding,
    paddingTop: AppTheme.layout.headerTopPadding,
    paddingBottom: AppTheme.spacing.base,
    gap: AppTheme.spacing.sm,
    backgroundColor: AppTheme.surfaces.screen,
  },

  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: AppTheme.spacing.md,
  },

  headerText: {
    flex: 1,
    gap: AppTheme.spacing.xs,
  },

  kicker: {
    ...AppTheme.typography.kicker,
  },

  title: {
    ...AppTheme.typography.titleSm,
  },

  subtitle: {
    ...AppTheme.typography.bodySm,
  },

  flipButton: {
    borderWidth: 1,
    borderColor: AppTheme.borders.strong,
    backgroundColor: AppTheme.surfaces.cardStrong,
    paddingHorizontal: AppTheme.spacing.md,
    paddingVertical: AppTheme.spacing.sm,
    borderRadius: AppTheme.radius.full,
  },

  flipText: {
    color: AppTheme.text.primary,
    fontSize: AppTheme.font.size.xs,
    fontWeight: AppTheme.font.weight.extrabold,
  },

  cameraWrap: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: AppTheme.surfaces.screenDeep,
  },

  camera: {
    flex: 1,
  },

  captureLoaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: AppTheme.overlays.camera,
    alignItems: "center",
    justifyContent: "center",
  },

  captureLoaderCard: {
    minWidth: 180,
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: AppTheme.radius.xl,
    backgroundColor: AppTheme.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    padding: AppTheme.spacing.lg,
  },

  footer: {
    paddingHorizontal: AppTheme.layout.screenPadding,
    paddingTop: AppTheme.spacing.md,
    paddingBottom: AppTheme.layout.footerPaddingBottom,
    gap: AppTheme.spacing.md,
    backgroundColor: AppTheme.surfaces.footer,
    borderTopWidth: 1,
    borderTopColor: AppTheme.borders.soft,
  },

  disabledButton: {
    opacity: 0.55,
  },

  secondaryButton: {
    minHeight: 48,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    backgroundColor: AppTheme.surfaces.cardStrong,
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryButtonText: {
    ...AppTheme.typography.button,
  },

  permissionScreen: {
    flex: 1,
    backgroundColor: AppTheme.surfaces.screen,
    paddingHorizontal: AppTheme.layout.screenPadding,
    paddingTop: AppTheme.layout.headerTopPaddingLarge,
    justifyContent: "center",
  },

  permissionCard: {
    borderRadius: AppTheme.radius.xl,
    backgroundColor: AppTheme.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    padding: AppTheme.spacing.lg,
    gap: AppTheme.spacing.base,
  },

  permissionTitle: {
    ...AppTheme.typography.titleMd,
  },

  permissionText: {
    ...AppTheme.typography.body,
  },

  previewWrap: {
    position: "absolute",
    right: AppTheme.spacing.base,
    bottom: AppTheme.spacing.base,
    width: AppTheme.sizes.logoSm,
    height: AppTheme.sizes.logoLg - AppTheme.spacing.xxs,
    borderRadius: AppTheme.radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: AppTheme.borders.white,
    backgroundColor: AppTheme.surfaces.screenDeep,
  },

  preview: {
    width: "100%",
    height: "100%",
  },
});

const overlayStyles = StyleSheet.create({
  dim: {
    position: "absolute",
    backgroundColor: AppTheme.overlays.camera,
  },

  ovalFrame: {
    position: "absolute",
    borderWidth: 3,
    borderColor: AppTheme.text.primary,
  },

  docFrame: {
    position: "absolute",
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.borders.light,
    overflow: "hidden",
  },

  hintWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },

  hintText: {
    color: AppTheme.text.primary,
    fontSize: 13,
    fontWeight: AppTheme.font.weight.extrabold,
    backgroundColor: AppTheme.surfaces.cardStrong,
    borderWidth: 1,
    borderColor: AppTheme.borders.default,
    paddingHorizontal: AppTheme.spacing.md,
    paddingVertical: AppTheme.spacing.sm,
    borderRadius: AppTheme.radius.full,
    overflow: "hidden",
  },
});

const CORNER = 26;
const THICK = 4;

const cornerStyles = StyleSheet.create({
  base: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: AppTheme.text.primary,
  },

  tl: {
    top: 0,
    left: 0,
    borderLeftWidth: THICK,
    borderTopWidth: THICK,
    borderTopLeftRadius: AppTheme.radius.lg,
  },

  tr: {
    top: 0,
    right: 0,
    borderRightWidth: THICK,
    borderTopWidth: THICK,
    borderTopRightRadius: AppTheme.radius.lg,
  },

  bl: {
    bottom: 0,
    left: 0,
    borderLeftWidth: THICK,
    borderBottomWidth: THICK,
    borderBottomLeftRadius: AppTheme.radius.lg,
  },

  br: {
    bottom: 0,
    right: 0,
    borderRightWidth: THICK,
    borderBottomWidth: THICK,
    borderBottomRightRadius: AppTheme.radius.lg,
  },
});