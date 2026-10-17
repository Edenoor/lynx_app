// src/Presentation/views/picker/PickerMisplacedScreen.tsx
// Paquetes estanteados donde no les toca por su CP, según el servidor. Para
// reubicar uno se abre el escáner de siempre: se escanea el paquete (así se
// confirma que es el que está en la mano) y después la estantería. Al volver,
// la lista se actualiza.

import React from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../theme/AppTheme";
import { SafeScreen } from "../../components/SafeScreen";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { fetchMisplaced, MisplacedPackage } from "./warehouseApi";
import { ListMessage, listStyles, PickerHeader, shortDate, StaleBanner, useFocusQuery, warehouseLabel } from "./pickerUi";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerMisplacedScreen">;

export default function PickerMisplacedScreen({ navigation }: Props) {
  const { data, error, loading, refreshing, refresh } = useFocusQuery(fetchMisplaced);
  const warehouseId = data?.warehouse_id ?? null;
  const count = data?.deliveries.length ?? 0;

  return (
    <SafeScreen>
      <PickerHeader
        title="Descolocados"
        subtitle={warehouseLabel(warehouseId)}
        onBack={() => navigation.goBack()}
      />
      {data ? <StaleBanner error={error} /> : null}
      {count > 0 ? (
        <Text style={styles.help}>
          {count} {count === 1 ? "paquete está" : "paquetes están"} donde no les toca. Tocá uno para reubicarlo: escaneá el
          paquete y después la estantería sugerida.
        </Text>
      ) : null}
      <FlatList
        data={data?.deliveries ?? []}
        keyExtractor={(d) => String(d.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={AppTheme.text.accent} />}
        ListEmptyComponent={<ListMessage loading={loading} error={data ? null : error} empty="Todo en su lugar: no hay paquetes descolocados." />}
        renderItem={({ item }) => (
          <MisplacedRow
            item={item}
            onPress={() =>
              navigation.navigate("PickerScanScreen", {
                warehouseId,
                target: { tracking: item.tracking, expectedShelf: item.expected_shelf_code },
              })
            }
          />
        )}
      />
    </SafeScreen>
  );
}

function MisplacedRow({ item, onPress }: { item: MisplacedPackage; onPress: () => void }) {
  const cp = item.postal_code_norm ?? item.codigo_postal;
  const shelved = shortDate(item.shelved_at);
  return (
    <Pressable style={[listStyles.row, styles.row]} onPress={onPress}>
      <View style={styles.info}>
        <Text style={listStyles.rowTitle}>{item.tracking ?? `Envío #${item.id}`}</Text>
        <Text style={listStyles.rowMeta}>{[item.store, item.receiver].filter(Boolean).join(" · ")}</Text>
        <Text style={styles.move}>
          Está en {item.shelf_code} → va en {item.expected_shelf_code}
          {item.expected_unclassified ? " (su CP no tiene estantería)" : ""}
        </Text>
        <Text style={listStyles.rowMeta}>
          {[cp ? `CP ${cp}` : null, shelved ? `Estanteado ${shelved}` : null].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <Ionicons name="scan-outline" size={22} color={AppTheme.text.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  help: { color: AppTheme.text.secondary, fontSize: 13, paddingHorizontal: AppTheme.spacing.md, paddingBottom: 10 },
  row: { flexDirection: "row", alignItems: "center" },
  info: { flex: 1, gap: 4 },
  move: { color: AppTheme.colors.warning, fontSize: 14, fontWeight: "700" },
});
