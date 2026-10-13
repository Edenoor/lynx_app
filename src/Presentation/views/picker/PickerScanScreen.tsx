// src/Presentation/views/picker/PickerScanScreen.tsx
// Recepción y ubicación en planta, para escaneo continuo: cada lectura deja
// su resultado en la tarjeta de abajo y la cámara queda lista para la
// siguiente, sin diálogos que cerrar. Paquete → se recibe y se estantea según
// su CP; estantería → se mueve ahí el último paquete leído.

import React, { useCallback, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, Vibration, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";

import AppTheme from "../../theme/AppTheme";
import { QrScanner } from "../../components/QrScanner";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { PendingPackage, processScan, ScanOutcome } from "./pickerScan";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerScanScreen">;

const VIBRATE_OK = 60;
const VIBRATE_WARN = [0, 60, 80, 60];
const VIBRATE_ERROR = [0, 250, 100, 250];

export default function PickerScanScreen({ navigation, route }: Props) {
  const focused = useIsFocused();
  const [processing, setProcessing] = useState(false);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [pending, setPending] = useState<PendingPackage | null>(null);
  const { warehouseId } = route.params;
  const warehouseLabel = warehouseId ? `Warehouse #${warehouseId}` : "Warehouse asignado a tu usuario";

  // processScan no tira errores (los devuelve como resultado); el finally
  // garantiza igual que la pantalla no quede en "Procesando…".
  const onScan = useCallback(
    async (raw: string) => {
      setProcessing(true);
      try {
        const r = await processScan(raw, pending);
        setOutcome(r.outcome);
        setPending(r.pending);
        const kind = r.outcome.kind;
        const warn = kind === "unknown" || (kind === "received" && (r.outcome.result.alerts.length > 0 || !r.outcome.result.shelf));
        Vibration.vibrate(kind === "error" ? VIBRATE_ERROR : warn ? VIBRATE_WARN : VIBRATE_OK);
      } finally {
        setProcessing(false);
      }
    },
    [pending],
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={26} color={AppTheme.text.primary} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Recepción en planta</Text>
          <Text style={styles.headerSub}>{warehouseLabel}</Text>
        </View>
      </View>

      <View style={styles.camera}>
        <QrScanner active={focused} onScan={onScan} />
      </View>

      <View style={styles.panel}>
        {processing ? (
          <Text style={styles.hint}>Procesando…</Text>
        ) : outcome ? (
          <OutcomeCard outcome={outcome} warehouseLabel={warehouseLabel} />
        ) : (
          <Text style={styles.hint}>Escaneá la etiqueta del paquete (Mercado Libre o Lynx).</Text>
        )}
        {!processing && pending ? (
          <Text style={styles.next}>Para moverlo, escaneá la estantería. Si no, seguí con el próximo paquete.</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function OutcomeCard({ outcome, warehouseLabel }: { outcome: ScanOutcome; warehouseLabel: string }) {
  if (outcome.kind === "unknown") {
    return (
      <View style={[styles.card, { borderColor: AppTheme.colors.warning }]}>
        <Text style={[styles.cardTitle, { color: AppTheme.colors.warning }]}>Sin respuesta del servidor</Text>
        <Text style={styles.body}>{outcome.message}</Text>
      </View>
    );
  }

  if (outcome.kind === "error") {
    return (
      <View style={[styles.card, { borderColor: AppTheme.colors.danger }]}>
        <Text style={[styles.cardTitle, { color: AppTheme.colors.danger }]}>No se registró</Text>
        <Text style={styles.body}>{outcome.message}</Text>
      </View>
    );
  }

  if (outcome.kind === "moved") {
    return (
      <View style={[styles.card, { borderColor: AppTheme.colors.success }]}>
        <Text style={[styles.shelf, { color: AppTheme.colors.success }]}>→ {outcome.to}</Text>
        <Text style={styles.body}>
          {outcome.tracking ?? "Paquete"} movido{outcome.from ? ` de ${outcome.from}` : ""} a {outcome.to}.
        </Text>
        <Text style={styles.meta}>{warehouseLabel}</Text>
      </View>
    );
  }

  const { delivery, shelf, ops, alerts } = outcome.result;
  const color = !shelf ? AppTheme.colors.danger : alerts.length ? AppTheme.colors.warning : AppTheme.colors.success;
  return (
    <View style={[styles.card, { borderColor: color }]}>
      <Text style={[styles.shelf, { color }]}>→ {shelf?.code ?? "NO VA A ESTANTERÍA"}</Text>
      <Text style={styles.body}>
        {[delivery.tracking, delivery.store].filter(Boolean).join(" · ")}
      </Text>
      <Text style={styles.meta}>
        {[delivery.receiver, delivery.postal_code ? `CP ${delivery.postal_code}` : null].filter(Boolean).join(" · ")}
      </Text>
      <Text style={styles.meta}>
        {ops.already_here ? "Ya estaba en planta" : `Ingreso registrado: ${ops.to}`} · {warehouseLabel}
      </Text>
      {shelf?.suggested && shelf.suggested !== shelf.code ? (
        <Text style={[styles.meta, { color: AppTheme.colors.warning }]}>
          Está en {shelf.code}; por su CP le corresponde {shelf.suggested}.
        </Text>
      ) : null}
      {alerts.map((a) => (
        <Text key={a.code} style={[styles.meta, { color: AppTheme.colors.warning }]}>⚠ {a.text}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppTheme.surfaces.screen },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: AppTheme.spacing.md, paddingVertical: 12 },
  headerTitle: { color: AppTheme.text.primary, fontSize: 18, fontWeight: "700" },
  headerSub: { color: AppTheme.text.accent, fontSize: 13, fontWeight: "600" },
  camera: { flex: 1 },
  panel: { minHeight: 190, padding: AppTheme.spacing.md, gap: 8, backgroundColor: AppTheme.surfaces.screen },
  hint: { color: AppTheme.text.secondary, fontSize: 15, textAlign: "center", marginTop: 16 },
  next: { color: AppTheme.text.accent, fontSize: 13, textAlign: "center" },
  card: { borderWidth: 2, borderRadius: AppTheme.radius.lg, padding: AppTheme.spacing.md, gap: 4, backgroundColor: AppTheme.surfaces.card },
  cardTitle: { fontSize: 18, fontWeight: "800" },
  shelf: { fontSize: 30, fontWeight: "800" },
  body: { color: AppTheme.text.primary, fontSize: 15, fontWeight: "600" },
  meta: { color: AppTheme.text.secondary, fontSize: 13 },
});
