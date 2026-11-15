// src/Presentation/views/driver/chat/ChatScreen.tsx
// Una charla del chat interno: los mensajes con autor y hora, el campo para
// escribir y «<<» para volver a la lista de chats (en el encabezado fijo, a
// mano aunque la charla sea larga). Mientras está a la vista se
// pone al día cada pocos segundos (y al llegar un push de esta charla, que no
// muestra el aviso del sistema) y marca leído lo nuevo. Si el servidor dice que
// no se puede escribir, no hay campo para escribir. La usan el chofer y el
// picker: onBack dice a qué lista vuelve «<<» (por defecto, la del chofer).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import { SafeScreen } from "../../../components/SafeScreen";
import { KeyboardScreen } from "../../../components/KeyboardScreen";
import { setOpenConversation } from "../../../config/Push";
import { errorMessage } from "../errorMessage";
import { ChatMessage, ChatThread, MAX_MESSAGE_LENGTH, fetchMessages, markRead, sendMessage } from "./chatApi";
import { mergeMessages, messageTime, newestId, showAuthor } from "./chatView";
import { backToChatList, refreshChatUnread, useChatArrivals } from "./chatStore";
import { BackButton } from "../../../components/BackButton";

const REFRESH_MS = 5_000;

type Props = { onBack?: (navigation: any) => void };

