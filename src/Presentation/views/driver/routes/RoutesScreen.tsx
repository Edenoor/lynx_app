// src/Presentation/views/driver/routes/RoutesScreen.tsx
// Recorridos del chofer para una fecha (hoy por defecto).

import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, ImageBackground, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../../theme/AppTheme";
import DriverBottomNavigation, { DriverTabKey } from "../../../components/DriverBottomNavigation";
import type { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import { fetchMyRoutes, RouteSummary, STATUS_LABEL, todayIso, TYPE_LABEL } from "./routesApi";

type Props = NativeStackScreenProps<DriverStackParamList, "RoutesScreen">;

const shiftDate = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const prettyDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

export default function RoutesScreen({ navigation }: Props) {
  const [date, setDate] = useState(todayIso());
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRoutes(await fetchMyRoutes(date)); } catch (e: any) { setError(e?.message ?? "No se pudieron cargar los recorridos"); } finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => navigation.addListener("focus", load), [navigation, load]);

  const handleTabPress = (tab: DriverTabKey) => {
    switch (tab) {
      case "home": navigation.navigate("DriverScreen"); break;
      case "deliveries": navigation.navigate("EnviosScreen"); break;
      case "scan": navigation.navigate("DriverScanOptionsScreen"); break;
      case "activity": navigation.navigate("NotificationsScreen"); break;
      case "profile": navigation.navigate("DriverAccountScreen"); break;
      default: break;
    }
  };

  return (
    <ImageBackground source={require("../../../../../assets/background-1.png")} style={styles.background} imageStyle={styles.backgroundImage}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Recorridos</Text>
            <View style={styles.dateRow}>
              <Pressable onPress={() => setDate(shiftDate(date, -1))} style={styles.dateBtn} hitSlop={8}><Ionicons name="chevron-back" size={22} color={AppTheme.text.primary} /></Pressable>
              <Text style={styles.title}>{prettyDate(date)}</Text>
              <Pressable onPress={() => setDate(shiftDate(date, 1))} style={styles.dateBtn} hitSlop={8}><Ionicons name="chevron-forward" size={22} color={AppTheme.text.primary} /></Pressable>
            </View>
            {date !== todayIso() ? <Pressable onPress={() => setDate(todayIso())}><Text style={styles.link}>Volver a hoy</Text></Pressable> : null}
          </View>

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

          <FlatList
            data={routes}
            keyExtractor={(r) => String(r.id)}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={AppTheme.text.accent} />}
            ListEmptyComponent={loading ? <ActivityIndicator color={AppTheme.text.accent} style={{ marginTop: 40 }} /> : (
              <View style={styles.empty}><Ionicons name="map-outline" size={36} color={AppTheme.text.muted} /><Text style={styles.emptyText}>No tenés recorridos asignados para este día.</Text></View>
            )}
            renderItem={({ item }) => (
              <Pressable style={styles.card} onPress={() => navigation.navigate("RouteDetailScreen", { routeId: item.id })}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardType}>{TYPE_LABEL[item.type]} #{item.id}</Text>
                  <View style={[styles.badge, item.status === "IN_PROGRESS" && styles.badgeActive, (item.status === "COMPLETED" || item.status === "CANCELLED") && styles.badgeDone]}>
                    <Text style={styles.badgeText}>{STATUS_LABEL[item.status]}</Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>
                  {item.stops_count} {item.stops_count === 1 ? "parada" : "paradas"} · {item.deliveries_count} {item.deliveries_count === 1 ? "envío" : "envíos"}
                  {item.type === "DELIVERY" && item.expected_count !== null ? ` · carga ${item.confirmed_count ?? "–"}/${item.expected_count}` : ""}
                </Text>
                {item.type === "DELIVERY" && item.status === "ASSIGNED" ? <Text style={styles.cardHint}>Escaneá el QR del recorrido y confirmá la cantidad para salir.</Text> : null}
              </Pressable>
            )}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        </View>
        <DriverBottomNavigation activeTab="routes" onPress={handleTabPress} />
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: AppTheme.colors.background },
  backgroundImage: { opacity: 0.18 },
  safeArea: { flex: 1 },
  page: { flex: 1, paddingHorizontal: AppTheme.layout.screenPadding, paddingTop: AppTheme.spacing.lg, paddingBottom: 112 },
  header: { marginBottom: AppTheme.spacing.lg, paddingTop: AppTheme.spacing.lg, gap: AppTheme.spacing.xs },
  eyebrow: { ...AppTheme.typography.kicker },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateBtn: { padding: 6 },
  title: { color: AppTheme.text.primary, fontSize: 20, fontWeight: "700", textTransform: "capitalize", flex: 1, textAlign: "center" },
  link: { color: AppTheme.text.accent, textAlign: "center", marginTop: 4 },
  card: { backgroundColor: AppTheme.surfaces.card, borderRadius: AppTheme.radius.lg, borderWidth: 1, borderColor: AppTheme.borders.default, padding: AppTheme.spacing.md, marginBottom: AppTheme.spacing.sm, gap: 6 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardType: { color: AppTheme.text.primary, fontSize: 16, fontWeight: "700" },
  cardMeta: { color: AppTheme.text.secondary, fontSize: 13 },
  cardHint: { color: AppTheme.text.accent, fontSize: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: AppTheme.borders.default },
  badgeActive: { borderColor: AppTheme.colors.primary },
  badgeDone: { opacity: 0.6 },
  badgeText: { color: AppTheme.text.primary, fontSize: 12, fontWeight: "600" },
  empty: { alignItems: "center", gap: 10, marginTop: 40 },
  emptyText: { color: AppTheme.text.secondary, textAlign: "center" },
  errorBox: { borderWidth: 1, borderColor: AppTheme.colors.danger ?? "#d9534f", borderRadius: AppTheme.radius.md, padding: 12, marginBottom: 12 },
  errorText: { color: AppTheme.text.primary },
});
