// src/Presentation/views/picker/PickerBaulScanScreen.tsx
// Escanear la etiqueta original de un envío y recibir lo que el chofer trae
// de él: escanear → ver qué es → confirmar → siguiente. Lo identifica el
// servidor (GET /v2/baul/lookup, solo del depósito del Picker); un envío ya
// entregado muestra su cobranza o su cambio y nunca se recibe como paquete.
// Con `driverId` (abierto desde un chofer) solo se confirma lo de ese chofer.
// La cámara se pausa mientras queda algo por confirmar: una lectura de más
// no cambia la tarjeta en la mitad de una cobranza.

import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, Vibration, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";

import AppTheme from "../../theme/AppTheme";
import { QrScanner } from "../../components/QrScanner";
import { SafeScreen } from "../../components/SafeScreen";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { lookupBaul, BaulApiError, BaulLookup, driverName } from "./baulApi";
import { obligationsOf, refOf } from "./baulPicker";
import { BaulObligationCard } from "./BaulObligationCard";
import { PickerHeader } from "./pickerUi";
import { playScanError, playScanSuccess } from "../../config/ScanSound";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerBaulScanScreen">;

type Scan = { qr: string; lookup: BaulLookup } | { qr: string; error: string };

export default function PickerBaulScanScreen({ navigation, route }: Props) {
  const { driverId, name } = route.params;
  const focused = useIsFocused();
  const [loading, setLoading] = useState(false);
  const [scan, setScan] = useState<Scan | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const identify = useCallback(async (qr: string) => {
    setLoading(true);
    try {
      const lookup = await lookupBaul(qr);
      setScan({ qr, lookup });
      return lookup;
    } catch (e) {
      const text = e instanceof BaulApiError ? e.message : "Sin conexión con el servidor. Volvé a escanear.";
      setScan({ qr, error: text });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const onScan = useCallback(async (raw: string) => {
    setNotice(null);
    const lookup = await identify(raw);
    const found = lookup ? obligationsOf(lookup).filter((o) => driverId == null || o.driverId === driverId) : [];
    if (found.length) { Vibration.vibrate(60); playScanSuccess(); } else { Vibration.vibrate([0, 250, 100, 250]); playScanError(); }
  }, [identify, driverId]);

  const all = scan && "lookup" in scan ? obligationsOf(scan.lookup) : [];
  const mine = all.filter((o) => driverId == null || o.driverId === driverId);
  const ofOthers = all.length - mine.length;
  // Varios choferes con algo del mismo envío (raro): cada tarjeta dice de quién es.
  const names = scan && "lookup" in scan ? new Map(scan.lookup.drivers.map((d) => [d.id, driverName(d)])) : new Map<number, string>();
  const waiting = mine.length > 0;

  return (
    <SafeScreen>
      <PickerHeader title="Baúl · escanear" subtitle={name ?? "Etiqueta original del envío"} onBack={() => navigation.goBack()} />

      <View style={styles.camera}>
        <QrScanner active={focused && !loading && !waiting} onScan={onScan} />
        {waiting ? <View style={styles.paused}><Text style={styles.pausedText}>Confirmá lo de abajo o tocá «Siguiente»</Text></View> : null}
      </View>

      <View style={styles.panel}>
        <ScrollView contentContainerStyle={styles.panelContent} keyboardShouldPersistTaps="handled">
          {notice ? <Text style={[styles.notice, { color: notice.ok ? AppTheme.colors.success : AppTheme.colors.danger }]}>{notice.text}</Text> : null}
          {loading ? (
            <Text style={styles.hint}>Buscando…</Text>
          ) : !scan ? (
            <Text style={styles.hint}>Escaneá la etiqueta original (Mercado Libre, LightData o Lynx).</Text>
          ) : "error" in scan ? (
            <Text style={[styles.hint, { color: AppTheme.colors.danger }]}>{scan.error}</Text>
          ) : (
            <>
              <Text style={styles.ref}>{refOf({ ...scan.lookup.delivery, delivery_id: scan.lookup.delivery.id })}{scan.lookup.delivery.store ? ` · ${scan.lookup.delivery.store}` : ""}</Text>
              {!mine.length ? (
                <Text style={styles.hint}>
                  {ofOthers ? "Lo que tiene pendiente es de otro chofer: recibilo desde su Baúl." : scan.lookup.message}
                </Text>
              ) : null}
              {mine.map((o) => (
                <View key={o.key} style={styles.item}>
                  {driverId == null ? <Text style={styles.owner}>De {names.get(o.driverId) ?? `chofer ${o.driverId}`}</Text> : null}
                  <BaulObligationCard
                    obligation={o}
                    onResult={(r) => {
                      setNotice({ ok: r.ok, text: r.text });
                      // Lo pendiente de este envío se vuelve a pedir: si no queda nada, la cámara sigue.
                      if (r.reload) void identify(scan.qr);
                    }}
                  />
                </View>
              ))}
              {waiting ? (
                <Pressable style={styles.next} onPress={() => { setScan(null); setNotice(null); }} accessibilityRole="button">
                  <Text style={styles.nextText}>Siguiente (dejar pendiente)</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1, minHeight: 160 },
  paused: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)" },
  pausedText: { color: AppTheme.colors.white, fontSize: 15, fontWeight: "700", textAlign: "center", paddingHorizontal: 24 },
  panel: { maxHeight: "60%", backgroundColor: AppTheme.surfaces.screen },
  panelContent: { padding: AppTheme.spacing.md, gap: 10 },
  hint: { color: AppTheme.text.secondary, fontSize: 15, textAlign: "center", marginVertical: 12 },
  notice: { fontSize: 14, fontWeight: "700" },
  ref: { color: AppTheme.text.primary, fontSize: 16, fontWeight: "800" },
  item: { gap: 4 },
  owner: { color: AppTheme.text.muted, fontSize: 12, fontWeight: "700" },
  next: { paddingVertical: 12, alignItems: "center", borderRadius: AppTheme.radius.md, borderWidth: 1, borderColor: AppTheme.text.accent },
  nextText: { color: AppTheme.text.accent, fontWeight: "800" },
});
