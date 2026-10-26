// src/Presentation/views/picker/PickerMoveShelfScreen.tsx
// Mover un paquete a otra estantería del mismo Warehouse: se elige el destino
// con el buscador y se confirma. No recepciona: usa solo el endpoint de
// movimiento, que valida custodia, Warehouse y estado.

import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../theme/AppTheme";
import { SafeScreen } from "../../components/SafeScreen";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { playScanError, playScanSuccess } from "../../config/ScanSound";
import { fetchShelves, Shelf } from "./warehouseApi";
import { moveDelivery, MoveOutcome, moveTargets } from "./shelfMove";
import { ListMessage, listStyles, PickerHeader, StaleBanner, useFocusQuery, warehouseLabel } from "./pickerUi";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerMoveShelfScreen">;

export default function PickerMoveShelfScreen({ navigation, route }: Props) {
  const { deliveryId, tracking, fromShelf, warehouseId } = route.params;
  const { data, error, loading } = useFocusQuery(fetchShelves);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Shelf | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<MoveOutcome | null>(null);
  const targets = useMemo(() => moveTargets(data?.shelves ?? [], fromShelf.id, query), [data, fromShelf.id, query]);
  const moved = outcome?.kind === "moved";
  const label = tracking ?? `Envío #${deliveryId}`;

  const confirm = async () => {
    if (!selected || busy) return;
    setBusy(true);
    const r = await moveDelivery(deliveryId, selected);
    setOutcome(r);
    if (r.kind === "moved") playScanSuccess();
    else playScanError();
    setBusy(false);
  };

  return (
    <SafeScreen>
      <PickerHeader title="Mover de estantería" subtitle={data?.warehouse_name || warehouseLabel(warehouseId)} onBack={() => navigation.goBack()} />

      <View style={styles.packageCard}>
        <Text style={styles.packageTitle}>{label}</Text>
        <Text style={styles.packageMeta}>
          {moved ? "Estaba en" : "Está en"} {fromShelf.code}
          {fromShelf.name ? ` · ${fromShelf.name}` : ""}
        </Text>
      </View>

      {outcome ? <OutcomeBanner outcome={outcome} /> : null}

      {moved && selected ? (
        <View style={styles.doneActions}>
          <Pressable style={styles.primary} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryText}>Volver a {fromShelf.code}</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={() =>
              navigation.replace("PickerShelfDetailScreen", { shelfId: selected.id, code: selected.code, warehouseId })
            }
          >
            <Text style={styles.secondaryText}>Ver {selected.code}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {data ? <StaleBanner error={error} /> : null}
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={AppTheme.text.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar estantería destino"
              placeholderTextColor={AppTheme.text.muted}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              editable={!busy}
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityLabel="Borrar búsqueda">
                <Ionicons name="close-circle" size={18} color={AppTheme.text.muted} />
              </Pressable>
            ) : null}
          </View>
          <FlatList
            data={targets}
            keyExtractor={(s) => String(s.id)}
            keyboardShouldPersistTaps="handled"
            extraData={selected}
            ListEmptyComponent={
              <ListMessage
                loading={loading}
                error={data ? null : error}
                empty={query.trim() ? "Ninguna estantería coincide con la búsqueda." : "No hay otras estanterías activas."}
              />
            }
            renderItem={({ item }) => {
              const isSelected = selected?.id === item.id;
              return (
                <Pressable
                  style={[listStyles.row, styles.target, isSelected && styles.targetSelected]}
                  onPress={() => {
                    setSelected(item);
                    setOutcome(null);
                  }}
                  disabled={busy}
                >
                  <Ionicons
                    name={isSelected ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={isSelected ? AppTheme.text.accent : AppTheme.text.muted}
                  />
                  <View style={styles.targetInfo}>
                    <Text style={listStyles.rowTitle} numberOfLines={1}>{item.name || item.code}</Text>
                    <Text style={listStyles.rowMeta}>
                      {item.code}
                      {item.unclassified ? " · Sin clasificar" : ""}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
          <View style={styles.footer}>
            <Pressable style={[styles.primary, (!selected || busy) && styles.disabled]} onPress={confirm} disabled={!selected || busy}>
              <Text style={styles.primaryText}>
                {busy ? "Moviendo…" : selected ? `Mover de ${fromShelf.code} a ${selected.code}` : "Elegí la estantería destino"}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeScreen>
  );
}

function OutcomeBanner({ outcome }: { outcome: MoveOutcome }) {
  const ok = outcome.kind === "moved";
  const color = ok ? AppTheme.colors.success : outcome.kind === "unknown" ? AppTheme.colors.warning : AppTheme.colors.danger;
  return (
    <View style={[styles.banner, { borderColor: color }]}>
      <Text style={[styles.bannerTitle, { color }]}>
        {ok ? `Movido a ${outcome.to}` : outcome.kind === "unknown" ? "Sin respuesta del servidor" : "No se pudo mover"}
      </Text>
      {outcome.kind !== "moved" ? <Text style={styles.bannerText}>{outcome.message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  packageCard: {
    marginHorizontal: AppTheme.spacing.md,
    marginBottom: 12,
    padding: AppTheme.spacing.md,
    gap: 4,
    borderRadius: AppTheme.radius.lg,
    backgroundColor: AppTheme.surfaces.card,
  },
  packageTitle: { color: AppTheme.text.primary, fontSize: 17, fontWeight: "800" },
  packageMeta: { color: AppTheme.text.secondary, fontSize: 14 },
  banner: {
    marginHorizontal: AppTheme.spacing.md,
    marginBottom: 12,
    padding: AppTheme.spacing.md,
    gap: 4,
    borderWidth: 2,
    borderRadius: AppTheme.radius.lg,
    backgroundColor: AppTheme.surfaces.card,
  },
  bannerTitle: { fontSize: 16, fontWeight: "800" },
  bannerText: { color: AppTheme.text.primary, fontSize: 14 },
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
  target: { flexDirection: "row", alignItems: "center", gap: 12 },
  targetSelected: { borderColor: AppTheme.borders.primary, borderWidth: 1 },
  targetInfo: { flex: 1, gap: 2 },
  footer: { padding: AppTheme.spacing.md },
  doneActions: { paddingHorizontal: AppTheme.spacing.md, gap: 10 },
  primary: { alignItems: "center", paddingVertical: 14, borderRadius: AppTheme.radius.lg, backgroundColor: AppTheme.colors.primary },
  primaryText: { color: AppTheme.colors.white, fontWeight: "800", fontSize: 15 },
  secondary: { alignItems: "center", paddingVertical: 14, borderRadius: AppTheme.radius.lg, borderWidth: 1, borderColor: AppTheme.borders.primary },
  secondaryText: { color: AppTheme.text.accent, fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.5 },
});
