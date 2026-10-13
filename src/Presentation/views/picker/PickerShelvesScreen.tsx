// src/Presentation/views/picker/PickerShelvesScreen.tsx
// Estanterías del Warehouse del Picker, con cuántos paquetes tiene cada una.
// Tocar una abre su contenido.

import React from "react";
import { FlatList, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../theme/AppTheme";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { fetchShelves, Shelf } from "./warehouseApi";
import { ListMessage, listStyles, PickerHeader, StaleBanner, useFocusQuery, warehouseLabel } from "./pickerUi";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerShelvesScreen">;

export default function PickerShelvesScreen({ navigation }: Props) {
  const { data, error, loading, refreshing, refresh } = useFocusQuery(fetchShelves);
  const warehouseId = data?.warehouse_id ?? null;

  return (
    <SafeAreaView style={styles.screen}>
      <PickerHeader
        title="Estanterías"
        subtitle={warehouseLabel(warehouseId)}
        onBack={() => navigation.goBack()}
        onScan={() => navigation.navigate("PickerScanScreen", { warehouseId })}
      />
      {data ? <StaleBanner error={error} /> : null}
      <FlatList
        data={data?.shelves ?? []}
        keyExtractor={(s) => String(s.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={AppTheme.text.accent} />}
        ListEmptyComponent={
          <ListMessage loading={loading} error={data ? null : error} empty="Tu warehouse todavía no tiene estanterías." />
        }
        renderItem={({ item }) => (
          <ShelfRow
            shelf={item}
            onPress={() =>
              navigation.navigate("PickerShelfDetailScreen", { shelfId: item.id, code: item.code, warehouseId })
            }
          />
        )}
      />
    </SafeAreaView>
  );
}

function ShelfRow({ shelf, onPress }: { shelf: Shelf; onPress: () => void }) {
  const tags = [shelf.unclassified ? "Sin clasificar" : null, shelf.active ? null : "Desactivada"].filter(Boolean);
  return (
    <Pressable style={[listStyles.row, styles.row, !shelf.active && styles.inactive]} onPress={onPress}>
      <View style={styles.info}>
        <Text style={listStyles.rowTitle}>
          {shelf.code}
          {shelf.name ? <Text style={listStyles.rowMeta}>  {shelf.name}</Text> : null}
        </Text>
        <Text style={listStyles.rowMeta}>
          {shelf.deliveries_count} {shelf.deliveries_count === 1 ? "paquete" : "paquetes"}
          {shelf.unclassified ? "" : ` · ${shelf.postal_codes_count} CP`}
        </Text>
        {tags.length ? <Text style={styles.tag}>{tags.join(" · ")}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={AppTheme.text.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppTheme.surfaces.screen },
  row: { flexDirection: "row", alignItems: "center" },
  info: { flex: 1, gap: 4 },
  inactive: { opacity: 0.6 },
  tag: { color: AppTheme.colors.warning, fontSize: 12, fontWeight: "700" },
});
