// src/Presentation/views/picker/PickerColectasScreen.tsx
// Colectas del día (Argentina) para recibir una en el depósito: abiertas,
// parciales o cerradas, con buscador por colecta o tienda.

import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../theme/AppTheme";
import { SafeScreen } from "../../components/SafeScreen";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { todayIso } from "../driver/routes/routesApi";
import { Colecta, fetchColectas } from "./warehouseApi";
import { colectaReception, colectaTotals, dayLabel, searchColectas } from "./colecta";
import { ListMessage, listStyles, PickerHeader, StaleBanner, useFocusQuery } from "./pickerUi";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerColectasScreen">;

export default function PickerColectasScreen({ navigation, route }: Props) {
  const { warehouseId } = route.params;
  // El día se fija al entrar: si la pantalla queda abierta pasada la
  // medianoche, sigue mostrando el mismo día.
  const [date] = useState(todayIso);
  const fetcher = useCallback(() => fetchColectas(date), [date]);
  const { data, error, loading, refreshing, refresh } = useFocusQuery(fetcher);
  const [query, setQuery] = useState("");
  const colectas = useMemo(() => searchColectas(data ?? [], query), [data, query]);
  const searching = query.trim().length > 0;

  return (
    <SafeScreen>
      <PickerHeader title="Recepcionar colecta" subtitle={`Colectas de hoy, ${dayLabel(date)}`} onBack={() => navigation.goBack()} />
      {data?.length ? (
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={AppTheme.text.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por colecta o tienda"
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
        data={colectas}
        keyExtractor={(c) => String(c.route_id)}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={AppTheme.text.accent} />}
        ListEmptyComponent={
          <ListMessage
            loading={loading}
            error={data ? null : error}
            empty={searching ? "Ninguna colecta coincide con la búsqueda." : "No hay colectas de tiendas para hoy."}
          />
        }
        renderItem={({ item }) => (
          <ColectaRow
            colecta={item}
            onPress={() =>
              navigation.navigate("PickerColectaDetailScreen", { warehouseId, routeId: item.route_id, date, name: item.name })
            }
          />
        )}
      />
    </SafeScreen>
  );
}

const RECEPTION_COLOR = {
  open: AppTheme.text.accent,
  partial: AppTheme.colors.warning,
  closed: AppTheme.text.secondary,
};

function ColectaRow({ colecta, onPress }: { colecta: Colecta; onPress: () => void }) {
  const t = colectaTotals(colecta);
  const reception = colectaReception(colecta);
  const stores = colecta.stops.map((s) => s.store_name).filter(Boolean).join(", ");
  return (
    <Pressable
      style={[listStyles.row, styles.row]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ver colecta ${colecta.name}`}
    >
      <View style={styles.info}>
        <Text style={listStyles.rowTitle} numberOfLines={2}>{colecta.name}</Text>
        <Text style={listStyles.rowMeta} numberOfLines={2}>
          #{colecta.route_id} · {t.stores === 1 ? "1 tienda" : `${t.stores} tiendas`}{stores ? `: ${stores}` : ""}
        </Text>
        <Text style={styles.counts}>Declarados {t.declared} · Atribuidos {t.attributed}</Text>
        <Text style={[styles.reception, { color: RECEPTION_COLOR[reception.kind] }]}>{reception.label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={AppTheme.text.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  info: { flex: 1, gap: 4 },
  counts: { color: AppTheme.text.primary, fontSize: 14, fontWeight: "700" },
  reception: { fontSize: 13, fontWeight: "700" },
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
