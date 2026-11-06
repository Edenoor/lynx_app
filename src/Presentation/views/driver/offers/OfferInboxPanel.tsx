// src/Presentation/views/driver/offers/OfferInboxPanel.tsx
// Bandeja de ofertas del chofer: Turbos, lotes de Turbos y recorridos que
// ofrece el coordinador, en una sola lista (lo que vence primero, arriba). Es
// la pestaña «Ofertas» de Alertas (NotificationScreen); se llega también desde
// el aviso de oferta y las notificaciones. Cada oferta se contesta con su
// contrato de siempre.
//
// Sin habilitación Turbo (turbo_enabled false) no se muestran ofertas Turbo ni
// el acceso a «Turbos de mañana»: no las puede aceptar. Lo que ya tiene
// asignado sigue en Envíos. La autorización la decide el servidor al aceptar.
//
// Turbos ofrecidos al chofer: cada tarjeta muestra tienda, destino, distancia,
// cuánto queda para contestar y hasta qué hora hay que entregar. Acepto lo
// asigna (el primero que toca se lo queda); Paso lo rechaza. Se refresca sola
// porque el push puede no llegar. Un lote (varios programados de una tienda)
// va en una sola tarjeta y se acepta entero. Arriba, «Turbos de mañana».
//
// Si el «Acepto» no tiene respuesta (sin red, sin respuesta a tiempo) no se sabe
// si quedó asignado: la tarjeta queda con «Confirmando el Turbo…» aunque el
// sondeo ya no la traiga, se reintenta (el servidor es idempotente) y, si nada
// contesta, queda el aviso con «Reintentar» y «Ver recorridos». Cada sondeo que
// vuelve a responder reintenta una vez, hasta tener una respuesta del servidor.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { acceptLote, acceptOffer, declineLote, declineOffer, fetchMyOffers, getAvailability, hhmm, km, TurboApiError, TurboOffer } from "../turbo/turboApi";
import { AcceptOutcome, acceptWithConfirm, isDefinitive, plazoParaResponder, secondsLeft, withLocalExpiry, WithLocalExpiry } from "../turbo/turboOffer";
import { acceptRouteOffer, declineRouteOffer, fetchRouteOffers, RouteOffer, todayIso } from "../routes/routesApi";
import { buildInbox, pendingOffers, routeOfferTitle, visibleTurboOffers } from "./offerInbox";
import { publishOfferCount, setOfferTurboEnabled } from "./offerStore";
import { invalidateDriverWork } from "../work/workSource";
import { errorMessage } from "../errorMessage";
import { refreshTrackingPolicy } from "../../../config/DriverLocation";

// navigation: la del stack del chofer (la de la pantalla que la contiene).
// bottomSpace: lo que tapa la barra de abajo.
type Props = { navigation: any; bottomSpace: number };
type Offer = WithLocalExpiry<TurboOffer>;
type OfferedRoute = WithLocalExpiry<RouteOffer>;
// El «Acepto» en curso: «confirming» mientras se espera (y se reintenta);
// «unknown» si ningún intento tuvo respuesta.
type PendingAccept = { offer: Offer; phase: "confirming" | "unknown" };

// Etiqueta compacta para la promesa comercial. No cambia el estado del envío.
function turboPromiseLabel(o: TurboOffer, today: string): string | null {
  const date = o.scheduled_date?.slice(0, 10);
  const start = o.window_start_at ? hhmm(o.window_start_at) : null;
  const end = o.deadline_at ? hhmm(o.deadline_at) : null;
  if (!date && !end) return null;

  let day = "hoy";
  if (date) {
    const [year, month, dayOfMonth] = date.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, dayOfMonth, 12));
    if (!Number.isNaN(parsed.getTime())) {
      const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "long", timeZone: "UTC" }).format(parsed);
      day = `${weekday} ${dayOfMonth}/${month}`;
    } else {
      day = date;
    }
  }
  const hour = (v: string) => v.replace(/^0(\d):/, "$1:").replace(/:00$/, "");
  const window = start && end ? ` de ${hour(start)} a ${hour(end)} hs` : end ? ` antes de las ${hour(end)} hs` : "";
  return `Promesa de entrega: ${day}${window}`;
}

const REFRESH_MS = 10_000;

