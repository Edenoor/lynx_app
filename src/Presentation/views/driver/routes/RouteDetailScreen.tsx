// src/Presentation/views/driver/routes/RouteDetailScreen.tsx
// Un recorrido del chofer: confirmar la carga (reparto), salir, llegar a
// cada parada, registrar qué pasó con cada envío, cerrar la parada y
// completar el recorrido. Sin mapa en esta etapa.

import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ImageBackground, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../../theme/AppTheme";
import type { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import {
  completeRoute, confirmLoad, fetchPendingAtStore, fetchRoute, OPS_LABEL, PendingDelivery, recordOutcome, RouteDetail, startRoute, todayIso,
  STATUS_LABEL, Stop, STOP_STATUS_LABEL, stopAction, TYPE_LABEL,
} from "./routesApi";
import { fetchDispatch, hhmm } from "../turbo/turboApi";
import OutcomeForm from "./OutcomeForm";
import { buildDeclaration, cobranzaOf, OutcomeDraft } from "./outcomeDeclaration";

type Props = NativeStackScreenProps<DriverStackParamList, "RouteDetailScreen">;

const time = (v: string | null | undefined) => (v ? new Date(v).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : null);

export default function RouteDetailScreen({ navigation, route: nav }: Props) {
  const { routeId } = nav.params;
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState("");
  const [openStop, setOpenStop] = useState<number | null>(null);
  // Solo en un Turbo: hasta qué hora hay que entregar (regla de Mercado Libre).
  const [deadline, setDeadline] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const r = await fetchRoute(routeId); setRoute(r); setError(null); }
    catch (e: any) { setError(e?.message ?? "No se pudo cargar el recorrido"); }
  }, [routeId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (route?.type !== "TURBO") return;
    fetchDispatch(routeId).then((d) => setDeadline(d?.deadline_at ?? null)).catch(() => setDeadline(null));
  }, [route?.type, routeId]);

  // Ejecuta una acción, recarga y muestra el error del servidor si lo hay.
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); await load(); } catch (e: any) { setError(e?.message ?? "No se pudo completar la acción"); } finally { setBusy(false); }
  };

  const onConfirmLoad = () =>
    act(async () => {
      const n = Number(count);
      if (!Number.isInteger(n) || n < 0) throw new Error("Ingresá la cantidad de bultos que recibiste");
      const r = await confirmLoad(routeId, n);
      if (!r.loaded && r.discrepancy) {
        Alert.alert(
          "La cantidad no coincide",
          `El depósito contó ${r.discrepancy.expected} y vos ${r.discrepancy.confirmed}. Resolvé la diferencia con el depósito antes de salir.`
        );
      }
    });

  const onStart = () =>
    act(async () => {
      // La ronda de mañana se ve hoy (para confirmarla), pero no se arranca hoy.
      // El servidor también lo rechaza; acá se explica antes de mandar nada.
      const fecha = route?.scheduled_date?.slice(0, 10);
      if (fecha && fecha > todayIso()) {
        throw new Error(`Este recorrido es del ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}: se inicia ese día.`);
      }
      const r = await startRoute(routeId);
      // Flex que no figura «En camino» en Mercado Libre: se avisa, no se frena.
      if (r.warnings?.length) Alert.alert("Revisá en Envíos Flex", r.warnings.map((w) => w.message).join("\n"));
    });
  const onComplete = () =>
    Alert.alert("Completar recorrido", "¿Terminaste todas las paradas?", [
      { text: "No", style: "cancel" },
      { text: "Sí, completar", onPress: () => act(() => completeRoute(routeId)) },
    ]);

  if (!route) {
    return (
      <View style={[styles.background, styles.center]}>
        {error ? <Text style={styles.errorText}>{error}</Text> : <ActivityIndicator color={AppTheme.text.accent} />}
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 16 }}><Text style={styles.link}>Volver</Text></Pressable>
      </View>
    );
  }

  const isDelivery = route.type === "DELIVERY";
  const canConfirm = isDelivery && route.status === "ASSIGNED";
  const canStart = route.status === "LOADED" || (!isDelivery && route.status === "ASSIGNED");
  const inProgress = route.status === "IN_PROGRESS";
  const allClosed = route.stops.every((s) => s.status === "DONE" || s.status === "SKIPPED");

  return (
    <ImageBackground source={require("../../../../../assets/background-1.png")} style={styles.background} imageStyle={styles.backgroundImage}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.page}>
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.back}><Ionicons name="arrow-back" size={22} color={AppTheme.text.primary} /></Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>{TYPE_LABEL[route.type]} #{route.id}</Text>
              <Text style={styles.title}>{STATUS_LABEL[route.status]}</Text>
              <Text style={styles.meta}>{route.stops.length} paradas · {route.deliveries_count} envíos{route.started_at ? ` · salida ${time(route.started_at)}` : ""}</Text>
              {route.type === "TURBO" && deadline ? <Text style={styles.deadline}>Entregar antes de las {hhmm(deadline)}</Text> : null}
            </View>
          </View>

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

          {canConfirm ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Control de carga</Text>
              <Text style={styles.panelText}>
                {route.load_expected_count === null
                  ? "El depósito todavía no cargó cuántos bultos preparó. Pedile que lo haga antes de salir."
                  : `El depósito preparó ${route.load_expected_count} bultos. Contá los que recibiste y confirmá.`}
              </Text>
              <View style={styles.row}>
                <TextInput value={count} onChangeText={setCount} keyboardType="number-pad" placeholder="Cantidad" placeholderTextColor={AppTheme.text.muted} style={styles.input} editable={!busy && route.load_expected_count !== null} />
                <Pressable onPress={onConfirmLoad} disabled={busy || route.load_expected_count === null} style={[styles.btn, (busy || route.load_expected_count === null) && styles.btnDisabled]}>
                  <Text style={styles.btnText}>Confirmar</Text>
                </Pressable>
              </View>
              {route.load_confirmed_count !== null && route.load_expected_count !== null && route.load_confirmed_count !== route.load_expected_count ? (
                <Text style={styles.warn}>Última confirmación: {route.load_confirmed_count} de {route.load_expected_count}. Con diferencia el recorrido no sale.</Text>
              ) : null}
            </View>
          ) : null}

          {canStart ? (
            <Pressable onPress={onStart} disabled={busy} style={[styles.btn, styles.btnBig, busy && styles.btnDisabled]}>
              <Ionicons name="play" size={18} color={AppTheme.text.inverse} />
              <Text style={styles.btnText}>Salir a la calle</Text>
            </Pressable>
          ) : null}

          {route.stops.map((s) => (
            <StopCard key={s.id} routeId={route.id} stop={s} routeType={route.type} inProgress={inProgress} busy={busy}
              open={openStop === s.id} onToggle={() => setOpenStop(openStop === s.id ? null : s.id)} act={act} />
          ))}

          {inProgress ? (
            <Pressable onPress={onComplete} disabled={busy || !allClosed} style={[styles.btn, styles.btnBig, (busy || !allClosed) && styles.btnDisabled]}>
              <Ionicons name="checkmark-done" size={18} color={AppTheme.text.inverse} />
              <Text style={styles.btnText}>{allClosed ? "Completar recorrido" : "Cerrá todas las paradas para completar"}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

function StopCard({ routeId, stop, routeType, inProgress, busy, open, onToggle, act }: {
  routeId: number; stop: Stop; routeType: RouteDetail["type"]; inProgress: boolean; busy: boolean; open: boolean; onToggle: () => void; act: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [pending, setPending] = useState<PendingDelivery[] | null>(null);
  const [notes, setNotes] = useState("");
  const isPickup = stop.type === "PICKUP";
  const closed = stop.status === "DONE" || stop.status === "SKIPPED";

  useEffect(() => {
    if (open && isPickup && stop.status === "ARRIVED") {
      fetchPendingAtStore(routeId, stop.id).then(setPending).catch(() => setPending([]));
    }
  }, [open, isPickup, stop.status, stop.id, routeId, stop.collected_count]);

  const outcome = (deliveryId: number, value: string) => act(() => recordOutcome(routeId, stop.id, deliveryId, value, notes || undefined));
  // Entregado / No entregado abren el cierre con la declaración del Baúl.
  const [closing, setClosing] = useState<{ deliveryId: number; outcome: "DELIVERED" | "NOT_DELIVERED" } | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const openClose = (deliveryId: number, value: "DELIVERED" | "NOT_DELIVERED") => { setCloseError(null); setClosing({ deliveryId, outcome: value }); };
  const confirmClose = (draft: OutcomeDraft) => {
    if (!closing) return;
    const built = buildDeclaration(closing.outcome, draft);
    if (!built.ok) { setCloseError(built.error); return; }
    setCloseError(null);
    act(async () => {
      // El error del servidor (p. ej. un 400 de la declaración) se muestra en el cierre, no arriba de todo.
      try { await recordOutcome(routeId, stop.id, closing.deliveryId, closing.outcome, notes || undefined, built.declaration); setClosing(null); }
      catch (e: any) { setCloseError(e?.message ?? "No se pudo registrar el resultado"); }
    });
  };
  // Los Flex se cierran desde Envíos Flex: no cuentan como «sin resultado».
  const withoutOutcome = stop.deliveries.filter((d) => !d.outcome && d.tipo_envio !== "flex");
  const collectedIds = new Set(stop.deliveries.map((d) => d.delivery_id));

  return (
    <View style={[styles.stop, closed && styles.stopClosed]}>
      <Pressable onPress={onToggle} style={styles.stopHead}>
        <View style={styles.seq}><Text style={styles.seqText}>{stop.sequence}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stopTitle}>{isPickup ? `Retiro · ${stop.store_name ?? `tienda ${stop.store_id}`}` : `Entrega · ${stop.receiver_name ?? stop.address ?? "destino"}`}</Text>
          <Text style={styles.stopMeta}>
            {isPickup ? (stop.store_address ?? "") : `${stop.address ?? ""}${stop.postal_code ? ` · CP ${stop.postal_code}` : ""}`}
          </Text>
          <Text style={styles.stopMeta}>
            {STOP_STATUS_LABEL[stop.status]}
            {stop.arrived_at ? ` · llegaste ${time(stop.arrived_at)}` : ""}
            {isPickup && stop.cutoff_snapshot ? ` · corte ${stop.cutoff_snapshot.slice(0, 5)}` : ""}
            {isPickup ? ` · ${stop.collected_count ?? 0} colectados` : ` · ${stop.deliveries.length} envíos`}
          </Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={AppTheme.text.muted} />
      </Pressable>

      {open ? (
        <View style={styles.stopBody}>
          {!isPickup && stop.deliveries.map((d) => (
            <View key={d.delivery_id} style={styles.deliveryRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.deliveryTitle}>{d.nombre_destinatario ?? "—"} <Text style={styles.mono}>{String(d.tracking ?? d.delivery_id)}</Text></Text>
                <Text style={styles.stopMeta}>{OPS_LABEL[d.ops_status] ?? d.ops_status}{d.outcome ? ` · ${d.outcome === "DELIVERED" ? "entregado" : "no entregado"} ${time(d.outcome_at) ?? ""}` : ""}</Text>
              </View>
              {inProgress && (stop.status === "ARRIVED" || stop.status === "PENDING") && !d.outcome ? (
                <View style={styles.row}>
                  {routeType === "TURBO" ? (
                    <Text style={styles.stopMeta}>Cerrá la entrega en Envíos Flex — Lynx se entera solo</Text>
                  ) : d.tipo_envio === "flex" ? (
                    <Text style={styles.stopMeta}>Entregado: se registra en Envíos Flex</Text>
                  ) : (
                    <Pressable onPress={() => openClose(d.delivery_id, "DELIVERED")} disabled={busy} style={[styles.btnSmall, busy && styles.btnDisabled]}><Text style={styles.btnText}>Entregado</Text></Pressable>
                  )}
                  <Pressable onPress={() => openClose(d.delivery_id, "NOT_DELIVERED")} disabled={busy} style={[styles.btnSmall, styles.btnGhost, busy && styles.btnDisabled]}><Text style={styles.btnGhostText}>No entregado</Text></Pressable>
                </View>
              ) : null}
              {inProgress && !d.outcome && closing?.deliveryId === d.delivery_id ? (
                <OutcomeForm key={closing.outcome} outcome={closing.outcome} cobranza={cobranzaOf(d.importe_cobranza)} busy={busy} error={closeError}
                  onConfirm={confirmClose} onCancel={() => setClosing(null)} />
              ) : null}
            </View>
          ))}

          {isPickup && stop.status === "ARRIVED" ? (
            <>
              <Text style={styles.panelText}>Envíos de la tienda pendientes de retiro. Marcá cada bulto que te entregan.</Text>
              {pending === null ? <ActivityIndicator color={AppTheme.text.accent} /> : pending.filter((p) => !collectedIds.has(p.delivery_id)).length === 0 ? (
                <Text style={styles.stopMeta}>No quedan envíos pendientes en esta tienda.</Text>
              ) : pending.filter((p) => !collectedIds.has(p.delivery_id)).map((p) => (
                <View key={p.delivery_id} style={styles.deliveryRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deliveryTitle}>{p.nombre_destinatario ?? "—"} <Text style={styles.mono}>{String(p.tracking ?? p.delivery_id)}</Text></Text>
                    <Text style={styles.stopMeta}>CP {p.codigo_postal ?? "—"}</Text>
                  </View>
                  <Pressable onPress={() => outcome(p.delivery_id, "COLLECTED")} disabled={busy} style={[styles.btnSmall, busy && styles.btnDisabled]}><Text style={styles.btnText}>Colecté</Text></Pressable>
                </View>
              ))}
              {stop.deliveries.length ? <Text style={styles.stopMeta}>Colectados en esta parada: {stop.deliveries.map((d) => String(d.tracking ?? d.delivery_id)).join(", ")}</Text> : null}
              {!stop.store_ready_at ? (
                <Pressable onPress={() => act(() => stopAction(routeId, stop.id, "store-ready"))} disabled={busy} style={[styles.btnSmall, styles.btnGhost, busy && styles.btnDisabled]}>
                  <Text style={styles.btnGhostText}>La tienda tenía todo listo</Text>
                </Pressable>
              ) : <Text style={styles.stopMeta}>Tienda lista a las {time(stop.store_ready_at)}</Text>}
            </>
          ) : null}

          {inProgress && !closed ? (
            <>
              <TextInput value={notes} onChangeText={setNotes} placeholder="Observación (opcional)" placeholderTextColor={AppTheme.text.muted} style={styles.input} />
              <View style={styles.row}>
                {stop.status === "PENDING" ? (
                  <Pressable onPress={() => act(() => stopAction(routeId, stop.id, "arrive"))} disabled={busy} style={[styles.btn, busy && styles.btnDisabled]}><Text style={styles.btnText}>Llegué</Text></Pressable>
                ) : null}
                {stop.status === "ARRIVED" || (!isPickup && stop.status === "PENDING") ? (
                  <Pressable
                    onPress={() => {
                      if (!isPickup && withoutOutcome.length) { Alert.alert("Faltan resultados", `Hay ${withoutOutcome.length} envíos sin marcar como entregados o no entregados.`); return; }
                      act(() => stopAction(routeId, stop.id, "done", notes || undefined));
                    }}
                    disabled={busy} style={[styles.btn, busy && styles.btnDisabled]}>
                    <Text style={styles.btnText}>Cerrar parada</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => Alert.alert("Saltear parada", "¿Seguro? Queda registrado que no se visitó.", [{ text: "No", style: "cancel" }, { text: "Saltear", style: "destructive", onPress: () => act(() => stopAction(routeId, stop.id, "skip", notes || "salteada")) }])}
                  disabled={busy} style={[styles.btn, styles.btnGhost, busy && styles.btnDisabled]}>
                  <Text style={styles.btnGhostText}>Saltear</Text>
                </Pressable>
              </View>
            </>
          ) : null}
          {!inProgress && !closed ? <Text style={styles.stopMeta}>Las paradas se trabajan cuando el recorrido está en curso.</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: AppTheme.colors.background },
  backgroundImage: { opacity: 0.18 },
  safeArea: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  page: { paddingHorizontal: AppTheme.layout.screenPadding, paddingTop: AppTheme.spacing.lg, paddingBottom: 40, gap: AppTheme.spacing.sm },
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: AppTheme.spacing.md, paddingTop: AppTheme.spacing.lg },
  back: { padding: 6, marginTop: 2 },
  eyebrow: { ...AppTheme.typography.kicker },
  title: { color: AppTheme.text.primary, fontSize: 22, fontWeight: "700" },
  meta: { color: AppTheme.text.secondary, fontSize: 13, marginTop: 2 },
  deadline: { color: AppTheme.colors.warning, fontSize: 14, fontWeight: "700", marginTop: 4 },
  link: { color: AppTheme.text.accent },
  panel: { backgroundColor: AppTheme.surfaces.card, borderRadius: AppTheme.radius.lg, borderWidth: 1, borderColor: AppTheme.borders.primary, padding: AppTheme.spacing.md, gap: 10 },
  panelTitle: { color: AppTheme.text.primary, fontWeight: "700", fontSize: 15 },
  panelText: { color: AppTheme.text.secondary, fontSize: 13, lineHeight: 18 },
  warn: { color: AppTheme.colors.warning, fontSize: 13 },
  row: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  input: { flex: 1, minWidth: 120, minHeight: 44, borderRadius: AppTheme.radius.md, borderWidth: 1, borderColor: AppTheme.borders.default, backgroundColor: AppTheme.surfaces.input, color: AppTheme.text.primary, paddingHorizontal: 12 },
  btn: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: AppTheme.colors.primary, borderRadius: AppTheme.radius.md, paddingHorizontal: 16, minHeight: 44 },
  btnBig: { minHeight: 52, marginVertical: 4 },
  btnSmall: { backgroundColor: AppTheme.colors.primary, borderRadius: AppTheme.radius.md, paddingHorizontal: 12, minHeight: 38, justifyContent: "center" },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: AppTheme.borders.default },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: AppTheme.text.inverse, fontWeight: "700" },
  btnGhostText: { color: AppTheme.text.primary, fontWeight: "600" },
  stop: { backgroundColor: AppTheme.surfaces.card, borderRadius: AppTheme.radius.lg, borderWidth: 1, borderColor: AppTheme.borders.default, overflow: "hidden" },
  stopClosed: { opacity: 0.65 },
  stopHead: { flexDirection: "row", gap: 12, alignItems: "center", padding: AppTheme.spacing.md },
  seq: { width: 30, height: 30, borderRadius: 15, backgroundColor: AppTheme.surfaces.muted, alignItems: "center", justifyContent: "center" },
  seqText: { color: AppTheme.text.primary, fontWeight: "700" },
  stopTitle: { color: AppTheme.text.primary, fontWeight: "700", fontSize: 15 },
  stopMeta: { color: AppTheme.text.secondary, fontSize: 12, marginTop: 2 },
  stopBody: { borderTopWidth: 1, borderTopColor: AppTheme.borders.soft, padding: AppTheme.spacing.md, gap: 10 },
  deliveryRow: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: AppTheme.borders.soft, flexWrap: "wrap" },
  deliveryTitle: { color: AppTheme.text.primary, fontSize: 14 },
  mono: { color: AppTheme.text.muted, fontFamily: "monospace", fontSize: 12 },
  errorBox: { borderWidth: 1, borderColor: AppTheme.colors.danger, borderRadius: AppTheme.radius.md, padding: 12 },
  errorText: { color: AppTheme.text.primary },
});
