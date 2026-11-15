// src/Presentation/views/driver/chat/ChatPeopleScreen.tsx
// «Nueva charla»: el directorio de usuarios internos (administración,
// coordinación, pickers, liquidaciones), con buscador y un punto verde para
// quien está en línea. Tocar a alguien abre la charla de a uno con esa
// persona (la que ya hay, o una nueva). Lo usa el picker; los choferes no
// tienen directorio.

import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import { SafeScreen } from "../../../components/SafeScreen";
import { errorMessage } from "../errorMessage";
import { ChatPerson, fetchPeople, openDirect } from "./chatApi";
import { personDetail } from "./chatView";
import { BackButton } from "../../../components/BackButton";

// chatRoute: la pantalla de la charla en ese stack. onBack: vuelve a la lista de chats.
type Props = { chatRoute: string; onBack: (navigation: any) => void };

const SEARCH_DELAY_MS = 300;

export default function ChatPeopleScreen({ chatRoute, onBack }: Props) {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [text, setText] = useState("");
  const [people, setPeople] = useState<ChatPerson[] | null>(null);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState<number | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Busca al escribir, con una pausa corta; una respuesta vieja no pisa a la nueva.
  useEffect(() => {
    let current = true;
    const t = setTimeout(() => {
      fetchPeople(text)
        .then((list) => { if (current && mounted.current) { setPeople(list); setError(""); } })
        .catch((e) => { if (current && mounted.current) setError(errorMessage(e, "No se pudo cargar el directorio.")); });
    }, people === null ? 0 : SEARCH_DELAY_MS);
    return () => { current = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const open = async (p: ChatPerson) => {
    if (opening !== null) return;
    setOpening(p.id);
    setError("");
    try {
      const conversationId = p.conversation_id ?? (await openDirect(p.id));
      if (!mounted.current) return;
      // La charla toma el lugar del directorio: «<<» vuelve a la lista.
      navigation.replace(chatRoute, { conversationId, title: p.name });
    } catch (e) {
      if (mounted.current) setError(errorMessage(e, "No se pudo abrir la charla."));
    } finally {
      if (mounted.current) setOpening(null);
    }
  };

  return (
    <SafeScreen>
      <ThemedStatusBar />
      <View style={styles.header}>
        <BackButton onPress={() => onBack(navigation)} label="Volver a los chats" />
        <Text style={styles.title}>Nueva charla</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Buscar por nombre o usuario"
          placeholderTextColor={theme.text.muted}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Buscar persona"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <FlatList
        data={people ?? []}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: theme.list.gap }} />}
        ListEmptyComponent={
          people === null ? (error ? null : <ActivityIndicator color={theme.text.accent} style={{ marginTop: 24 }} />)
          : <Text style={styles.empty}>Nadie del equipo coincide con la búsqueda.</Text>
        }
        renderItem={({ item: p }) => (
          <Pressable
            style={[theme.card, styles.row]}
            onPress={() => open(p)}
            disabled={opening !== null}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}, ${personDetail(p)}`}
          >
            <View style={styles.avatar}>
              <Ionicons name="person-outline" size={22} color={theme.text.accent} />
              {p.online ? <View style={styles.onlineDot} /> : null}
            </View>
            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.detail} numberOfLines={1}>{personDetail(p)}</Text>
            </View>
            {opening === p.id ? <ActivityIndicator color={theme.text.accent} /> : <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />}
          </Pressable>
        )}
      />
    </SafeScreen>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  header: {
    paddingTop: t.spacing.md,
    paddingHorizontal: t.layout.screenPadding,
    paddingBottom: t.spacing.sm,
    gap: t.spacing.sm,
  },
  title: { color: t.text.primary, fontSize: 26, lineHeight: 30, fontWeight: t.font.weight.black, letterSpacing: -0.5 },
  input: {
    minHeight: 48,
    borderRadius: t.radius.xl,
    borderWidth: 1,
    borderColor: t.borders.medium,
    backgroundColor: t.surfaces.cardStrong,
    color: t.text.primary,
    paddingHorizontal: t.spacing.md,
    fontSize: 15,
  },
  error: { color: t.status.rejected.text, fontSize: 14, fontWeight: t.font.weight.bold },
  list: { paddingHorizontal: t.layout.screenPadding, paddingBottom: 32 },
  row: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, padding: t.spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: t.radius.full,
    backgroundColor: t.overlays.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 13,
    height: 13,
    borderRadius: t.radius.full,
    backgroundColor: t.status.delivered.solid,
    borderWidth: 2,
    borderColor: t.surfaces.screen,
  },
  body: { flex: 1, gap: 2 },
  name: { color: t.text.primary, fontSize: 16, fontWeight: t.font.weight.bold },
  detail: { color: t.text.secondary, fontSize: 13 },
  empty: { color: t.text.secondary, textAlign: "center", marginTop: t.spacing.lg },
});
