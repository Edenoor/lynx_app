// src/Presentation/views/picker/PickerShelfDetailScreen.tsx
// Paquetes que están hoy en una estantería, del último estanteado al primero.

import React, { useCallback } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../theme/AppTheme";
import { SafeScreen } from "../../components/SafeScreen";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { fetchShelfContents, ShelfPackage } from "./warehouseApi";
import { ListMessage, listStyles, PickerHeader, shortDate, StaleBanner, useFocusQuery, warehouseLabel } from "./pickerUi";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerShelfDetailScreen">;

export default function PickerShelfDetailScreen({ navigation, route }: Props) {
  const { shelfId, code, warehouseId } = route.params;
  const fetcher = useCallback(() => fetchShelfContents(shelfId), [shelfId]);
  const { data, error, loading, refreshing, refresh } = useFocusQuery(fetcher);
  const count = data?.deliveries.length ?? null;

  return (
    <SafeScreen>
      <PickerHeader
        title={`Estantería ${data?.shelf.code ?? code}`}
        subtitle={warehouseLabel(warehouseId)}
        onBack={() => navigation.goBack()}
        onScan={() => navigation.navigate("PickerScanScreen", { warehouseId })}
      />
      {data ? <StaleBanner error={error} /> : null}
      {count !== null && count > 0 ? (
        <Text style={styles.count}>
          {count} {count === 1 ? "paquete" : "paquetes"}
          {data?.shelf.name ? ` · ${data.shelf.name}` : ""}
        </Text>
      ) : null}
      <FlatList
        data={data?.deliveries ?? []}
        keyExtractor={(d) => String(d.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={AppTheme.text.accent} />}
        ListEmptyComponent={<ListMessage loading={loading} error={data ? null : error} empty="No hay paquetes en esta estantería." />}
        renderItem={({ item }) => <PackageRow item={item} />}
      />
    </SafeScreen>
  );
}

function PackageRow({ item }: { item: ShelfPackage }) {
  const cp = item.postal_code_norm ?? item.codigo_postal;
  const shelved = shortDate(item.shelved_at);
  return (
    <View style={listStyles.row}>
      <Text style={listStyles.rowTitle}>
        {item.tracking ?? `Envío #${item.id}`}
        {item.tipo_envio === "flex" ? <Text style={styles.flex}>  FLEX</Text> : null}
      </Text>
      <Text style={listStyles.rowMeta}>{[item.store, item.receiver].filter(Boolean).join(" · ")}</Text>
      <Text style={listStyles.rowMeta}>
        {[cp ? `CP ${cp}` : null, item.direccion].filter(Boolean).join(" · ")}
      </Text>
      <Text style={listStyles.rowMeta}>
        {[shelved ? `Estanteado ${shelved}` : null, item.ops_status && item.ops_status !== "SHELVED" ? item.ops_status : null]
          .filter(Boolean)
          .join(" · ")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  count: { color: AppTheme.text.secondary, fontSize: 13, paddingHorizontal: AppTheme.spacing.md, paddingBottom: 8 },
  flex: { color: AppTheme.text.accent, fontSize: 12, fontWeight: "800" },
});
