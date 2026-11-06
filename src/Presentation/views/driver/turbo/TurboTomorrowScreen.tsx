// src/Presentation/views/driver/turbo/TurboTomorrowScreen.tsx
// Turbos de mañana: los programados (Mercado Libre los prometió para otro
// día) que todavía no tienen chofer. Cualquier chofer habilitado puede tomar
// uno antes: queda para ese día, con su franja, y no se retira antes.
//
// Filtro por tienda y orden (por promesa o por tienda): ver scheduledList.ts.
// No hay «Rechazar»: el servidor no guarda el rechazo de un programado (lo
// volvería a listar), y esconderlo solo en el teléfono sería simularlo.

import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, ImageBackground, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import type { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import { todayIso } from "../routes/routesApi";
import { errorMessage } from "../errorMessage";
import { claimScheduled, fetchScheduledAvailable, hhmm, ScheduledTurbo } from "./turboApi";
import { NO_RETIRAR_ANTES } from "./turboOffer";
import { filterScheduled, hasMine, promiseText, ScheduledSort, sortScheduled, StoreFilter, storeName, storesOf } from "./scheduledList";

type Props = NativeStackScreenProps<DriverStackParamList, "TurboTomorrowScreen">;

const SORTS: { key: ScheduledSort; label: string }[] = [
  { key: "promise", label: "Por promesa" },
  { key: "store", label: "Por tienda" },
];

export default function TurboTomorrowScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [turbos, setTurbos] = useState<ScheduledTurbo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [filter, setFilter] = useState<StoreFilter>({ kind: "all" });
  const [sort, setSort] = useState<ScheduledSort>("promise");

  const load = useCallback(async () => {
    setLoading(true);
    try { setTurbos(await fetchScheduledAvailable()); setError(null); }
    catch (e: any) { setError(errorMessage(e, "No se pudieron cargar los Turbos de mañana")); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const stores = useMemo(() => storesOf(turbos), [turbos]);
  // Una tienda elegida que ya no tiene Turbos (los tomaron) vuelve a «Todas».
  const current: StoreFilter = filter.kind === "store" && !stores.includes(filter.name) ? { kind: "all" } : filter.kind === "mine" && !hasMine(turbos) ? { kind: "all" } : filter;
  const shown = useMemo(() => sortScheduled(filterScheduled(turbos, current), sort), [turbos, current.kind, current.kind === "store" ? current.name : "", sort]);
  const today = todayIso();

  const chips: { key: string; label: string; value: StoreFilter }[] = [
    { key: "all", label: "Todas las tiendas", value: { kind: "all" } },
    ...(hasMine(turbos) ? [{ key: "mine", label: "Mis tiendas", value: { kind: "mine" } as StoreFilter }] : []),
    ...(stores.length > 1 ? stores.map((name) => ({ key: `s:${name}`, label: name, value: { kind: "store", name } as StoreFilter })) : []),
  ];
  const isActive = (v: StoreFilter) => v.kind === current.kind && (v.kind !== "store" || (current.kind === "store" && current.name === v.name));

  const aceptar = (t: ScheduledTurbo) =>
    Alert.alert("Aceptar el Turbo", `${storeName(t)} · ${promiseText(t, today, hhmm)}. ${NO_RETIRAR_ANTES}`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Aceptar", onPress: async () => {
          setBusy(t.route_id); setError(null);
          try {
            const r = await claimScheduled(t.route_id);
            if (r.group_id) navigation.navigate("TurboGroupScreen", { groupId: r.group_id });
            else navigation.navigate("RouteDetailScreen", { routeId: t.route_id });
          } catch (e: any) { setError(errorMessage(e, "No se pudo aceptar el Turbo")); await load(); }
          finally { setBusy(null); }
        },
      },
    ]);

  return (
    <ImageBackground source={require("../../../../../assets/background-1.png")} style={styles.background} imageStyle={styles.backgroundImage}>
      <ThemedStatusBar />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.page}>
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button" accessibilityLabel="Volver"><Ionicons name="arrow-back" size={22} color={theme.text.primary} /></Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Turbo</Text>
              <Text style={styles.title}>Turbos de mañana</Text>
              <Text style={styles.meta}>Quedan para su día y su franja. El primero que acepta se lo queda.</Text>
            </View>
          </View>

          {turbos.length ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsBox}>
                {chips.map((c) => {
                  const active = isActive(c.value);
                  return (
                    <Pressable key={c.key} onPress={() => setFilter(c.value)} style={[styles.chip, active && styles.chipActive]}
                      accessibilityRole="button" accessibilityState={{ selected: active }}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={styles.sortRow}>
                <Text style={styles.count}>{shown.length === 1 ? "1 Turbo" : `${shown.length} Turbos`}</Text>
                {SORTS.map((s) => (
                  <Pressable key={s.key} onPress={() => setSort(s.key)} style={[styles.sortBtn, sort === s.key && styles.sortBtnActive]}
                    accessibilityRole="button" accessibilityState={{ selected: sort === s.key }}>
                    <Text style={[styles.sortText, sort === s.key && styles.sortTextActive]}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
          <FlatList
            data={shown}
            keyExtractor={(t) => String(t.route_id)}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.text.accent} />}
            ListEmptyComponent={loading ? <ActivityIndicator color={theme.text.accent} style={{ marginTop: 40 }} /> : (
              <View style={styles.empty}><Ionicons name="calendar-outline" size={36} color={theme.text.muted} /><Text style={styles.emptyText}>No hay Turbos para otro día sin chofer.</Text></View>
            )}
            renderItem={({ item }) => (
              <View style={[theme.card, styles.card]}>
                <View style={styles.cardTop}>
                  <Text style={styles.store} numberOfLines={1}>{storeName(item)}</Text>
                  {item.offered_to_me ? <Text style={styles.mine}>Tu tienda</Text> : null}
                </View>
                <Text style={styles.label}>Promesa de entrega</Text>
                <Text style={styles.promise}>{promiseText(item, today, hhmm)}</Text>
                <Text style={styles.line} numberOfLines={2}><Text style={styles.label}>Retiro · </Text>{item.store_address ?? "sin dirección"}</Text>
                <Text style={styles.line} numberOfLines={2}>
                  <Text style={styles.label}>Entrega · </Text>{item.delivery_address ?? "sin dirección"}{item.delivery_postal_code ? ` · CP ${item.delivery_postal_code}` : ""}
                </Text>
                <Pressable onPress={() => aceptar(item)} disabled={busy !== null} style={[styles.btn, busy !== null && styles.btnDisabled]} accessibilityRole="button">
                  {busy === item.route_id ? <ActivityIndicator color={theme.text.onPrimary} /> : <Text style={styles.btnText}>Aceptar</Text>}
                </Pressable>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  background: { flex: 1, backgroundColor: t.colors.background },
  backgroundImage: { opacity: t.backdrop.imageOpacity },
  safeArea: { flex: 1 },
  page: { flex: 1, paddingHorizontal: t.layout.screenPadding, paddingTop: t.spacing.lg, paddingBottom: 24 },
  header: { flexDirection: "row", gap: 4, alignItems: "flex-start", marginBottom: t.spacing.md, paddingTop: t.spacing.lg },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -11, marginTop: -8 },
  eyebrow: { ...t.typography.kicker },
  title: { color: t.text.primary, fontSize: 22, fontWeight: "700" },
  meta: { color: t.text.secondary, fontSize: 13, marginTop: 2 },
  chipsBox: { flexGrow: 0, marginBottom: t.spacing.sm },
  chips: { gap: 6, paddingRight: t.spacing.lg },
  chip: { minHeight: 36, maxWidth: 220, paddingHorizontal: 12, borderRadius: t.radius.full, justifyContent: "center", backgroundColor: t.surfaces.muted, borderWidth: 1, borderColor: t.borders.soft },
  chipActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  chipText: { color: t.text.secondary, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: t.text.onPrimary },
  sortRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: t.spacing.sm },
  count: { flex: 1, color: t.text.secondary, fontSize: 13, fontWeight: "600" },
  sortBtn: { minHeight: 32, paddingHorizontal: 10, borderRadius: t.radius.md, justifyContent: "center", borderWidth: 1, borderColor: t.borders.default },
  sortBtnActive: { borderColor: t.text.accent, backgroundColor: t.overlays.primary },
  sortText: { color: t.text.secondary, fontSize: 12, fontWeight: "700" },
  sortTextActive: { color: t.text.accent },
  card: { borderWidth: 1, borderColor: t.borders.primary, padding: t.spacing.md, marginBottom: t.spacing.sm, gap: 4 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  store: { flex: 1, color: t.text.primary, fontSize: 16, fontWeight: "800" },
  mine: { color: t.status.confirmed.text, fontSize: 12, fontWeight: "700" },
  promise: { color: t.status.pending.text, fontSize: 15, fontWeight: "700", marginBottom: 2 },
  line: { color: t.text.primary, fontSize: 14 },
  label: { color: t.text.secondary, fontWeight: "600", fontSize: 12 },
  btn: { minHeight: 44, borderRadius: t.radius.md, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.primary, marginTop: 6 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: t.text.onPrimary, fontWeight: "700", fontSize: 15 },
  empty: { alignItems: "center", gap: 10, marginTop: 40 },
  emptyText: { color: t.text.secondary, textAlign: "center" },
  errorBox: { borderWidth: 1, borderColor: t.status.rejected.border, backgroundColor: t.status.rejected.background, borderRadius: t.radius.md, padding: 12, marginBottom: 12 },
  errorText: { color: t.text.primary },
});
