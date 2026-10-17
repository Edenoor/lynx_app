// src/Presentation/views/picker/PickerNotificationsScreen.tsx
// Bandeja de notificaciones del Picker, desde el servidor. El contrato actual
// devuelve solo las no vistas (hasta 20): marcar una como vista no la saca de
// la lista hasta actualizar, pero después ya no vuelve.

import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import AppTheme from "../../theme/AppTheme";
import { SafeScreen } from "../../components/SafeScreen";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { fetchMyNotifications, InboxNotification, INBOX_LIMIT, markNotificationsSeen, setUnreadCount } from "./notificationsApi";
import { loadErrorMessage } from "./warehouseApi";
import { ListMessage, listStyles, shortDate } from "./pickerUi";
import { PickerBottomNavigation, usePickerBottomSpace } from "./PickerBottomNavigation";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerNotificationsScreen">;

export default function PickerNotificationsScreen({ route }: Props) {
  const { warehouseId } = route.params;
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
      const list = await fetchMyNotifications();
      setItems(list);
      setSeen(new Set());
      setUnreadCount(list.length);
      setError(null);
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
        <Text style={styles.title}>Notificaciones</Text>
        {unseenIds.length ? (
          <Pressable style={styles.markAll} onPress={() => markSeen(unseenIds)} disabled={busy} hitSlop={8}>
            <Text style={styles.markAllText}>Marcar todas como vistas</Text>
          </Pressable>
        ) : null}
      </View>

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
