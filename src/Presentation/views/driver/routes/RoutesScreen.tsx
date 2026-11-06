// src/Presentation/views/driver/routes/RoutesScreen.tsx
// Recorridos de reparto y Turbo del chofer para una fecha (hoy por defecto).
// Las ofertas se contestan en Alertas › Ofertas: acá solo el
// acceso con el contador. Las colectas tienen su pantalla (CollectionsScreen).

import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, ImageBackground, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import DriverBottomNavigation, { DriverTabKey } from "../../../components/DriverBottomNavigation";
import type { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import { fetchMyRoutes, RouteSummary, todayIso } from "./routesApi";
import { fetchMyGroups, TurboGroup, TurboLoad } from "../turbo/turboApi";
import { loadText, loadTotal, routesWithGroups } from "../turbo/turboGroup";
import { capitalize } from "./collectionLabels";
import WorkItemCard from "../../../components/driver/WorkItemCard";
import { openOfferInbox, refreshOfferCount, useOfferCount } from "../offers/offerStore";

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
  // Ofertas sin contestar: el push puede perderse, el acceso no.
  const ofertas = useOfferCount();
  // Grupos Turbo del día: varios Turbos de una tienda se ven como uno.
  const [grupos, setGrupos] = useState<{ groups: TurboGroup[]; load: TurboLoad | null }>({ groups: [], load: null });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      void refreshOfferCount();
      const [mine, groups] = await Promise.all([
        fetchMyRoutes(date),
        // Un servidor anterior no tiene grupos: la lista de siempre.
        fetchMyGroups(date).catch(() => ({ groups: [] as TurboGroup[], load: null })),
      ]);
      setRoutes(mine.filter((r) => r.type !== "PICKUP"));
      setGrupos(groups);
    } catch (e: any) { setError(e?.message ?? "No se pudieron cargar los recorridos"); } finally { setLoading(false); }
  }, [date]);

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
              <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Volver"><Ionicons name="arrow-back" size={22} color={theme.text.primary} /></Pressable>
              <Text style={styles.eyebrow}>Recorridos de reparto</Text>
            </View>
            {/* Navegación por días: bloque aparte del «volver», con botones de 44 px. */}
            <View style={[theme.card, styles.dateRow]}>
              <Pressable onPress={() => setDate(shiftDate(date, -1))} style={styles.dateBtn} accessibilityRole="button" accessibilityLabel="Día anterior"><Ionicons name="chevron-back" size={22} color={theme.text.primary} /></Pressable>
              <Text style={styles.title}>{capitalize(prettyDate(date))}</Text>
              <Pressable onPress={() => setDate(shiftDate(date, 1))} style={styles.dateBtn} accessibilityRole="button" accessibilityLabel="Día siguiente"><Ionicons name="chevron-forward" size={22} color={theme.text.primary} /></Pressable>
            </View>
            {date !== todayIso() ? <Pressable onPress={() => setDate(todayIso())}><Text style={styles.link}>Volver a hoy</Text></Pressable> : null}
          </View>

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

          {ofertas ? (
            <Pressable style={[theme.card, styles.confirmBox, styles.turboBox]} onPress={() => openOfferInbox(navigation)}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="flash" size={22} color={theme.text.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.confirmTitle}>Tenés {ofertas === 1 ? "una oferta" : `${ofertas} ofertas`} sin contestar</Text>
                  <Text style={styles.cardMeta}>Contestalas en Alertas antes de que venzan.</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.text.muted} />
              </View>
            </Pressable>
          ) : null}

          {loadTotal(grupos?.load) ? <Text style={[styles.cardMeta, { marginBottom: 8 }]}>Turbos que llevás: {loadText(grupos?.load)}</Text> : null}

          <FlatList
            data={routesWithGroups(routes, grupos?.groups ?? [])}
            keyExtractor={(i) => (i.kind === "group" ? `g${i.group.id}` : String(i.route.id))}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.text.accent} />}
            ListEmptyComponent={loading ? <ActivityIndicator color={theme.text.accent} style={{ marginTop: 40 }} /> : (
              <View style={styles.empty}><Ionicons name="map-outline" size={36} color={theme.text.muted} /><Text style={styles.emptyText}>No tenés recorridos de reparto ni Turbo para este día.</Text></View>
            )}
            renderItem={({ item: it }) => (
              <WorkItemCard
                item={it}
                onPress={() => (it.kind === "group" ? navigation.navigate("TurboGroupScreen", { groupId: it.group.id }) : navigation.navigate("RouteDetailScreen", { routeId: it.route.id }))}
              />
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
  header: { marginBottom: t.spacing.lg, paddingTop: t.spacing.lg, gap: t.spacing.md },
  // Volver: 44 px de área táctil; el ícono queda alineado con el contenido.
  headerTop: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: -11 },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: t.radius.full },
  eyebrow: { ...t.typography.kicker },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: t.spacing.xs, paddingVertical: t.spacing.xs },
  dateBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: t.radius.full },
  // Solo la primera letra en mayúscula («Lunes 27 de octubre»).
  title: { color: t.text.primary, fontSize: 18, fontWeight: "700", flex: 1, textAlign: "center" },
  link: { color: t.text.accent, textAlign: "center", marginTop: 4 },
  cardMeta: { color: t.text.secondary, fontSize: 13 },
  empty: { alignItems: "center", gap: 10, marginTop: 40 },
  emptyText: { color: t.text.secondary, textAlign: "center" },
  // Ofertas: siempre con contorno, también en Minimal (piden respuesta).
  confirmBox: { borderWidth: 1, borderColor: t.colors.primary, padding: t.spacing.md, marginBottom: t.spacing.md, gap: 8 },
  confirmTitle: { color: t.text.primary, fontSize: 15, fontWeight: "700" },
  turboBox: { borderColor: t.text.accent },
  errorBox: { borderWidth: 1, borderColor: t.status.rejected.border, backgroundColor: t.status.rejected.background, borderRadius: t.radius.md, padding: 12, marginBottom: 12 },
  errorText: { color: t.status.rejected.text },
});
