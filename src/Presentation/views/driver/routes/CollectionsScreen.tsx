// src/Presentation/views/driver/routes/CollectionsScreen.tsx
// Colectas (PICKUP) del chofer para hoy y mañana. Es lo que el servidor deja
// consultar (GET /v2/routes/mine, por fecha): todavía no hay forma de pedir
// todas las colectas fijas de la semana, así que no se simulan.

import React, { useCallback, useEffect, useState } from "react";
import { ImageBackground, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../../theme/AppTheme";
import DriverBottomNavigation, { DriverTabKey } from "../../../components/DriverBottomNavigation";
import type { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import { fetchMyRoutes, respondConfirmation, RouteSummary, todayIso, tomorrowIso } from "./routesApi";
import { needsAnswer, PICKUP_ANSWER_LABEL, pickupAnswer, startsLater } from "./pickupConfirmation";
import { capitalize, COLLECTION_STATUS_LABEL, collectionKindLabel, collectionName, executionDayLabel, plural } from "./collectionLabels";
import { errorMessage } from "../errorMessage";

type Props = NativeStackScreenProps<DriverStackParamList, "CollectionsScreen">;
type Day = { date: string; routes: RouteSummary[] };

export default function CollectionsScreen({ navigation }: Props) {
  const [days, setDays] = useState<Day[] | null>(null);
  const [today, setToday] = useState(todayIso());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [respondiendo, setRespondiendo] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const dates = [todayIso(), tomorrowIso()];
    try {
      const lists = await Promise.all(dates.map((d) => fetchMyRoutes(d)));
      setToday(dates[0]);
      setDays(dates.map((date, i) => ({ date, routes: lists[i].filter((r) => r.type === "PICKUP") })));
    } catch (e: any) { setError(errorMessage(e, "No se pudieron cargar las colectas")); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => navigation.addListener("focus", load), [navigation, load]);

  const responder = async (r: RouteSummary, response: "ACCEPTED" | "DECLINED") => {
    setRespondiendo(r.id);
    try { await respondConfirmation(r.id, response); await load(); } catch (e: any) { setError(errorMessage(e, "No se pudo enviar la respuesta")); } finally { setRespondiendo(null); }
  };

  const handleTabPress = (tab: DriverTabKey) => {
    switch (tab) {
      case "home": navigation.navigate("DriverScreen"); break;
      case "deliveries": navigation.navigate("EnviosScreen"); break;
      case "scan": navigation.navigate("DriverScanOptionsScreen"); break;
      case "activity": navigation.navigate("NotificationsScreen"); break;
      default: break;
    }
  };

  const porConfirmar = days?.reduce((n, d) => n + d.routes.filter(needsAnswer).length, 0) ?? 0;

  return (
    <ImageBackground source={require("../../../../../assets/background-1.png")} style={styles.background} imageStyle={styles.backgroundImage}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.page}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={AppTheme.text.accent} />}
        >
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Colectas</Text>
            <Text style={styles.title}>Mis colectas</Text>
            <Text style={styles.subtitle}>
              {porConfirmar ? `Tenés ${plural(porConfirmar, "colecta", "colectas")} por confirmar. ` : ""}
              Se muestran las colectas de hoy y de mañana.
            </Text>
          </View>

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

          {days?.map((day) => (
            <View key={day.date} style={styles.section}>
              <Text style={styles.sectionTitle}>{capitalize(executionDayLabel(day.date, today))}</Text>
              {day.routes.length === 0 ? (
                <Text style={styles.emptyText}>{day.date === today ? "Sin colectas para hoy." : "Sin colectas para mañana por ahora."}</Text>
              ) : day.routes.map((r) => (
                <CollectionCard key={r.id} route={r} today={today} busy={respondiendo === r.id}
                  onOpen={() => navigation.navigate("RouteDetailScreen", { routeId: r.id, name: collectionName(r) })}
                  onAnswer={(response) => responder(r, response)} />
              ))}
            </View>
          ))}
        </ScrollView>
        <DriverBottomNavigation activeTab="collections" onPress={handleTabPress} />
      </SafeAreaView>
    </ImageBackground>
  );
}

