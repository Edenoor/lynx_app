// src/Presentation/views/driver/routes/RoutesScreen.tsx
// Recorridos de reparto y Turbo del chofer para una fecha (hoy por defecto),
// con los Turbo y los recorridos que le ofrecieron. Se entra desde Envíos; las
// colectas tienen su pantalla (CollectionsScreen).

import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, ImageBackground, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import StatusChip from "../../../components/StatusChip";
import DriverBottomNavigation, { DriverTabKey } from "../../../components/DriverBottomNavigation";
import type { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import {
  acceptRouteOffer, declineRouteOffer, fetchMyRoutes, fetchRouteOffers, RouteOffer, RouteSummary, STATUS_LABEL,
  todayIso, TYPE_LABEL,
} from "./routesApi";
import { errorMessage } from "../errorMessage";
import { fetchMyOffers } from "../turbo/turboApi";
import { routeStatusKey } from "./routeStatus";

type Props = NativeStackScreenProps<DriverStackParamList, "RoutesScreen">;

const shiftDate = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const prettyDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

export default function RoutesScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [date, setDate] = useState(todayIso());
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [respondiendo, setRespondiendo] = useState<number | null>(null);
  // Turbos ofrecidos y todavía sin respuesta: el push puede perderse, el banner no.
  const [ofertas, setOfertas] = useState(0);
  // Recorridos que ofreció el coordinador (no Turbo): se aceptan o rechazan acá.
  const [ofrecidos, setOfrecidos] = useState<RouteOffer[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [mine, turbos, offered] = await Promise.all([
        fetchMyRoutes(date),
        fetchMyOffers().catch(() => []),
        fetchRouteOffers().catch(() => [] as RouteOffer[]),
      ]);
      setRoutes(mine.filter((r) => r.type !== "PICKUP"));
      setOfertas(turbos.length);
      setOfrecidos(offered);
    } catch (e: any) { setError(e?.message ?? "No se pudieron cargar los recorridos"); } finally { setLoading(false); }
  }, [date]);

  const responderOferta = async (o: RouteOffer, accept: boolean) => {
    setRespondiendo(o.route_id);
    try { await (accept ? acceptRouteOffer : declineRouteOffer)(o.route_id); await load(); }
    catch (e: any) { setError(errorMessage(e, "No se pudo enviar la respuesta")); await load(); }
    finally { setRespondiendo(null); }
  };

  useEffect(() => { load(); }, [load]);
  useEffect(() => navigation.addListener("focus", load), [navigation, load]);

  const handleTabPress = (tab: DriverTabKey) => {
    switch (tab) {
      case "home": navigation.navigate("DriverScreen"); break;
      case "deliveries": navigation.navigate("EnviosScreen"); break;
      case "scan": navigation.navigate("DriverScanOptionsScreen"); break;
      case "activity": navigation.navigate("NotificationsScreen"); break;
      default: break;
    }
  };

  return (
    <ImageBackground source={require("../../../../../assets/background-1.png")} style={styles.background} imageStyle={styles.backgroundImage}>
      <ThemedStatusBar />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.page}>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Pressable onPress={() => navigation.goBack()} hitSlop={8}><Ionicons name="arrow-back" size={22} color={theme.text.primary} /></Pressable>
              <Text style={styles.eyebrow}>Recorridos de reparto</Text>
            </View>
            <View style={styles.dateRow}>
              <Pressable onPress={() => setDate(shiftDate(date, -1))} style={styles.dateBtn} hitSlop={8}><Ionicons name="chevron-back" size={22} color={theme.text.primary} /></Pressable>
              <Text style={styles.title}>{prettyDate(date)}</Text>
              <Pressable onPress={() => setDate(shiftDate(date, 1))} style={styles.dateBtn} hitSlop={8}><Ionicons name="chevron-forward" size={22} color={theme.text.primary} /></Pressable>
            </View>
            {date !== todayIso() ? <Pressable onPress={() => setDate(todayIso())}><Text style={styles.link}>Volver a hoy</Text></Pressable> : null}
          </View>

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

          {ofertas ? (
            <Pressable style={[theme.card, styles.confirmBox, styles.turboBox]} onPress={() => navigation.navigate("TurboOffersScreen")}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="flash" size={22} color={theme.text.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.confirmTitle}>Tenés {ofertas === 1 ? "un turbo ofrecido" : `${ofertas} turbos ofrecidos`}</Text>
                  <Text style={styles.cardMeta}>Contestá antes de que venza: el primero que acepta se lo queda.</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.text.muted} />
              </View>
            </Pressable>
          ) : null}

          {ofrecidos.length ? (
            <View style={[theme.card, styles.confirmBox]}>
              <Text style={styles.confirmTitle}>Te {ofrecidos.length === 1 ? "ofrecieron un recorrido" : `ofrecieron ${ofrecidos.length} recorridos`}</Text>
              {ofrecidos.map((o) => (
                <View key={o.route_id} style={styles.confirmRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.confirmName}>Recorrido #{o.route_id} · {o.deliveries} {o.deliveries === 1 ? "envío" : "envíos"}</Text>
                    <Text style={styles.cardMeta} numberOfLines={2}>
                      {[o.first_addresses?.filter(Boolean).join(" · "), `vence ${new Date(o.expires_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`].filter(Boolean).join(" — ")}
                    </Text>
                  </View>
                  <Pressable style={[styles.confirmBtn, styles.confirmYes]} disabled={respondiendo === o.route_id} onPress={() => responderOferta(o, true)}><Text style={styles.confirmBtnText}>Aceptar</Text></Pressable>
                  <Pressable style={[styles.confirmBtn, styles.confirmNo]} disabled={respondiendo === o.route_id} onPress={() => responderOferta(o, false)}><Text style={styles.confirmBtnText}>No</Text></Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <FlatList
            data={routes}
            keyExtractor={(r) => String(r.id)}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.text.accent} />}
            ListEmptyComponent={loading ? <ActivityIndicator color={theme.text.accent} style={{ marginTop: 40 }} /> : (
              <View style={styles.empty}><Ionicons name="map-outline" size={36} color={theme.text.muted} /><Text style={styles.emptyText}>No tenés recorridos de reparto ni Turbo para este día.</Text></View>
            )}
            renderItem={({ item }) => (
              <Pressable style={[theme.listItem, styles.card]} onPress={() => navigation.navigate("RouteDetailScreen", { routeId: item.id })}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardType}>{TYPE_LABEL[item.type]} #{item.id}</Text>
                  <StatusChip status={routeStatusKey(item.status)} label={STATUS_LABEL[item.status]} />
                </View>
                <Text style={styles.cardMeta}>
                  {item.stops_count} {item.stops_count === 1 ? "parada" : "paradas"} · {item.deliveries_count} {item.deliveries_count === 1 ? "envío" : "envíos"}
                  {item.type === "DELIVERY" && item.load_expected_count !== null ? ` · carga ${item.load_confirmed_count ?? "–"}/${item.load_expected_count}` : ""}
                </Text>
                {item.type === "DELIVERY" && item.status === "ASSIGNED" ? <Text style={styles.cardHint}>Escaneá el QR del recorrido y confirmá la cantidad para salir.</Text> : null}
              </Pressable>
            )}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        </View>
        <DriverBottomNavigation activeTab="deliveries" onPress={handleTabPress} />
      </SafeAreaView>
    </ImageBackground>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  background: { flex: 1, backgroundColor: t.colors.background },
  backgroundImage: { opacity: t.backdrop.imageOpacity },
  safeArea: { flex: 1 },
  page: { flex: 1, paddingHorizontal: t.layout.screenPadding, paddingTop: t.spacing.lg, paddingBottom: 112 },
  header: { marginBottom: t.spacing.lg, paddingTop: t.spacing.lg, gap: t.spacing.xs },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  eyebrow: { ...t.typography.kicker },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateBtn: { padding: 6 },
  title: { color: t.text.primary, fontSize: 20, fontWeight: "700", textTransform: "capitalize", flex: 1, textAlign: "center" },
  link: { color: t.text.accent, textAlign: "center", marginTop: 4 },
  card: { padding: t.spacing.md, marginBottom: t.list.gap, gap: 6 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardType: { color: t.text.primary, fontSize: 16, fontWeight: "700" },
  cardMeta: { color: t.text.secondary, fontSize: 13 },
  cardHint: { color: t.text.accent, fontSize: 12 },
  empty: { alignItems: "center", gap: 10, marginTop: 40 },
  emptyText: { color: t.text.secondary, textAlign: "center" },
  // Ofertas: siempre con contorno, también en Minimal (piden respuesta).
  confirmBox: { borderWidth: 1, borderColor: t.colors.primary, padding: t.spacing.md, marginBottom: t.spacing.md, gap: 8 },
  confirmTitle: { color: t.text.primary, fontSize: 15, fontWeight: "700" },
  turboBox: { borderColor: t.text.accent },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 6, borderTopWidth: t.separator.width, borderTopColor: t.separator.color },
  confirmName: { color: t.text.primary, fontSize: 14, fontWeight: "600" },
  confirmBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  confirmYes: { borderColor: t.status.confirmed.border, backgroundColor: t.status.confirmed.background },
  confirmNo: { borderColor: t.status.rejected.border, backgroundColor: t.status.rejected.background },
  confirmBtnText: { color: t.text.primary, fontWeight: "700" },
  errorBox: { borderWidth: 1, borderColor: t.status.rejected.border, backgroundColor: t.status.rejected.background, borderRadius: t.radius.md, padding: 12, marginBottom: 12 },
  errorText: { color: t.status.rejected.text },
});
