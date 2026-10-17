// src/Presentation/views/picker/PickerBulkyMockScreen.tsx
// MAQUETA del flujo "Grande / Voluminoso": cómo se clasificaría un paquete y
// dónde se lo sugeriría ubicar. No identifica paquetes, no crea zonas ni
// estanterías y no modifica ningún envío: el servidor todavía no guarda esa
// característica ni tiene zonas especiales.

import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../theme/AppTheme";
import { SafeScreen } from "../../components/SafeScreen";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { DisabledAction, MockNotice, OptionList, PickerHeader, warehouseLabel } from "./pickerUi";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerBulkyMockScreen">;

type BulkyClass = "heavy" | "bulky" | "both";

const CLASSES: { key: BulkyClass; label: string }[] = [
  { key: "heavy", label: "Pesado" },
  { key: "bulky", label: "Voluminoso" },
  { key: "both", label: "Pesado y voluminoso" },
];

export default function PickerBulkyMockScreen({ navigation, route }: Props) {
  const [klass, setKlass] = useState<BulkyClass | null>(null);

  return (
    <SafeScreen>
      <PickerHeader title="Grande / Voluminoso" subtitle={warehouseLabel(route.params.warehouseId)} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <MockNotice missing="Falta que el servidor guarde esta clasificación y tenga una zona especial para estos paquetes." />

        <Step n={1} title="Paquete">
          <Text style={styles.pending}>
            La identificación del paquete se integrará con la consulta de depósito, que todavía no existe. En esta maqueta no se escanea.
          </Text>
        </Step>

        <Step n={2} title="Clasificación">
          <OptionList options={CLASSES} value={klass} onChange={setKlass} />
        </Step>

        <Step n={3} title="Ubicación sugerida">
          {klass ? (
            <>
              <Text style={styles.zone}>Zona especial · Pesados y voluminosos</Text>
              <Text style={styles.pending}>
                Esta zona todavía no existe en el depósito. Se configurará cuando el servidor la soporte, sin depender del código postal.
              </Text>
            </>
          ) : (
            <Text style={styles.pending}>Elegí una clasificación para ver la ubicación sugerida.</Text>
          )}
        </Step>

        <DisabledAction label="Confirmar clasificación" />
      </ScrollView>
    </SafeScreen>
  );
}

function Step({ n, title, children }: React.PropsWithChildren<{ n: number; title: string }>) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepTitle}>
        {n}. {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: AppTheme.spacing.md, gap: 18 },
  step: { gap: 8 },
  stepTitle: { color: AppTheme.text.primary, fontSize: 16, fontWeight: "800" },
  pending: { color: AppTheme.text.secondary, fontSize: 14, lineHeight: 20 },
  zone: { color: AppTheme.text.accent, fontSize: 18, fontWeight: "800" },
});
