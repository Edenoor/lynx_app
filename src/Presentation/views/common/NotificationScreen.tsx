import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useNotifications, Noti } from "../../context/NotificationContext";
import { useAppTheme, useThemedStyles } from "../../theme/ThemeContext";
import type { StatusKey, Theme } from "../../theme/createTheme";
import { ThemedStatusBar } from "../../theme/ThemedStatusBar";
import { routeIdOf } from "../../config/pushKind";
import { fetchRoute, RouteDetail, STATUS_LABEL, todayIso, TYPE_LABEL } from "../driver/routes/routesApi";
import { PICKUP_ANSWER_LABEL, pickupAnswer } from "../driver/routes/pickupConfirmation";
import { capitalize, COLLECTION_STATUS_LABEL, collectionName, confirmationNoticeText, executionDayLabel } from "../driver/routes/collectionLabels";
import { errorMessage } from "../driver/errorMessage";
import {
  DriverBottomNavigation,
  DriverTabKey,
} from "../../components/DriverBottomNavigation";

const kindLabel: Record<Noti["kind"], string> = {
  NEW_TRAD: "Nuevo envío",
  TRAD_ACCEPTED: "Envío aceptado",
  ASIGNACION: "Asignación",
  DRIVER_ASIGNADO: "Driver asignado",
  ASSIGNMENT_ACCEPTED: "Aceptada",
  ASSIGNMENT_REJECTED: "Rechazada",
  ROUTE_CONFIRMATION: "Confirmación de colecta",
  TURBO_OFFER: "Turbo",
  PICKUP_ASSIGNED: "Colecta asignada",
  PICKUP_REASSIGNED: "Colecta quitada",
  ROUTE_UPDATED: "Recorrido actualizado",
  ROUTE_OFFER: "Recorrido ofrecido",
  INFO: "Info",
  ALERT: "Alerta",
};

const kindIcon: Record<Noti["kind"], keyof typeof Ionicons.glyphMap> = {
  NEW_TRAD: "flash-outline",
  TRAD_ACCEPTED: "checkmark-circle-outline",
  ASIGNACION: "cube-outline",
  DRIVER_ASIGNADO: "person-circle-outline",
  ASSIGNMENT_ACCEPTED: "checkmark-circle-outline",
  ASSIGNMENT_REJECTED: "close-circle-outline",
  ROUTE_CONFIRMATION: "calendar-outline",
  TURBO_OFFER: "flash-outline",
  PICKUP_ASSIGNED: "cube-outline",
  PICKUP_REASSIGNED: "remove-circle-outline",
  ROUTE_UPDATED: "git-compare-outline",
  ROUTE_OFFER: "map-outline",
  INFO: "information-circle-outline",
  ALERT: "alert-circle-outline",
};

// Tono de cada aviso, con los colores de estado del tema (antes: azul de marca,
// verde, rojo, ámbar y gris del oscuro).
const kindTone: Record<Noti["kind"], StatusKey> = {
  NEW_TRAD: "inTransit",
  TRAD_ACCEPTED: "delivered",
  ASIGNACION: "inTransit",
  DRIVER_ASIGNADO: "delivered",
  ASSIGNMENT_ACCEPTED: "delivered",
  ASSIGNMENT_REJECTED: "rejected",
  ROUTE_CONFIRMATION: "inTransit",
  TURBO_OFFER: "inTransit",
  PICKUP_ASSIGNED: "inTransit",
  PICKUP_REASSIGNED: "pending",
  ROUTE_UPDATED: "inTransit",
  ROUTE_OFFER: "inTransit",
  INFO: "neutral",
  ALERT: "rejected",
};

const formatDate = (ts: number) => {
  try {
    const d = new Date(ts);
    return d.toLocaleString("es-AR");
  } catch {
    return String(ts);
  }
};

const asText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const pickDataValue = (data: unknown, keys: string[]): string => {
  if (!data || typeof data !== "object") return "";

  const record = data as Record<string, unknown>;

  for (const key of keys) {
    const value = asText(record[key]);
    if (value) return value;
  }

  return "";
};

