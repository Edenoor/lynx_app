// src/Presentation/views/driver/turbo/TurboGroupScreen.tsx
// Un grupo Turbo: los Turbos de una misma tienda que lleva el chofer, con un
// solo retiro. Comenzar sale con todos; en la tienda, «Llegué», «Colecté» en
// cada paquete y «Cerrar retiro» una vez. Las entregas van en el orden del
// plan, con su hora límite y la hora estimada; cada una se abre en su
// recorrido (RouteDetailScreen) para cerrarla.

import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ImageBackground, Linking, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import ThemedCard from "../../../components/ThemedCard";
import type { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import { OPS_LABEL, todayIso } from "../routes/routesApi";
import { capitalize, directionsUrl, executionDayLabel } from "../routes/collectionLabels";
import { errorMessage } from "../errorMessage";
import { refreshTrackingPolicy } from "../../../config/DriverLocation";
import { collectInGroup, completeGroup, fetchGroup, fetchMyGroups, groupStoreAction, hhmm, moveTurbo, startGroup, TurboGroup } from "./turboApi";
import { NO_RETIRAR_ANTES } from "./turboOffer";
import { canMove, deliveries, deliveryClosed, deliveryTime, groupActions, groupTitle, moveTargets, STORE_STATE_LABEL, storeTitle, storeTurbos } from "./turboGroup";
import { turboPickupError } from "../routes/turboPickup";

type Props = NativeStackScreenProps<DriverStackParamList, "TurboGroupScreen">;

export default function TurboGroupScreen({ navigation, route: nav }: Props) {
  const { groupId } = nav.params;
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [group, setGroup] = useState<TurboGroup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mover un Turbo: cuál, y a qué grupos del chofer se puede.
  const [moving, setMoving] = useState<{ routeId: number; groups: TurboGroup[] } | null>(null);

  const load = useCallback(async () => {
    try { setGroup(await fetchGroup(groupId)); setError(null); }
    catch (e: any) { setError(errorMessage(e, "No se pudo cargar el grupo")); }
  }, [groupId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => navigation.addListener("focus", load), [navigation, load]);

  // Cada acción devuelve el grupo como quedó; si falla, se muestra el porqué y se recarga.
  const act = async (fn: () => Promise<TurboGroup | void>) => {
    setBusy(true); setError(null);
    try { const g = await fn(); if (g) setGroup(g); else await load(); }
    catch (e: any) { setError(errorMessage(e, "No se pudo completar la acción")); await load(); }
    finally { setBusy(false); }
  };

  if (!group) {
    return (
      <View style={[styles.background, styles.center]}>
        <ThemedStatusBar />
        {error ? <Text style={styles.errorText}>{error}</Text> : <ActivityIndicator color={theme.text.accent} />}
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 16 }}><Text style={styles.link}>Volver</Text></Pressable>
      </View>
    );
  }

  const today = todayIso();
  const a = groupActions(group, today);
  const day = executionDayLabel(group.scheduled_date, today);

  const onStart = () => act(async () => {
    const r = await startGroup(group.id);
    void refreshTrackingPolicy();
    if (r.warnings?.length) Alert.alert("Revisá en Envíos Flex", r.warnings.map((w) => w.message).join("\n"));
    return r.group;
  });
  const openMove = async (routeId: number) => {
    setError(null);
    try { setMoving({ routeId, groups: (await fetchMyGroups(group.scheduled_date)).groups }); }
    catch (e: any) { setError(errorMessage(e, "No se pudieron cargar tus grupos")); }
  };
  const doMove = (routeId: number, toGroupId: number | null) => act(async () => {
    const r = await moveTurbo(group.id, routeId, toGroupId);
    setMoving(null);
    if (r.late.length) Alert.alert("Ojo con las horas", `Con este cambio, ${r.late.length === 1 ? "una entrega llegaría" : `${r.late.length} entregas llegarían`} después de su hora límite.`);
    // Si el grupo quedó vacío, se sigue en el otro.
    if (!r.from.turbos.some((t) => t.route_status !== "CANCELLED")) { navigation.replace("TurboGroupScreen", { groupId: r.to.id }); return; }
    return r.from;
  });

  const onComplete = () =>
    Alert.alert("Terminar", "¿Entregaste todo lo de este grupo?", [
      { text: "No", style: "cancel" },
      {
        text: "Sí, terminar", onPress: () => act(async () => {
          const r = await completeGroup(group.id);
          if (r.pending.length) Alert.alert("Quedan abiertos", `${r.pending.length === 1 ? "Un Turbo tiene" : `${r.pending.length} Turbos tienen`} paradas sin cerrar.`);
          return r.group;
        }),
      },
    ]);

  return (
    <ImageBackground source={require("../../../../../assets/background-1.png")} style={styles.background} imageStyle={styles.backgroundImage}>
      <ThemedStatusBar />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={theme.text.accent} />}>
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.back}><Ionicons name="arrow-back" size={22} color={theme.text.primary} /></Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Turbo · grupo #{group.id}</Text>
              <Text style={styles.title}>{groupTitle(group)}</Text>
              <Text style={styles.meta}>
                {capitalize(day)} · {group.status === "IN_PROGRESS" ? "En curso" : group.status === "DONE" ? "Terminado" : "Asignado"}
                {group.estimated ? " · horas estimadas sin calles" : ""}
              </Text>
            </View>
          </View>

          {a.later ? (
            <View style={styles.warnBox}>
              <Ionicons name="alert-circle-outline" size={18} color={theme.status.pending.text} />
              <Text style={styles.warnText}>{NO_RETIRAR_ANTES}</Text>
            </View>
          ) : null}

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

          {a.later && group.status === "ASSIGNED" ? (
            <View style={[styles.btn, styles.btnBig, styles.btnDisabled]}>
              <Ionicons name="lock-closed" size={18} color={theme.text.onPrimary} />
              <Text style={styles.btnText}>Se comienza {day}</Text>
            </View>
          ) : a.canStart ? (
            <Pressable onPress={onStart} disabled={busy} style={[styles.btn, styles.btnBig, busy && styles.btnDisabled]}>
              <Ionicons name="play" size={18} color={theme.text.onPrimary} />
              <Text style={styles.btnText}>Salir a la calle</Text>
            </Pressable>
          ) : null}

          <Text style={styles.section}>Retiro</Text>
          {group.stores.filter((s) => s.turbos > 0).map((s) => {
            const items = storeTurbos(group, s.store_id);
            const directions = directionsUrl({ latitude: s.latitude, longitude: s.longitude, address: s.store_address });
            return (
              <ThemedCard key={s.store_id} variant="row" style={[styles.card, s.pickup_status === "DONE" && styles.cardClosed]}>
                <Text style={styles.cardTitle}>{storeTitle(s)}</Text>
                {s.store_address ? <Text style={styles.meta}>{s.store_address}</Text> : null}
                <Text style={styles.meta}>
                  {STORE_STATE_LABEL[s.pickup_status]} · {s.collected} de {s.turbos} retirados
                  {s.eta && s.pickup_status === "PENDING" ? ` · llegás ~${hhmm(s.eta)}` : ""}
                </Text>
                {directions ? (
                  <Pressable onPress={() => Linking.openURL(directions).catch(() => Alert.alert("Cómo llegar", "No se pudo abrir Google Maps."))} style={[styles.btnSmall, styles.btnGhost, styles.rowBtn]}>
                    <Ionicons name="navigate-outline" size={16} color={theme.text.primary} />
                    <Text style={styles.btnGhostText}>Cómo llegar</Text>
                  </Pressable>
                ) : null}
                {s.pickup_status === "ARRIVED" ? (
                  <>
                    <Text style={styles.panelText}>Marcá cada paquete cuando te lo entregan. Solo los de este grupo.</Text>
                    {items.map((t) => (
                      <View key={t.route_id} style={styles.row}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.item}>{t.nombre_destinatario ?? "—"} <Text style={styles.mono}>{String(t.tracking ?? t.delivery_id)}</Text></Text>
                          <Text style={styles.meta}>{t.collected ? "Colectado" : OPS_LABEL[t.ops_status ?? ""] ?? t.ops_status}{t.postal_code ? ` · CP ${t.postal_code}` : ""}</Text>
                        </View>
                        {!t.collected ? (
                          <Pressable onPress={() => act(async () => (await collectInGroup(group.id, t.route_id).catch((e) => { throw turboPickupError(e); })).group)} disabled={busy} style={[styles.btnSmall, busy && styles.btnDisabled]}>
                            <Text style={styles.btnText}>Colecté</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </>
                ) : null}
                {a.started && s.pickup_status === "PENDING" ? (
                  <Pressable onPress={() => act(() => groupStoreAction(group.id, s.store_id, "arrive"))} disabled={busy} style={[styles.btn, busy && styles.btnDisabled]}>
                    <Text style={styles.btnText}>Llegué a {s.store_name ?? "la tienda"}</Text>
                  </Pressable>
                ) : null}
                {s.pickup_status === "ARRIVED" ? (
                  <Pressable
                    onPress={() => {
                      const faltan = items.filter((t) => !t.collected).length;
                      const cerrar = () => act(() => groupStoreAction(group.id, s.store_id, "done"));
                      if (!faltan) { cerrar(); return; }
                      Alert.alert("Cerrar retiro", `${faltan === 1 ? "Un paquete no está marcado" : `${faltan} paquetes no están marcados`} como colectado. ¿Cerrar igual?`, [
                        { text: "No", style: "cancel" }, { text: "Cerrar", style: "destructive", onPress: cerrar },
                      ]);
                    }}
                    disabled={busy} style={[styles.btn, busy && styles.btnDisabled]}>
                    <Text style={styles.btnText}>Cerrar retiro</Text>
                  </Pressable>
                ) : null}
              </ThemedCard>
            );
          })}

          <Text style={styles.section}>Entregas, en orden</Text>
          {deliveries(group).map((t, i) => (
            <View key={t.route_id}>
            <Pressable onPress={() => navigation.navigate("RouteDetailScreen", { routeId: t.route_id, fromGroup: true })}>
              <ThemedCard variant="row" style={[styles.card, deliveryClosed(t) && styles.cardClosed]}>
                <View style={styles.row}>
                  <View style={styles.seq}><Text style={styles.seqText}>{i + 1}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{t.receiver_name ?? t.nombre_destinatario ?? "Comprador"}</Text>
                    <Text style={styles.meta}>{t.address ?? ""}{t.postal_code ? ` · CP ${t.postal_code}` : ""}</Text>
                    {deliveryTime(t, hhmm) ? (
                      <Text style={[styles.deadline, t.slack_minutes != null && t.slack_minutes < 0 && !deliveryClosed(t) && styles.late]}>{deliveryTime(t, hhmm)}</Text>
                    ) : null}
                    <Text style={styles.meta}>{deliveryClosed(t) ? "Cerrada" : OPS_LABEL[t.ops_status ?? ""] ?? t.ops_status} · Turbo #{t.route_id}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.text.muted} />
                </View>
              </ThemedCard>
            </Pressable>
            {canMove(t) && moving?.routeId !== t.route_id ? (
              <Pressable onPress={() => openMove(t.route_id)} disabled={busy} style={styles.moveLink} accessibilityRole="button">
                <Text style={styles.link}>Mover a otro grupo</Text>
              </Pressable>
            ) : null}
            {moving?.routeId === t.route_id ? (() => {
              const m = moveTargets(group, moving.groups);
              return (
                <View style={styles.movePanel}>
                  {m.groups.map((g) => (
                    <Pressable key={g.id} onPress={() => doMove(t.route_id, g.id)} disabled={busy} style={[styles.btn, styles.btnGhost, busy && styles.btnDisabled]}>
                      <Text style={styles.btnGhostText}>Al grupo #{g.id} · {groupTitle(g)}</Text>
                    </Pressable>
                  ))}
                  {m.canSplit ? (
                    <Pressable onPress={() => doMove(t.route_id, null)} disabled={busy} style={[styles.btn, styles.btnGhost, busy && styles.btnDisabled]}>
                      <Text style={styles.btnGhostText}>Separarlo en un grupo nuevo</Text>
                    </Pressable>
                  ) : null}
                  {!m.groups.length && !m.canSplit ? <Text style={styles.meta}>No tenés otro grupo para este día.</Text> : null}
                  <Pressable onPress={() => setMoving(null)} style={styles.moveLink}><Text style={styles.link}>Cancelar</Text></Pressable>
                </View>
              );
            })() : null}
            </View>
          ))}
          <Text style={styles.meta}>La entrega se cierra en Envíos Flex: Lynx se entera solo. Si no la podés entregar, abrila y marcá «No entregado».</Text>

          {a.started ? (
            <Pressable onPress={onComplete} disabled={busy || !a.canComplete} style={[styles.btn, styles.btnBig, (busy || !a.canComplete) && styles.btnDisabled]}>
              <Ionicons name="checkmark-done" size={18} color={theme.text.onPrimary} />
              <Text style={styles.btnText}>{a.canComplete ? "Terminar" : "Cerrá el retiro y las entregas para terminar"}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  background: { flex: 1, backgroundColor: t.colors.background },
  backgroundImage: { opacity: t.backdrop.imageOpacity },
  safeArea: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  page: { paddingHorizontal: t.layout.screenPadding, paddingTop: t.spacing.lg, paddingBottom: 40, gap: t.spacing.sm },
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: t.spacing.md, paddingTop: t.spacing.lg },
  back: { padding: 6, marginTop: 2 },
  eyebrow: { ...t.typography.kicker },
  title: { color: t.text.primary, fontSize: 22, fontWeight: "700" },
  meta: { color: t.text.secondary, fontSize: 13, marginTop: 2 },
  section: { color: t.text.primary, fontSize: 15, fontWeight: "700", marginTop: t.spacing.md },
  deadline: { color: t.status.pending.text, fontSize: 14, fontWeight: "700", marginTop: 4 },
  late: { color: t.status.rejected.text },
  warnBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderWidth: 1, borderColor: t.status.pending.border, backgroundColor: t.status.pending.background, borderRadius: t.radius.md, padding: 12, marginBottom: 12 },
  warnText: { flex: 1, color: t.text.primary, fontSize: 14 },
  link: { color: t.text.accent },
  panelText: { color: t.text.secondary, fontSize: 13, lineHeight: 18 },
  card: { padding: t.spacing.md, gap: 8 },
  cardClosed: { opacity: 0.65 },
  cardTitle: { color: t.text.primary, fontWeight: "700", fontSize: 15 },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  item: { color: t.text.primary, fontSize: 14 },
  mono: { color: t.text.muted, fontFamily: "monospace", fontSize: 12 },
  seq: { width: 30, height: 30, borderRadius: t.radius.full, backgroundColor: t.surfaces.muted, alignItems: "center", justifyContent: "center" },
  seqText: { color: t.text.primary, fontWeight: "700" },
  btn: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.primary, borderRadius: t.radius.md, paddingHorizontal: 16, minHeight: 44 },
  btnBig: { minHeight: 52, marginVertical: 4 },
  btnSmall: { backgroundColor: t.colors.primary, borderRadius: t.radius.md, paddingHorizontal: 12, minHeight: 38, justifyContent: "center" },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: t.borders.default },
  rowBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6 },
  moveLink: { alignSelf: "flex-end", paddingVertical: 8, paddingHorizontal: 4 },
  movePanel: { gap: 8, paddingVertical: 6 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: t.text.onPrimary, fontWeight: "700" },
  btnGhostText: { color: t.text.primary, fontWeight: "600" },
  errorBox: { borderWidth: 1, borderColor: t.status.rejected.border, borderRadius: t.radius.md, padding: 12 },
  errorText: { color: t.text.primary },
});
