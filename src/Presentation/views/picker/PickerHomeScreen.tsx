// src/Presentation/views/picker/PickerHomeScreen.tsx
// Inicio del Picker (ADMIN con perfil PICKER): en qué Warehouse opera,
// Baúl de choferes, Estanterías y Descolocados. La recepción se abre desde el
// QR central.

import React, { useCallback, useContext, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import AppTheme from "../../theme/AppTheme";
import { SafeScreen } from "../../components/SafeScreen";
import { UserContext } from "../../context/UserContext";
import { hasPermission, PERMISSION } from "../../navigator/appArea";
import { DriverActionCard } from "../../components/DriverActionCard";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { fetchShelves, loadErrorMessage } from "./warehouseApi";
import { PickerBottomNavigation, usePickerBottomSpace } from "./PickerBottomNavigation";
import { refreshUnreadCount } from "./notificationsApi";
import { usePickerPush } from "./pickerPush";
import { GetAdminCapabilitiesUseCase } from "../../../Domain/useCases/auth/GetAdminCapabilities";
import { assignedWarehouseProblem, AssignedWarehouse } from "./assignedWarehouse";
import { refreshChatUnread } from "../driver/chat/chatStore";

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
  const bottomSpace = usePickerBottomSpace();
  // Depósito asignado según el servidor (undefined: todavía no se sabe o el
  // servidor no lo informa; ahí queda lo de siempre).
  const [assigned, setAssigned] = useState<AssignedWarehouse | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    GetAdminCapabilitiesUseCase()
      .then((c) => { if (alive) setAssigned(c.assignedWarehouse); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);
  const problem = assignedWarehouseProblem(assigned);

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

  // La campana se actualiza cada vez que se vuelve al inicio.
  useFocusEffect(
    useCallback(() => {
      refreshUnreadCount();
      void refreshChatUnread();
    }, []),
  );

  usePickerPush(
    () => navigation.navigate("PickerNotificationsScreen", { warehouseId }),
    (conversationId) => conversationId
      ? navigation.navigate("PickerChatScreen", { conversationId })
      : navigation.navigate("PickerNotificationsScreen", { warehouseId, tab: "messages" }),
  );

  return (
    <SafeScreen edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomSpace }]}>
        <View style={styles.content}>
          <Text style={AppTheme.typography.kicker}>LYNX · DEPÓSITO</Text>
          <Text style={styles.title}>Hola{user?.first_name ? `, ${user.first_name}` : ""}</Text>

          <View style={styles.warehouse}>
            <Text style={styles.label}>Depósito operativo</Text>
            {problem ? (
              <>
                <Text style={styles.warehouseId}>Sin depósito para operar</Text>
                <Text style={styles.meta}>{problem}</Text>
              </>
            ) : warehouse.status === "loading" ? (
              <Text style={styles.meta}>Identificando tu warehouse…</Text>
            ) : warehouse.status === "ok" ? (
              <>
                <Text style={styles.warehouseId}>{assigned?.name ?? `Warehouse #${warehouse.id}`}</Text>
                <Text style={styles.meta}>
                  {warehouse.shelves} {warehouse.shelves === 1 ? "estantería activa" : "estanterías activas"}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.warehouseId}>{assigned?.name ?? "Depósito asignado"}</Text>
                <Text style={styles.meta}>
                  {assigned ? "No podés ver sus estanterías, pero lo que recibas va a este depósito." : `No pudimos ver cuál es. ${warehouse.reason}`}
                </Text>
              </>
            )}
          </View>

          {/* Cada acceso aparece solo con su permiso (el servidor rechazaría el resto). */}
          {!problem && hasPermission(user, PERMISSION.BAUL_VER, PERMISSION.BAUL_OPERAR) ? (
            <DriverActionCard
              icon="briefcase-outline"
              title="Baúl de choferes"
              subtitle="Recibir paquetes, cambios y cobranzas"
              onPress={() => navigation.navigate("PickerBaulScreen")}
            />
          ) : null}
          {!problem && hasPermission(user, PERMISSION.DEPOSITO_VER) ? (
            <>
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
            </>
          ) : null}

          <Text style={styles.note}>La configuración de estanterías y los recorridos se gestionan desde la Web.</Text>
        </View>

        <Pressable style={styles.logout} onPress={removeUserSession}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>

      {problem ? null : <PickerBottomNavigation activeTab="home" warehouseId={warehouseId} />}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "space-between" },
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