const getAssignmentVisualState = (item: Noti | null) => {
  if (!item) return "default";

  const response = pickDataValue(item.data, [
    "assignment_response",
    "assignmentResponse",
    "response",
    "status",
  ]).toLowerCase();

  if (
    item.kind === "ASSIGNMENT_ACCEPTED" ||
    response === "accepted" ||
    response === "aceptada" ||
    response === "aceptado"
  ) {
    return "accepted";
  }

  if (
    item.kind === "ASSIGNMENT_REJECTED" ||
    response === "rejected" ||
    response === "rechazada" ||
    response === "rechazado"
  ) {
    return "rejected";
  }

  if (item.kind === "ASIGNACION") {
    return "pending";
  }

  return "default";
};

const getVisualTone = (item: Noti): StatusKey => {
  const visualState = getAssignmentVisualState(item);

  if (visualState === "accepted") return "confirmed";
  if (visualState === "rejected") return "rejected";

  return kindTone[item.kind] ?? "inTransit";
};

const getVisualLabel = (item: Noti) => {
  const visualState = getAssignmentVisualState(item);

  if (visualState === "accepted") return "Asignación aceptada";
  if (visualState === "rejected") return "Asignación rechazada";
  if (visualState === "pending" && item.kind === "ASIGNACION") {
    return "Asignación pendiente";
  }

  return kindLabel[item.kind] ?? "Notificación";
};

// El aviso de confirmación de colecta llega con «Ronda … hoy/mañana»: se
// muestra rearmado con la fecha de la colecta, calculado al verlo.
const displayText = (item: Noti) =>
  item.kind === "ROUTE_CONFIRMATION" ? confirmationNoticeText(item.data, todayIso()) : { title: item.title, body: item.body };

// Avisos de un recorrido puntual: al abrirlos se consulta cómo está ahora,
// en vez de confiar en lo que decía el push.
const LIVE_ROUTE_KINDS: Noti["kind"][] = ["PICKUP_ASSIGNED", "ROUTE_CONFIRMATION", "ROUTE_UPDATED"];
type LiveRoute = { loading: true } | { route: RouteDetail } | { error: string };

const DetailRow = ({ label, value }: { label: string; value?: string }) => {
  const styles = useThemedStyles(makeStyles);
  if (!value) return null;

  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
};

const Item = ({ item, onPress }: { item: Noti; onPress: () => void }) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const tone = theme.status[getVisualTone(item)];
  const color = tone.text;
  const visualState = getAssignmentVisualState(item);

  return (
    <TouchableOpacity
      style={[
        theme.listItem,
        styles.item,
        visualState === "accepted" && styles.itemAccepted,
        visualState === "rejected" && styles.itemRejected,
      ]}
      onPress={onPress}
      activeOpacity={0.84}
    >
      <View style={[styles.itemIcon, { backgroundColor: tone.background }]}>
        <Ionicons
          name={kindIcon[item.kind] ?? "notifications-outline"}
          size={18}
          color={color}
        />
      </View>

      <View style={styles.itemContent}>
        <View style={styles.itemTopRow}>
          <Text style={[styles.itemKind, { color }]}>
            {getVisualLabel(item)}
          </Text>

          {!item.read && <View style={styles.unreadDot} />}
        </View>

        <Text style={styles.itemTitle} numberOfLines={1}>
          {displayText(item).title}
        </Text>

        {!!displayText(item).body && (
          <Text style={styles.itemBody} numberOfLines={2}>
            {displayText(item).body}
          </Text>
        )}

        <Text style={styles.itemDate}>{formatDate(item.createdAt)}</Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={theme.text.muted}
      />
    </TouchableOpacity>
  );
};

