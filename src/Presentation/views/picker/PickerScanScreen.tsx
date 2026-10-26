// src/Presentation/views/picker/PickerScanScreen.tsx
// Recepción y ubicación en planta, para escaneo continuo: cada lectura deja
// su resultado en la tarjeta de abajo y la cámara queda lista para la
// siguiente, sin diálogos que cerrar. Paquete → se recibe y se estantea según
// su CP; estantería → se mueve ahí el último paquete leído.

import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, Vibration, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";

import AppTheme from "../../theme/AppTheme";
import { QrScanner } from "../../components/QrScanner";
import { SafeScreen } from "../../components/SafeScreen";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { PendingPackage, processScan, ScanOutcome } from "./pickerScan";
import { OutcomeTone, OutcomeView, presentOutcome } from "./pickerOutcome";
import { PickerHeader, warehouseLabel } from "./pickerUi";
import { playScanError, playScanSuccess } from "../../config/ScanSound";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerScanScreen">;

const VIBRATION: Record<OutcomeTone, number | number[]> = {
  success: 60,
  neutral: [0, 60, 80, 60],
  warning: [0, 60, 80, 60],
  danger: [0, 250, 100, 250],
};

const TONE_COLOR: Record<OutcomeTone, string> = {
  success: AppTheme.colors.success,
  neutral: AppTheme.text.muted,
  warning: AppTheme.colors.warning,
  danger: AppTheme.colors.danger,
};

// Una etiqueta rara puede traer un texto enorme: en pantalla se corta, al
// copiar va completo.
const RAW_PREVIEW_CHARS = 400;

export default function PickerScanScreen({ navigation, route }: Props) {
  const focused = useIsFocused();
  const [processing, setProcessing] = useState(false);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [pending, setPending] = useState<PendingPackage | null>(null);
  const { warehouseId, target } = route.params;
  const warehouse = warehouseLabel(warehouseId);
  const view = outcome ? presentOutcome(outcome, warehouse) : null;

  // processScan no tira errores (los devuelve como resultado); el finally
  // garantiza igual que la pantalla no quede en "Procesando…".
  const onScan = useCallback(
    async (raw: string) => {
      setProcessing(true);
      try {
        const r = await processScan(raw, pending);
        setOutcome(r.outcome);
        setPending(r.pending);
        const tone = presentOutcome(r.outcome, warehouse).tone;
        Vibration.vibrate(VIBRATION[tone]);
        // Éxito solo si se recibió o se movió; cualquier otro resultado avisa.
        if (tone === "success") playScanSuccess();
        else playScanError();
      } finally {
        setProcessing(false);
      }
    },
    [pending, warehouse],
  );

  return (
    <SafeScreen>
      <PickerHeader title="Recepción en planta" subtitle={warehouse} onBack={() => navigation.goBack()} />
      {target ? (
        <Text style={styles.target}>
          Reubicando {target.tracking ?? "el paquete"}: escaneá el paquete y después la estantería {target.expectedShelf}.
        </Text>
      ) : null}

      <View style={styles.camera}>
        <QrScanner active={focused} onScan={onScan} />
      </View>

      <View style={styles.panel}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.panelContent} keyboardShouldPersistTaps="handled">
          {processing ? (
            <Text style={styles.hint}>Procesando…</Text>
          ) : view ? (
            <OutcomeCard view={view} />
          ) : (
            <Text style={styles.hint}>Escaneá la etiqueta del paquete (Mercado Libre o Lynx).</Text>
          )}
          {!processing && pending ? (
            <Text style={styles.next}>Para moverlo, escaneá la estantería. Si no, seguí con el próximo paquete.</Text>
          ) : null}
        </ScrollView>
      </View>
    </SafeScreen>
  );
}

function OutcomeCard({ view }: { view: OutcomeView }) {
  const color = TONE_COLOR[view.tone];
  return (
    <View style={[styles.card, { borderColor: color }]}>
      {view.shelf ? <Text style={[styles.shelf, { color }]}>→ {view.shelf}</Text> : null}
      <Text style={[styles.cardTitle, { color }]}>{view.title}</Text>
      {view.lines.map((line, i) => (
        <Text key={`l${i}`} style={i === 0 ? styles.body : styles.meta}>{line}</Text>
      ))}
      {view.warnings.map((w, i) => (
        <Text key={`w${i}`} style={[styles.meta, { color: AppTheme.colors.warning }]}>⚠ {w}</Text>
      ))}
      {view.raw !== null ? <RawContent raw={view.raw} /> : null}
    </View>
  );
}

// Lo que leyó la cámara, para identificar formatos de etiqueta que el
// servidor no reconoce. Solo en memoria: no se guarda ni se registra.
function RawContent({ raw }: { raw: string }) {
  const [copy, setCopy] = useState<"idle" | "done" | "failed">("idle");
  useEffect(() => setCopy("idle"), [raw]);

  const onCopy = async () => {
    try {
      await Clipboard.setStringAsync(raw);
      setCopy("done");
    } catch {
      setCopy("failed");
    }
  };

  const preview = raw.length > RAW_PREVIEW_CHARS ? `${raw.slice(0, RAW_PREVIEW_CHARS)}… (${raw.length} caracteres)` : raw;
  return (
    <View style={styles.raw}>
      <Text style={styles.rawLabel}>Contenido leído</Text>
      <Text style={styles.rawText} selectable>{preview}</Text>
      <Pressable style={styles.copy} onPress={onCopy} hitSlop={8}>
        <Text style={styles.copyText}>
          {copy === "done" ? "Copiado" : copy === "failed" ? "No se pudo copiar" : "Copiar contenido"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  target: { color: AppTheme.colors.warning, fontSize: 13, fontWeight: "600", paddingHorizontal: AppTheme.spacing.md, paddingBottom: 10 },
  // La cámara se queda con lo que sobra; la tarjeta nunca pasa del 45% de la
  // pantalla y, si trae mucho texto, se desplaza adentro.
  camera: { flex: 1, minHeight: 180 },
  panel: { maxHeight: "45%", backgroundColor: AppTheme.surfaces.screen },
  scroll: { flexGrow: 0 },
  panelContent: { padding: AppTheme.spacing.md, gap: 8 },
  hint: { color: AppTheme.text.secondary, fontSize: 15, textAlign: "center", marginVertical: 16 },
  next: { color: AppTheme.text.accent, fontSize: 13, textAlign: "center" },
  card: { borderWidth: 2, borderRadius: AppTheme.radius.lg, padding: AppTheme.spacing.md, gap: 4, backgroundColor: AppTheme.surfaces.card },
  cardTitle: { fontSize: 17, fontWeight: "800" },
  shelf: { fontSize: 30, fontWeight: "800" },
  body: { color: AppTheme.text.primary, fontSize: 15, fontWeight: "600" },
  meta: { color: AppTheme.text.secondary, fontSize: 13 },
  raw: { marginTop: 6, padding: 10, gap: 6, borderRadius: AppTheme.radius.md, backgroundColor: AppTheme.surfaces.input },
  rawLabel: { color: AppTheme.text.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  rawText: { color: AppTheme.text.primary, fontSize: 12, fontFamily: "monospace" },
  copy: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: AppTheme.text.accent },
  copyText: { color: AppTheme.text.accent, fontSize: 13, fontWeight: "700" },
});
