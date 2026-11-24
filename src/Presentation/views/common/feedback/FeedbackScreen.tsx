// src/Presentation/views/common/feedback/FeedbackScreen.tsx
// Sugerencias y errores, para Driver (Mi cuenta) y Picker (Inicio). Usa el
// mismo sistema que la WebApp (POST /v2/feedback): lo que se manda aparece en
// Sistema › Sugerencias y errores. Foto opcional, solo con la cámara (la
// galería pide un build nuevo). Al pie se dice qué datos técnicos se adjuntan.

import React from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { SafeScreen } from "../../../components/SafeScreen";
import { KeyboardScreen } from "../../../components/KeyboardScreen";
import { RoundedButton } from "../../../components/RoundedButton";
import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import type { Theme } from "../../../theme/createTheme";
import useFeedbackViewModel from "./ViewModel";
import { FeedbackArea, FeedbackKind, MAX_MESSAGE, PLACEHOLDER } from "./feedbackContext";

export type FeedbackParams = { area: FeedbackArea; photoUri?: string };

const KINDS: { kind: FeedbackKind; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { kind: "ERROR", label: "Error", icon: "bug-outline" },
  { kind: "SUGERENCIA", label: "Sugerencia", icon: "bulb-outline" },
];

export default function FeedbackScreen() {
  const navigation = useNavigation<any>();
  const params = (useRoute().params ?? {}) as FeedbackParams;
  const area: FeedbackArea = params.area === "picker" ? "picker" : "driver";
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const vm = useFeedbackViewModel(area, params.photoUri);

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Volver">
        <Ionicons name="arrow-back" size={22} color={theme.text.primary} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>{area === "picker" ? "LYNX · DEPÓSITO" : "MI CUENTA"}</Text>
        <Text style={styles.title}>Sugerencias y errores</Text>
        <Text style={styles.subtitle}>Lo recibe el equipo de Lynx, igual que lo que se manda desde la web.</Text>
      </View>
    </View>
  );

  if (vm.sent) {
    return (
      <SafeScreen style={styles.screen}>
        <ThemedStatusBar />
        <View style={styles.page}>
          {header}
          <View style={styles.done} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle" size={48} color={theme.status.delivered.icon} />
            <Text style={styles.doneText}>¡Gracias! Lo recibimos y lo vamos a revisar.</Text>
          </View>
          <RoundedButton text="Volver" onPress={() => navigation.goBack()} />
        </View>
      </SafeScreen>
    );
  }

  const length = vm.message.trim().length;

  return (
    <SafeScreen style={styles.screen}>
      <ThemedStatusBar />
      <KeyboardScreen
        contentContainerStyle={styles.page}
        footer={
          <View style={styles.footer}>
            {vm.error ? <Text style={styles.error} accessibilityRole="alert">{vm.error}</Text> : null}
            <RoundedButton text={vm.sending ? "Enviando…" : "Enviar"} onPress={vm.send} disabled={!vm.ready} />
          </View>
        }
      >
        {header}

        <Text style={styles.label}>¿Qué querés contarnos?</Text>
        <View style={styles.kinds}>
          {KINDS.map(({ kind, label, icon }) => {
            const on = vm.kind === kind;
            return (
              <Pressable
                key={kind}
                onPress={() => vm.setKind(kind)}
                disabled={vm.sending}
                style={[styles.kind, on && styles.kindOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, disabled: vm.sending }}
                accessibilityLabel={label}
              >
                <Ionicons name={icon} size={20} color={on ? theme.text.accent : theme.text.secondary} />
                <Text style={[styles.kindText, on && styles.kindTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={vm.message}
          onChangeText={vm.setMessage}
          editable={!vm.sending}
          multiline
          maxLength={MAX_MESSAGE}
          placeholder={vm.kind ? PLACEHOLDER[vm.kind] : "Elegí arriba si es un error o una sugerencia, y contanos."}
          placeholderTextColor={theme.text.muted}
          style={styles.input}
          textAlignVertical="top"
          accessibilityLabel="Descripción"
        />
        <Text style={styles.counter}>{length < 3 ? "Mínimo 3 caracteres · " : ""}{vm.message.length} / {MAX_MESSAGE}</Text>

        <Text style={styles.label}>Foto (opcional)</Text>
        {vm.preparingPhoto ? (
          <Text style={styles.hint}>Preparando la foto…</Text>
        ) : vm.photo ? (
          <View style={styles.photoRow}>
            <Image source={{ uri: vm.photo.uri }} style={styles.thumb} accessibilityLabel="Foto adjunta" />
            <View style={styles.photoActions}>
              <Pressable onPress={() => navigation.navigate("FeedbackPhotoScreen")} disabled={vm.sending} hitSlop={6} accessibilityRole="button">
                <Text style={styles.link}>Sacar otra</Text>
              </Pressable>
              <Pressable onPress={vm.removePhoto} disabled={vm.sending} hitSlop={6} accessibilityRole="button">
                <Text style={styles.remove}>Quitar foto</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => navigation.navigate("FeedbackPhotoScreen")}
            disabled={vm.sending}
            style={styles.photoButton}
            accessibilityRole="button"
            accessibilityLabel="Sacar foto"
          >
            <Ionicons name="camera-outline" size={20} color={theme.text.accent} />
            <Text style={styles.link}>Sacar foto</Text>
          </Pressable>
        )}
        {vm.photoError ? <Text style={styles.error}>{vm.photoError}</Text> : null}

        <Text style={styles.tech}>
          Junto con tu mensaje se envían la versión de Lynx y de su actualización, la versión de Android, el modelo del teléfono y la pantalla en la que estabas. No se envían tus datos de contacto ni tu contraseña.
        </Text>
      </KeyboardScreen>
    </SafeScreen>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { backgroundColor: t.colors.background },
    page: { paddingHorizontal: t.layout.screenPadding, paddingBottom: 24, gap: 10 },
    header: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingTop: t.spacing.lg, marginBottom: t.spacing.sm },
    back: { padding: 6, marginTop: 2 },
    kicker: { ...t.typography.kicker },
    title: { ...t.typography.titleSm, marginTop: 2 },
    subtitle: { ...t.typography.bodySm, marginTop: 4 },
    label: { color: t.text.primary, fontSize: 15, fontWeight: "700", marginTop: t.spacing.sm },
    kinds: { flexDirection: "row", gap: 8 },
    kind: {
      flex: 1,
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.borders.default,
      backgroundColor: t.surfaces.card,
    },
    kindOn: { borderColor: t.text.accent, borderWidth: 2, backgroundColor: t.overlays.primary },
    kindText: { color: t.text.secondary, fontSize: 14, fontWeight: "600" },
    kindTextOn: { color: t.text.primary, fontWeight: "800" },
    input: {
      minHeight: 140,
      padding: 12,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.borders.default,
      backgroundColor: t.surfaces.input,
      color: t.text.primary,
      fontSize: 15,
    },
    counter: { color: t.text.muted, fontSize: 12, alignSelf: "flex-end" },
    hint: { color: t.text.secondary, fontSize: 13 },
    photoButton: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: t.borders.default,
    },
    photoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    thumb: { width: 72, height: 72, borderRadius: t.radius.sm, borderWidth: 1, borderColor: t.borders.default },
    photoActions: { gap: 10 },
    link: { color: t.text.accent, fontSize: 14, fontWeight: "700" },
    remove: { color: t.colors.danger, fontSize: 14, fontWeight: "700" },
    tech: { color: t.text.muted, fontSize: 12, marginTop: t.spacing.md },
    footer: { paddingHorizontal: t.layout.screenPadding, paddingVertical: t.spacing.sm, gap: 8 },
    error: { color: t.colors.danger, fontSize: 13 },
    done: { alignItems: "center", gap: 12, paddingVertical: 32 },
    doneText: { color: t.text.primary, fontSize: 16, fontWeight: "700", textAlign: "center" },
  });