function CollectionCard({ route, today, busy, onOpen, onAnswer }: {
  route: RouteSummary; today: string; busy: boolean; onOpen: () => void; onAnswer: (r: "ACCEPTED" | "DECLINED") => void;
}) {
  const answer = pickupAnswer(route);
  const habitual = !!route.template_id;
  const color = answer === "ACCEPTED" ? AppTheme.colors.success : answer === "DECLINED" ? AppTheme.colors.danger : AppTheme.colors.warning;
  return (
    <Pressable style={styles.card} onPress={onOpen}>
      <View style={styles.cardTop}>
        <Text style={styles.cardName} numberOfLines={1}>{collectionName(route)}</Text>
        <View style={[styles.chip, habitual ? styles.chipHabitual : styles.chipExtra]}>
          <Text style={styles.chipText}>{collectionKindLabel(route)}</Text>
        </View>
      </View>
      <Text style={styles.cardMeta}>
        {plural(route.stops_count, "parada", "paradas")}
        {route.departure_time ? ` · sale ${route.departure_time.slice(0, 5)}` : ""}
        {route.status !== "ASSIGNED" ? ` · ${COLLECTION_STATUS_LABEL[route.status] ?? route.status}` : ""}
      </Text>
      {answer ? (
        <View style={styles.answerRow}>
          <View style={[styles.answerBadge, { borderColor: color }]}><Text style={[styles.answerText, { color }]}>{PICKUP_ANSWER_LABEL[answer]}</Text></View>
          {answer !== "ACCEPTED" ? (
            <>
              <Pressable style={[styles.answerBtn, styles.answerYes]} disabled={busy} onPress={() => onAnswer("ACCEPTED")}><Text style={styles.answerBtnText}>Aceptar</Text></Pressable>
              {answer === "PENDING" ? (
                <Pressable style={[styles.answerBtn, styles.answerNo]} disabled={busy} onPress={() => onAnswer("DECLINED")}><Text style={styles.answerBtnText}>Rechazar</Text></Pressable>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}
      {answer === "PENDING" && route.confirmation_state === "OVERDUE" ? <Text style={styles.cardWarn}>Venció el plazo para confirmar.</Text> : null}
      {answer === "ACCEPTED" && startsLater(route, today) ? <Text style={styles.cardHint}>Se comienza mañana.</Text> : null}
      <View style={styles.cardFooter}>
        <Text style={styles.link}>Ver colecta</Text>
        <Ionicons name="chevron-forward" size={16} color={AppTheme.text.accent} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: AppTheme.colors.background },
  backgroundImage: { opacity: 0.18 },
  safeArea: { flex: 1 },
  page: { paddingHorizontal: AppTheme.layout.screenPadding, paddingTop: AppTheme.spacing.lg, paddingBottom: 132 },
  header: { marginBottom: AppTheme.spacing.lg, paddingTop: AppTheme.spacing.lg, gap: AppTheme.spacing.xs },
  eyebrow: { ...AppTheme.typography.kicker },
  title: { color: AppTheme.text.primary, fontSize: 22, fontWeight: "700" },
  subtitle: { color: AppTheme.text.secondary, fontSize: 13 },
  section: { marginBottom: AppTheme.spacing.lg, gap: AppTheme.spacing.sm },
  sectionTitle: { color: AppTheme.text.primary, fontSize: 16, fontWeight: "700" },
  emptyText: { color: AppTheme.text.secondary, fontSize: 13 },
  card: { backgroundColor: AppTheme.surfaces.card, borderRadius: AppTheme.radius.lg, borderWidth: 1, borderColor: AppTheme.borders.default, padding: AppTheme.spacing.md, gap: 6 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardName: { color: AppTheme.text.primary, fontSize: 16, fontWeight: "700", flex: 1 },
  cardMeta: { color: AppTheme.text.secondary, fontSize: 13 },
  cardHint: { color: AppTheme.text.accent, fontSize: 12 },
  cardWarn: { color: AppTheme.colors.warning, fontSize: 12 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 2, paddingTop: 2 },
  link: { color: AppTheme.text.accent, fontSize: 13, fontWeight: "600" },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  chipHabitual: { borderColor: AppTheme.colors.primary },
  chipExtra: { borderColor: AppTheme.colors.warning },
  chipText: { color: AppTheme.text.primary, fontSize: 11, fontWeight: "700" },
  answerRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 4 },
  answerBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, marginRight: "auto" },
  answerText: { fontSize: 12, fontWeight: "700" },
  answerBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  answerYes: { borderColor: AppTheme.colors.success, backgroundColor: `${AppTheme.colors.success}22` },
  answerNo: { borderColor: AppTheme.colors.danger, backgroundColor: `${AppTheme.colors.danger}22` },
  answerBtnText: { color: AppTheme.text.primary, fontWeight: "700" },
  errorBox: { borderWidth: 1, borderColor: AppTheme.colors.danger, borderRadius: AppTheme.radius.md, padding: 12, marginBottom: 12 },
  errorText: { color: AppTheme.text.primary },
});
