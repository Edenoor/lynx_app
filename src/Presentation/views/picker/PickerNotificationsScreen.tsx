// src/Presentation/views/picker/PickerNotificationsScreen.tsx
// Alertas del Picker, en dos pestañas:
//   Notificaciones  la bandeja del servidor. El contrato actual devuelve solo
//                   las no vistas (hasta 20): marcar una como vista no la saca
//                   de la lista hasta actualizar, pero después ya no vuelve.
//   Mensajes        el chat interno: sus charlas de a uno y «Nueva charla».

import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import AppTheme from "../../theme/AppTheme";
import { SafeScreen } from "../../components/SafeScreen";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { fetchMyNotifications, InboxNotification, INBOX_LIMIT, markNotificationsSeen, setUnreadCount, splitChatRows } from "./notificationsApi";
import { loadErrorMessage } from "./warehouseApi";
import { ListMessage, listStyles, shortDate } from "./pickerUi";
import { PickerBottomNavigation, usePickerBottomSpace } from "./PickerBottomNavigation";
import ChatListPanel from "../driver/chat/ChatListPanel";
import { refreshChatUnread, useChatUnread } from "../driver/chat/chatStore";

type AlertsTab = "notifications" | "messages";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerNotificationsScreen">;

export default function PickerNotificationsScreen({ route, navigation }: Props) {
  const { warehouseId } = route.params;
  const [tab, setTab] = useState<AlertsTab>(route.params.tab === "messages" ? "messages" : "notifications");
  // Volver desde una charla (o un push) con la pantalla ya abierta pide la pestaña Mensajes.
  useEffect(() => {
    if (route.params.tab) setTab(route.params.tab);
  }, [route.params]);
  const chatUnread = useChatUnread();
  const bottomSpace = usePickerBottomSpace();
  const [items, setItems] = useState<InboxNotification[] | null>(null);
  const [seen, setSeen] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (manual: boolean) => {
    if (manual) setRefreshing(true);
    try {
      const { notifications: list, chatIds } = splitChatRows(await fetchMyNotifications());
      setItems(list);
      setSeen(new Set());
      setUnreadCount(list.length);
      setError(null);
      if (chatIds.length) markNotificationsSeen(chatIds).catch(() => undefined);
    } catch (e) {
      setError(loadErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
      void refreshChatUnread();
    }, [load]),
  );

  const markSeen = async (ids: number[]) => {
    if (!ids.length || busy) return;
    setBusy(true);
    try {
      await markNotificationsSeen(ids);
      const next = new Set(seen);
      ids.forEach((id) => next.add(id));
      setSeen(next);
      setUnreadCount((items?.length ?? 0) - next.size);
      setError(null);
    } catch (e) {
      setError(loadErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const unseenIds = (items ?? []).filter((n) => !seen.has(n.id)).map((n) => n.id);

  return (
    <SafeScreen edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={AppTheme.typography.kicker}>LYNX · DEPÓSITO</Text>
        <Text style={styles.title}>Alertas</Text>
        <View style={styles.tabs} accessibilityRole="tablist">
          {([
            ["notifications", "Notificaciones", items ? items.length - seen.size : 0],
            ["messages", "Mensajes", chatUnread ?? 0],
          ] as const).map(([key, label, n]) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                style={[styles.tab, active && styles.tabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={n ? `${label}: ${n}` : label}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>{label}</Text>
                {n ? (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{n > 99 ? "99+" : n}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        {tab === "notifications" && unseenIds.length ? (
          <Pressable style={styles.markAll} onPress={() => markSeen(unseenIds)} disabled={busy} hitSlop={8}>
            <Text style={styles.markAllText}>Marcar todas como vistas</Text>
          </Pressable>
        ) : null}
      </View>

      {tab === "messages" ? (
        <ChatListPanel
          navigation={navigation}
          bottomSpace={bottomSpace}
          assistant={false}
          chatRoute="PickerChatScreen"
          onNewChat={() => navigation.navigate("PickerChatPeopleScreen")}
          emptyText="Todavía no tenés charlas. Tocá «Nueva charla» para escribirle a alguien del equipo."
        />
      ) : (
      <>
      {items && error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items ?? []}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={{ paddingBottom: bottomSpace }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={AppTheme.text.accent} />}
        ListEmptyComponent={<ListMessage loading={loading} error={items ? null : error} empty="No tenés notificaciones sin ver." />}
        ListFooterComponent={
          items?.length ? (
            <Text style={styles.footer}>
              Se muestran hasta {INBOX_LIMIT} notificaciones sin ver. Las que marcás como vistas dejan de aparecer al actualizar.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <NotificationRow item={item} seen={seen.has(item.id)} busy={busy} onSeen={() => markSeen([item.id])} />
        )}
      />
      </>
      )}

      <PickerBottomNavigation activeTab="notifications" warehouseId={warehouseId} />
    </SafeScreen>
  );
}

function NotificationRow({ item, seen, busy, onSeen }: { item: InboxNotification; seen: boolean; busy: boolean; onSeen: () => void }) {
  const date = shortDate(item.created_at);
  return (
    <View style={[listStyles.row, seen ? styles.rowSeen : styles.rowNew]}>
      <View style={styles.rowHead}>
        <Text style={[listStyles.rowTitle, styles.rowTitle]}>{item.title || "Notificación"}</Text>
        <Text style={seen ? styles.tagSeen : styles.tagNew}>{seen ? "Vista" : "Nueva"}</Text>
      </View>
      {item.body ? <Text style={listStyles.rowMeta}>{item.body}</Text> : null}
      <View style={styles.rowFoot}>
        {date ? <Text style={styles.date}>{date}</Text> : <View />}
        {!seen ? (
          <Pressable onPress={onSeen} disabled={busy} hitSlop={8}>
            <Text style={styles.markOne}>Marcar como vista</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: AppTheme.spacing.md, paddingTop: 24, gap: 4 },
  title: { color: AppTheme.text.primary, fontSize: 26, fontWeight: "800" },
  markAll: { alignSelf: "flex-start", marginTop: 6 },
  // Mismas pestañas que las Alertas del chofer.
  tabs: {
    flexDirection: "row",
    gap: AppTheme.spacing.xs,
    marginTop: AppTheme.spacing.sm,
    padding: 4,
    borderRadius: AppTheme.radius.full,
    backgroundColor: AppTheme.surfaces.muted,
  },
  tab: { flex: 1, minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: AppTheme.radius.full },
  tabActive: { backgroundColor: AppTheme.colors.primary },
  tabText: { color: AppTheme.text.secondary, fontSize: 14, fontWeight: "800" },
  tabTextActive: { color: AppTheme.text.onPrimary },
  tabBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: AppTheme.radius.full,
    backgroundColor: AppTheme.status.rejected.solid,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadgeText: { color: AppTheme.status.rejected.onSolid, fontSize: 11, fontWeight: "800" },
  markAllText: { color: AppTheme.text.accent, fontWeight: "700", fontSize: 14 },
  error: { color: AppTheme.colors.danger, fontSize: 13, paddingHorizontal: AppTheme.spacing.md, paddingBottom: 8 },
  rowNew: { borderColor: AppTheme.borders.primary },
  rowSeen: { opacity: 0.6 },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { flex: 1 },
  tagNew: { color: AppTheme.text.accent, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  tagSeen: { color: AppTheme.text.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  rowFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  date: { color: AppTheme.text.muted, fontSize: 12 },
  markOne: { color: AppTheme.text.accent, fontSize: 13, fontWeight: "700" },
  footer: { color: AppTheme.text.muted, fontSize: 12, textAlign: "center", paddingHorizontal: 32, paddingTop: 4 },
});