const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { items, markRead, markAllRead, remove, clear } = useNotifications();
  const [selected, setSelected] = useState<Noti | null>(null);
  const [live, setLive] = useState<LiveRoute | null>(null);

  const selectedRouteId = selected && LIVE_ROUTE_KINDS.includes(selected.kind) ? routeIdOf(selected.data) : null;
  useEffect(() => {
    if (!selectedRouteId) { setLive(null); return; }
    let cancelled = false;
    setLive({ loading: true });
    fetchRoute(selectedRouteId)
      .then((route) => { if (!cancelled) setLive({ route }); })
      .catch((e) => { if (!cancelled) setLive({ error: errorMessage(e, "No se pudo consultar") }); });
    return () => { cancelled = true; };
  }, [selectedRouteId, selected?.id]);

  const liveRoute = live && "route" in live ? live.route : null;
  const liveAnswer = liveRoute ? pickupAnswer(liveRoute) : null;
  const liveName = selected?.data?.template_name
    ? String(selected.data.template_name)
    : liveRoute ? (liveRoute.type === "PICKUP" ? collectionName(liveRoute) : `${TYPE_LABEL[liveRoute.type]} #${liveRoute.id}`) : "";
  const liveState = !live ? "" : "loading" in live ? "Consultando…" : "error" in live
    ? `No disponible (${live.error})`
    : (liveRoute!.type === "PICKUP" ? COLLECTION_STATUS_LABEL[liveRoute!.status] : STATUS_LABEL[liveRoute!.status]) ?? liveRoute!.status;
  const openRoute = (fallback: "CollectionsScreen" | "RoutesScreen") => {
    const routeId = selected ? routeIdOf(selected.data) : null;
    if (selected) markRead(selected.id);
    setSelected(null);
    if (routeId) (navigation as any).navigate("RouteDetailScreen", { routeId, name: liveName || undefined });
    else (navigation as any).navigate(fallback);
  };
  const openList = (screen: "CollectionsScreen" | "RoutesScreen") => {
    if (selected) markRead(selected.id);
    setSelected(null);
    (navigation as any).navigate(screen);
  };

  const data = useMemo(
    () => [...items].sort((a, b) => b.createdAt - a.createdAt),
    [items]
  );

  const unreadCount = useMemo(
    () => items.filter((item) => !item.read).length,
    [items]
  );

  const selectedTone = theme.status[selected ? getVisualTone(selected) : "inTransit"];
  const selectedColor = selectedTone.text;

  const selectedTracking = selected
    ? pickDataValue(selected.data, [
        "tracking",
        "tracking_number",
        "trackingNumber",
        "shipment_id",
        "shipmentId",
        "delivery_id",
        "deliveryId",
        "id",
      ])
    : "";

  const selectedStore = selected
    ? pickDataValue(selected.data, [
        "store",
        "store_name",
        "storeName",
        "seller",
        "seller_name",
        "sellerName",
      ])
    : "";

  const selectedAddress = selected
    ? pickDataValue(selected.data, [
        "address",
        "direccion",
        "domicilio",
        "destination",
        "receiver_address",
      ])
    : "";

  const selectedZone = selected
    ? pickDataValue(selected.data, [
        "zone",
        "zona",
        "localidad",
        "city",
        "barrio",
      ])
    : "";

  const selectedType = selected
    ? pickDataValue(selected.data, [
        "delivery_type",
        "deliveryType",
        "metodo_envio",
        "metodoEnvio",
      ])
    : "";

  const selectedStatus = selected ? getVisualLabel(selected) : "";

  const handleTabPress = useCallback(
    (tab: DriverTabKey) => {
      if (tab === "activity") return;

      if (tab === "home") {
        navigation.navigate("DriverScreen");
        return;
      }

      if (tab === "deliveries") {
        navigation.navigate("EnviosScreen");
        return;
      }

      if (tab === "scan") {
        navigation.navigate("DriverScanOptionsScreen");
      }
    },
    [navigation]
  );

  return (
    <View style={styles.container}>
      <ThemedStatusBar />
      <View style={styles.header}>
        <Text style={styles.kicker}>LYNX DRIVER</Text>
        <Text style={styles.title}>Alertas</Text>
        <Text style={styles.subtitle}>
          {unreadCount > 0
            ? `${unreadCount} notificación${unreadCount === 1 ? "" : "es"} sin leer`
            : "No tenés alertas pendientes"}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            activeOpacity={0.78}
            onPress={markAllRead}
            style={styles.actionButton}
          >
            <Text style={styles.actionText}>Marcar leídas</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.78}
            onPress={clear}
            style={[styles.actionButton, styles.actionButtonDanger]}
          >
            <Text style={[styles.actionText, styles.actionTextDanger]}>
              Vaciar
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={data}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: theme.list.gap }} />}
        renderItem={({ item }) => (
          <Item
            item={item}
            onPress={() => {
              setSelected(item);
              if (!item.read) markRead(item.id);
            }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name="notifications-off-outline"
              size={36}
              color={theme.text.muted}
            />
            <Text style={styles.emptyTitle}>Sin notificaciones</Text>
            <Text style={styles.emptyTxt}>
              Cuando haya novedades operativas, las vas a ver acá.
            </Text>
          </View>
        }
      />

      <DriverBottomNavigation activeTab="activity" onPress={handleTabPress} />

      <Modal
        transparent
        visible={!!selected}
        onRequestClose={() => setSelected(null)}
        animationType="fade"
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHero}>
              <View
                style={[
                  styles.modalIcon,
                  { backgroundColor: selectedTone.background, borderColor: selectedTone.border },
                ]}
              >
                <Ionicons
                  name={
                    selected
                      ? kindIcon[selected.kind] ?? "notifications-outline"
                      : "notifications-outline"
                  }
                  size={24}
                  color={selectedColor}
                />
              </View>

              <Pressable
                onPress={() => setSelected(null)}
                style={styles.closeBtn}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={theme.text.primary}
                />
              </Pressable>
            </View>

            <View style={styles.modalHeader}>
              <Text style={[styles.modalKind, { color: selectedColor }]}>
                {selectedStatus}
              </Text>

              <Text style={styles.modalTitle}>{selected ? displayText(selected).title : ""}</Text>

              {!!selected && !!displayText(selected).body && (
                <Text style={styles.modalBody}>{displayText(selected).body}</Text>
              )}
            </View>

            <View style={styles.detailBox}>
              {live ? (
                <>
                  <DetailRow label={liveRoute && liveRoute.type !== "PICKUP" ? "Recorrido" : "Colecta"} value={liveName} />
                  <DetailRow label="Día" value={liveRoute ? capitalize(executionDayLabel(liveRoute.scheduled_date, todayIso())) : ""} />
                  <DetailRow label="Estado actual" value={liveState} />
                  <DetailRow label="Confirmación" value={liveAnswer ? PICKUP_ANSWER_LABEL[liveAnswer] : ""} />
                </>
              ) : (
                <DetailRow label="Estado" value={selectedStatus} />
              )}
              <DetailRow label="Tracking" value={selectedTracking} />
              <DetailRow label="Tienda / Seller" value={selectedStore} />
              <DetailRow label="Tipo" value={selectedType} />
              <DetailRow label="Zona" value={selectedZone} />
              <DetailRow label="Dirección" value={selectedAddress} />
              <DetailRow
                label="Fecha"
                value={selected ? formatDate(selected.createdAt) : ""}
              />
            </View>

            <View style={styles.modalFooter}>
              {selected?.kind === "TURBO_OFFER" && (
                <Pressable
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => {
                    markRead(selected.id);
                    setSelected(null);
                    (navigation as any).navigate("TurboOffersScreen");
                  }}
                >
                  <Text style={styles.btnTxtPrimary}>Ver ofertas</Text>
                </Pressable>
              )}
              {(selected?.kind === "PICKUP_ASSIGNED" || selected?.kind === "ROUTE_CONFIRMATION") && (
                <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => openRoute("CollectionsScreen")}>
                  <Text style={styles.btnTxtPrimary}>Ver colecta</Text>
                </Pressable>
              )}
              {selected?.kind === "ROUTE_UPDATED" && (
                <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => openRoute("RoutesScreen")}>
                  <Text style={styles.btnTxtPrimary}>Ver recorrido</Text>
                </Pressable>
              )}
              {selected?.kind === "PICKUP_REASSIGNED" && (
                <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => openList("CollectionsScreen")}>
                  <Text style={styles.btnTxtPrimary}>Ver colectas</Text>
                </Pressable>
              )}
              {selected?.kind === "ROUTE_OFFER" && (
                <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => openList("RoutesScreen")}>
                  <Text style={styles.btnTxtPrimary}>Ver ofertas</Text>
                </Pressable>
              )}
              {!!selected && (
                <Pressable
                  style={[styles.btn, styles.btnDanger]}
                  onPress={() => {
                    remove(selected.id);
                    setSelected(null);
                  }}
                >
                  <Text style={[styles.btnTxt, styles.btnTxtDanger]}>
                    Eliminar
                  </Text>
                </Pressable>
              )}

              <Pressable
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => setSelected(null)}
              >
                <Text style={styles.btnTxtPrimary}>Cerrar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