export default function ChatScreen({ onBack = backToChatList }: Props = {}) {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const conversationId: number = route.params.conversationId;
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const scrollRef = useRef<ScrollView>(null);

  const [conversation, setConversation] = useState<ChatThread["conversation"] | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  // El mensaje que se está enviando: se ve en gris hasta que el servidor lo guarda.
  const [sending, setSending] = useState<string | null>(null);
  const [sendError, setSendError] = useState("");
  const mounted = useRef(true);
  const loadedOnce = useRef(false);
  const lastMarked = useRef(0);
  // Lo que se ve, para juntarle lo que llega sin depender del render.
  const shown = useRef<ChatMessage[]>([]);
  // Pegada al final: al abrir y cuando llega (o se manda) un mensaje; no al
  // traer los anteriores. El contenido se mide en varias pasadas al abrir, así
  // que se baja en cada una mientras siga pegada.
  const stickToEnd = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Junta lo que llegó con lo que se ve y marca leído lo nuevo de los otros
  // (baja el número de Alertas). Lo propio ya queda leído al mandarlo.
  const apply = useCallback((incoming: ChatMessage[]) => {
    const before = newestId(shown.current);
    const next = mergeMessages(shown.current, incoming);
    shown.current = next;
    setMessages(next);
    const newest = newestId(next);
    if (newest !== before) stickToEnd.current = true;
    if (newest === null || newest <= lastMarked.current) return;
    const since = lastMarked.current;
    lastMarked.current = newest;
    if (!next.some((m) => !m.mine && m.id > since)) return;
    markRead(conversationId, newest).then(() => refreshChatUnread(true)).catch(() => {});
  }, [conversationId]);

  // silent: el sondeo; si falla, queda lo que se ve.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetchMessages(conversationId);
      if (!mounted.current) return;
      setConversation(res.conversation);
      setLoadError("");
      if (!loadedOnce.current) setHasMore(res.has_more);
      loadedOnce.current = true;
      apply(res.messages);
    } catch (e: any) {
      if (!mounted.current || silent) return;
      setLoadError(e?.status === 404 ? "Esta charla ya no está disponible." : errorMessage(e, "No se pudo abrir la charla."));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [conversationId, apply]);

  useFocusEffect(
    useCallback(() => {
      setOpenConversation(conversationId);
      load(loadedOnce.current);
      const poll = setInterval(() => load(true), REFRESH_MS);
      const sub = AppState.addEventListener("change", (s) => { if (s === "active") load(true); });
      return () => { setOpenConversation(null); clearInterval(poll); sub.remove(); };
    }, [conversationId, load]),
  );

  // Llegó un mensaje por push: se pone al día sin esperar el sondeo.
  const arrivals = useChatArrivals();
  const firstArrival = useRef(arrivals);
  useEffect(() => {
    if (arrivals !== firstArrival.current) load(true);
  }, [arrivals, load]);

  const loadOlder = async () => {
    const oldest = messages[0]?.id;
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    stickToEnd.current = false;
    try {
      const res = await fetchMessages(conversationId, oldest);
      if (!mounted.current) return;
      apply(res.messages);
      setHasMore(res.has_more);
    } catch (e) {
      if (mounted.current) setSendError(errorMessage(e, "No se pudieron traer los mensajes anteriores."));
    } finally {
      if (mounted.current) setLoadingOlder(false);
    }
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending !== null) return;
    setSending(body);
    stickToEnd.current = true;
    setText("");
    setSendError("");
    try {
      const saved = await sendMessage(conversationId, body);
      if (!mounted.current) return;
      apply([saved]);
    } catch (e: any) {
      if (!mounted.current) return;
      // El texto vuelve al campo para reintentarlo.
      setText(body);
      setSendError(errorMessage(e, "No se pudo enviar el mensaje. Probá de nuevo."));
    } finally {
      if (mounted.current) setSending(null);
    }
  };

  // Android aplica el alto nuevo en el cuadro siguiente: bajar en el mismo
  // aviso dejaba la charla a mitad de camino (visto en el Moto). También al
  // cambiar el alto visible (el teclado).
  const toEnd = () => {
    if (stickToEnd.current) requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
  };

  const title = conversation?.title ?? route.params?.title ?? "Chat";
  const canWrite = !!conversation?.can_write;

  const footer = conversation && !loadError ? (
    <View style={styles.footer}>
      {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
      {canWrite ? (
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escribí un mensaje"
            placeholderTextColor={theme.text.muted}
            style={styles.input}
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
          />
          <Pressable
            style={[styles.sendButton, (!text.trim() || sending !== null) && styles.sendButtonOff]}
            onPress={send}
            disabled={!text.trim() || sending !== null}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
            accessibilityState={{ disabled: !text.trim() || sending !== null, busy: sending !== null }}
          >
            <Ionicons name="send" size={18} color={theme.text.onPrimary} />
          </Pressable>
        </View>
      ) : (
        <Text style={styles.hint}>En esta charla no podés escribir.</Text>
      )}
    </View>
  ) : null;

  return (
    <SafeScreen>
      <ThemedStatusBar />
      <View style={styles.header}>
        <BackButton onPress={() => onBack(navigation)} label="Volver a los chats" />
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
      </View>
      <KeyboardScreen
        contentContainerStyle={styles.content}
        footer={footer}
        scrollRef={scrollRef}
        scrollProps={{ onContentSizeChange: toEnd, onLayout: toEnd }}
      >
        {loading && !conversation ? (
          <ActivityIndicator color={theme.text.accent} style={{ marginTop: 24 }} />
        ) : loadError ? (
          <View style={styles.card}>
            <Text style={styles.hint}>{loadError}</Text>
            <Pressable onPress={() => load()} accessibilityRole="button">
              <Text style={styles.retry}>Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {hasMore ? (
              <Pressable style={styles.older} onPress={loadOlder} disabled={loadingOlder} accessibilityRole="button">
                {loadingOlder ? <ActivityIndicator color={theme.text.accent} /> : <Text style={styles.retry}>Ver anteriores</Text>}
              </Pressable>
            ) : null}
            {messages.length === 0 && sending === null ? (
              <Text style={styles.empty}>{canWrite ? "Todavía no hay mensajes. Escribí el primero." : "Todavía no hay mensajes."}</Text>
            ) : null}
            {messages.map((m) => (
              <Bubble key={m.id} message={m} />
            ))}
            {sending !== null ? (
              <View style={[styles.bubble, styles.bubbleMine, styles.bubblePending]}>
                <Text style={styles.bubbleTextMine} selectable>{sending}</Text>
                <Text style={styles.timeMine}>Enviando…</Text>
              </View>
            ) : null}
          </>
        )}
      </KeyboardScreen>
    </SafeScreen>
  );
}

