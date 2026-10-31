// src/Presentation/views/driver/turbo/TurboOffersScreen.tsx
// Turbos ofrecidos al chofer: cada tarjeta muestra tienda, destino, distancia,
// cuánto queda para contestar y hasta qué hora hay que entregar. Acepto lo
// asigna (el primero que toca se lo queda); Paso lo rechaza. Se refresca sola
// porque el push puede no llegar.
//
// Si el «Acepto» no tiene respuesta (sin red, sin respuesta a tiempo) no se sabe
// si quedó asignado: la tarjeta queda con «Confirmando el Turbo…» aunque el
// sondeo ya no la traiga, se reintenta (el servidor es idempotente) y, si nada
// contesta, queda el aviso con «Reintentar» y «Ver recorridos». Cada sondeo que
// vuelve a responder reintenta una vez, hasta tener una respuesta del servidor.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, FlatList, ImageBackground, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import DriverBottomNavigation, { DriverTabKey } from "../../../components/DriverBottomNavigation";
import type { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import { acceptOffer, declineOffer, fetchMyOffers, hhmm, km, TurboApiError, TurboOffer } from "./turboApi";
import { AcceptOutcome, acceptWithConfirm, secondsLeft, withLocalExpiry, WithLocalExpiry } from "./turboOffer";
import { errorMessage } from "../errorMessage";

type Props = NativeStackScreenProps<DriverStackParamList, "TurboOffersScreen">;
type Offer = WithLocalExpiry<TurboOffer>;
// El «Acepto» en curso: «confirming» mientras se espera (y se reintenta);
// «unknown» si ningún intento tuvo respuesta.
type PendingAccept = { offer: Offer; phase: "confirming" | "unknown" };

const REFRESH_MS = 10_000;

export default function TurboOffersScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [pending, setPendingState] = useState<PendingAccept | null>(null);
  const [now, setNow] = useState(Date.now());
  const mounted = useRef(true);
  const focused = useRef(false);
  // Copia para los callbacks (el sondeo, el resultado de un intento).
  const pendingRef = useRef<PendingAccept | null>(null);
  const setPending = (p: PendingAccept | null) => { pendingRef.current = p; setPendingState(p); };
  // Un solo pedido de aceptación en vuelo (el doble toque y el sondeo no lo repiten).
  const accepting = useRef(false);

  const drop = (routeId: number) => setOffers((prev) => prev.filter((o) => o.route_id !== routeId));

  const settle = (o: Offer, r: AcceptOutcome) => {
    const visible = mounted.current && focused.current;
    if (r.kind === "unknown") {
      setPending({ offer: o, phase: "unknown" });
      // Fuera de la pantalla nadie ve el aviso de la tarjeta.
      if (!visible) {
        Alert.alert("No pudimos confirmar el Turbo", `No sabemos si el Turbo #${o.route_id} quedó a tu nombre. Si quedó asignado, aparece en Recorridos.`, [
          { text: "Cerrar", style: "cancel" },
          { text: "Ver recorridos", onPress: () => navigation.navigate("RoutesScreen") },
        ]);
      }
      return;
    }
    setPending(null);
    drop(o.route_id);
    if (r.kind === "gone") {
      // TAKEN / EXPIRED / NOT_OFFERING: la oferta ya no vale, la tarjeta se va con el mensaje del servidor.
      if (visible) setNotice(errorMessage(r.error, "Este Turbo ya no está disponible."));
      return;
    }
    if (visible) {
      setNotice("Turbo asignado. Ya está en tus recorridos.");
      navigation.navigate("RouteDetailScreen", { routeId: o.route_id });
    } else {
      // El chofer salió de la pantalla mientras se confirmaba.
      Alert.alert("Turbo asignado", `El Turbo #${o.route_id} quedó a tu nombre.`, [
        { text: "Cerrar", style: "cancel" },
        { text: "Ver recorrido", onPress: () => navigation.navigate("RouteDetailScreen", { routeId: o.route_id }) },
      ]);
    }
  };

  const confirm = async (o: Offer, tries?: number) => {
    if (accepting.current) return;
    accepting.current = true;
    try {
      settle(o, await acceptWithConfirm(o.route_id, acceptOffer, { tries }));
    } finally {
      accepting.current = false;
    }
  };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    // El vencimiento se ancla a cuando sale el pedido (ver turboOffer.ts).
    const startedAt = Date.now();
    try {
      const list = withLocalExpiry(await fetchMyOffers(), startedAt);
      if (mounted.current) { setOffers(list); setError(null); }
      // El servidor volvió a responder: un Acepto sin confirmar se reintenta una vez.
      const p = pendingRef.current;
      if (p?.phase === "unknown") void confirm(p.offer, 1);
    } catch (e: any) {
      if (mounted.current && !silent) setError(errorMessage(e, "No se pudieron cargar las ofertas"));
    } finally {
      if (mounted.current) setLoading(false);
    }
    // Sin dependencias: confirm y settle solo usan refs, setters y navigation.
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
      focused.current = true;
      load(loadedOnce.current);
      loadedOnce.current = true;
      setNow(Date.now());
      const poll = setInterval(() => load(true), REFRESH_MS);
      const tick = setInterval(() => setNow(Date.now()), 1000);
      const sub = AppState.addEventListener("change", (s) => { if (s === "active") load(true); });
      return () => { focused.current = false; clearInterval(poll); clearInterval(tick); sub.remove(); };
    }, [load]),
  );

  const onAccept = (o: Offer) => {
    if (pendingRef.current) return;
    setPending({ offer: o, phase: "confirming" }); setNotice(null); setError(null);
    void confirm(o);
  };

  const onRetry = () => {
    const p = pendingRef.current;
    if (!p || accepting.current) return;
    setPending({ offer: p.offer, phase: "confirming" });
    void confirm(p.offer);
  };

  // La tarjeta sale solo si el servidor tomó la respuesta (o la oferta ya no
  // está: 409/404). Si no llegó, sigue y vuelve a aparecer en el próximo sondeo.
  const onDecline = async (o: Offer) => {
    setBusy(o.route_id); setNotice(null); setError(null);
    try {
      await declineOffer(o.route_id);
      drop(o.route_id);
    } catch (e: any) {
      if (e instanceof TurboApiError && (e.status === 409 || e.status === 404)) drop(o.route_id);
      else setError(`No se pudo avisar que pasás. ${errorMessage(e, "Probá de nuevo.")}`);
    } finally { setBusy(null); }
  };

  // La tarjeta del Acepto en curso se ve aunque el sondeo ya no la traiga
  // (si el servidor la asignó, deja de venir como oferta).
  const shown = pending && !offers.some((o) => o.route_id === pending.offer.route_id) ? [pending.offer, ...offers] : offers;

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
            data={shown}
            keyExtractor={(o) => String(o.route_id)}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} tintColor={theme.text.accent} />}
            ListEmptyComponent={loading ? <ActivityIndicator color={theme.text.accent} style={{ marginTop: 40 }} /> : (
              <View style={styles.empty}><Ionicons name="flash-outline" size={36} color={theme.text.muted} /><Text style={styles.emptyText}>No hay turbos ofrecidos ahora.</Text></View>
            )}
            renderItem={({ item }) => {
              const left = secondsLeft(item, now);
              const urgent = left <= 15;
              const mine = pending?.offer.route_id === item.route_id ? pending : null;
              const disabled = busy !== null || pending !== null || left === 0;
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
                  {mine?.phase === "confirming" ? (
                    <View style={styles.confirming}>
                      <ActivityIndicator color={theme.text.accent} />
                      <Text style={styles.line}>Confirmando el Turbo…</Text>
                    </View>
                  ) : mine ? (
                    <>
                      <Text style={styles.line}>No pudimos confirmar el Turbo #{item.route_id}. Si quedó asignado, aparece en Recorridos.</Text>
                      <View style={styles.row}>
                        <Pressable onPress={onRetry} style={[styles.btn, styles.btnYes]}>
                          <Text style={styles.btnText}>Reintentar</Text>
                        </Pressable>
                        <Pressable onPress={() => navigation.navigate("RoutesScreen")} style={[styles.btn, styles.btnNo]}>
                          <Text style={styles.btnGhostText}>Ver recorridos</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <View style={styles.row}>
                      <Pressable onPress={() => onAccept(item)} disabled={disabled} style={[styles.btn, styles.btnYes, disabled && styles.btnDisabled]}>
                        <Text style={styles.btnText}>Acepto</Text>
                      </Pressable>
                      <Pressable onPress={() => onDecline(item)} disabled={disabled} style={[styles.btn, styles.btnNo, disabled && styles.btnDisabled]}>
                        {busy === item.route_id ? <ActivityIndicator color={theme.text.primary} /> : <Text style={styles.btnGhostText}>Paso</Text>}
                      </Pressable>
                    </View>
                  )}
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
  confirming: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 46, marginTop: 6 },
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
