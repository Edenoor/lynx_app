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

import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import DriverBottomNavigation, { DriverTabKey } from "../../../components/DriverBottomNavigation";
import type { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import { acceptOffer, declineOffer, fetchMyOffers, hhmm, km, TurboApiError, TurboOffer } from "./turboApi";

type Props = NativeStackScreenProps<DriverStackParamList, "TurboOffersScreen">;

const REFRESH_MS = 10_000;

export default function TurboOffersScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
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
            <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button" accessibilityLabel="Volver"><Ionicons name="arrow-back" size={22} color={theme.text.primary} /></Pressable>
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
            refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} tintColor={theme.text.accent} />}
            ListEmptyComponent={loading ? <ActivityIndicator color={theme.text.accent} style={{ marginTop: 40 }} /> : (
              <View style={styles.empty}><Ionicons name="flash-outline" size={36} color={theme.text.muted} /><Text style={styles.emptyText}>No hay turbos ofrecidos ahora.</Text></View>
            )}
            renderItem={({ item }) => {
              const left = Math.max(0, Math.round((new Date(item.expires_at).getTime() - now) / 1000));
              const urgent = left <= 15;
              const disabled = busy !== null || left === 0;
              return (
                <View style={[theme.card, styles.card, urgent && styles.cardUrgent]}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardType}>Turbo #{item.route_id}</Text>
                    <View style={[styles.badge, urgent && styles.badgeUrgent]}>
                      <Ionicons name="time-outline" size={14} color={urgent ? theme.status.rejected.icon : theme.text.primary} />
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
                      {busy === item.route_id ? <ActivityIndicator color={theme.text.onPrimary} /> : <Text style={styles.btnText}>Acepto</Text>}
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
        {/* Los Turbo son recorridos de reparto: se llega desde Envíos. */}
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
  header: { flexDirection: "row", gap: 4, alignItems: "flex-start", marginBottom: t.spacing.lg, paddingTop: t.spacing.lg },
  // Volver: 44 px de área táctil, como en Recorridos.
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -11, marginTop: -8 },
  eyebrow: { ...t.typography.kicker },
  title: { color: t.text.primary, fontSize: 22, fontWeight: "700" },
  meta: { color: t.text.secondary, fontSize: 13, marginTop: 2 },
  // Superficie del tema; el contorno queda en los tres estilos (también en
  // Minimal): es una oferta que pide respuesta, y en rojo cuando está por vencer.
  card: { borderWidth: 1, borderColor: t.colors.primary, padding: t.spacing.md, marginBottom: t.spacing.sm, gap: 6 },
  cardUrgent: { borderColor: t.status.rejected.text },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardType: { color: t.text.primary, fontSize: 16, fontWeight: "700" },
  line: { color: t.text.primary, fontSize: 14 },
  label: { color: t.text.secondary, fontWeight: "600" },
  cardMeta: { color: t.text.secondary, fontSize: 13 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: t.borders.default },
  badgeUrgent: { borderColor: t.status.rejected.border, backgroundColor: t.status.rejected.background },
  badgeText: { color: t.text.primary, fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  badgeTextUrgent: { color: t.status.rejected.text },
  row: { flexDirection: "row", gap: 8, marginTop: 6 },
  btn: { flex: 1, minHeight: 46, borderRadius: t.radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  btnYes: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  btnNo: { backgroundColor: "transparent", borderColor: t.borders.default },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: t.text.onPrimary, fontWeight: "700", fontSize: 15 },
  btnGhostText: { color: t.text.primary, fontWeight: "600", fontSize: 15 },
  empty: { alignItems: "center", gap: 10, marginTop: 40 },
  emptyText: { color: t.text.secondary, textAlign: "center" },
  errorBox: { borderWidth: 1, borderColor: t.status.rejected.border, backgroundColor: t.status.rejected.background, borderRadius: t.radius.md, padding: 12, marginBottom: 12 },
  errorText: { color: t.text.primary },
  noticeBox: { borderWidth: 1, borderColor: t.status.inTransit.border, backgroundColor: t.status.inTransit.background, borderRadius: t.radius.md, padding: 12, marginBottom: 12 },
  noticeText: { color: t.text.primary },
});