function Bubble({ message: m }: { message: ChatMessage }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.bubble, m.mine ? styles.bubbleMine : styles.bubbleOther]}>
      {showAuthor(m) ? <Text style={styles.author}>{m.author!.name}</Text> : null}
      {m.kind === "handoff" ? (
        <Text style={m.mine ? styles.handoffMine : styles.handoff}>Consulta derivada desde el asistente</Text>
      ) : null}
      <Text style={m.mine ? styles.bubbleTextMine : styles.bubbleText} selectable>{m.body}</Text>
      <Text style={m.mine ? styles.timeMine : styles.time}>{messageTime(m.created_at)}</Text>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  header: {
    paddingTop: t.spacing.md,
    paddingHorizontal: t.layout.screenPadding,
    paddingBottom: t.spacing.sm,
    gap: t.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: t.borders.medium,
  },
  content: {
    paddingTop: t.spacing.sm,
    paddingHorizontal: t.layout.screenPadding,
    paddingBottom: t.spacing.md,
    gap: t.spacing.sm,
  },
  title: {
    color: t.text.primary,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: t.font.weight.black,
    letterSpacing: -0.5,
  },
  card: {
    borderRadius: t.radius.xxl,
    backgroundColor: t.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: t.borders.medium,
    padding: t.spacing.md,
    gap: t.spacing.sm,
  },
  hint: { color: t.text.secondary, fontSize: 13, lineHeight: 18, fontWeight: t.font.weight.bold },
  retry: { color: t.text.accent, fontSize: 14, fontWeight: t.font.weight.bold },
  older: { alignSelf: "center", minHeight: 36, justifyContent: "center", paddingHorizontal: t.spacing.md },
  empty: { color: t.text.secondary, fontSize: 14, textAlign: "center", marginTop: t.spacing.md },
  error: { color: t.status.rejected.text, fontSize: 14, fontWeight: t.font.weight.bold },
  bubble: { maxWidth: "88%", borderRadius: t.radius.xl, paddingVertical: 8, paddingHorizontal: 14, gap: 2 },
  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: t.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: t.borders.medium,
  },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: t.colors.primary },
  bubblePending: { opacity: 0.6 },
  author: { color: t.text.accent, fontSize: 13, fontWeight: t.font.weight.black },
  handoff: { color: t.text.accent, fontSize: 12, fontWeight: t.font.weight.black },
  handoffMine: { color: t.text.onPrimary, fontSize: 12, fontWeight: t.font.weight.black, opacity: 0.85 },
  bubbleText: { color: t.text.primary, fontSize: 15, lineHeight: 21 },
  bubbleTextMine: { color: t.text.onPrimary, fontSize: 15, lineHeight: 21, fontWeight: t.font.weight.bold },
  time: { color: t.text.muted, fontSize: 11, fontWeight: t.font.weight.bold, alignSelf: "flex-end" },
  timeMine: { color: t.text.onPrimary, fontSize: 11, fontWeight: t.font.weight.bold, alignSelf: "flex-end", opacity: 0.8 },
  footer: {
    paddingHorizontal: t.layout.screenPadding,
    paddingTop: t.spacing.sm,
    paddingBottom: t.spacing.sm,
    gap: t.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: t.borders.medium,
    backgroundColor: t.surfaces.screen,
  },
  inputRow: { flexDirection: "row", gap: t.spacing.sm, alignItems: "flex-end" },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: t.radius.xl,
    borderWidth: 1,
    borderColor: t.borders.medium,
    backgroundColor: t.surfaces.cardStrong,
    color: t.text.primary,
    paddingHorizontal: t.spacing.md,
    paddingVertical: 12,
    fontSize: 15,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: t.radius.full,
    backgroundColor: t.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonOff: { opacity: 0.45 },
});
