// src/Presentation/views/driver/help/DriverHelpScreen.tsx
// «Ayuda»: el chofer le pregunta al asistente cómo usar la app. Es una charla:
// cada pregunta va con el hilo (conversation_id) y el asistente recuerda lo
// anterior. Al abrir se retoma la charla si es reciente; si no, arranca vacía
// con preguntas sugeridas.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import { SafeScreen } from "../../../components/SafeScreen";
import { KeyboardScreen } from "../../../components/KeyboardScreen";
import { errorMessage } from "../errorMessage";
import {
  HelpMessage,
  HelpStatus,
  MAX_QUESTION_LENGTH,
  SUGGESTIONS,
  askHelp,
  fetchHelpStatus,
  fetchLatestConversation,
  isRecent,
} from "./helpApi";

const INTRO =
  "Hola. Preguntame cómo usar Lynx: colectas, repartos, Turbos, el ingreso o los permisos. No veo tus envíos ni tus pagos: eso lo resuelve coordinación.";

export default function DriverHelpScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const scrollRef = useRef<ScrollView>(null);

  const [status, setStatus] = useState<HelpStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<HelpMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchHelpStatus(), fetchLatestConversation()])
      .then(([s, c]) => {
        if (!alive) return;
        setStatus(s);
        setLoadError("");
        if (isRecent(c)) {
          setConversationId(c!.id);
          setMessages(c!.messages);
        }
      })
      .catch((e) => { if (alive) setLoadError(errorMessage(e, "No se pudo abrir la ayuda.")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  const remaining = status?.remaining_today ?? 0;
  const disabled = status?.enabled === false;
  const limitReached = !!status && remaining <= 0;

  const send = useCallback(async (raw: string) => {
    const question = raw.trim();
    if (!question || sending) return;
    const local: HelpMessage = { id: `local-${Date.now()}`, role: "user", content: question };
    setMessages((m) => [...m, local]);
    setText("");
    setSendError("");
    setSending(true);
    try {
      const res = await askHelp(question, conversationId);
      setConversationId(res.conversation_id);
      setMessages((m) => [...m, res.message]);
      setStatus((s) => (s ? { ...s, remaining_today: res.remaining_today } : s));
    } catch (e: any) {
      // La pregunta vuelve al campo para reintentarla.
      setMessages((m) => m.filter((x) => x.id !== local.id));
      setText(question);
      if (e?.code === "DAILY_LIMIT") setStatus((s) => (s ? { ...s, remaining_today: 0 } : s));
      setSendError(errorMessage(e, "No se pudo enviar la pregunta. Probá de nuevo."));
    } finally {
      setSending(false);
    }
  }, [conversationId, sending]);

  const newConversation = () => {
    setConversationId(null);
    setMessages([]);
    setSendError("");
  };

  const canWrite = !!status && !disabled && !limitReached;

  const footer = canWrite || sendError ? (
    <View style={styles.footer}>
      {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
      {canWrite && remaining <= 5 ? (
        <Text style={styles.hint}>
          {remaining === 1 ? "Te queda 1 pregunta por hoy." : `Te quedan ${remaining} preguntas por hoy.`}
        </Text>
      ) : null}
      {canWrite ? (
        <>
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Escribí tu pregunta"
              placeholderTextColor={theme.text.muted}
              style={styles.input}
              multiline
              maxLength={MAX_QUESTION_LENGTH}
              editable={!sending}
            />
            <Pressable
              style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonOff]}
              onPress={() => send(text)}
              disabled={!text.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel="Enviar pregunta"
              accessibilityState={{ disabled: !text.trim() || sending, busy: sending }}
            >
              <Ionicons name="send" size={18} color={theme.text.onPrimary} />
            </Pressable>
          </View>
          <Text style={styles.caption}>No escribas contraseñas ni datos personales.</Text>
        </>
      ) : null}
    </View>
  ) : null;

  return (
    <SafeScreen>
      <ThemedStatusBar />
      <KeyboardScreen
        contentContainerStyle={styles.content}
        footer={footer}
        scrollRef={scrollRef}
        scrollProps={{ onContentSizeChange: () => scrollRef.current?.scrollToEnd({ animated: true }) }}
      >
        <View style={styles.topRow}>
          <Pressable style={styles.back} onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={theme.text.secondary} />
            <Text style={styles.backText}>Volver</Text>
          </Pressable>
          {messages.length > 0 && !sending ? (
            <Pressable onPress={newConversation} hitSlop={10} accessibilityRole="button">
              <Text style={styles.link}>Nueva consulta</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.title}>Ayuda</Text>

        {loading ? (
          <ActivityIndicator color={theme.text.accent} style={{ marginTop: 24 }} />
        ) : loadError ? (
          <View style={styles.card}>
            <Text style={styles.hint}>{loadError}</Text>
            <Pressable onPress={() => setReloadKey((k) => k + 1)} accessibilityRole="button">
              <Text style={styles.retry}>Reintentar</Text>
            </Pressable>
          </View>
        ) : disabled ? (
          <View style={styles.card}>
            <Text style={styles.hint}>La ayuda no está disponible por ahora. Si tenés una duda, consultala con coordinación.</Text>
          </View>
        ) : (
          <>
            <Bubble role="assistant" content={INTRO} />
            {messages.length === 0 && canWrite ? (
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s} style={styles.chip} onPress={() => send(s)} disabled={sending} accessibilityRole="button">
                    <Text style={styles.chipText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {messages.map((m) => (
              <Bubble key={String(m.id)} role={m.role} content={m.content} escalated={m.escalated} />
            ))}
            {sending ? (
              <View style={[styles.bubble, styles.bubbleAssistant, styles.typing]}>
                <ActivityIndicator size="small" color={theme.text.accent} />
                <Text style={styles.typingText}>Escribiendo…</Text>
              </View>
            ) : null}
            {limitReached ? (
              <View style={styles.card}>
                <Text style={styles.hint}>Llegaste al límite de preguntas por hoy. Mañana podés seguir; si es urgente, consultá con coordinación.</Text>
              </View>
            ) : null}
          </>
        )}
      </KeyboardScreen>
    </SafeScreen>
  );
}

function Bubble({ role, content, escalated }: { role: HelpMessage["role"]; content: string; escalated?: boolean }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const mine = role === "user";
  return (
    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleAssistant]}>
      <Text style={mine ? styles.bubbleTextMine : styles.bubbleText} selectable>{content}</Text>
      {escalated ? (
        <View style={styles.escalated}>
          <Ionicons name="people-outline" size={16} color={theme.text.accent} />
          <Text style={styles.escalatedText}>Consultalo con coordinación.</Text>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  content: {
    paddingTop: t.spacing.md,
    paddingHorizontal: t.layout.screenPadding,
    paddingBottom: t.spacing.md,
    gap: t.spacing.sm,
  },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { flexDirection: "row", alignItems: "center", gap: 2 },
  backText: { color: t.text.secondary, fontSize: 14, fontWeight: t.font.weight.bold },
  link: { color: t.text.accent, fontSize: 14, fontWeight: t.font.weight.bold },
  title: {
    color: t.text.primary,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: t.font.weight.black,
    letterSpacing: -1,
    marginBottom: t.spacing.xs,
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
  error: { color: t.status.rejected.text, fontSize: 14, fontWeight: t.font.weight.bold },
  bubble: { maxWidth: "88%", borderRadius: t.radius.xl, paddingVertical: 10, paddingHorizontal: 14, gap: t.spacing.xs },
  bubbleAssistant: {
    alignSelf: "flex-start",
    backgroundColor: t.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: t.borders.medium,
  },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: t.colors.primary },
  bubbleText: { color: t.text.primary, fontSize: 15, lineHeight: 21 },
  bubbleTextMine: { color: t.text.onPrimary, fontSize: 15, lineHeight: 21, fontWeight: t.font.weight.bold },
  escalated: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  escalatedText: { color: t.text.accent, fontSize: 13, fontWeight: t.font.weight.black },
  typing: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
  typingText: { color: t.text.muted, fontSize: 14, fontWeight: t.font.weight.bold },
  suggestions: { gap: t.spacing.sm, alignItems: "flex-start" },
  chip: {
    borderRadius: t.radius.full,
    borderWidth: 1,
    borderColor: t.borders.medium,
    backgroundColor: t.overlays.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipText: { color: t.text.accent, fontSize: 14, fontWeight: t.font.weight.bold },
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
  caption: { color: t.text.muted, fontSize: 12, fontWeight: t.font.weight.bold },
});
