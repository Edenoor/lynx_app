// src/Presentation/views/driver/account/AppearanceScreen.tsx
// Mi cuenta → Configuración → Apariencia. Tema, estilo y bordes se aplican y se
// guardan al tocarlos (sin «Guardar»). La vista previa usa las mismas piezas
// que Colectas e Inicio. Las pantallas todavía no adaptadas siguen oscuras.

import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { SafeScreen } from "../../../components/SafeScreen";
import ThemedCard from "../../../components/ThemedCard";
import Separator from "../../../components/Separator";
import StatusChip from "../../../components/StatusChip";
import { useAppearance, useThemedStyles } from "../../../theme/ThemeContext";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import { createTheme, radiusScale, type Theme } from "../../../theme/createTheme";
import {
  COLOR_MODES,
  ColorMode,
  DEFAULT_APPEARANCE,
  RADIUS_PRESETS,
  RadiusPreset,
  VISUAL_STYLES,
  VisualStyle,
} from "../../../theme/appearance";

type Icon = keyof typeof Ionicons.glyphMap;

const COLOR_MODE_OPTION: Record<ColorMode, { label: string; icon: Icon }> = {
  light: { label: "Claro", icon: "sunny-outline" },
  dark: { label: "Oscuro", icon: "moon-outline" },
  system: { label: "Automático", icon: "phone-portrait-outline" },
};

const STYLE_OPTION: Record<VisualStyle, { label: string; hint: string }> = {
  classic: { label: "Classic", hint: "Tarjetas marcadas" },
  minimal: { label: "Minimal", hint: "Plano, con líneas" },
  marble: { label: "Marble", hint: "Mineral y suave" },
};

const RADIUS_OPTION: Record<RadiusPreset, string> = {
  square: "Recto",
  balanced: "Equilibrado",
  rounded: "Redondeado",
};

