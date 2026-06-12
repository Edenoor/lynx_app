import React, { useCallback, useMemo, useState } from "react";
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
import AppTheme from "../../theme/AppTheme";
import {
  DriverBottomNavigation,
  DriverTabKey,
} from "../../components/DriverBottomNavigation";

const kindLabel: Record<Noti["kind"], string> = {
  NEW_TRAD: "Nuevo envío",
  TRAD_ACCEPTED: "Envío aceptado",
  INFO: "Info",
  ALERT: "Alerta",
};

const kindIcon: Record<Noti["kind"], keyof typeof Ionicons.glyphMap> = {
  NEW_TRAD: "flash-outline",
  TRAD_ACCEPTED: "checkmark-circle-outline",
  INFO: "information-circle-outline",
  ALERT: "alert-circle-outline",
};

const kindColor: Record<Noti["kind"], string> = {
  NEW_TRAD: AppTheme.colors.primary,
  TRAD_ACCEPTED: AppTheme.colors.success,
  INFO: AppTheme.text.secondary,
  ALERT: AppTheme.colors.danger,
};

const formatDate = (ts: number) => {
  try {
    const d = new Date(ts);
    return d.toLocaleString("es-AR");
  } catch {
    return String(ts);
  }
};

const Item = ({
  item,
  onPress,
}: {
  item: Noti;
  onPress: () => void;
}) => {
  const color = kindColor[item.kind] ?? AppTheme.colors.primary;

  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.84}>
      <View style={styles.itemIcon}>
        <Ionicons
          name={kindIcon[item.kind] ?? "notifications-outline"}
          size={18}
          color={color}
        />
      </View>

      <View style={styles.itemContent}>
        <View style={styles.itemTopRow}>
          <Text style={[styles.itemKind, { color }]}>
            {kindLabel[item.kind] ?? "Notificación"}
          </Text>

          {!item.read && <View style={styles.unreadDot} />}
        </View>

        <Text style={styles.itemTitle} numberOfLines={1}>
          {item.title}
        </Text>

        {!!item.body && (
          <Text style={styles.itemBody} numberOfLines={2}>
            {item.body}
          </Text>
        )}

        <Text style={styles.itemDate}>{formatDate(item.createdAt)}</Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={AppTheme.text.muted}
      />
    </TouchableOpacity>
  );
};

