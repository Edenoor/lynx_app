// src/Presentation/views/picker/PickerHomeScreen.tsx
// Inicio del Picker (ADMIN con perfil PICKER): en qué Warehouse opera y la
// recepción en planta. Descolocados y estanterías siguen en la Web.

import React, { useContext, useEffect, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../theme/AppTheme";
import { UserContext } from "../../context/UserContext";
import { DriverActionCard } from "../../components/DriverActionCard";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { fetchShelves, loadErrorMessage } from "./warehouseApi";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerHomeScreen">;

// El servidor no le muestra al Picker el nombre ni el tipo de su Warehouse:
// solo el ID, que sale de sus estanterías.
type WarehouseState =
  | { status: "loading" }
  | { status: "ok"; id: number; shelves: number }
  | { status: "unavailable"; reason: string };

export default function PickerHomeScreen({ navigation }: Props) {
  const { user, removeUserSession } = useContext(UserContext);
  const [warehouse, setWarehouse] = useState<WarehouseState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    fetchShelves()
      .then((r) => {
        const shelves = r.shelves.filter((s) => s.active !== false).length;
        if (alive) setWarehouse({ status: "ok", id: r.warehouse_id, shelves });
      })
      .catch((e) => {
        if (alive) setWarehouse({ status: "unavailable", reason: loadErrorMessage(e) });
      });
    return () => {
      alive = false;
    };
  }, []);

  const warehouseId = warehouse.status === "ok" ? warehouse.id : null;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={AppTheme.typography.kicker}>LYNX · DEPÓSITO</Text>
        <Text style={styles.title}>Hola{user?.first_name ? `, ${user.first_name}` : ""}</Text>

        <View style={styles.warehouse}>
          <Text style={styles.label}>Depósito operativo</Text>
          {warehouse.status === "loading" ? (
            <Text style={styles.meta}>Identificando tu warehouse…</Text>
          ) : warehouse.status === "ok" ? (
            <>
              <Text style={styles.warehouseId}>Warehouse #{warehouse.id}</Text>
              <Text style={styles.meta}>
                {warehouse.shelves} {warehouse.shelves === 1 ? "estantería activa" : "estanterías activas"}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.warehouseId}>Warehouse asignado</Text>
              <Text style={styles.meta}>
                No pudimos ver cuál es. {warehouse.reason} La recepción usa igual el warehouse asignado a tu usuario.
              </Text>
            </>
          )}
        </View>

        <DriverActionCard
          primary
          icon="scan-outline"
          title="Recibir y ubicar paquetes"
          subtitle="Escaneá el paquete y, si lo movés, la estantería"
          onPress={() => navigation.navigate("PickerScanScreen", { warehouseId })}
        />
        <DriverActionCard
          icon="file-tray-stacked-outline"
          title="Estanterías"
          subtitle="Qué paquetes hay en cada una"
          onPress={() => navigation.navigate("PickerShelvesScreen")}
        />
        <DriverActionCard
          icon="swap-horizontal-outline"
          title="Descolocados"
          subtitle="Paquetes en una estantería que no les toca"
          onPress={() => navigation.navigate("PickerMisplacedScreen")}
        />

        <Text style={styles.note}>La configuración de estanterías y los recorridos se gestionan desde la Web.</Text>
      </View>

      <Pressable style={styles.logout} onPress={removeUserSession}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppTheme.surfaces.screen, justifyContent: "space-between" },
  content: { padding: AppTheme.spacing.md, paddingTop: 32, gap: 12 },
  title: { color: AppTheme.text.primary, fontSize: 26, fontWeight: "800" },
  warehouse: {
    padding: AppTheme.spacing.md,
    gap: 4,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.borders.primary,
    backgroundColor: AppTheme.surfaces.card,
  },
  label: { color: AppTheme.text.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  warehouseId: { color: AppTheme.text.primary, fontSize: 22, fontWeight: "800" },
  meta: { color: AppTheme.text.secondary, fontSize: 14 },
  note: { color: AppTheme.text.muted, fontSize: 13, marginTop: 8 },
  logout: { margin: AppTheme.spacing.md, padding: 14, borderRadius: AppTheme.radius.md, borderWidth: 1, borderColor: AppTheme.colors.danger, alignItems: "center" },
  logoutText: { color: AppTheme.colors.danger, fontWeight: "700" },
});
