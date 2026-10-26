// src/Presentation/views/picker/PickerShelfDetailScreen.tsx
// Paquetes que están hoy en una estantería, del último estanteado al primero.

import React, { useCallback } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../theme/AppTheme";
import { SafeScreen } from "../../components/SafeScreen";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { OPS_LABEL } from "../driver/routes/routesApi";
import { activeShelfPackages, fetchShelfContents, ShelfPackage } from "./warehouseApi";
import { ListMessage, listStyles, PickerHeader, shortDate, StaleBanner, useFocusQuery, warehouseLabel } from "./pickerUi";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerShelfDetailScreen">;

export default function PickerShelfDetailScreen({ navigation, route }: Props) {
  const { shelfId, code, warehouseId } = route.params;
  const fetcher = useCallback(() => fetchShelfContents(shelfId), [shelfId]);
  const { data, error, loading, refreshing, refresh } = useFocusQuery(fetcher);
  const packages = activeShelfPackages(data?.deliveries ?? []);

  return (
    <SafeScreen>
      <PickerHeader title={`Estantería ${data?.shelf.code ?? code}`} subtitle={warehouseLabel(warehouseId)} onBack={() => navigation.goBack()} />
      {data ? <StaleBanner error={error} /> : null}
      {data ? (
        <Text style={styles.count}>
          {packages.length ? `${packages.length} ${packages.length === 1 ? "paquete" : "paquetes"}` : "Vacía"}
          {data.shelf.name ? ` · ${data.shelf.name}` : ""}
        </Text>
      ) : null}
      <FlatList
        data={packages}
        keyExtractor={(d) => String(d.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={AppTheme.text.accent} />}
        ListEmptyComponent={<ListMessage loading={loading} error={data ? null : error} empty="No hay paquetes en esta estantería." />}
        renderItem={({ item }) => (
          <PackageRow
            item={item}
            // Se puede mover o no lo decide el servidor (custodia y estado).
            onMove={
              data
                ? () =>
                    navigation.navigate("PickerMoveShelfScreen", {
                      deliveryId: item.id,
                      tracking: item.tracking,
                      fromShelf: { id: data.shelf.id, code: data.shelf.code, name: data.shelf.name },
                      warehouseId,
                    })
                : undefined
            }
          />
        )}
      />
    </SafeScreen>
  );
}

function PackageRow({ item, onMove }: { item: ShelfPackage; onMove?: () => void }) {
  const cp = item.postal_code_norm ?? item.codigo_postal;
  const shelved = shortDate(item.shelved_at);
  const ops = item.ops_status ? OPS_LABEL[item.ops_status] ?? item.ops_status : null;
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
        {[shelved ? `Estanteado ${shelved}` : null, ops && item.ops_status !== "SHELVED" ? ops : null].filter(Boolean).join(" · ")}
      </Text>
      {onMove ? (
        <Pressable style={styles.move} onPress={onMove} hitSlop={6}>
          <Ionicons name="swap-horizontal-outline" size={16} color={AppTheme.text.accent} />
          <Text style={styles.moveText}>Mover</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  count: { color: AppTheme.text.secondary, fontSize: 13, paddingHorizontal: AppTheme.spacing.md, paddingBottom: 8 },
  flex: { color: AppTheme.text.accent, fontSize: 12, fontWeight: "800" },
  move: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.borders.primary,
  },
  moveText: { color: AppTheme.text.accent, fontWeight: "700", fontSize: 13 },
});