export default function OfferInboxPanel({ navigation, bottomSpace }: Props) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [offers, setOffers] = useState<Offer[]>([]);
  // Recorridos que ofrece el coordinador (no Turbo).
  const [routeOffers, setRouteOffers] = useState<OfferedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [pending, setPendingState] = useState<PendingAccept | null>(null);
  const [now, setNow] = useState(Date.now());
  // null: no se sabe (sin dato no se esconde nada).
  const [turboEnabled, setTurboEnabled] = useState<boolean | null>(null);
  const enabledRef = useRef<boolean | null>(null);
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
    // Un Turbo asignado mantiene el GPS fuera del horario: si estaba en pausa,
    // vuelve en el acto.
    void refreshTrackingPolicy();
    invalidateDriverWork();
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
      // Los recorridos ofrecidos son otra fuente: si fallan, los Turbos se ven igual y el error queda arriba.
      const [turboList, routeList] = await Promise.all([
        fetchMyOffers(),
        fetchRouteOffers().then((r) => ({ ok: true as const, list: r }), (e: unknown) => ({ ok: false as const, error: e })),
      ]);
      const list = withLocalExpiry(visibleTurboOffers(turboList, enabledRef.current), startedAt);
      const offered = routeList.ok ? withLocalExpiry(routeList.list, startedAt) : null;
      if (mounted.current) {
        setOffers(list);
        if (offered) setRouteOffers(offered);
        if (offered) setError(null);
        else if (!silent) setError(`No se pudieron cargar los recorridos ofrecidos. ${errorMessage(routeList.ok ? null : routeList.error, "Probá de nuevo.")}`);
      }
      if (offered) publishOfferCount(pendingOffers(list, offered));
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
      // La habilitación se consulta al entrar; el sondeo no la repite.
      getAvailability()
        .then((a) => {
          const enabled = typeof a.turbo_enabled === "boolean" ? a.turbo_enabled : null;
          enabledRef.current = enabled;
          setOfferTurboEnabled(enabled);
          if (!mounted.current) return;
          setTurboEnabled(enabled);
          if (enabled === false) setOffers((prev) => visibleTurboOffers(prev, false));
        })
        .catch(() => {});
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

  // Un lote se acepta o se rechaza entero. `busy` lleva el lote en negativo
  // (no se confunde con el número de un Turbo).
  const dropLote = (groupId: number) => setOffers((prev) => prev.filter((o) => o.group_id !== groupId));
  const onAcceptLote = async (groupId: number) => {
    if (pendingRef.current || busy !== null) return;
    setBusy(-groupId); setNotice(null); setError(null);
    try {
      const r = await acceptLote(groupId);
      void refreshTrackingPolicy();
      invalidateDriverWork();
      dropLote(groupId);
      navigation.navigate("TurboGroupScreen", { groupId: r.group?.id ?? groupId });
    } catch (e: any) {
      if (isDefinitive(e)) { dropLote(groupId); setNotice(errorMessage(e, "Este lote ya no está disponible.")); }
      else setError("No pudimos confirmar el lote. Si quedó a tu nombre, aparece en Recorridos.");
    } finally { setBusy(null); }
  };
  const onDeclineLote = async (groupId: number) => {
    setBusy(-groupId); setNotice(null); setError(null);
    try { await declineLote(groupId); dropLote(groupId); }
    catch (e: any) {
      if (e instanceof TurboApiError && (e.status === 409 || e.status === 404)) dropLote(groupId);
      else setError(`No se pudo avisar que pasás. ${errorMessage(e, "Probá de nuevo.")}`);
    } finally { setBusy(null); }
  };

  // Recorrido ofrecido: aceptar o rechazar con POST /v2/offers/:routeId/…
  // Sin respuesta no se sabe si quedó: no se reintenta solo, la tarjeta queda
  // y el próximo sondeo dice cómo está.
  const dropRouteOffer = (routeId: number) => setRouteOffers((prev) => prev.filter((o) => o.route_id !== routeId));
  const onRouteOffer = async (o: OfferedRoute, accept: boolean) => {
    if (busy !== null || pendingRef.current) return;
    setBusy(o.route_id); setNotice(null); setError(null);
    try {
      await (accept ? acceptRouteOffer : declineRouteOffer)(o.route_id);
      dropRouteOffer(o.route_id);
      if (accept) {
        invalidateDriverWork();
        void refreshTrackingPolicy();
        navigation.navigate("RouteDetailScreen", { routeId: o.route_id });
      }
    } catch (e: any) {
      if (isDefinitive(e)) { dropRouteOffer(o.route_id); setNotice(errorMessage(e, "Este recorrido ya no está disponible.")); }
      else setError(accept ? "No pudimos confirmar el recorrido. Si quedó a tu nombre, aparece en Envíos." : `No se pudo enviar la respuesta. ${errorMessage(e, "Probá de nuevo.")}`);
    } finally { setBusy(null); }
  };

  // La tarjeta del Acepto en curso se ve aunque el sondeo ya no la traiga
  // (si el servidor la asignó, deja de venir como oferta).
  const shown = pending && !offers.some((o) => o.route_id === pending.offer.route_id) ? [pending.offer, ...offers] : offers;

  return (
        <View style={styles.page}>
          <Text style={styles.meta}>
            {turboEnabled === false ? "Recorridos ofrecidos" : "Turbos y recorridos ofrecidos"}. Si no contestás a tiempo, pasan a otro chofer.
          </Text>
          {turboEnabled === false ? null : (
            <Pressable onPress={() => navigation.navigate("TurboTomorrowScreen")} style={[styles.btn, styles.btnNo, styles.tomorrow]} accessibilityRole="button">
              <Text style={styles.btnGhostText}>Turbos de mañana</Text>
            </Pressable>
          )}

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
          {notice ? <View style={styles.noticeBox}><Text style={styles.noticeText}>{notice}</Text></View> : null}

          <FlatList
            data={buildInbox(shown, routeOffers)}
            keyExtractor={(c) => c.key}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} tintColor={theme.text.accent} />}
            ListEmptyComponent={loading ? <ActivityIndicator color={theme.text.accent} style={{ marginTop: 40 }} /> : (
              <View style={styles.empty}><Ionicons name="flash-outline" size={36} color={theme.text.muted} /><Text style={styles.emptyText}>No tenés ofertas ahora.</Text></View>
            )}
            renderItem={({ item: card }) => {
              if (card.kind === "recorrido") {
                const o = card.offer;
                const left = secondsLeft(o, now);
                const urgent = left <= 15;
                const disabled = busy !== null || pending !== null || left === 0;
                const addresses = (o.first_addresses ?? []).filter(Boolean);
                return (
                  <View style={[theme.card, styles.card, urgent && styles.cardUrgent]}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardType}>{routeOfferTitle(o)}</Text>
                      <View style={[styles.badge, urgent && styles.badgeUrgent]}>
                        <Ionicons name="time-outline" size={14} color={urgent ? theme.status.rejected.icon : theme.text.primary} />
                        <Text style={[styles.badgeText, urgent && styles.badgeTextUrgent]}>{plazoParaResponder(left)}</Text>
                      </View>
                    </View>
                    <Text style={styles.label}>Recorrido de reparto ofrecido por coordinación</Text>
                    {addresses.length ? <Text style={styles.line} numberOfLines={2}>{addresses.join(" · ")}</Text> : null}
                    <Text style={styles.cardMeta}>{o.scheduled_date ? `Para el ${o.scheduled_date.slice(8, 10)}/${o.scheduled_date.slice(5, 7)} · ` : ""}vence {hhmm(o.expires_at)}</Text>
                    <View style={styles.row}>
                      <Pressable onPress={() => onRouteOffer(o, true)} disabled={disabled} style={[styles.btn, styles.btnYes, disabled && styles.btnDisabled]}>
                        {busy === o.route_id ? <ActivityIndicator color={theme.text.onPrimary} /> : <Text style={styles.btnText}>Aceptar</Text>}
                      </Pressable>
                      <Pressable onPress={() => onRouteOffer(o, false)} disabled={disabled} style={[styles.btn, styles.btnNo, disabled && styles.btnDisabled]}>
                        <Text style={styles.btnGhostText}>Rechazar</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }
              if (card.kind === "lote") {
                const first = card.offers[0];
                const left = secondsLeft(first, now);
                const disabled = busy !== null || pending !== null || left === 0;
                const ultima = card.offers.reduce((a, o) => (o.deadline_at && (!a || o.deadline_at > a) ? o.deadline_at : a), null as string | null);
                return (
                  <View style={[theme.card, styles.card, left <= 15 && styles.cardUrgent]}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardType}>Lote de {card.offers.length} Turbos</Text>
                      <View style={[styles.badge, left <= 15 && styles.badgeUrgent]}>
                        <Ionicons name="time-outline" size={14} color={left <= 15 ? theme.status.rejected.icon : theme.text.primary} />
                        <Text style={[styles.badgeText, left <= 15 && styles.badgeTextUrgent]}>{plazoParaResponder(left)}</Text>
                      </View>
                    </View>
                    <Text style={styles.line}><Text style={styles.label}>Retiro · </Text>{first.store_name ?? "tienda"}{first.store_address ? ` · ${first.store_address}` : ""} · un solo retiro</Text>
                    {card.offers.map((o) => (
                      <Text key={o.route_id} style={styles.line}><Text style={styles.label}>Entrega · </Text>{o.receiver_name ?? "comprador"}{o.delivery_address ? ` · ${o.delivery_address}` : ""}{o.deadline_at ? ` · antes de las ${hhmm(o.deadline_at)}` : ""}</Text>
                    ))}
                    <Text style={styles.cardMeta}>
                      {km(first.distance_km) ? `Tienda a ${km(first.distance_km)} de vos · ` : ""}Se acepta entero{ultima ? `: la última, antes de las ${hhmm(ultima)}` : ""}.
                    </Text>
                    <View style={styles.row}>
                      <Pressable onPress={() => onAcceptLote(card.group_id)} disabled={disabled} style={[styles.btn, styles.btnYes, disabled && styles.btnDisabled]}>
                        {busy === -card.group_id ? <ActivityIndicator color={theme.text.onPrimary} /> : <Text style={styles.btnText}>Acepto el lote</Text>}
                      </Pressable>
                      <Pressable onPress={() => onDeclineLote(card.group_id)} disabled={disabled} style={[styles.btn, styles.btnNo, disabled && styles.btnDisabled]}>
                        <Text style={styles.btnGhostText}>Paso</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }
              const item = card.offer;
              const left = secondsLeft(item, now);
              const urgent = left <= 15;
              const mine = pending?.offer.route_id === item.route_id ? pending : null;
              const disabled = busy !== null || pending !== null || left === 0;
              const promise = turboPromiseLabel(item, todayIso());
              return (
                <View style={[theme.card, styles.card, styles.turboCard, urgent && styles.cardUrgent]}>
                  <View style={styles.cardTop}>
                    <View style={styles.turboHeading}>
                      <Ionicons name="flash" size={19} color={theme.status.pending.text} />
                      <Text style={styles.cardType}>Turbo</Text>
                    </View>
                    <View style={[styles.badge, urgent && styles.badgeUrgent]}>
                      <Ionicons name="time-outline" size={14} color={urgent ? theme.status.rejected.icon : theme.text.primary} />
                      <Text style={[styles.badgeText, urgent && styles.badgeTextUrgent]}>{plazoParaResponder(left)}</Text>
                    </View>
                  </View>
                  {promise ? <Text style={styles.turboPromise} numberOfLines={2}>{promise}</Text> : null}
                  <Text style={styles.turboLine} numberOfLines={1}><Text style={styles.label}>Retiro · </Text>{item.store_name ?? "tienda"}{item.store_address ? ` · ${item.store_address}` : ""}</Text>
                  <Text style={styles.turboLine} numberOfLines={1}><Text style={styles.label}>Entrega · </Text>{item.receiver_name ?? "comprador"}{item.delivery_address ? ` · ${item.delivery_address}` : ""}{item.delivery_postal_code ? ` · CP ${item.delivery_postal_code}` : ""}</Text>
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
            contentContainerStyle={{ paddingBottom: bottomSpace + 24 }}
          />
        </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  page: { flex: 1, paddingHorizontal: t.layout.screenPadding },
  meta: { color: t.text.secondary, fontSize: 13, marginBottom: t.spacing.sm },
  // Superficie del tema; el contorno queda en los tres estilos (también en
  // Minimal): es una oferta que pide respuesta, y en rojo cuando está por vencer.
  card: { borderWidth: 1, borderColor: t.colors.primary, padding: t.spacing.md, marginBottom: t.spacing.sm, gap: 6 },
  cardUrgent: { borderColor: t.status.rejected.text },
  turboCard: { paddingVertical: 11, paddingHorizontal: 12, gap: 4 },
  turboHeading: { flexDirection: "row", alignItems: "center", gap: 5 },
  turboPromise: { color: t.status.pending.text, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  turboLine: { color: t.text.primary, fontSize: 13, lineHeight: 19 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardType: { color: t.text.primary, fontSize: 16, fontWeight: "700" },
  line: { color: t.text.primary, fontSize: 14 },
  label: { color: t.text.secondary, fontWeight: "600" },
  cardMeta: { color: t.text.secondary, fontSize: 13 },
  programado: { color: t.status.pending.text, fontSize: 15, fontWeight: "700" },
  warnBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderWidth: 1, borderColor: t.status.pending.border, backgroundColor: t.status.pending.background, borderRadius: t.radius.md, padding: 10 },
  warnText: { flex: 1, color: t.text.primary, fontSize: 13 },
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
  tomorrow: { flex: 0, minHeight: 40, marginBottom: t.spacing.md },
  empty: { alignItems: "center", gap: 10, marginTop: 40 },
  emptyText: { color: t.text.secondary, textAlign: "center" },
  errorBox: { borderWidth: 1, borderColor: t.status.rejected.border, backgroundColor: t.status.rejected.background, borderRadius: t.radius.md, padding: 12, marginBottom: 12 },
  errorText: { color: t.text.primary },
  noticeBox: { borderWidth: 1, borderColor: t.status.inTransit.border, backgroundColor: t.status.inTransit.background, borderRadius: t.radius.md, padding: 12, marginBottom: 12 },
  noticeText: { color: t.text.primary },
});
