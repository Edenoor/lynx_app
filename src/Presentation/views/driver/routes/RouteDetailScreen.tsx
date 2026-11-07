// src/Presentation/views/driver/routes/RouteDetailScreen.tsx
// Un recorrido del chofer: confirmar la carga (reparto), salir, llegar a
// cada parada, registrar qué pasó con cada envío, cerrar la parada y
// completar el recorrido. En un reparto, las paradas con todos sus envíos
// terminados van a «Finalizados» y los de Mercado Libre se cierran en Envíos Flex.
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, ImageBackground, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import ThemedCard from "../../../components/ThemedCard";
import { KeyboardScreen } from "../../../components/KeyboardScreen";
import { EDGES_ABOVE_BOTTOM_BAR, SafeScreen } from "../../../components/SafeScreen";
import type { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import {
  completeRoute, confirmLoad, declareStopCount, fetchPendingAtStore, fetchRoute, OPS_LABEL, PendingDelivery, recordOutcome, respondConfirmation, RouteDetail, saveStopNotes, startRoute, todayIso,
  STATUS_LABEL, Stop, STOP_STATUS_LABEL, stopAction, TYPE_LABEL,
} from "./routesApi";
import { fetchDispatch, hhmm } from "../turbo/turboApi";
import { NO_RETIRAR_ANTES, programadoLabel } from "../turbo/turboOffer";
import OutcomeForm from "./OutcomeForm";
import { buildDeclaration, cobranzaOf, OutcomeDraft, outcomeNotes, reverseRequestText } from "./outcomeDeclaration";
import { errorMessage } from "../errorMessage";
import { canStartRoute, PICKUP_ANSWER_LABEL, pickupAnswer, startsLater } from "./pickupConfirmation";
import { capitalize, COLLECTION_STATUS_LABEL, collectionName, directionsUrl, executionDayLabel } from "./collectionLabels";
import { LYNX_COLLECT_ENABLED, showCollectInLightData } from "../collectionMode";
import DeclaredCountForm from "./DeclaredCountForm";
import RouteMapModal from "../../../components/driver/RouteMapModal";
import { declarationLabel, declarationSummary, placeStatLabel, supportsDeclaration } from "./stopDeclaration";
import { turboPickupError, turboPickupItems } from "./turboPickup";
import {
  awaitingProvider, deliveryDelivered, deliveryResolved, deliveryStatusLabel, deliveryView, providerGoverned, routeCanFinish, routeProgress, splitDeliveries, splitStops, stopActions,
  stopAddress, stopFinished, stopMapsAddress, stopPackagesLabel, stopsToCloseOnFinish, stopStateLabel, stopSummary,
} from "./stopView";
import ProviderBadge from "../../../components/driver/ProviderBadge";
import { canOrganize } from "./routePlan";
import { refreshTrackingPolicy } from "../../../config/DriverLocation";
import DriverBottomNavigation, { DriverTabKey } from "../../../components/DriverBottomNavigation";
type Props = NativeStackScreenProps<DriverStackParamList, "RouteDetailScreen">;
// Mercado Libre decide el resultado de sus envíos: desde Lynx no se registra nada.
const ML_TITLE = "Entrega de Mercado Libre";
const ML_DELIVER = "Para confirmar esta entrega, tenés que finalizarla desde la aplicación Envíos Flex de Mercado Libre. Lynx actualizará automáticamente el estado cuando reciba la información.";
const ML_NOT_DELIVERED = "Registrá el resultado de esta entrega desde la aplicación Envíos Flex de Mercado Libre. Lynx actualizará el estado automáticamente cuando reciba la información.";
const mlNotice = (message: string) => Alert.alert(ML_TITLE, message, [{ text: "Entendido" }]);
// Las horas de llegada, salida, «tienda lista» y entrega (arrived_at,
// started_at, store_ready_at, outcome_at) se guardan sin zona horaria y en una
// prueba se vieron corridas: no se muestran hasta que el servidor lo corrija.
// Los registros no se tocan. El corte (cutoff_snapshot) es una hora fija y sí.
export default function RouteDetailScreen({ navigation, route: nav }: Props) {
  const { routeId, name, fromGroup } = nav.params;
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState("");
  const [openStop, setOpenStop] = useState<number | null>(null);
  // Solo en un Turbo: hasta qué hora hay que entregar (regla de Mercado Libre).
  // Y desde qué hora (el inicio de la franja de ML), para un Turbo de otro día.
  // Un solo estado: las pruebas de pantalla toman los useState por orden.
  const [turboWindow, setTurboWindow] = useState<{ deadline: string | null; start: string | null } | null>(null);
  const deadline = turboWindow?.deadline ?? null;
  const windowStart = turboWindow?.start ?? null;
  // El recorrido completo en el mapa (último estado: las pruebas toman los useState por orden).
  const [mapOpen, setMapOpen] = useState(false);
  const load = useCallback(async () => {
    try { const r = await fetchRoute(routeId); setRoute(r); setError(null); }
    catch (e: any) { setError(errorMessage(e, "No se pudo cargar el recorrido")); }
  }, [routeId]);
  useEffect(() => { load(); }, [load]);
  // Lo que Mercado Libre cierra mientras el chofer está en Envíos Flex (u otra
  // pantalla) se ve al volver: se relee al volver a esta pantalla y al volver
  // la app a primer plano. Sin sondeo. El primer foco es la carga de arriba.
  const focused = useRef(false);
  useEffect(() => navigation.addListener("focus", () => { if (focused.current) load(); focused.current = true; }), [navigation, load]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => { if (state === "active") load(); });
    return () => sub.remove();
  }, [load]);
  // Un Turbo que corre en un grupo se maneja desde el grupo (un solo retiro por
  // tienda): una oferta aceptada o un aviso que abre este recorrido va al grupo.
  useEffect(() => {
    if (!fromGroup && route?.type === "TURBO" && route.turbo_group_id) navigation.replace("TurboGroupScreen", { groupId: route.turbo_group_id });
  }, [fromGroup, route?.type, route?.turbo_group_id, navigation]);
  useEffect(() => {
    if (route?.type !== "TURBO") return;
    fetchDispatch(routeId)
      .then((d) => setTurboWindow({ deadline: d?.deadline_at ?? null, start: d?.window_start_at ?? null }))
      .catch(() => setTurboWindow(null));
  }, [route?.type, routeId]);
  // Ejecuta una acción, recarga y muestra el error del servidor si lo hay
  // (arriba de todo, o donde diga `onError`). Si la acción falla no se recarga.
  // Estables (useCallback): las paradas están memorizadas y no se vuelven a
  // dibujar todas al abrir una o al escribir.
  const act = useCallback(async (fn: () => Promise<unknown>, onError?: (message: string) => void) => {
    setBusy(true); setError(null);
    try { await fn(); await load(); } catch (e: any) { (onError ?? setError)(errorMessage(e, "No se pudo completar la acción")); } finally { setBusy(false); }
  }, [load]);
  const toggleStop = useCallback((id: number) => setOpenStop((cur) => (cur === id ? null : id)), []);
  // La parada que devuelve la declaración se muestra ya, aunque falle la recarga.
  const replaceStop = useCallback((stop: Stop) => setRoute((r) => (r ? { ...r, stops: r.stops.map((s) => (s.id === stop.id ? stop : s)) } : r)), []);
  // Con el recorrido cargado o en curso el GPS sigue fuera del horario: si
  // estaba en pausa (antes de las 07:00, después de las 22:00) se pregunta en
  // el acto, sin esperar al sondeo ni a volver a primer plano.
  const onConfirmLoad = () =>
    act(async () => {
      const n = Number(count);
      if (!Number.isInteger(n) || n < 0) throw new Error("Ingresá la cantidad de bultos que recibiste");
      const r = await confirmLoad(routeId, n);
      void refreshTrackingPolicy();
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
      void refreshTrackingPolicy();
      // Flex que no figura «En camino» en Mercado Libre: se avisa, no se frena.
      if (r.warnings?.length) Alert.alert("Revisá en Envíos Flex", r.warnings.map((w) => w.message).join("\n"));
    });
  const handleTabPress = (tab: DriverTabKey) => {
    switch (tab) {
      case "home": navigation.navigate("DriverScreen"); break;
      case "deliveries": navigation.navigate("EnviosScreen"); break;
      case "scan": navigation.navigate("DriverScanOptionsScreen"); break;
      case "activity": navigation.navigate("NotificationsScreen"); break;
      default: break;
    }
  };

  // Antes de completar, la app cierra las paradas terminadas que el servidor no
  // cierra solo (stopsToCloseOnFinish), una por una, como haría el chofer.
  const onComplete = () =>
    Alert.alert("Completar recorrido", "¿Terminaste todas las paradas?", [
      { text: "No", style: "cancel" },
      {
        text: "Sí, completar",
        onPress: () => act(async () => {
          for (const s of stopsToCloseOnFinish(route?.stops ?? [], route?.type ?? "")) await stopAction(routeId, s.id, "done");
          await completeRoute(routeId);
        }),
      },
    ]);
  if (!route) {
    return (
      <View style={styles.background}>
        <ThemedStatusBar />
        <SafeScreen edges={EDGES_ABOVE_BOTTOM_BAR} style={styles.safeArea}>
          <View style={[styles.center, { flex: 1 }]}>
            {error ? <Text style={styles.errorText}>{error}</Text> : <ActivityIndicator color={theme.text.accent} />}
            <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 16 }}><Text style={styles.link}>Volver</Text></Pressable>
          </View>
          <DriverBottomNavigation activeTab="deliveries" onPress={handleTabPress} />
        </SafeScreen>
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
  // Un Turbo de otro día (programado): se comienza ese día y no se retira antes.
  const programado = route.type === "TURBO" ? programadoLabel({ scheduled_date: route.scheduled_date, window_start_at: windowStart, deadline_at: deadline }, today, hhmm) : null;
  const inProgress = route.status === "IN_PROGRESS";
  // En un reparto, las paradas con todo resuelto las cierra el servidor al finalizar.
  const allClosed = routeCanFinish(route);
  const declared = isPickup ? declarationSummary(route.stops) : null;
  // Reparto: pendientes arriba y lo terminado plegado abajo. Colecta y Turbo, como siempre.
  const sections = isDelivery ? splitStops(route.stops) : null;
  const progress = isDelivery ? routeProgress(route.stops) : null;
  const stopCard = (s: Stop) => (
    <StopCard key={s.id} routeId={route.id} stop={s} stops={route.stops} routeType={route.type} routeStatus={route.status} inProgress={inProgress} busy={busy}
      open={openStop === s.id} dimmed={openStop !== null && openStop !== s.id} onToggle={toggleStop} act={act} onStopSaved={replaceStop} />
  );
  return (
    <ImageBackground source={require("../../../../../assets/background-1.png")} style={styles.background} imageStyle={styles.backgroundImage}>
      <ThemedStatusBar />
      {/* Arriba y a los lados respeta las barras del sistema (edge-to-edge);
          abajo la cubre la barra de navegación del chofer, que queda donde estaba. */}
      <SafeScreen edges={EDGES_ABOVE_BOTTOM_BAR} style={styles.safeArea}>
        {/* KeyboardScreen: la cantidad de bultos, la observación de la parada y
            los importes del cierre no quedan tapados por el teclado (la app es
            edge-to-edge: el adjustResize del manifest ya no corre nada). */}
        <View style={styles.scrollArea}>
          <KeyboardScreen contentContainerStyle={styles.page}>
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.back}><Ionicons name="arrow-back" size={22} color={theme.text.primary} /></Pressable>
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
                <Text style={styles.meta}>
                  {progress
                    ? `${progress.total} ${progress.total === 1 ? "envío" : "envíos"} · ${progress.pending} ${progress.pending === 1 ? "pendiente" : "pendientes"} · ${progress.finished} ${progress.finished === 1 ? "finalizado" : "finalizados"}`
                    : `${route.stops.length} paradas · ${route.deliveries_count} envíos`}
                </Text>
                {route.stops.length ? (
                  <Pressable onPress={() => setMapOpen(true)} style={styles.mapLink} accessibilityRole="button" hitSlop={6}>
                    <Ionicons name="map-outline" size={15} color={theme.text.accent} />
                    <Text style={styles.link}>Ver recorrido en el mapa</Text>
                  </Pressable>
                ) : null}
                {route.stops.length && canOrganize(route) ? (
                  <Pressable onPress={() => navigation.navigate("RouteOrganizeScreen", { routeId: route.id })} style={styles.mapLink} accessibilityRole="button" hitSlop={6}>
                    <Ionicons name="swap-vertical-outline" size={15} color={theme.text.accent} />
                    <Text style={styles.link}>Organizar recorrido</Text>
                  </Pressable>
                ) : null}
                {programado ? <Text style={styles.deadline}>{programado}</Text>
                  : route.type === "TURBO" && deadline ? <Text style={styles.deadline}>Entregar antes de las {hhmm(deadline)}</Text> : null}
              </View>
            )}
          </View>
          {programado ? (
            <View style={styles.warnBox}>
              <Ionicons name="alert-circle-outline" size={18} color={theme.status.pending.text} />
              <Text style={styles.warnText}>{NO_RETIRAR_ANTES}</Text>
            </View>
          ) : null}
          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
          {canConfirm ? (
            <ThemedCard style={styles.panel}>
              <Text style={styles.panelTitle}>Control de carga</Text>
              <Text style={styles.panelText}>
                {route.load_expected_count === null
                  ? "El depósito todavía no cargó cuántos bultos preparó. Pedile que lo haga antes de salir."
                  : `El depósito preparó ${route.load_expected_count} bultos. Contá los que recibiste y confirmá.`}
              </Text>
              <View style={styles.row}>
                <TextInput value={count} onChangeText={setCount} keyboardType="number-pad" placeholder="Cantidad" placeholderTextColor={theme.text.muted} style={styles.input} editable={!busy && route.load_expected_count !== null} />
                <Pressable onPress={onConfirmLoad} disabled={busy || route.load_expected_count === null} style={[styles.btn, (busy || route.load_expected_count === null) && styles.btnDisabled]}>
                  <Text style={styles.btnText}>Confirmar</Text>
                </Pressable>
              </View>
              {route.load_confirmed_count !== null && route.load_expected_count !== null && route.load_confirmed_count !== route.load_expected_count ? (
                <Text style={styles.warn}>Última confirmación: {route.load_confirmed_count} de {route.load_expected_count}. Con diferencia el recorrido no sale.</Text>
              ) : null}
            </ThemedCard>
          ) : null}
          {answer ? (
            <ThemedCard style={[styles.panel, answer === "DECLINED" && styles.panelDanger]}>
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
            </ThemedCard>
          ) : null}
          {answer && answer !== "ACCEPTED" ? (
            <View style={[styles.btn, styles.btnBig, styles.btnDisabled]}>
              <Ionicons name="lock-closed" size={18} color={theme.text.onPrimary} />
              <Text style={styles.btnText}>Aceptá la colecta para comenzarla</Text>
            </View>
          ) : canStart && later ? (
            <View style={[styles.btn, styles.btnBig, styles.btnDisabled]}>
              <Ionicons name="lock-closed" size={18} color={theme.text.onPrimary} />
              <Text style={styles.btnText}>Se comienza {day}</Text>
            </View>
          ) : canStart ? (
            <Pressable onPress={onStart} disabled={busy} style={[styles.btn, styles.btnBig, busy && styles.btnDisabled]}>
              <Ionicons name="play" size={18} color={theme.text.onPrimary} />
              <Text style={styles.btnText}>{isPickup ? "Comenzar colecta" : "Salir a la calle"}</Text>
            </Pressable>
          ) : null}
          {declared && declared.stops ? (
            <ThemedCard style={styles.panel}>
              <Text style={styles.panelTitle}>Paquetes retirados</Text>
              <View style={styles.stats}>
                <Stat value={declared.total} label="informados" />
                <Stat value={declared.informed} label={placeStatLabel(declared.informed, declared.allStores, "informed")} />
                <Stat value={declared.pending} label={placeStatLabel(declared.pending, declared.allStores, "pending")} warn={declared.pending > 0} />
              </View>
            </ThemedCard>
          ) : null}
          {sections ? (
            <>
              {sections.pending.map(stopCard)}
              {sections.finished.length ? <FinishedStops count={sections.finished.length}>{() => sections.finished.map(stopCard)}</FinishedStops> : null}
            </>
          ) : route.stops.map(stopCard)}
          {inProgress ? (
            <Pressable onPress={onComplete} disabled={busy || !allClosed} style={[styles.btn, styles.btnBig, (busy || !allClosed) && styles.btnDisabled]}>
              <Ionicons name="checkmark-done" size={18} color={theme.text.onPrimary} />
              <Text style={styles.btnText}>
                {allClosed ? "Completar recorrido"
                  : sections ? `${sections.pending.length === 1 ? "Queda 1 parada pendiente" : `Quedan ${sections.pending.length} paradas pendientes`}`
                  : "Cerrá todas las paradas para completar"}
              </Text>
            </Pressable>
          ) : null}
          </KeyboardScreen>
        </View>
        <DriverBottomNavigation activeTab="deliveries" onPress={handleTabPress} />
      </SafeScreen>
      <RouteMapModal visible={mapOpen} title={`${TYPE_LABEL[route.type]} #${route.id}`} stops={route.stops} onClose={() => setMapOpen(false)} />
    </ImageBackground>
  );
}
function Stat({ value, label, warn }: { value: number; label: string; warn?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, warn && styles.statWarn]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
// «Finalizados (N)»: plegado al entrar; las paradas se dibujan recién al abrirlo.
function FinishedStops({ count, children }: { count: number; children: () => React.ReactNode }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.finishedHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={styles.finishedTitle}>Finalizados ({count})</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={theme.text.secondary} />
      </Pressable>
      {open ? children() : null}
    </>
  );
}
// Observación de la parada, con guardado propio. Si falla, el texto queda.
function StopNotes({ routeId, stopId, saved, onSaved }: { routeId: number; stopId: number; saved: string | null; onSaved: (stop: Stop) => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [text, setText] = useState(saved ?? "");
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });
  // Frena el segundo toque antes de que el estado deshabilite el botón.
  const sending = useRef(false);
  const changed = text.trim() !== (saved ?? "").trim();
  const save = async () => {
    if (sending.current || !changed) return;
    sending.current = true;
    setStatus({ kind: "saving" });
    try {
      onSaved(await saveStopNotes(routeId, stopId, text));
      setStatus({ kind: "saved" });
    } catch (e: any) {
      setStatus({
        kind: "error",
        message: e?.status === 404
          ? "Todavía no se pueden guardar observaciones: falta actualizar el servidor. Tu texto sigue acá."
          : `${errorMessage(e, "No se pudo guardar la observación").replace(/\.?$/, ".")} Tu texto sigue acá.`,
      });
    } finally { sending.current = false; }
  };
  const saving = status.kind === "saving";
  return (
    <View style={styles.notes}>
      <TextInput value={text} onChangeText={(v) => { setText(v); if (status.kind !== "saving") setStatus({ kind: "idle" }); }} placeholder="Observación (opcional)"
        placeholderTextColor={theme.text.muted} style={[styles.input, styles.notesInput]} multiline textAlignVertical="top" editable={!saving} accessibilityLabel="Observación de la parada" />
      <View style={styles.row}>
        <Pressable onPress={save} disabled={saving || !changed} style={[styles.btnSmall, styles.rowBtn, (saving || !changed) && styles.btnDisabled]} accessibilityRole="button">
          {saving ? <ActivityIndicator size="small" color={theme.text.onPrimary} /> : null}
          <Text style={styles.btnText}>Guardar observación</Text>
        </Pressable>
        {status.kind === "saved" && !changed ? <Text style={[styles.stopMeta, styles.deliveryDone]}>Observación guardada</Text> : null}
      </View>
      {status.kind === "error" ? <Text style={styles.warn}>{status.message}</Text> : null}
    </View>
  );
}
// Destinatario y tracking, con el logo del canal del envío.
function DeliveryHead({ d }: { d: Stop["deliveries"][number] }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.deliveryHead}>
      <ProviderBadge provider={d.provider} />
      <Text style={[styles.deliveryTitle, styles.shrink]}>{d.nombre_destinatario ?? "—"} <Text style={styles.mono}>{String(d.tracking ?? d.delivery_id)}</Text></Text>
    </View>
  );
}
// Memorizada: con 80-100 paradas, abrir una o recargar no vuelve a dibujar las
// que no cambiaron (las funciones que recibe son estables).
const StopCard = memo(StopCardView);
function StopCardView({ routeId, stop, stops, routeType, routeStatus, inProgress, busy, open, dimmed, onToggle, act, onStopSaved }: {
  routeId: number; stop: Stop; stops: Stop[]; routeType: RouteDetail["type"]; routeStatus: RouteDetail["status"]; inProgress: boolean; busy: boolean; open: boolean;
  // Otra parada está abierta: esta se atenúa, pero se puede tocar.
  dimmed: boolean; onToggle: (stopId: number) => void;
  act: (fn: () => Promise<unknown>, onError?: (message: string) => void) => Promise<void>; onStopSaved: (stop: Stop) => void;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [pending, setPending] = useState<PendingDelivery[] | null>(null);
  const isPickup = stop.type === "PICKUP";
  // Reparto: estados por envío, «Finalizados» y Mercado Libre por Envíos Flex.
  // Turbo y colecta siguen como estaban.
  const isRouteDelivery = routeType === "DELIVERY" && !isPickup;
  const finished = isRouteDelivery && stopFinished(stop);
  const closed = stop.status === "DONE" || stop.status === "SKIPPED";
  // Marcar envíos como colectados: en una colecta (PICKUP) eso se hace en
  // LightData durante este MVP; el retiro de un Turbo se sigue marcando acá.
  const collectsHere = isPickup && (routeType !== "PICKUP" || LYNX_COLLECT_ENABLED);
  // En el retiro de un Turbo se listan solo los envíos del recorrido (los de
  // sus paradas de entrega), no los pendientes de la tienda: ver turboPickup.ts.
  const turboPickup = isPickup && routeType === "TURBO";
  const turboItems = turboPickup ? turboPickupItems(stops, stop) : null;
  // Cómo llegar: coordenadas si las hay; si no, la dirección. Abrir Maps no cambia la parada.
  const directions = isPickup
    ? directionsUrl({ latitude: stop.latitude_snapshot, longitude: stop.longitude_snapshot, address: stop.store_address })
    : directionsUrl({ latitude: stop.latitude, longitude: stop.longitude, address: stopMapsAddress(stop) });
  // Una parada de reparto terminada no pide llegar, cerrar ni saltear.
  const actions = finished ? { arrive: false, close: false, skip: false, resolvedButOpen: false } : stopActions(stop, inProgress);
  const summary = isPickup ? null : stopSummary(stop);
  const split = isPickup || isRouteDelivery ? null : splitDeliveries(stop.deliveries);
  useEffect(() => {
    if (open && collectsHere && !turboPickup && stop.status === "ARRIVED") {
      fetchPendingAtStore(routeId, stop.id).then(setPending).catch(() => setPending([]));
    }
  }, [open, collectsHere, turboPickup, stop.status, stop.id, routeId, stop.collected_count]);
  // La observación se guarda aparte (StopNotes): ya no viaja escondida en cada resultado.
  const outcome = (deliveryId: number, value: string) => act(() => recordOutcome(routeId, stop.id, deliveryId, value));
  // Un envío ajeno al Turbo lo rechaza el servidor (409 TURBO_NOT_IN_ROUTE): se explica.
  const collectTurbo = (deliveryId: number) =>
    act(() => recordOutcome(routeId, stop.id, deliveryId, "COLLECTED").catch((e) => { throw turboPickupError(e); }));
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
      await recordOutcome(routeId, stop.id, closing.deliveryId, closing.outcome, outcomeNotes(closing.outcome, draft), built.declaration);
      setClosing(null);
    }, setCloseError);
  };
  // Cantidad retirada (solo colectas). La ref frena el segundo toque antes de
  // que `busy` llegue a deshabilitar el botón.
  const declares = routeType === "PICKUP" && supportsDeclaration(stop);
  const declaring = useRef(false);
  const [declareError, setDeclareError] = useState<string | null>(null);
  // «Más»: la observación y «Saltear», plegados para que la parada sea corta.
  const [more, setMore] = useState(false);
  // «Envíos cerrados», plegado (último estado: las pruebas toman los useState por orden).
  const [showClosed, setShowClosed] = useState(false);
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
  // Los de Mercado Libre se cierran desde Envíos Flex: no cuentan como «sin
  // resultado». En reparto se reconocen por el proveedor; en Turbo, como antes.
  const governed = isRouteDelivery ? providerGoverned : (d: Stop["deliveries"][number]) => d.tipo_envio === "flex";
  const withoutOutcome = stop.deliveries.filter((d) => !deliveryResolved(d) && !governed(d));
  const collectedIds = new Set(stop.deliveries.map((d) => d.delivery_id));
  const closeStop = () => {
    if (!isPickup && withoutOutcome.length) { Alert.alert("Faltan resultados", `Hay ${withoutOutcome.length} envíos sin marcar como entregados o no entregados.`); return; }
    const close = () => act(() => stopAction(routeId, stop.id, "done"));
    // Cerrar no cambia el envío, pero al completar el recorrido lo que ML no
    // cerró queda en el Baúl del chofer (regla del servidor): se avisa antes.
    const waiting = isRouteDelivery ? awaitingProvider(stop).length : 0;
    if (!waiting) { close(); return; }
    Alert.alert(
      "Mercado Libre todavía no lo cerró",
      `${waiting === 1 ? "1 envío de esta parada sigue" : `${waiting} envíos de esta parada siguen`} sin resultado en Mercado Libre. Si cerrás la parada y completás el recorrido, queda${waiting === 1 ? "" : "n"} en tu Baúl como no entregado${waiting === 1 ? "" : "s"} hasta que Mercado Libre lo confirme.`,
      [{ text: "Volver", style: "cancel" }, { text: "Cerrar igual", onPress: close }],
    );
  };
  return (
    <ThemedCard variant="row" style={[styles.stop, closed && !isRouteDelivery && styles.stopClosed, open && styles.stopOpen, dimmed && styles.stopDimmed]}>
      <Pressable onPress={() => onToggle(stop.id)} style={styles.stopHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={styles.seq}><Text style={styles.seqText}>{stop.sequence}</Text></View>
        <View style={{ flex: 1 }}>
          {isPickup ? (
            <>
              <Text style={styles.stopTitle}>{`Retiro · ${stop.store_name ?? stop.warehouse_name ?? `tienda ${stop.store_id}`}`}</Text>
              <Text style={styles.stopMeta}>{stop.store_address ?? ""}</Text>
            </>
          ) : (
            <>
              {/* Entrega: la dirección primero; el destinatario y el CP, abajo. */}
              <Text style={styles.stopAddress}>{stopAddress(stop)}</Text>
              <Text style={styles.stopMeta}>{[stop.receiver_name, stop.postal_code ? `CP ${stop.postal_code}` : null].filter(Boolean).join(" · ")}</Text>
            </>
          )}
          {isPickup && stop.pickup_time_snapshot ? (
            <View style={styles.cutoffRow}>
              <Ionicons name="time-outline" size={14} color={theme.text.accent} />
              <Text style={styles.cutoffText}>Retiro: {stop.pickup_time_snapshot.slice(0, 5)}</Text>
            </View>
          ) : null}
          {isPickup && stop.cutoff_snapshot ? (
            <View style={styles.cutoffRow}>
              <Ionicons name="time-outline" size={14} color={theme.text.accent} />
              <Text style={styles.cutoffText}>Corte de la tienda: {stop.cutoff_snapshot.slice(0, 5)}</Text>
            </View>
          ) : null}
          {isRouteDelivery ? (
            // El estado real de sus envíos, no el de la parada.
            <Text style={[styles.stopMeta, styles.stopStatus, finished && (stop.deliveries.every((d) => deliveryView(d).tone === "delivered") ? styles.deliveryDone : styles.stopStatusClosed)]}>
              {stopStateLabel(stop)}
            </Text>
          ) : (
            <Text style={styles.stopMeta}>
              <Text style={[styles.stopStatus, closed && styles.stopStatusClosed, actions.resolvedButOpen && styles.stopStatusWarn]}>{STOP_STATUS_LABEL[stop.status]}</Text>
              {isPickup ? (stop.collected_count ? ` · ${stop.collected_count} colectados en Lynx` : "") : summary ? ` · ${stopPackagesLabel(summary)}` : ""}
              {declares ? ` · ${declarationLabel(stop.declared_count)}` : ""}
            </Text>
          )}
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={theme.text.muted} />
      </Pressable>
      {open ? (
        <View style={styles.stopBody}>
          {directions ? (
            <Pressable onPress={() => Linking.openURL(directions).catch(() => Alert.alert("Cómo llegar", "No se pudo abrir Google Maps."))} style={[styles.btnSmall, styles.btnGhost, styles.rowBtn]} accessibilityRole="link">
              <Ionicons name="navigate-outline" size={16} color={theme.text.primary} />
              <Text style={styles.btnGhostText}>Cómo llegar</Text>
            </Pressable>
          ) : null}
          {actions.resolvedButOpen ? (
            <View style={styles.resolvedBox}>
              <Ionicons name="checkmark-circle-outline" size={18} color={theme.status.confirmed.text} />
              <Text style={styles.resolvedText}>Todos los envíos de esta parada ya figuran resueltos. Cerrá la parada para seguir.</Text>
            </View>
          ) : null}
          {isRouteDelivery ? stop.deliveries.map((d) => {
            const view = deliveryView(d);
            const canAct = inProgress && !view.final && (stop.status === "ARRIVED" || stop.status === "PENDING");
            const ml = providerGoverned(d);
            return (
              <View key={d.delivery_id} style={styles.deliveryRow}>
                <View style={{ flex: 1 }}>
                  <DeliveryHead d={d} />
                  <Text style={[styles.stopMeta, view.tone === "delivered" ? styles.deliveryDone : view.final ? styles.stopStatusClosed : null]}>{view.label}</Text>
                  {!view.final && d.reverse_kind ? <Text style={styles.reverseRequest}>{reverseRequestText(d.reverse_kind, d.reverse_note)}</Text> : null}
                </View>
                {canAct ? (
                  <View style={styles.row}>
                    {/* Mercado Libre: se cierra en Envíos Flex; acá solo se avisa, sin pedir nada al servidor. */}
                    <Pressable onPress={() => (ml ? mlNotice(ML_DELIVER) : openClose(d.delivery_id, "DELIVERED"))} disabled={busy} style={[styles.btnSmall, busy && styles.btnDisabled]}><Text style={styles.btnText}>Entregar</Text></Pressable>
                    <Pressable onPress={() => (ml ? mlNotice(ML_NOT_DELIVERED) : openClose(d.delivery_id, "NOT_DELIVERED"))} disabled={busy} style={[styles.btnSmall, styles.btnGhost, busy && styles.btnDisabled]}><Text style={styles.btnGhostText}>No pude entregar</Text></Pressable>
                  </View>
                ) : null}
                {canAct && !ml && closing?.deliveryId === d.delivery_id ? (
                  <OutcomeForm key={closing.outcome} outcome={closing.outcome} cobranza={cobranzaOf(d.importe_cobranza)} reverseRequest={reverseRequestText(d.reverse_kind, d.reverse_note)}
                    busy={busy} error={closeError} onConfirm={confirmClose} onCancel={() => setClosing(null)} />
                ) : null}
              </View>
            );
          }) : null}
          {split?.pending.map((d) => (
            <View key={d.delivery_id} style={styles.deliveryRow}>
              <View style={{ flex: 1 }}>
                <DeliveryHead d={d} />
                <Text style={styles.stopMeta}>{deliveryStatusLabel(d)}</Text>
              </View>
              {/* Un envío ya resuelto (entregado por ML, con resultado) no admite otro. */}
              {inProgress && (stop.status === "ARRIVED" || stop.status === "PENDING") && !deliveryResolved(d) ? (
                <View style={styles.row}>
                  {routeType === "TURBO" ? (
                    <Text style={styles.stopMeta}>Cerrá la entrega en Envíos Flex — Lynx se entera solo</Text>
                  ) : d.tipo_envio === "flex" ? (
                    <Text style={styles.stopMeta}>Entregado: se registra en Envíos Flex</Text>
                  ) : (
                    <Pressable onPress={() => openClose(d.delivery_id, "DELIVERED")} disabled={busy} style={[styles.btnSmall, busy && styles.btnDisabled]}><Text style={styles.btnText}>Entregar</Text></Pressable>
                  )}
                  <Pressable onPress={() => openClose(d.delivery_id, "NOT_DELIVERED")} disabled={busy} style={[styles.btnSmall, styles.btnGhost, busy && styles.btnDisabled]}><Text style={styles.btnGhostText}>No pude entregar</Text></Pressable>
                </View>
              ) : null}
              {inProgress && (stop.status === "ARRIVED" || stop.status === "PENDING") && !deliveryResolved(d) && closing?.deliveryId === d.delivery_id ? (
                <OutcomeForm key={closing.outcome} outcome={closing.outcome} cobranza={cobranzaOf(d.importe_cobranza)} busy={busy} error={closeError}
                  onConfirm={confirmClose} onCancel={() => setClosing(null)} />
              ) : null}
            </View>
          ))}
          {/* Lo resuelto (entregado por el chofer o confirmado por Mercado Libre, no entregado, cancelado) va aparte, plegado. */}
          {split?.closed.length ? (
            <>
              <Pressable onPress={() => setShowClosed(!showClosed)} style={styles.closedHead} accessibilityRole="button" accessibilityState={{ expanded: showClosed }}>
                <Text style={styles.closedTitle}>Envíos cerrados ({split.closed.length})</Text>
                <Ionicons name={showClosed ? "chevron-up" : "chevron-down"} size={16} color={theme.text.muted} />
              </Pressable>
              {showClosed ? split.closed.map((d) => (
                <View key={d.delivery_id} style={styles.deliveryRow}>
                  <View style={{ flex: 1 }}>
                    <DeliveryHead d={d} />
                    <Text style={[styles.stopMeta, deliveryDelivered(d) ? styles.deliveryDone : styles.stopStatusClosed]}>{deliveryStatusLabel(d)}</Text>
                  </View>
                </View>
              )) : null}
            </>
          ) : null}
          {declares ? (
            <DeclaredCountForm key={String(stop.declared_count)} count={stop.declared_count ?? null} routeStatus={routeStatus}
              busy={busy} error={declareError} onSubmit={declare} />
          ) : null}
          {isPickup && !collectsHere && stop.status === "ARRIVED" ? (
            <>
              <Pressable onPress={showCollectInLightData} style={[styles.btnSmall, styles.rowBtn]}>
                <Ionicons name="qr-code-outline" size={16} color={theme.text.onPrimary} />
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
              {turboItems ? (
                <>
                  <Text style={styles.panelText}>Envíos de este Turbo. Marcá el bulto cuando te lo entregan.</Text>
                  {turboItems.length === 0 ? <Text style={styles.stopMeta}>Este Turbo no tiene envíos para retirar.</Text> : turboItems.map((d) => (
                    <View key={d.delivery_id} style={styles.deliveryRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.deliveryTitle}>{d.nombre_destinatario ?? "—"} <Text style={styles.mono}>{String(d.tracking ?? d.delivery_id)}</Text></Text>
                        <Text style={styles.stopMeta}>{d.collected ? "Colectado" : OPS_LABEL[d.ops_status] ?? d.ops_status}{d.codigo_postal ? ` · CP ${d.codigo_postal}` : ""}</Text>
                      </View>
                      {!d.collected ? (
                        <Pressable onPress={() => collectTurbo(d.delivery_id)} disabled={busy} style={[styles.btnSmall, busy && styles.btnDisabled]}><Text style={styles.btnText}>Colecté</Text></Pressable>
                      ) : null}
                    </View>
                  ))}
                </>
              ) : (
                <>
                  <Text style={styles.panelText}>Envíos de la tienda pendientes de retiro. Marcá cada bulto que te entregan.</Text>
                  {pending === null ? <ActivityIndicator color={theme.text.accent} /> : pending.filter((p) => !collectedIds.has(p.delivery_id)).length === 0 ? (
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
                </>
              )}
              {!stop.store_ready_at ? (
                <Pressable onPress={() => act(() => stopAction(routeId, stop.id, "store-ready"))} disabled={busy} style={[styles.btnSmall, styles.btnGhost, busy && styles.btnDisabled]}>
                  <Text style={styles.btnGhostText}>La tienda tenía todo listo</Text>
                </Pressable>
              ) : <Text style={styles.stopMeta}>La tienda tenía todo listo.</Text>}
            </>
          ) : null}
          {inProgress && !closed ? (
            <>
              <View style={styles.row}>
                {actions.arrive ? (
                  <Pressable onPress={() => act(() => stopAction(routeId, stop.id, "arrive"))} disabled={busy} style={[styles.btn, busy && styles.btnDisabled]}><Text style={styles.btnText}>Llegué</Text></Pressable>
                ) : null}
                {actions.close ? (
                  <Pressable onPress={closeStop} disabled={busy} style={[styles.btn, busy && styles.btnDisabled]}>
                    <Text style={styles.btnText}>Cerrar parada</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setMore((v) => !v)} style={[styles.btn, styles.btnGhost]} accessibilityRole="button" accessibilityState={{ expanded: more }}>
                  <Text style={styles.btnGhostText}>Más</Text>
                  <Ionicons name={more ? "chevron-up" : "chevron-down"} size={16} color={theme.text.primary} />
                </Pressable>
              </View>
              {more ? (
                <>
                  {/* La del chofer (driver_notes), nunca `notes`: esa también la escribe el sistema. */}
                  <StopNotes routeId={routeId} stopId={stop.id} saved={stop.driver_notes ?? null} onSaved={onStopSaved} />
                  {actions.skip ? (
                    // «salteada» va a `notes` (la del sistema); la observación del chofer no se toca.
                    <Pressable
                      onPress={() => Alert.alert("Saltear parada", "¿Seguro? Queda registrado que no se visitó.", [{ text: "No", style: "cancel" }, { text: "Saltear", style: "destructive", onPress: () => act(() => stopAction(routeId, stop.id, "skip", "salteada")) }])}
                      disabled={busy} style={[styles.btn, styles.btnGhost, styles.rowBtn, busy && styles.btnDisabled]}>
                      <Text style={styles.btnGhostText}>Saltear parada</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
          {!inProgress && !closed ? <Text style={styles.stopMeta}>Las paradas se trabajan cuando el recorrido está en curso.</Text> : null}
        </View>
      ) : null}
    </ThemedCard>
  );
}
const makeStyles = (t: Theme) => StyleSheet.create({
  background: { flex: 1, backgroundColor: t.colors.background },
  backgroundImage: { opacity: t.backdrop.imageOpacity },
  // Transparente: el fondo es la imagen de abajo.
  safeArea: { flex: 1, backgroundColor: "transparent" },
  scrollArea: { flex: 1, minHeight: 0 },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  page: { paddingHorizontal: t.layout.screenPadding, paddingTop: t.spacing.lg, paddingBottom: 120, gap: t.spacing.sm },
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: t.spacing.md, paddingTop: t.spacing.lg },
  back: { padding: 6, marginTop: 2 },
  eyebrow: { ...t.typography.kicker },
  title: { color: t.text.primary, fontSize: 22, fontWeight: "700" },
  meta: { color: t.text.secondary, fontSize: 13, marginTop: 2 },
  deadline: { color: t.status.pending.text, fontSize: 14, fontWeight: "700", marginTop: 4 },
  warnBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderWidth: 1, borderColor: t.status.pending.border, backgroundColor: t.status.pending.background, borderRadius: t.radius.md, padding: 12, marginBottom: 12 },
  warnText: { flex: 1, color: t.text.primary, fontSize: 14 },
  link: { color: t.text.accent },
  mapLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, minHeight: 28 },
  // Fondo, radio y sombra: ThemedCard.
  panel: { borderColor: t.borders.primary, padding: t.spacing.md, gap: 10 },
  panelTitle: { color: t.text.primary, fontWeight: "700", fontSize: 15 },
  panelText: { color: t.text.secondary, fontSize: 13, lineHeight: 18 },
  warn: { color: t.status.pending.text, fontSize: 13 },
  panelDanger: { borderWidth: 1, borderColor: t.status.rejected.border },
  row: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  input: { flex: 1, minWidth: 120, minHeight: 44, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.borders.default, backgroundColor: t.surfaces.input, color: t.text.primary, paddingHorizontal: 12 },
  btn: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.primary, borderRadius: t.radius.md, paddingHorizontal: 16, minHeight: 44 },
  btnBig: { minHeight: 52, marginVertical: 4 },
  btnSmall: { backgroundColor: t.colors.primary, borderRadius: t.radius.md, paddingHorizontal: 12, minHeight: 38, justifyContent: "center" },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: t.borders.default },
  rowBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6 },
  cutoffRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  cutoffText: { color: t.text.accent, fontSize: 12, fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: t.text.onPrimary, fontWeight: "700" },
  btnGhostText: { color: t.text.primary, fontWeight: "600" },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: t.radius.md, backgroundColor: t.surfaces.muted },
  statValue: { color: t.text.primary, fontSize: 20, fontWeight: "700" },
  statWarn: { color: t.status.pending.text },
  statLabel: { color: t.text.secondary, fontSize: 11, textAlign: "center" },
  // Fondo, borde, radio y sombra: ThemedCard (fila de lista).
  stop: { overflow: "hidden" },
  stopClosed: { opacity: 0.65 },
  // La parada abierta se destaca; las demás se atenúan un poco (siguen tocables).
  stopOpen: { borderWidth: 1.5, borderColor: t.colors.primary },
  stopDimmed: { opacity: 0.6 },
  finishedHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48, paddingHorizontal: 4, marginTop: t.spacing.sm },
  finishedTitle: { color: t.text.secondary, fontSize: 15, fontWeight: "700" },
  notes: { gap: 8 },
  notesInput: { flex: 0, minHeight: 88, paddingTop: 10, paddingBottom: 10 },
  stopHead: { flexDirection: "row", gap: 12, alignItems: "center", padding: t.spacing.md },
  seq: { width: 30, height: 30, borderRadius: t.radius.full, backgroundColor: t.surfaces.muted, alignItems: "center", justifyContent: "center" },
  seqText: { color: t.text.primary, fontWeight: "700" },
  stopTitle: { color: t.text.primary, fontWeight: "700", fontSize: 15 },
  stopAddress: { color: t.text.primary, fontWeight: "800", fontSize: 16, lineHeight: 21 },
  stopStatus: { color: t.status.inTransit.text, fontWeight: "700" },
  stopStatusClosed: { color: t.text.secondary },
  stopStatusWarn: { color: t.status.pending.text },
  deliveryDone: { color: t.status.confirmed.text, fontWeight: "700" },
  resolvedBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderWidth: 1, borderColor: t.status.confirmed.border, backgroundColor: t.status.confirmed.background, borderRadius: t.radius.md, padding: 10 },
  resolvedText: { flex: 1, color: t.text.primary, fontSize: 13, lineHeight: 18 },
  stopMeta: { color: t.text.secondary, fontSize: 12, marginTop: 2 },
  reverseRequest: { color: t.status.pending.text, fontSize: 12, marginTop: 2, fontWeight: "600" },
  stopBody: { borderTopWidth: t.separator.width, borderTopColor: t.separator.color, padding: t.spacing.md, gap: 10 },
  deliveryRow: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 6, borderBottomWidth: t.separator.width, borderBottomColor: t.separator.color, flexWrap: "wrap" },
  deliveryTitle: { color: t.text.primary, fontSize: 14 },
  deliveryHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  shrink: { flexShrink: 1 },
  closedHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, minHeight: 44 },
  closedTitle: { color: t.text.secondary, fontSize: 13, fontWeight: "700" },
  mono: { color: t.text.muted, fontFamily: "monospace", fontSize: 12 },
  errorBox: { borderWidth: 1, borderColor: t.status.rejected.border, borderRadius: t.radius.md, padding: 12 },
  errorText: { color: t.text.primary },
});