const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { items, markRead, markAllRead, remove, clear } = useNotifications();
  const [selected, setSelected] = useState<Noti | null>(null);

  const data = useMemo(
    () => [...items].sort((a, b) => b.createdAt - a.createdAt),
    [items]
  );

  const unreadCount = useMemo(
    () => items.filter((item) => !item.read).length,
    [items]
  );

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
  return;
}

      if (tab === "profile") {
        navigation.navigate("DriverAccountScreen");
      }
    },
    [navigation]
  );

  return (
    <View style={styles.container}>
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
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
              color={AppTheme.text.muted}
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
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalKind}>
                  {selected ? kindLabel[selected.kind] : ""}
                </Text>
                <Text style={styles.modalTitle}>{selected?.title}</Text>
              </View>

              <Pressable
                onPress={() => setSelected(null)}
                style={styles.closeBtn}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={AppTheme.text.primary}
                />
              </Pressable>
            </View>

            {!!selected?.body && (
              <Text style={styles.modalBody}>{selected.body}</Text>
            )}

            {!!selected?.data && (
              <View style={styles.modalDataBox}>
                <Text style={styles.modalData}>
                  {JSON.stringify(selected.data, null, 2)}
                </Text>
              </View>
            )}

            <View style={styles.modalFooter}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.surfaces.screen,
  },

  header: {
    paddingTop: AppTheme.layout.headerTopPadding,
    paddingHorizontal: AppTheme.layout.screenPadding,
    paddingBottom: AppTheme.spacing.md,
  },

  kicker: {
    ...AppTheme.typography.kicker,
  },

  title: {
    ...AppTheme.typography.titleLg,
    marginTop: AppTheme.spacing.xs,
  },

  subtitle: {
    ...AppTheme.typography.body,
    marginTop: AppTheme.spacing.sm,
  },

  actions: {
    flexDirection: "row",
    gap: AppTheme.spacing.sm,
    marginTop: AppTheme.spacing.md,
  },

  actionButton: {
    minHeight: 36,
    paddingHorizontal: AppTheme.spacing.md,
    borderRadius: AppTheme.radius.full,
    backgroundColor: AppTheme.overlays.primary,
    borderWidth: 1,
    borderColor: AppTheme.borders.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  actionButtonDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.10)",
    borderColor: "rgba(239, 68, 68, 0.24)",
  },

  actionText: {
    color: AppTheme.colors.primary,
    fontSize: 12,
    fontWeight: AppTheme.font.weight.black,
  },

  actionTextDanger: {
    color: AppTheme.colors.danger,
  },

  listContent: {
    paddingHorizontal: AppTheme.layout.screenPadding,
    paddingBottom: 124,
  },

  item: {
    borderRadius: AppTheme.radius.xl,
    backgroundColor: AppTheme.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: AppTheme.borders.soft,
    padding: AppTheme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.md,
  },

  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: AppTheme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.overlays.primary,
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
    fontWeight: AppTheme.font.weight.black,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: AppTheme.radius.full,
    backgroundColor: AppTheme.colors.danger,
  },

  itemTitle: {
    color: AppTheme.text.primary,
    fontSize: 15,
    fontWeight: AppTheme.font.weight.black,
  },

  itemBody: {
    color: AppTheme.text.secondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: AppTheme.font.weight.medium,
    marginTop: 2,
  },

  itemDate: {
    color: AppTheme.text.muted,
    fontSize: 11,
    fontWeight: AppTheme.font.weight.bold,
    marginTop: 5,
  },

  empty: {
    alignItems: "center",
    marginTop: 54,
    paddingHorizontal: AppTheme.spacing.lg,
  },

  emptyTitle: {
    color: AppTheme.text.primary,
    fontSize: 16,
    fontWeight: AppTheme.font.weight.black,
    marginTop: AppTheme.spacing.md,
  },

  emptyTxt: {
    color: AppTheme.text.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: AppTheme.overlays.camera,
    justifyContent: "center",
    padding: AppTheme.spacing.lg,
  },

  modalCard: {
    borderRadius: AppTheme.radius.xxl,
    backgroundColor: AppTheme.surfaces.screenAlt,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    padding: AppTheme.spacing.lg,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: AppTheme.spacing.md,
  },

  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: AppTheme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.surfaces.card,
    borderWidth: 1,
    borderColor: AppTheme.borders.soft,
  },

  modalKind: {
    ...AppTheme.typography.kicker,
  },

  modalTitle: {
    color: AppTheme.text.primary,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: AppTheme.font.weight.black,
    marginTop: AppTheme.spacing.xs,
  },

  modalBody: {
    color: AppTheme.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: AppTheme.font.weight.medium,
    marginTop: AppTheme.spacing.md,
  },

  modalDataBox: {
    marginTop: AppTheme.spacing.md,
    borderRadius: AppTheme.radius.lg,
    backgroundColor: AppTheme.surfaces.card,
    borderWidth: 1,
    borderColor: AppTheme.borders.soft,
    padding: AppTheme.spacing.md,
  },

  modalData: {
    color: AppTheme.text.muted,
    fontSize: 11,
  },

  modalFooter: {
    marginTop: AppTheme.spacing.lg,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: AppTheme.spacing.sm,
  },

  btn: {
    minHeight: 42,
    paddingHorizontal: AppTheme.spacing.md,
    borderRadius: AppTheme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },

  btnPrimary: {
    backgroundColor: AppTheme.colors.primary,
  },

  btnDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.28)",
  },

  btnTxtPrimary: {
    color: AppTheme.colors.white,
    fontWeight: AppTheme.font.weight.black,
  },

  btnTxt: {
    fontWeight: AppTheme.font.weight.black,
  },

  btnTxtDanger: {
    color: AppTheme.colors.danger,
  },
});