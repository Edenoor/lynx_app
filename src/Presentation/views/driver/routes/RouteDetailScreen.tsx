// src/Presentation/views/driver/routes/RouteDetailScreen.tsx
// Un recorrido del chofer: confirmar la carga (reparto), salir, llegar a
// cada parada, registrar qué pasó con cada envío, cerrar la parada y
// completar el recorrido. Sin mapa en esta etapa.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, ImageBackground, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../../theme/AppTheme";
import type { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import {
  completeRoute, confirmLoad, declareStopCount, fetchPendingAtStore, fetchRoute, OPS_LABEL, PendingDelivery, recordOutcome, respondConfirmation, RouteDetail, startRoute, todayIso,
  STATUS_LABEL, Stop, STOP_STATUS_LABEL, stopAction, TYPE_LABEL,
} from "./routesApi";
import { fetchDispatch, hhmm } from "../turbo/turboApi";
import OutcomeForm from "./OutcomeForm";
import { buildDeclaration, cobranzaOf, OutcomeDraft } from "./outcomeDeclaration";
import { errorMessage } from "../errorMessage";
import { canStartRoute, PICKUP_ANSWER_LABEL, pickupAnswer, startsLater } from "./pickupConfirmation";
import { capitalize, COLLECTION_STATUS_LABEL, collectionName, directionsUrl, executionDayLabel } from "./collectionLabels";
import { LYNX_COLLECT_ENABLED, showCollectInLightData } from "../collectionMode";
import DeclaredCountForm from "./DeclaredCountForm";
import { declarationLabel, declarationSummary, placeStatLabel, supportsDeclaration } from "./stopDeclaration";

type Props = NativeStackScreenProps<DriverStackParamList, "RouteDetailScreen">;

// Las horas de llegada, salida, «tienda lista» y entrega (arrived_at,
// started_at, store_ready_at, outcome_at) se guardan sin zona horaria y en una
// prueba se vieron corridas: no se muestran hasta que el servidor lo corrija.
// Los registros no se tocan. El corte (cutoff_snapshot) es una hora fija y sí.

export default function RouteDetailScreen({ navigation, route: nav }: Props) {
  const { routeId, name } = nav.params;
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState("");
  const [openStop, setOpenStop] = useState<number | null>(null);
  // Solo en un Turbo: hasta qué hora hay que entregar (regla de Mercado Libre).
  const [deadline, setDeadline] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const r = await fetchRoute(routeId); setRoute(r); setError(null); }
    catch (e: any) { setError(errorMessage(e, "No se pudo cargar el recorrido")); }
  }, [routeId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (route?.type !== "TURBO") return;
    fetchDispatch(routeId).then((d) => setDeadline(d?.deadline_at ?? null)).catch(() => setDeadline(null));
  }, [route?.type, routeId]);

  // Ejecuta una acción, recarga y muestra el error del servidor si lo hay
  // (arriba de todo, o donde diga `onError`). Si la acción falla no se recarga.
  const act = async (fn: () => Promise<unknown>, onError?: (message: string) => void) => {
    setBusy(true); setError(null);
    try { await fn(); await load(); } catch (e: any) { (onError ?? setError)(errorMessage(e, "No se pudo completar la acción")); } finally { setBusy(false); }
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
  const isPickup = route.type === "PICKUP";
  const canConfirm = isDelivery && route.status === "ASSIGNED";
  // Una colecta asignada sale recién cuando el chofer la acepta (el servidor
  // la rechaza sin aceptar): mientras tanto se muestra para contestar.
  const answer = pickupAnswer(route);
  const canStart = canStartRoute(route);
  // La colecta de mañana se ve hoy (para confirmarla), pero se comienza ese día.
  const today = todayIso();
  const later = startsLater(route, today);
  const day = executionDayLabel(route.scheduled_date, today);
  const inProgress = route.status === "IN_PROGRESS";
  const allClosed = route.stops.every((s) => s.status === "DONE" || s.status === "SKIPPED");
  const declared = isPickup ? declarationSummary(route.stops) : null;
  // La parada que devuelve la declaración se muestra ya, aunque falle la recarga.
  const replaceStop = (stop: Stop) => setRoute((r) => (r ? { ...r, stops: r.stops.map((s) => (s.id === stop.id ? stop : s)) } : r));

  return (
    <ImageBackground source={require("../../../../../assets/background-1.png")} style={styles.background} imageStyle={styles.backgroundImage}>
      <SafeAreaView style={styles.safeArea}>
        {/* «handled»: con el teclado abierto, el primer toque en «Confirmar» confirma (no solo cierra el teclado). */}
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.back}><Ionicons name="arrow-back" size={22} color={AppTheme.text.primary} /></Pressable>
            {isPickup ? (
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Colecta {route.template_id ? "habitual" : "extraordinaria"} · #{route.id}</Text>
                <Text style={styles.title}>{name || collectionName(route)}</Text>
                <Text style={styles.meta}>{capitalize(day)} · {COLLECTION_STATUS_LABEL[route.status] ?? route.status}</Text>
                <Text style={styles.meta}>
                  {route.stops.length} {route.stops.length === 1 ? "parada" : "paradas"}{route.departure_time ? ` · sale ${route.departure_time.slice(0, 5)}` : ""}
                </Text>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>{TYPE_LABEL[route.type]} #{route.id}</Text>
                <Text style={styles.title}>{STATUS_LABEL[route.status]}</Text>
                <Text style={styles.meta}>{route.stops.length} paradas · {route.deliveries_count} envíos</Text>
                {route.type === "TURBO" && deadline ? <Text style={styles.deadline}>Entregar antes de las {hhmm(deadline)}</Text> : null}
              </View>
            )}
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

          {answer ? (
            <View style={[styles.panel, answer === "DECLINED" && styles.panelDanger]}>
              <Text style={styles.panelTitle}>Confirmación · {PICKUP_ANSWER_LABEL[answer]}</Text>
              <Text style={styles.panelText}>
                {answer === "ACCEPTED"
                  ? later ? "La aceptaste. Se comienza el día de la colecta." : "La aceptaste. Cuando estés listo, comenzá la colecta."
                  : answer === "DECLINED"
                  ? "Dijiste que no podés hacerla: el coordinador ya fue avisado. Si cambiaste de idea, aceptala."
                  : "Confirmá si podés hacer esta colecta. Sin aceptarla no se puede comenzar."}
              </Text>
              {answer === "PENDING" && route.confirmation_state === "OVERDUE" ? <Text style={styles.warn}>Venció el plazo para confirmar.</Text> : null}
              {answer !== "ACCEPTED" ? (
                <View style={styles.row}>
                  <Pressable onPress={() => act(() => respondConfirmation(routeId, "ACCEPTED"))} disabled={busy} style={[styles.btn, busy && styles.btnDisabled]}>
                    <Text style={styles.btnText}>Aceptar colecta</Text>
                  </Pressable>
                  {answer === "PENDING" ? (
                    <Pressable onPress={() => act(() => respondConfirmation(routeId, "DECLINED"))} disabled={busy} style={[styles.btn, styles.btnGhost, busy && styles.btnDisabled]}>
                      <Text style={styles.btnGhostText}>No puedo</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {answer && answer !== "ACCEPTED" ? (
            <View style={[styles.btn, styles.btnBig, styles.btnDisabled]}>
              <Ionicons name="lock-closed" size={18} color={AppTheme.text.inverse} />
              <Text style={styles.btnText}>Aceptá la colecta para comenzarla</Text>
            </View>
          ) : canStart && later ? (
            <View style={[styles.btn, styles.btnBig, styles.btnDisabled]}>
              <Ionicons name="lock-closed" size={18} color={AppTheme.text.inverse} />
              <Text style={styles.btnText}>Se comienza {day}</Text>
            </View>
          ) : canStart ? (
            <Pressable onPress={onStart} disabled={busy} style={[styles.btn, styles.btnBig, busy && styles.btnDisabled]}>
              <Ionicons name="play" size={18} color={AppTheme.text.inverse} />
              <Text style={styles.btnText}>{isPickup ? "Comenzar colecta" : "Salir a la calle"}</Text>
            </Pressable>
          ) : null}

          {declared && declared.stops ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Paquetes retirados</Text>
              <View style={styles.stats}>
                <Stat value={declared.total} label="informados" />
                <Stat value={declared.informed} label={placeStatLabel(declared.informed, declared.allStores, "informed")} />
                <Stat value={declared.pending} label={placeStatLabel(declared.pending, declared.allStores, "pending")} warn={declared.pending > 0} />
              </View>
            </View>
          ) : null}

          {route.stops.map((s) => (
            <StopCard key={s.id} routeId={route.id} stop={s} routeType={route.type} routeStatus={route.status} inProgress={inProgress} busy={busy}
              open={openStop === s.id} onToggle={() => setOpenStop(openStop === s.id ? null : s.id)} act={act} onStopSaved={replaceStop} />
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

function Stat({ value, label, warn }: { value: number; label: string; warn?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, warn && styles.statWarn]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StopCard({ routeId, stop, routeType, routeStatus, inProgress, busy, open, onToggle, act, onStopSaved }: {
  routeId: number; stop: Stop; routeType: RouteDetail["type"]; routeStatus: RouteDetail["status"]; inProgress: boolean; busy: boolean; open: boolean; onToggle: () => void;
  act: (fn: () => Promise<unknown>, onError?: (message: string) => void) => Promise<void>; onStopSaved: (stop: Stop) => void;
}) {
  const [pending, setPending] = useState<PendingDelivery[] | null>(null);
  const [notes, setNotes] = useState("");
  const isPickup = stop.type === "PICKUP";
  const closed = stop.status === "DONE" || stop.status === "SKIPPED";
  // Marcar envíos como colectados: en una colecta (PICKUP) eso se hace en
  // LightData durante este MVP; el retiro de un Turbo se sigue marcando acá.
  const collectsHere = isPickup && (routeType !== "PICKUP" || LYNX_COLLECT_ENABLED);
  const directions = isPickup
    ? directionsUrl({ latitude: stop.latitude_snapshot, longitude: stop.longitude_snapshot, address: stop.store_address })
    : null;

  useEffect(() => {
    if (open && collectsHere && stop.status === "ARRIVED") {
      fetchPendingAtStore(routeId, stop.id).then(setPending).catch(() => setPending([]));
    }
  }, [open, collectsHere, stop.status, stop.id, routeId, stop.collected_count]);

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
    // El error (un 400 de la declaración, o sin red) se muestra solo en el cierre: no arriba de todo, ni se recarga.
    act(async () => {
      await recordOutcome(routeId, stop.id, closing.deliveryId, closing.outcome, notes || undefined, built.declaration);
      setClosing(null);
    }, setCloseError);
  };
  // Cantidad retirada (solo colectas). La ref frena el segundo toque antes de
  // que `busy` llegue a deshabilitar el botón.
  const declares = routeType === "PICKUP" && supportsDeclaration(stop);
  const declaring = useRef(false);
  const [declareError, setDeclareError] = useState<string | null>(null);
  const declare = (count: number) => {
    const send = () => {
      if (declaring.current) return;
      declaring.current = true;
      setDeclareError(null);
      act(async () => onStopSaved(await declareStopCount(routeId, stop.id, count)), setDeclareError).finally(() => { declaring.current = false; });
    };
    if (stop.declared_count === null || stop.declared_count === undefined) { send(); return; }
    Alert.alert("Corregir cantidad", `Ya informaste ${stop.declared_count}. ¿Reemplazarlo por ${count}?`, [
      { text: "No", style: "cancel" },
      { text: "Sí, corregir", onPress: send },
    ]);
  };
  // Los Flex se cierran desde Envíos Flex: no cuentan como «sin resultado».
  const withoutOutcome = stop.deliveries.filter((d) => !d.outcome && d.tipo_envio !== "flex");
  const collectedIds = new Set(stop.deliveries.map((d) => d.delivery_id));

  return (
    <View style={[styles.stop, closed && styles.stopClosed]}>
      <Pressable onPress={onToggle} style={styles.stopHead}>
        <View style={styles.seq}><Text style={styles.seqText}>{stop.sequence}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stopTitle}>{isPickup ? `Retiro · ${stop.store_name ?? stop.warehouse_name ?? `tienda ${stop.store_id}`}` : `Entrega · ${stop.receiver_name ?? stop.address ?? "destino"}`}</Text>
          <Text style={styles.stopMeta}>
            {isPickup ? (stop.store_address ?? "") : `${stop.address ?? ""}${stop.postal_code ? ` · CP ${stop.postal_code}` : ""}`}
          </Text>
          {isPickup && stop.pickup_time_snapshot ? (
            <View style={styles.cutoffRow}>
              <Ionicons name="time-outline" size={14} color={AppTheme.text.accent} />
              <Text style={styles.cutoffText}>Retiro: {stop.pickup_time_snapshot.slice(0, 5)}</Text>
            </View>
          ) : null}
          {isPickup && stop.cutoff_snapshot ? (
            <View style={styles.cutoffRow}>
              <Ionicons name="time-outline" size={14} color={AppTheme.text.accent} />
              <Text style={styles.cutoffText}>Corte de la tienda: {stop.cutoff_snapshot.slice(0, 5)}</Text>
            </View>
          ) : null}
          <Text style={styles.stopMeta}>
            {STOP_STATUS_LABEL[stop.status]}
            {isPickup ? (stop.collected_count ? ` · ${stop.collected_count} colectados en Lynx` : "") : ` · ${stop.deliveries.length} envíos`}
            {declares ? ` · ${declarationLabel(stop.declared_count)}` : ""}
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
                <Text style={styles.stopMeta}>{OPS_LABEL[d.ops_status] ?? d.ops_status}{d.outcome ? ` · ${d.outcome === "DELIVERED" ? "entregado" : "no entregado"}` : ""}</Text>
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
              {inProgress && (stop.status === "ARRIVED" || stop.status === "PENDING") && !d.outcome && closing?.deliveryId === d.delivery_id ? (
                <OutcomeForm key={closing.outcome} outcome={closing.outcome} cobranza={cobranzaOf(d.importe_cobranza)} busy={busy} error={closeError}
                  onConfirm={confirmClose} onCancel={() => setClosing(null)} />
              ) : null}
            </View>
          ))}

          {directions ? (
            <Pressable onPress={() => Linking.openURL(directions).catch(() => Alert.alert("Cómo llegar", "No se pudo abrir Google Maps."))} style={[styles.btnSmall, styles.btnGhost, styles.rowBtn]}>
              <Ionicons name="navigate-outline" size={16} color={AppTheme.text.primary} />
              <Text style={styles.btnGhostText}>Cómo llegar</Text>
            </Pressable>
          ) : null}

          {declares ? (
            <DeclaredCountForm key={String(stop.declared_count)} count={stop.declared_count ?? null} routeStatus={routeStatus}
              busy={busy} error={declareError} onSubmit={declare} />
          ) : null}

          {isPickup && !collectsHere && stop.status === "ARRIVED" ? (
            <>
              <Pressable onPress={showCollectInLightData} style={[styles.btnSmall, styles.rowBtn]}>
                <Ionicons name="qr-code-outline" size={16} color={AppTheme.text.inverse} />
                <Text style={styles.btnText}>Escanear paquetes</Text>
              </Pressable>
              {stop.deliveries.length ? <Text style={styles.stopMeta}>Colectados en Lynx en esta parada: {stop.deliveries.map((d) => String(d.tracking ?? d.delivery_id)).join(", ")}</Text> : null}
              {!stop.store_ready_at ? (
                <Pressable onPress={() => act(() => stopAction(routeId, stop.id, "store-ready"))} disabled={busy} style={[styles.btnSmall, styles.btnGhost, busy && styles.btnDisabled]}>
                  <Text style={styles.btnGhostText}>La tienda tenía todo listo</Text>
                </Pressable>
              ) : <Text style={styles.stopMeta}>La tienda tenía todo listo.</Text>}
            </>
          ) : null}

          {collectsHere && stop.status === "ARRIVED" ? (
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
              ) : <Text style={styles.stopMeta}>La tienda tenía todo listo.</Text>}
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
  panelDanger: { borderColor: AppTheme.colors.danger },
  row: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  input: { flex: 1, minWidth: 120, minHeight: 44, borderRadius: AppTheme.radius.md, borderWidth: 1, borderColor: AppTheme.borders.default, backgroundColor: AppTheme.surfaces.input, color: AppTheme.text.primary, paddingHorizontal: 12 },
  btn: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: AppTheme.colors.primary, borderRadius: AppTheme.radius.md, paddingHorizontal: 16, minHeight: 44 },
  btnBig: { minHeight: 52, marginVertical: 4 },
  btnSmall: { backgroundColor: AppTheme.colors.primary, borderRadius: AppTheme.radius.md, paddingHorizontal: 12, minHeight: 38, justifyContent: "center" },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: AppTheme.borders.default },
  rowBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6 },
  cutoffRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  cutoffText: { color: AppTheme.text.accent, fontSize: 12, fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: AppTheme.text.inverse, fontWeight: "700" },
  btnGhostText: { color: AppTheme.text.primary, fontWeight: "600" },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: AppTheme.radius.md, backgroundColor: AppTheme.surfaces.muted },
  statValue: { color: AppTheme.text.primary, fontSize: 20, fontWeight: "700" },
  statWarn: { color: AppTheme.colors.warning },
  statLabel: { color: AppTheme.text.secondary, fontSize: 11, textAlign: "center" },
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
