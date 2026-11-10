// src/Presentation/views/driver/chat/ChatListPanel.tsx
// Lista de chats del chofer: la pestaña «Mensajes» de Alertas. Arriba el
// asistente; después su charla fija con el equipo de Lynx («Lynx»). Se
// refresca sola mientras está a la vista, y al llegar un push.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { errorMessage } from "../errorMessage";
import { ChatConversation, ChatInbox, fetchInbox } from "./chatApi";
import { chatRows, countLabel, listTime, previewOf } from "./chatView";
import { publishChatUnread, useChatArrivals } from "./chatStore";

// navigation: la del stack del chofer (la de la pantalla que la contiene).
// bottomSpace: lo que tapa la barra de abajo.
type Props = { navigation: any; bottomSpace: number };

const REFRESH_MS = 15_000;

export default function ChatListPanel({ navigation, bottomSpace }: Props) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [inbox, setInbox] = useState<ChatInbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // silent: el sondeo; si falla, queda lo último que se vio sin cartel de error.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchInbox();
      if (!mounted.current) return;
      setInbox(data);
      setError(null);
      publishChatUnread(data.unread_total);
    } catch (e) {
      if (mounted.current && !silent) setError(errorMessage(e, "No se pudieron cargar los chats."));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const loadedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      load(loadedOnce.current);
      loadedOnce.current = true;
      const poll = setInterval(() => load(true), REFRESH_MS);
      const sub = AppState.addEventListener("change", (s) => { if (s === "active") load(true); });
      return () => { clearInterval(poll); sub.remove(); };
    }, [load]),
  );

  // Llegó un mensaje por push: se pone al día sin esperar el sondeo.
  const arrivals = useChatArrivals();
  const firstArrival = useRef(arrivals);
  useEffect(() => {
    if (arrivals !== firstArrival.current) load(true);
  }, [arrivals, load]);

  const openConversation = (c: ChatConversation) =>
    navigation.navigate("ChatScreen", { conversationId: c.id, title: c.title });

  const rows = chatRows(inbox);
  const empty = !!inbox && rows.length === 1;

  return (
    <View style={styles.page}>
      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerStyle={{ paddingBottom: bottomSpace + 24 }}
        ItemSeparatorComponent={() => <View style={{ height: theme.list.gap }} />}
        refreshControl={<RefreshControl refreshing={loading && !!inbox} onRefresh={() => load()} tintColor={theme.text.accent} />}
        ListFooterComponent={
          loading && !inbox ? <ActivityIndicator color={theme.text.accent} style={{ marginTop: 24 }} />
          : empty ? <Text style={styles.emptyText}>Todavía no tenés chats.</Text>
          : null
        }
        renderItem={({ item: row }) => {
          if (row.kind === "assistant") {
            return (
              <Pressable style={[theme.card, styles.row]} onPress={() => navigation.navigate("DriverHelpScreen")} accessibilityRole="button" accessibilityLabel="Asistente de ayuda">
                <View style={[styles.avatar, styles.avatarPrimary]}>
                  <MaterialCommunityIcons name="robot-happy-outline" size={24} color={theme.text.onPrimary} />
                </View>
                <View style={styles.body}>
                  <Text style={styles.title} numberOfLines={1}>Asistente</Text>
                  <Text style={styles.preview} numberOfLines={1}>Dudas de uso de la app</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
              </Pressable>
            );
          }
          const c = row.conversation;
          return (
            <Pressable
              style={[theme.card, styles.row]}
              onPress={() => openConversation(c)}
              accessibilityRole="button"
              accessibilityLabel={c.unread ? `${c.title}: ${c.unread} sin leer` : c.title}
            >
              <View style={styles.avatar}>
                <Ionicons name="chatbubbles-outline" size={22} color={theme.text.accent} />
              </View>
              <View style={styles.body}>
                <View style={styles.top}>
                  <Text style={styles.title} numberOfLines={1}>{c.title}</Text>
                  {c.last_message ? <Text style={[styles.time, c.unread > 0 && styles.timeUnread]}>{listTime(c.last_message.created_at)}</Text> : null}
                </View>
                <View style={styles.top}>
                  <Text style={[styles.preview, c.unread > 0 && styles.previewUnread]} numberOfLines={1}>{previewOf(c)}</Text>
                  {c.unread > 0 ? (
                    <View style={styles.badge}><Text style={styles.badgeText}>{countLabel(c.unread)}</Text></View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  page: { flex: 1, paddingHorizontal: t.layout.screenPadding },
  row: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, padding: t.spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: t.radius.full,
    backgroundColor: t.overlays.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPrimary: { backgroundColor: t.colors.primary },
  body: { flex: 1, gap: 2 },
  top: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
  title: { flex: 1, color: t.text.primary, fontSize: 16, fontWeight: t.font.weight.bold },
  time: { color: t.text.muted, fontSize: 12, fontWeight: t.font.weight.bold },
  timeUnread: { color: t.text.accent },
  preview: { flex: 1, color: t.text.secondary, fontSize: 14 },
  previewUnread: { color: t.text.primary, fontWeight: t.font.weight.bold },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: t.radius.full,
    backgroundColor: t.status.rejected.solid,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: t.status.rejected.onSolid, fontSize: 12, fontWeight: t.font.weight.black },
  emptyText: { color: t.text.secondary, textAlign: "center", marginTop: t.spacing.lg, paddingHorizontal: t.spacing.md },
  errorBox: { borderWidth: 1, borderColor: t.status.rejected.border, backgroundColor: t.status.rejected.background, borderRadius: t.radius.md, padding: 12, marginBottom: 12 },
  errorText: { color: t.text.primary },
});
