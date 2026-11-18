// src/Presentation/views/picker/PickerColectaDetailScreen.tsx
// Una colecta antes de recibirla: sus tiendas con lo declarado por el chofer,
// lo ya atribuido y el estado de recepción de cada una. «Continuar» abre el
// mismo escáner de recepción con la colecta elegida (también para retomar
// una recepción a medias: los contadores salen del servidor).

import React, { useCallback } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../theme/AppTheme";
import { SafeScreen } from "../../components/SafeScreen";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { fetchColectas, type ColectaStop } from "./warehouseApi";
import {
  colectaReception,
  colectaStatusLabel,
  colectaTotals,
  dayLabel,
  findColecta,
  stopIsClosed,
  stopName,
  stopReceptionLabel,
} from "./colecta";
import { ListMessage, listStyles, PickerHeader, StaleBanner, useFocusQuery } from "./pickerUi";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerColectaDetailScreen">;

export default function PickerColectaDetailScreen({ navigation, route }: Props) {
  const { warehouseId, routeId, date, name } = route.params;
  const fetcher = useCallback(async () => findColecta(await fetchColectas(date), routeId), [date, routeId]);
  const { data: colecta, error, loading, refreshing, refresh } = useFocusQuery(fetcher);
  const totals = colecta ? colectaTotals(colecta) : null;
  const reception = colecta ? colectaReception(colecta) : null;
  // Cargó bien y la colecta ya no está en el día (cancelada o movida).
  const missing = !loading && !error && !colecta;

  return (
    <SafeScreen>
      <PickerHeader title={colecta?.name ?? name} subtitle={`#${routeId} · ${dayLabel(date)}`} onBack={() => navigation.goBack()} />
      {colecta ? <StaleBanner error={error} /> : null}
      <FlatList
        data={colecta?.stops ?? []}
        keyExtractor={(s) => String(s.route_stop_id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={AppTheme.text.accent} />}
        ListHeaderComponent={
          colecta && totals && reception ? (
            <View style={styles.summary}>
              <Text style={styles.status}>
                {colectaStatusLabel(colecta.status)} · {totals.stores === 1 ? "1 tienda" : `${totals.stores} tiendas`}
              </Text>
              <Text style={[styles.reception, reception.kind === "open" ? null : { color: AppTheme.colors.warning }]}>
                {reception.label}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <ListMessage
            loading={loading}
            error={colecta ? null : error}
            empty={missing ? "Esta colecta ya no figura entre las de hoy." : "La colecta no tiene tiendas."}
          />
        }
        renderItem={({ item }) => <StopRow stop={item} />}
      />
      {colecta && totals && reception ? (
            <View style={styles.footer}>
              <Text style={styles.total}>Total declarado: {totals.declared}</Text>
              {totals.undeclared ? (
                <Text style={styles.note}>
                  {totals.undeclared === 1 ? "1 tienda sin declarar" : `${totals.undeclared} tiendas sin declarar`}
                </Text>
              ) : null}
              <Text style={styles.attributed}>Atribuidos a la colecta: {totals.attributed}</Text>
              <Text style={styles.note}>
                «Atribuidos» son los paquetes que el servidor ya sumó a cada tienda de la colecta.
              </Text>
              {reception.kind === "closed" ? (
                <Text style={[styles.note, { color: AppTheme.colors.warning }]}>
                  La recepción está cerrada: lo que escanees entra a planta, pero no se suma a la colecta.
                </Text>
              ) : null}
              <Pressable
                style={styles.continue}
                accessibilityRole="button"
                onPress={() =>
                  navigation.navigate("PickerScanScreen", {
                    warehouseId,
                    colecta: { routeId: colecta.route_id, date, name: colecta.name },
                  })
                }
              >
                <Text style={styles.continueText}>Continuar</Text>
              </Pressable>
            </View>
      ) : null}
    </SafeScreen>
  );
}

function StopRow({ stop }: { stop: ColectaStop }) {
  const closed = stopIsClosed(stop);
  return (
    <View style={[listStyles.row, styles.stop]}>
      <View style={styles.stopInfo}>
        <Text style={listStyles.rowTitle} numberOfLines={2}>{stopName(stop)}</Text>
        <Text style={[styles.stopReception, closed ? { color: AppTheme.colors.warning } : null]}>
          {stopReceptionLabel(stop.reception_status)}
        </Text>
      </View>
      <View style={styles.stopCounts}>
        <Text style={styles.declared}>{typeof stop.declarado === "number" ? stop.declarado : "—"}</Text>
        <Text style={listStyles.rowMeta}>
          {typeof stop.declarado === "number" ? "declarados" : "sin declarar"}
        </Text>
        <Text style={styles.stopAttributed}>Atribuidos {stop.recibido}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { marginHorizontal: AppTheme.spacing.md, marginBottom: 12, gap: 4 },
  status: { color: AppTheme.text.secondary, fontSize: 14, fontWeight: "600" },
  reception: { color: AppTheme.text.accent, fontSize: 15, fontWeight: "800" },
  stop: { flexDirection: "row", alignItems: "center", gap: 12 },
  stopInfo: { flex: 1, gap: 4 },
  stopReception: { color: AppTheme.text.accent, fontSize: 13, fontWeight: "700" },
  stopCounts: { alignItems: "flex-end", gap: 2 },
  declared: { color: AppTheme.text.primary, fontSize: 22, fontWeight: "800" },
  stopAttributed: { color: AppTheme.text.secondary, fontSize: 12, fontWeight: "600" },
  footer: {
    paddingHorizontal: AppTheme.spacing.md,
    paddingTop: 12,
    paddingBottom: AppTheme.spacing.md,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: AppTheme.borders.default,
    backgroundColor: AppTheme.surfaces.screen,
  },
  total: { color: AppTheme.text.primary, fontSize: 18, fontWeight: "800" },
  attributed: { color: AppTheme.text.primary, fontSize: 15, fontWeight: "700" },
  note: { color: AppTheme.text.secondary, fontSize: 13, lineHeight: 18 },
  continue: {
    marginTop: 10,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: AppTheme.radius.lg,
    backgroundColor: AppTheme.colors.primary,
  },
  continueText: { color: AppTheme.colors.white, fontSize: 16, fontWeight: "800" },
});