export default function AppearanceScreen() {
  const navigation = useNavigation<any>();
  const { theme, preferences, setAppearance, resetAppearance } = useAppearance();
  const styles = useThemedStyles(makeStyles);
  const isDefault =
    preferences.colorMode === DEFAULT_APPEARANCE.colorMode &&
    preferences.style === DEFAULT_APPEARANCE.style &&
    preferences.radius === DEFAULT_APPEARANCE.radius;

  return (
    <SafeScreen style={styles.screen}>
      <ThemedStatusBar />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.back} accessibilityLabel="Volver">
            <Ionicons name="arrow-back" size={22} color={theme.text.primary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>CONFIGURACIÓN</Text>
            <Text style={styles.title}>Apariencia</Text>
            <Text style={styles.subtitle}>Se aplica al instante en todas las pantallas del chofer. El ingreso y el alta se ven siempre en claro, y la cámara en oscuro.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Tema</Text>
        <View style={styles.segmented}>
          {COLOR_MODES.map((mode) => (
            <Choice key={mode} selected={preferences.colorMode === mode} onPress={() => setAppearance({ colorMode: mode })} style={styles.segment}>
              <Ionicons name={COLOR_MODE_OPTION[mode].icon} size={18} color={preferences.colorMode === mode ? theme.text.accent : theme.text.secondary} />
              <Text style={[styles.choiceLabel, preferences.colorMode === mode && styles.choiceLabelOn]}>{COLOR_MODE_OPTION[mode].label}</Text>
            </Choice>
          ))}
        </View>
        {preferences.colorMode === "system" ? (
          <Text style={styles.hint}>Ahora: {theme.scheme === "dark" ? "oscuro" : "claro"}, según el teléfono.</Text>
        ) : null}

        <Text style={styles.sectionTitle}>Estilo</Text>
        <View style={styles.options}>
          {VISUAL_STYLES.map((style) => (
            <Choice key={style} selected={preferences.style === style} onPress={() => setAppearance({ style })} style={styles.option}>
              <StyleSwatch theme={createTheme({ scheme: theme.scheme, style, radius: preferences.radius })} />
              <Text style={[styles.choiceLabel, preferences.style === style && styles.choiceLabelOn]}>{STYLE_OPTION[style].label}</Text>
              <Text style={styles.optionHint}>{STYLE_OPTION[style].hint}</Text>
            </Choice>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Bordes</Text>
        <View style={styles.options}>
          {RADIUS_PRESETS.map((preset) => (
            <Choice key={preset} selected={preferences.radius === preset} onPress={() => setAppearance({ radius: preset })} style={styles.option}>
              <View style={[styles.radiusSample, { borderTopLeftRadius: radiusScale(preset).xl }]} />
              <Text style={[styles.choiceLabel, preferences.radius === preset && styles.choiceLabelOn]}>{RADIUS_OPTION[preset]}</Text>
            </Choice>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Vista previa</Text>
        <View style={{ gap: theme.list.gap }}>
          <PreviewCollection name="Mañanero 02" kind="Habitual" meta={["Lunes 27/10", "09:00", "3 paradas"]} status="pending" label="Pendiente" />
          <PreviewCollection name="Retiro Arroyito" kind="Extraordinaria" meta={["Martes 28/10", "14:30", "1 parada"]} status="confirmed" label="Aceptada" />
        </View>

        <ThemedCard style={styles.previewPanel}>
          <Text style={styles.panelTitle}>Estados</Text>
          <Text style={styles.panelText}>Mismo color en todos los estilos: siempre con ícono y texto.</Text>
          <View style={styles.chips}>
            <StatusChip status="delivered" label="Entregado" />
            <StatusChip status="pending" label="Pendiente" />
            <StatusChip status="confirmed" label="Confirmado" />
            <StatusChip status="inTransit" label="En camino" />
            <StatusChip status="incident" label="Incidencia" />
            <StatusChip status="rejected" label="Rechazado" />
            <StatusChip status="cancelled" label="Cancelado" />
            <StatusChip status="neutral" label="Asignado" />
          </View>
          <Separator />
          <View style={styles.buttons}>
            <View style={styles.btn}>
              <Ionicons name="play" size={16} color={theme.text.onPrimary} />
              <Text style={styles.btnText}>Botón principal</Text>
            </View>
            <View style={[styles.btn, styles.btnGhost]}>
              <Text style={styles.btnGhostText}>Secundario</Text>
            </View>
          </View>
        </ThemedCard>

        <Pressable onPress={resetAppearance} disabled={isDefault} style={[styles.reset, isDefault && styles.disabled]} accessibilityRole="button">
          <Ionicons name="refresh-outline" size={18} color={theme.text.primary} />
          <Text style={styles.btnGhostText}>Restablecer apariencia</Text>
        </Pressable>
        <Text style={[styles.hint, styles.center]}>Oscuro · Classic · Equilibrado</Text>
      </ScrollView>
    </SafeScreen>
  );
}

function Choice({ selected, onPress, style, children }: React.PropsWithChildren<{ selected: boolean; onPress: () => void; style?: object }>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable onPress={onPress} style={[styles.choice, style, selected && styles.choiceOn]} accessibilityRole="button" accessibilityState={{ selected }}>
      {children}
    </Pressable>
  );
}

// Miniatura de un estilo, dibujada con su propio tema: un panel y una fila de
// lista (en Minimal, la fila es solo una línea).
function StyleSwatch({ theme }: { theme: Theme }) {
  const flat = { height: 14, shadowOpacity: 0, elevation: 0 };
  return (
    <View style={{ alignSelf: "stretch", height: 54, borderRadius: theme.radius.md, backgroundColor: theme.colors.background, padding: 8, gap: 6 }}>
      <View style={[theme.card, flat, { borderRadius: theme.radius.sm }]} />
      <View style={[theme.listItem, flat, { width: "70%", borderRadius: Math.min(theme.listItem.borderRadius, theme.radius.sm) }]} />
    </View>
  );
}

function PreviewCollection({ name, kind, meta, status, label }: {
  name: string; kind: string; meta: string[]; status: "pending" | "confirmed"; label: string;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <ThemedCard variant="row" style={styles.row}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.rowName}>{name}</Text>
          <Text style={styles.rowKind}>{kind}</Text>
        </View>
        <StatusChip status={status} label={label} />
      </View>
      <Text style={styles.rowMeta}>{meta.join("  ·  ")}</Text>
    </ThemedCard>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: { backgroundColor: t.colors.background },
  page: { paddingHorizontal: t.layout.screenPadding, paddingBottom: 48, gap: 10 },
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingTop: t.spacing.lg, marginBottom: t.spacing.sm },
  back: { padding: 6, marginTop: 2 },
  kicker: { ...t.typography.kicker },
  title: { ...t.typography.titleSm, marginTop: 2 },
  subtitle: { ...t.typography.bodySm, marginTop: 4 },
  sectionTitle: { color: t.text.primary, fontSize: 15, fontWeight: "700", marginTop: t.spacing.md },
  hint: { color: t.text.secondary, fontSize: 12 },
  center: { textAlign: "center" },

  segmented: { flexDirection: "row", gap: 8 },
  segment: { flex: 1, flexDirection: "row", justifyContent: "center", minHeight: 48 },
  options: { flexDirection: "row", gap: 8 },
  option: { flex: 1, alignItems: "flex-start", padding: 10, gap: 6 },
  optionHint: { color: t.text.muted, fontSize: 11 },
  choice: {
    alignItems: "center",
    gap: 6,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.borders.default,
    backgroundColor: t.surfaces.card,
  },
  choiceOn: { borderColor: t.text.accent, borderWidth: 2, backgroundColor: t.overlays.primary },
  choiceLabel: { color: t.text.secondary, fontSize: 13, fontWeight: "600" },
  choiceLabelOn: { color: t.text.primary, fontWeight: "800" },
  radiusSample: {
    width: 40,
    height: 30,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: t.text.accent,
    marginVertical: 6,
  },

  row: { paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  rowName: { color: t.text.primary, fontSize: 16, fontWeight: "700" },
  rowKind: { color: t.text.secondary, fontSize: 11, fontWeight: "500" },
  rowMeta: { color: t.text.secondary, fontSize: 12 },

  previewPanel: { padding: t.spacing.md, gap: 10, marginTop: t.spacing.sm },
  panelTitle: { color: t.text.primary, fontWeight: "700", fontSize: 15 },
  panelText: { color: t.text.secondary, fontSize: 13, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  buttons: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  btn: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.primary,
    borderRadius: t.radius.md,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: t.borders.default },
  btnText: { color: t.text.onPrimary, fontWeight: "700" },
  btnGhostText: { color: t.text.primary, fontWeight: "600" },

  reset: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    marginTop: t.spacing.lg,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.borders.default,
  },
  disabled: { opacity: 0.45 },
});
