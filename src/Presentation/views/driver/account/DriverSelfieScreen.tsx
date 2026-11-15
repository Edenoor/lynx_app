// src/Presentation/views/driver/account/DriverSelfieScreen.tsx
// Cambiar la foto de perfil desde Mi cuenta: la cámara del alta
// (CameraCaptureView, frontal y con el marco de selfie) y, con la foto
// sacada, la vista previa para guardarla o cancelar. Guardar la sube y la
// confirma con el servidor (updateSelfie); si algo falla, la foto anterior
// queda y se dice por qué. Solo cámara: la galería pide un build nuevo.

import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import { SafeScreen } from "../../../components/SafeScreen";
import { CameraCaptureView } from "../../../ui/CameraCaptureView";
import useViewModel from "../landing/ViewModel";
import { errorMessage } from "../errorMessage";
import { updateSelfie } from "./driverProfileApi";

export default function DriverSelfieScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { user } = useViewModel();
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!photo) {
    return (
      <CameraCaptureView
        title="Nueva foto de perfil"
        subtitle="Ubicate con buena luz, sin gorra ni lentes oscuros."
        kicker="MI CUENTA"
        permissionText="Necesitamos acceso a la cámara para sacar tu nueva foto de perfil."
        facing="front"
        overlayMode="selfie"
        allowFlip
        onCaptured={(uri) => { setError(null); setPhoto(uri); }}
      />
    );
  }

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateSelfie((user as any)?.id, photo);
      navigation.goBack();
    } catch (e: any) {
      setError(errorMessage(e, "No se pudo guardar la foto"));
      setSaving(false);
    }
  };

  return (
    <SafeScreen>
      <ThemedStatusBar />
      <View style={styles.content}>
        <Text style={styles.kicker}>MI CUENTA</Text>
        <Text style={styles.title}>¿Usamos esta foto?</Text>
        <Text style={styles.subtitle}>Reemplaza la selfie de tu ficha: la vas a ver en Mi cuenta y coordinación también la ve.</Text>

        <View style={styles.previewWrap}>
          <Image source={{ uri: photo }} style={styles.preview} accessibilityLabel="Vista previa de la nueva foto" />
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
            <Text style={styles.hint}>Tu foto anterior sigue igual.</Text>
          </View>
        ) : null}

        <Pressable onPress={save} disabled={saving} style={[styles.button, saving && styles.disabled]} accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }}>
          {saving ? <ActivityIndicator color={theme.text.onPrimary} /> : <Ionicons name="checkmark" size={18} color={theme.text.onPrimary} />}
          <Text style={styles.buttonText}>{saving ? "Guardando…" : "Guardar"}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} disabled={saving} style={[styles.button, styles.buttonSecondary, saving && styles.disabled]} accessibilityRole="button">
          <Text style={styles.buttonSecondaryText}>Cancelar</Text>
        </Pressable>
      </View>
    </SafeScreen>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: t.spacing.md,
    paddingHorizontal: t.layout.screenPadding,
    paddingBottom: 32,
    gap: t.spacing.md,
  },
  kicker: { color: t.text.muted, fontSize: 12, fontWeight: t.font.weight.black, letterSpacing: 0.6 },
  title: { color: t.text.primary, fontSize: 30, lineHeight: 34, fontWeight: t.font.weight.black, letterSpacing: -1 },
  subtitle: { color: t.text.secondary, fontSize: 14, lineHeight: 20, fontWeight: t.font.weight.bold },
  previewWrap: { alignItems: "center", paddingVertical: t.spacing.md },
  preview: { width: 220, height: 220, borderRadius: 110, backgroundColor: t.surfaces.cardStrong, borderWidth: 1, borderColor: t.borders.medium },
  errorBox: {
    borderRadius: t.radius.xl,
    borderWidth: 1,
    borderColor: t.status.rejected.border,
    backgroundColor: t.status.rejected.background,
    padding: t.spacing.md,
    gap: 4,
  },
  error: { color: t.status.rejected.text, fontSize: 14, fontWeight: t.font.weight.bold },
  hint: { color: t.text.secondary, fontSize: 13, fontWeight: t.font.weight.bold },
  button: {
    minHeight: 48,
    borderRadius: t.radius.xl,
    backgroundColor: t.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
  },
  buttonText: { color: t.text.onPrimary, fontSize: 15, fontWeight: t.font.weight.black },
  buttonSecondary: { backgroundColor: t.overlays.primary, borderWidth: 1, borderColor: t.borders.medium },
  buttonSecondaryText: { color: t.text.accent, fontSize: 15, fontWeight: t.font.weight.black },
  disabled: { opacity: 0.6 },
});