export default NotificationsScreen;

const makeStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.surfaces.screen,
  },

  header: {
    paddingTop: t.layout.headerTopPadding,
    paddingHorizontal: t.layout.screenPadding,
    paddingBottom: t.spacing.md,
  },

  kicker: {
    ...t.typography.kicker,
  },

  title: {
    ...t.typography.titleLg,
    marginTop: t.spacing.xs,
  },

  subtitle: {
    ...t.typography.body,
    marginTop: t.spacing.sm,
  },

  actions: {
    flexDirection: "row",
    gap: t.spacing.sm,
    marginTop: t.spacing.md,
  },

  actionButton: {
    minHeight: 36,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radius.full,
    backgroundColor: t.overlays.primary,
    borderWidth: 1,
    borderColor: t.borders.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  actionButtonDanger: {
    backgroundColor: t.status.rejected.background,
    borderColor: t.status.rejected.border,
  },

  actionText: {
    color: t.text.accent,
    fontSize: 12,
    fontWeight: t.font.weight.black,
  },

  actionTextDanger: {
    color: t.status.rejected.text,
  },

  listContent: {
    paddingHorizontal: t.layout.screenPadding,
    paddingBottom: 124,
  },

  // Superficie, borde y radio: theme.listItem (en Minimal, fila con separador).
  item: {
    padding: t.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.md,
  },

  itemAccepted: {
    borderColor: t.status.confirmed.border,
  },

  itemRejected: {
    borderColor: t.status.rejected.border,
  },

  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: t.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },

  itemContent: {
    flex: 1,
  },

  itemTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },

  itemKind: {
    fontSize: 10,
    fontWeight: t.font.weight.black,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: t.radius.full,
    backgroundColor: t.status.rejected.text,
  },

  itemTitle: {
    color: t.text.primary,
    fontSize: 15,
    fontWeight: t.font.weight.black,
  },

  itemBody: {
    color: t.text.secondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: t.font.weight.medium,
    marginTop: 2,
  },

  itemDate: {
    color: t.text.muted,
    fontSize: 11,
    fontWeight: t.font.weight.bold,
    marginTop: 5,
  },

  empty: {
    alignItems: "center",
    marginTop: 54,
    paddingHorizontal: t.spacing.lg,
  },

  emptyTitle: {
    color: t.text.primary,
    fontSize: 16,
    fontWeight: t.font.weight.black,
    marginTop: t.spacing.md,
  },

  emptyTxt: {
    color: t.text.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: t.overlays.camera,
    justifyContent: "center",
    padding: t.spacing.lg,
  },

  modalCard: {
    borderRadius: t.radius.xxl,
    backgroundColor: t.surfaces.screenAlt,
    borderWidth: 1,
    borderColor: t.borders.medium,
    padding: t.spacing.lg,
  },

  modalHero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  modalIcon: {
    width: 54,
    height: 54,
    borderRadius: t.radius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  modalHeader: {
    marginTop: t.spacing.md,
  },

  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: t.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.surfaces.card,
    borderWidth: 1,
    borderColor: t.borders.soft,
  },

  modalKind: {
    fontSize: 10,
    fontWeight: t.font.weight.black,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  modalTitle: {
    color: t.text.primary,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: t.font.weight.black,
    marginTop: t.spacing.xs,
  },

  modalBody: {
    color: t.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: t.font.weight.medium,
    marginTop: t.spacing.sm,
  },

  detailBox: {
    marginTop: t.spacing.lg,
    borderRadius: t.radius.xl,
    backgroundColor: t.surfaces.card,
    borderWidth: 1,
    borderColor: t.borders.soft,
    overflow: "hidden",
  },

  detailRow: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderBottomWidth: t.separator.width,
    borderBottomColor: t.separator.color,
    gap: 3,
  },

  detailLabel: {
    color: t.text.muted,
    fontSize: 10,
    fontWeight: t.font.weight.black,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  detailValue: {
    color: t.text.primary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: t.font.weight.bold,
  },

  modalFooter: {
    marginTop: t.spacing.lg,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: t.spacing.sm,
  },

  btn: {
    minHeight: 42,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },

  btnPrimary: {
    backgroundColor: t.colors.primary,
  },

  btnDanger: {
    backgroundColor: t.status.rejected.background,
    borderWidth: 1,
    borderColor: t.status.rejected.border,
  },

  btnTxtPrimary: {
    color: t.text.onPrimary,
    fontWeight: t.font.weight.black,
  },

  btnTxt: {
    fontWeight: t.font.weight.black,
  },

  btnTxtDanger: {
    color: t.status.rejected.text,
  },
});