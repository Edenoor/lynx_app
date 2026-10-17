// src/Presentation/views/picker/PickerReportMockScreen.tsx
// MAQUETA del flujo "Reportar problema": qué motivos habría y qué datos
// pediríamos en cada caso. No registra incidencias ni modifica envíos: el
// servidor todavía no tiene dónde guardarlas.

import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../theme/AppTheme";
import { SafeScreen } from "../../components/SafeScreen";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { DisabledAction, MockNotice, OptionList, PickerHeader, warehouseLabel } from "./pickerUi";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerReportMockScreen">;

type Reason = "wrong_location" | "no_location" | "unreadable_label" | "other";

const REASONS: { key: Reason; label: string }[] = [
  { key: "wrong_location", label: "Ubicación física incorrecta" },
  { key: "no_location", label: "Paquete sin ubicación" },
  { key: "unreadable_label", label: "Etiqueta ilegible" },
  { key: "other", label: "Otro" },
];

// Datos que pediría cada motivo, y de dónde saldrían.
const FIELDS: Record<Reason, { label: string; source: string }[]> = {
  wrong_location: [
    { label: "Paquete", source: "escaneo de la etiqueta" },
    { label: "Estantería registrada", source: "la informa el servidor" },
    { label: "Estantería donde está físicamente", source: "escaneo del QR de la estantería" },
    { label: "Observaciones", source: "texto opcional" },
  ],
  no_location: [
    { label: "Paquete", source: "escaneo de la etiqueta" },
    { label: "Dónde se encontró", source: "texto o escaneo de estantería" },
    { label: "Observaciones", source: "texto opcional" },
  ],
  unreadable_label: [
    { label: "Foto de la etiqueta", source: "cámara" },
    { label: "Datos visibles (tracking, tienda, destinatario)", source: "texto" },
    { label: "Estantería donde está", source: "escaneo del QR de la estantería" },
  ],
  other: [
    { label: "Paquete", source: "escaneo de la etiqueta, si se puede leer" },
    { label: "Descripción del problema", source: "texto obligatorio" },
  ],
};

export default function PickerReportMockScreen({ navigation, route }: Props) {
  const [reason, setReason] = useState<Reason | null>(null);

  return (
    <SafeScreen>
      <PickerHeader title="Reportar problema" subtitle={warehouseLabel(route.params.warehouseId)} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <MockNotice missing="Falta que el servidor registre incidencias de depósito." />

        <Text style={styles.sectionTitle}>Motivo</Text>
        <OptionList options={REASONS} value={reason} onChange={setReason} />

        <Text style={styles.sectionTitle}>Datos que pediríamos</Text>
        {reason ? (
          FIELDS[reason].map((f) => (
            <View key={f.label} style={styles.field}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <Text style={styles.fieldSource}>{f.source}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.pending}>Elegí un motivo para ver qué datos completaría el Picker.</Text>
        )}

        <DisabledAction label="Enviar reporte" />
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: AppTheme.spacing.md, gap: 12 },
  sectionTitle: { color: AppTheme.text.primary, fontSize: 16, fontWeight: "800", marginTop: 6 },
  pending: { color: AppTheme.text.secondary, fontSize: 14, lineHeight: 20 },
  field: {
    padding: 12,
    gap: 2,
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: AppTheme.borders.default,
  },
  fieldLabel: { color: AppTheme.text.primary, fontSize: 14, fontWeight: "700" },
  fieldSource: { color: AppTheme.text.muted, fontSize: 12 },
});
