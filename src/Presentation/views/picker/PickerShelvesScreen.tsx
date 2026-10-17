// src/Presentation/views/picker/PickerShelvesScreen.tsx
// Estanterías del Warehouse del Picker, con buscador. Tocar una abre su
// contenido; el botón QR muestra su código para escanearlo.

import React, { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../theme/AppTheme";
import { SafeScreen } from "../../components/SafeScreen";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { fetchShelves, presentCount, Shelf, shelfQrPayload, visibleShelves } from "./warehouseApi";
import { ListMessage, listStyles, PickerHeader, StaleBanner, useFocusQuery, warehouseLabel } from "./pickerUi";
import { ShelfQrModal } from "./ShelfQrModal";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerShelvesScreen">;

export default function PickerShelvesScreen({ navigation }: Props) {
  const { data, error, loading, refreshing, refresh } = useFocusQuery(fetchShelves);
  const warehouseId = data?.warehouse_id ?? null;
  const [query, setQuery] = useState("");
  const [qrShelf, setQrShelf] = useState<Shelf | null>(null);
  const shelves = useMemo(() => visibleShelves(data?.shelves ?? [], query), [data, query]);
  const searching = query.trim().length > 0;

  return (
    <SafeScreen>
      <PickerHeader
        title="Estanterías"
        subtitle={data?.warehouse_name || warehouseLabel(warehouseId)}
        onBack={() => navigation.goBack()}
      />
      <Pressable style={styles.scanShelf} onPress={() => navigation.navigate("PickerShelfScanScreen", { warehouseId })}>
        <Ionicons name="qr-code-outline" size={20} color={AppTheme.text.accent} />
        <Text style={styles.scanShelfText}>Escanear estantería</Text>
      </Pressable>
      {data?.shelves.length ? (
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={AppTheme.text.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por nombre o código"
            placeholderTextColor={AppTheme.text.muted}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searching ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityLabel="Borrar búsqueda">
              <Ionicons name="close-circle" size={18} color={AppTheme.text.muted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {data ? <StaleBanner error={error} /> : null}
      <FlatList
        data={shelves}
        keyExtractor={(s) => String(s.id)}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={AppTheme.text.accent} />}
        ListEmptyComponent={
          <ListMessage
            loading={loading}
            error={data ? null : error}
            empty={searching ? "Ninguna estantería coincide con la búsqueda." : "Tu warehouse todavía no tiene estanterías."}
          />
        }
        renderItem={({ item }) => (
          <ShelfRow
            shelf={item}
            onPress={() =>
              navigation.navigate("PickerShelfDetailScreen", { shelfId: item.id, code: item.code, warehouseId })
            }
            onShowQr={() => setQrShelf(item)}
          />
        )}
      />
      <ShelfQrModal shelf={qrShelf} onClose={() => setQrShelf(null)} />
    </SafeScreen>
  );
}

// Sin present_count del servidor no se muestra ninguna cifra (deliveries_count
// incluye envíos cerrados).
const countLabel = (s: Shelf) => {
  const n = presentCount(s);
  if (n === null) return null;
  if (n === 0) return "Vacía";
  return n === 1 ? "1 envío" : `${n} envíos`;
};

function ShelfRow({ shelf, onPress, onShowQr }: { shelf: Shelf; onPress: () => void; onShowQr: () => void }) {
  const count = countLabel(shelf);
  const tags = [shelf.unclassified ? "Sin clasificar" : null, shelf.active ? null : "Desactivada"].filter(Boolean);
  return (
    <Pressable style={[listStyles.row, styles.row, !shelf.active && styles.inactive]} onPress={onPress}>
      <View style={styles.info}>
        <Text style={listStyles.rowTitle} numberOfLines={2}>{shelf.name || shelf.code}</Text>
        <Text style={listStyles.rowMeta}>
          {shelf.code}
          {count ? <Text style={presentCount(shelf) ? styles.count : undefined}>{`  ·  ${count}`}</Text> : null}
        </Text>
        {tags.length ? <Text style={styles.tag}>{tags.join(" · ")}</Text> : null}
      </View>
      {shelfQrPayload(shelf) ? (
        <Pressable style={styles.qrButton} onPress={onShowQr} hitSlop={6} accessibilityLabel={`Ver QR de ${shelf.code}`}>
          <Ionicons name="qr-code-outline" size={22} color={AppTheme.text.accent} />
        </Pressable>
      ) : null}
      <Ionicons name="chevron-forward" size={20} color={AppTheme.text.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  info: { flex: 1, gap: 4 },
  inactive: { opacity: 0.6 },
  count: { color: AppTheme.text.primary, fontWeight: "700" },
  tag: { color: AppTheme.colors.warning, fontSize: 12, fontWeight: "700" },
  qrButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.borders.primary,
  },
  scanShelf: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: AppTheme.spacing.md,
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.borders.primary,
    backgroundColor: AppTheme.surfaces.card,
  },
  scanShelfText: { color: AppTheme.text.accent, fontWeight: "700", fontSize: 15 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: AppTheme.spacing.md,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.borders.default,
    backgroundColor: AppTheme.surfaces.input,
  },
  searchInput: { flex: 1, color: AppTheme.text.primary, fontSize: 15, paddingVertical: 10 },
});
