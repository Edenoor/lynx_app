// src/Presentation/views/driver/turbo/TurboOffersScreen.tsx
// Turbos ofrecidos al chofer: cada tarjeta muestra tienda, destino, distancia,
// cuánto queda para contestar y hasta qué hora hay que entregar. Acepto lo
// asigna (el primero que toca se lo queda); Paso lo rechaza. Se refresca sola
// porque el push puede no llegar.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, FlatList, ImageBackground, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import AppTheme from "../../../theme/AppTheme";
import DriverBottomNavigation, { DriverTabKey } from "../../../components/DriverBottomNavigation";
import type { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import { acceptOffer, declineOffer, fetchMyOffers, hhmm, km, TurboApiError, TurboOffer } from "./turboApi";

type Props = NativeStackScreenProps<DriverStackParamList, "TurboOffersScreen">;

const REFRESH_MS = 10_000;

export default function TurboOffersScreen({ navigation }: Props) {
  const [offers, setOffers] = useState<TurboOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const mounted = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const list = await fetchMyOffers();
      if (mounted.current) { setOffers(list); setError(null); }
    } catch (e: any) {
      if (mounted.current && !silent) setError(e?.message ?? "No se pudieron cargar las ofertas");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Consulta y cuenta regresiva solo mientras la pantalla está a la vista: al
  // aceptar se pasa al recorrido y esta queda montada debajo.
  const loadedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      load(loadedOnce.current);
      loadedOnce.current = true;
      setNow(Date.now());
      const poll = setInterval(() => load(true), REFRESH_MS);
      const tick = setInterval(() => setNow(Date.now()), 1000);
      const sub = AppState.addEventListener("change", (s) => { if (s === "active") load(true); });
      return () => { clearInterval(poll); clearInterval(tick); sub.remove(); };
    }, [load]),
  );

  const drop = (routeId: number) => setOffers((prev) => prev.filter((o) => o.route_id !== routeId));

  const onAccept = async (o: TurboOffer) => {
    setBusy(o.route_id); setNotice(null); setError(null);
    try {
      await acceptOffer(o.route_id);
      drop(o.route_id);
      setNotice("Turbo asignado. Ya está en tus recorridos.");
      navigation.navigate("RouteDetailScreen", { routeId: o.route_id });
    } catch (e: any) {
      // TAKEN / EXPIRED: la oferta ya no vale, la tarjeta se va con el mensaje del servidor.
      if (e instanceof TurboApiError && e.status === 409) { drop(o.route_id); setNotice(e.message); }
      else setError(e?.message ?? "No se pudo aceptar el turbo");
    } finally { setBusy(null); }
  };

  const onDecline = async (o: TurboOffer) => {
    setBusy(o.route_id); setNotice(null); setError(null);
    try { await declineOffer(o.route_id); } catch (_e) { /* si ya venció, da igual */ }
    drop(o.route_id); setBusy(null);
  };

  const handleTabPress = (tab: DriverTabKey) => {
    switch (tab) {
      case "home": navigation.navigate("DriverScreen"); break;
      case "deliveries": navigation.navigate("EnviosScreen"); break;
      case "scan": navigation.navigate("DriverScanOptionsScreen"); break;
      case "routes": navigation.navigate("RoutesScreen"); break;
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
            <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.back}><Ionicons name="arrow-back" size={22} color={AppTheme.text.primary} /></Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Turbo</Text>
              <Text style={styles.title}>Turbos ofrecidos</Text>
              <Text style={styles.meta}>El primero que acepta se lo queda. Si no contestás a tiempo, pasa a otro chofer.</Text>
            </View>
          </View>

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
          {notice ? <View style={styles.noticeBox}><Text style={styles.noticeText}>{notice}</Text></View> : null}

          <FlatList
            data={offers}
            keyExtractor={(o) => String(o.route_id)}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} tintColor={AppTheme.text.accent} />}
            ListEmptyComponent={loading ? <ActivityIndicator color={AppTheme.text.accent} style={{ marginTop: 40 }} /> : (
              <View style={styles.empty}><Ionicons name="flash-outline" size={36} color={AppTheme.text.muted} /><Text style={styles.emptyText}>No hay turbos ofrecidos ahora.</Text></View>
            )}
            renderItem={({ item }) => {
              const left = Math.max(0, Math.round((new Date(item.expires_at).getTime() - now) / 1000));
              const urgent = left <= 15;
              const disabled = busy !== null || left === 0;
              return (
                <View style={[styles.card, urgent && styles.cardUrgent]}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardType}>Turbo #{item.route_id}</Text>
                    <View style={[styles.badge, urgent && styles.badgeUrgent]}>
                      <Ionicons name="time-outline" size={14} color={urgent ? AppTheme.colors.danger : AppTheme.text.primary} />
                      <Text style={[styles.badgeText, urgent && styles.badgeTextUrgent]}>{left === 0 ? "vencida" : `${left} s para responder`}</Text>
                    </View>
                  </View>
                  <Text style={styles.line}><Text style={styles.label}>Retiro · </Text>{item.store_name ?? "tienda"}{item.store_address ? ` · ${item.store_address}` : ""}</Text>
                  <Text style={styles.line}><Text style={styles.label}>Entrega · </Text>{item.receiver_name ?? "comprador"}{item.delivery_address ? ` · ${item.delivery_address}` : ""}{item.delivery_postal_code ? ` · CP ${item.delivery_postal_code}` : ""}</Text>
                  <Text style={styles.cardMeta}>
                    {km(item.distance_km) ? `Tienda a ${km(item.distance_km)} de vos` : ""}
                    {item.deadline_at ? ` · entregar antes de las ${hhmm(item.deadline_at)}` : ""}
                  </Text>
                  <View style={styles.row}>
                    <Pressable onPress={() => onAccept(item)} disabled={disabled} style={[styles.btn, styles.btnYes, disabled && styles.btnDisabled]}>
                      {busy === item.route_id ? <ActivityIndicator color={AppTheme.text.inverse} /> : <Text style={styles.btnText}>Acepto</Text>}
                    </Pressable>
                    <Pressable onPress={() => onDecline(item)} disabled={disabled} style={[styles.btn, styles.btnNo, disabled && styles.btnDisabled]}>
                      <Text style={styles.btnGhostText}>Paso</Text>
                    </Pressable>
                  </View>
                </View>
              );
            }}
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
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: AppTheme.spacing.lg, paddingTop: AppTheme.spacing.lg },
  back: { padding: 6, marginTop: 2 },
  eyebrow: { ...AppTheme.typography.kicker },
  title: { color: AppTheme.text.primary, fontSize: 22, fontWeight: "700" },
  meta: { color: AppTheme.text.secondary, fontSize: 13, marginTop: 2 },
  card: { backgroundColor: AppTheme.surfaces.card, borderRadius: AppTheme.radius.lg, borderWidth: 1, borderColor: AppTheme.colors.primary, padding: AppTheme.spacing.md, marginBottom: AppTheme.spacing.sm, gap: 6 },
  cardUrgent: { borderColor: AppTheme.colors.danger },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardType: { color: AppTheme.text.primary, fontSize: 16, fontWeight: "700" },
  line: { color: AppTheme.text.primary, fontSize: 14 },
  label: { color: AppTheme.text.secondary, fontWeight: "600" },
  cardMeta: { color: AppTheme.text.secondary, fontSize: 13 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: AppTheme.borders.default },
  badgeUrgent: { borderColor: AppTheme.colors.danger },
  badgeText: { color: AppTheme.text.primary, fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  badgeTextUrgent: { color: AppTheme.colors.danger },
  row: { flexDirection: "row", gap: 8, marginTop: 6 },
  btn: { flex: 1, minHeight: 46, borderRadius: AppTheme.radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  btnYes: { backgroundColor: AppTheme.colors.primary, borderColor: AppTheme.colors.primary },
  btnNo: { backgroundColor: "transparent", borderColor: AppTheme.borders.default },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: AppTheme.text.inverse, fontWeight: "700", fontSize: 15 },
  btnGhostText: { color: AppTheme.text.primary, fontWeight: "600", fontSize: 15 },
  empty: { alignItems: "center", gap: 10, marginTop: 40 },
  emptyText: { color: AppTheme.text.secondary, textAlign: "center" },
  errorBox: { borderWidth: 1, borderColor: AppTheme.colors.danger, borderRadius: AppTheme.radius.md, padding: 12, marginBottom: 12 },
  errorText: { color: AppTheme.text.primary },
  noticeBox: { borderWidth: 1, borderColor: AppTheme.colors.primary, borderRadius: AppTheme.radius.md, padding: 12, marginBottom: 12 },
  noticeText: { color: AppTheme.text.primary },
});
