// src/Presentation/views/driver/Envios/EnviosScreen.tsx
// Envíos del chofer por modalidad logística:
//   Turbo (si está habilitado o tiene Turbos): en curso, finalizados y
//     programados para mañana.
//   Flex: recorridos de reparto en curso y finalizados (por día o rango).
//   Solo recorridos (10-nov, decisión de producto): todo envío asignado va en
//   un recorrido y se ve dentro de él; no hay listas de envíos sueltos.
//   Baúl: lo que el chofer tiene que rendir o devolver (GET /v2/baul/me).
//   Envíos tradicionales: próximamente.
// Arriba, la bandeja de ofertas con su contador; abajo, «Continuar» si hay un
// recorrido en la calle. Los recorridos se leen de workSource (compartido con
// Inicio). Los envíos del ViewModel solo se usan para no esconder trabajo:
// mostrar Turbo si hay Turbos y avisar de envíos en recorrido sin su recorrido.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  RefreshControl,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import useEnviosViewModel from "./ViewModel";
import { classifyDelivery } from "./deliveryState";
import { fetchMyBaul, BaulResult } from "./baulSource";
import BaulPanel from "./BaulPanel";
import global from "../../../theme/global";
import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import { LynxPulseLoader } from "../../../components/LynxPulseLoader";
import WorkItemCard from "../../../components/driver/WorkItemCard";
import ContinueBar, { CONTINUE_BAR_SPACE } from "../../../components/driver/ContinueBar";
import {
  DriverBottomNavigation,
} from "../../../components/DriverBottomNavigation";
import { goToDriverTab } from "../../../navigator/driverTabs";
import {
  closedOf,
  dayLabel,
  deliveriesInRoute,
  flexInProgress,
  Mission,
  Period,
  periodDays,
  periodLabel,
  turboInProgress,
  WorkItem,
} from "../work/driverWork";
import {
  fetchRoutesForDays,
  fetchScheduledTurbo,
  HISTORY_MAX_DAYS,
  SourceState,
  useDriverWork,
} from "../work/workSource";
import { openOfferInbox, refreshOfferCount, useOfferCounts } from "../offers/offerStore";
import { RouteSummary, todayIso, tomorrowIso } from "../routes/routesApi";
import { loadText, loadTotal } from "../turbo/turboGroup";
import { errorMessage } from "../errorMessage";

type ModalityKey = "turbo" | "flex" | "baul" | "tradicional";
// Cada cuánto se vuelve a pedir el Baúl mientras está a la vista.
const BAUL_REFRESH_MS = 20_000;
type SubKey = "current" | "finished" | "tomorrow";

const SUBS: Record<"turbo" | "flex", { key: SubKey; label: string; icon: keyof typeof Ionicons.glyphMap }[]> = {
  turbo: [
    { key: "current", label: "En curso", icon: "flash-outline" },
    { key: "finished", label: "Finalizados", icon: "checkmark-circle-outline" },
    { key: "tomorrow", label: "Mañana", icon: "calendar-outline" },
  ],
  flex: [
    { key: "current", label: "En curso", icon: "flash-outline" },
    { key: "finished", label: "Finalizados", icon: "checkmark-circle-outline" },
  ],
};

type Envio = {
  id?: string | number | null;
  delivery_id?: string | number | null;
  numero_tracking: string | null;
  tracking?: string | null;
  tracking_number?: string | null;
  fecha_colecta: string | null;
  fecha_wynflex?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  status_updated_at?: string | null;
  assigned_at?: string | null;
  nombre_fantasia: string | null;
  store_name?: string | null;
  seller_name?: string | null;
  direccion: string | null;
  address?: string | null;
  cp: string | null;
  estado: string | null;
  status?: string | null;
  status_ml?: string | null;
  assignment_response?: string | null;
  cadete: string | null;
  zona: string | null;
  metodo_envio?: string | null;
  localidad?: string | null;
  provincia?: string | null;
  precio_chofer?: string | null;
  porcentaje_chofer?: string | null;
  neto_chofer?: string | null;
  [key: string]: any;
};

// Fecha local (YYYY-MM-DD) de un Date: la del teléfono, no la de UTC.
const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dateOf = (iso: string) => new Date(`${iso}T12:00:00`);

const fmtDate = (iso?: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");

const isFinalizado = (item: Envio) => classifyDelivery(item).finished;

const getDateValue = (item: Envio): string | null => {
  return (
    item.fecha_colecta ||
    item.fecha_wynflex ||
    item.status_updated_at ||
    item.updated_at ||
    item.assigned_at ||
    item.created_at ||
    null
  );
};

const normalizeCurrentDelivery = (item: any): Envio => {
  const tracking =
    item?.numero_tracking ||
    item?.tracking ||
    item?.tracking_number ||
    item?.trackingNumber ||
    item?.shipment_id ||
    item?.shipmentId ||
    null;

  const nombreFantasia =
    item?.nombre_fantasia ||
    item?.store_name ||
    item?.storeName ||
    item?.seller_name ||
    item?.sellerName ||
    item?.tienda ||
    null;

  const direccion =
    item?.direccion ||
    item?.address ||
    item?.domicilio ||
    item?.receiver_address ||
    null;

  return {
    ...item,
    numero_tracking: tracking,
    tracking,
    fecha_colecta: getDateValue(item),
    nombre_fantasia: nombreFantasia,
    direccion,
    cp: item?.cp || item?.postal_code || item?.zip_code || null,
    // La tarjeta y el detalle muestran `estado`: va la etiqueta ya clasificada.
    estado: classifyDelivery(item ?? {}).label,
    cadete: item?.cadete || item?.driver_name || item?.driver || null,
    zona: item?.zona || item?.zone || item?.localidad || item?.provincia || null,
    localidad: item?.localidad || item?.provincia || item?.zona || null,
    // Un Turbo viene con tipo_envio "flex": lo que lo marca es is_turbo.
    metodo_envio: item?.is_turbo
      ? "turbo"
      : item?.metodo_envio || item?.delivery_type || item?.type || item?.tipo_envio || "flex",
    precio_chofer:
      item?.precio_chofer !== undefined && item?.precio_chofer !== null
        ? String(item.precio_chofer)
        : item?.driver_price !== undefined && item?.driver_price !== null
        ? String(item.driver_price)
        : null,
    porcentaje_chofer:
      item?.porcentaje_chofer !== undefined && item?.porcentaje_chofer !== null
        ? String(item.porcentaje_chofer)
        : item?.driver_percentage !== undefined && item?.driver_percentage !== null
        ? String(item.driver_percentage)
        : null,
    neto_chofer:
      item?.neto_chofer !== undefined && item?.neto_chofer !== null
        ? String(item.neto_chofer)
        : null,
  };
};

const isTurboRow = (item: Envio) => String(item.metodo_envio ?? "").toLowerCase() === "turbo";

// Historial de recorridos de una vista de finalizados.
type History = { key: string; loading: boolean; routes: RouteSummary[]; failedDays: string[]; error: string | null; tooLong: boolean };
type Scheduled = { loading: boolean; items: WorkItem[]; groupsState: SourceState; groupsError: string | null; error: string | null };

export const EnviosScreen = ({ navigation }: any) => {
  const { currentDeliveries, loading, reload } = useEnviosViewModel({ legacy: false });
  const work = useDriverWork();
  const offerCounts = useOfferCounts();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const currentRows = useMemo(
    () =>
      ((currentDeliveries || []).filter(Boolean) as any[]).map(
        normalizeCurrentDelivery
      ),
    [currentDeliveries]
  );

  const [refreshing, setRefreshing] = useState(false);
  const [modality, setModality] = useState<ModalityKey>("flex");
  // Ofertas de esta pestaña: Turbo cuenta las Turbo, Flex los recorridos ofrecidos; el resto, ninguna.
  const tabOffers = modality === "turbo" ? offerCounts?.turbo ?? 0 : modality === "flex" ? offerCounts?.routes ?? 0 : 0;
  const tabOfferWhat = modality === "turbo" ? { one: "una oferta Turbo", many: "ofertas Turbo" } : { one: "un recorrido ofrecido", many: "recorridos ofrecidos" };
  const [picked, setPicked] = useState(false);
  const [sub, setSub] = useState<SubKey>("current");
  const [finishedPeriod, setFinishedPeriod] = useState<Period>({ kind: "today" });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draft, setDraft] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [picker, setPicker] = useState<null | "FROM" | "TO">(null);

  const [history, setHistory] = useState<History | null>(null);
  const [scheduled, setScheduled] = useState<Scheduled | null>(null);
  const [baul, setBaul] = useState<BaulResult | null>(null);

  const w = work.work;
  const today = w?.today ?? todayIso();
  const missions = w?.missions ?? [];

  useFocusEffect(useCallback(() => { void refreshOfferCount(); }, []));

  // Turbo se ve si el coordinador lo habilitó o si hay Turbos (no se esconde trabajo).
  const turboRows = useMemo(() => currentRows.filter(isTurboRow), [currentRows]);
  const flexRows = useMemo(() => currentRows.filter((r) => !isTurboRow(r)), [currentRows]);
  const turboActive = useMemo(() => (w ? turboInProgress(w.openRoutes, w.groups, today) : []), [w, today]);
  const flexActive = useMemo(() => (w ? flexInProgress(w.openRoutes, today) : []), [w, today]);
  const turboVisible = w?.turboEnabled === true || turboActive.length > 0 || turboRows.length > 0;

  // Turbo primero si está habilitado; el chofer puede cambiar y se respeta.
  useEffect(() => {
    if (!picked && turboVisible && modality === "flex") setModality("turbo");
    if (!turboVisible && modality === "turbo") {
      setModality("flex");
      setSub("current");
    }
  }, [picked, turboVisible, modality]);

  const pickModality = (m: ModalityKey) => {
    setPicked(true);
    setModality(m);
    setSub("current");
  };

  const period = finishedPeriod;
  const setPeriod = setFinishedPeriod;
  const days = useMemo(() => periodDays(period, today), [period, today]);

  // Finalizados: los recorridos cerrados de esos días (un pedido por día, con tope).
  const historyKey = modality === "turbo" || modality === "flex" ? `${modality}|${JSON.stringify(days)}` : "";
  const loadHistory = useCallback(async () => {
    if (!days) return;
    if (days.length > HISTORY_MAX_DAYS) {
      setHistory({ key: historyKey, loading: false, routes: [], failedDays: [], error: null, tooLong: true });
      return;
    }
    setHistory({ key: historyKey, loading: true, routes: [], failedDays: [], error: null, tooLong: false });
    try {
      const r = await fetchRoutesForDays(days);
      setHistory({ key: historyKey, loading: false, routes: r.routes, failedDays: r.failedDays, error: null, tooLong: false });
    } catch (e) {
      setHistory({ key: historyKey, loading: false, routes: [], failedDays: [], error: errorMessage(e, "No se pudieron cargar los recorridos finalizados"), tooLong: false });
    }
  }, [days, historyKey]);

  useEffect(() => {
    if (sub === "finished" && (modality === "turbo" || modality === "flex") && history?.key !== historyKey) void loadHistory();
  }, [sub, modality, historyKey, history?.key, loadHistory]);

  const loadScheduled = useCallback(async () => {
    setScheduled((prev) => ({ loading: true, items: prev?.items ?? [], groupsState: prev?.groupsState ?? "ok", groupsError: null, error: null }));
    try {
      const r = await fetchScheduledTurbo(tomorrowIso());
      setScheduled({ loading: false, items: r.items, groupsState: r.groupsState, groupsError: r.groupsError, error: null });
    } catch (e) {
      setScheduled({ loading: false, items: [], groupsState: "ok", groupsError: null, error: errorMessage(e, "No se pudieron cargar los Turbos de mañana") });
    }
  }, []);

  useEffect(() => {
    if (modality === "turbo" && sub === "tomorrow" && !scheduled) void loadScheduled();
  }, [modality, sub, scheduled, loadScheduled]);

  const [baulRefreshing, setBaulRefreshing] = useState(false);
  const reloadBaul = useCallback(async () => {
    setBaulRefreshing(true);
    setBaul(await fetchMyBaul());
    setBaulRefreshing(false);
  }, []);

  // El picker confirma lo recibido en su teléfono: mientras el Baúl está a la
  // vista (esta pestaña y la pantalla enfocada) se vuelve a pedir al entrar y
  // cada 20 s, así lo recibido sale solo de la lista. Un error de red no borra
  // lo que ya se veía.
  useFocusEffect(useCallback(() => {
    if (modality !== "baul") return undefined;
    const load = () => {
      void fetchMyBaul().then((r) => setBaul((prev) => (r.status === "error" && prev?.status === "ok" ? prev : r)));
    };
    load();
    const timer = setInterval(load, BAUL_REFRESH_MS);
    return () => clearInterval(timer);
  }, [modality]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      reload(),
      work.refresh(),
      refreshOfferCount(true),
      sub === "finished" ? loadHistory() : Promise.resolve(),
      modality === "turbo" && sub === "tomorrow" ? loadScheduled() : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [reload, work, sub, modality, loadHistory, loadScheduled]);

  const openItem = (it: WorkItem) =>
    it.kind === "group"
      ? navigation.navigate("TurboGroupScreen", { groupId: it.group.id })
      : navigation.navigate("RouteDetailScreen", { routeId: it.route.id });
  const openMission = (m: Mission) => navigation.navigate(m.target.screen, m.target.params);

  // ---------- Lo que muestra la vista elegida ----------

  const view = useMemo(() => {
    let routes: WorkItem[] = [];
    if (modality === "flex" && sub === "current") routes = flexActive;
    else if (modality === "flex" && sub === "finished") routes = closedOf(history?.key === historyKey ? history.routes : [], "flex").map((route) => ({ kind: "route", route }));
    else if (modality === "turbo" && sub === "current") routes = turboActive;
    else if (modality === "turbo" && sub === "finished") routes = closedOf(history?.key === historyKey ? history.routes : [], "turbo").map((route) => ({ kind: "route", route }));
    else if (modality === "turbo" && sub === "tomorrow") routes = scheduled?.items ?? [];
    return { routes };
  }, [modality, sub, flexActive, turboActive, history, historyKey, scheduled]);

  if (loading && currentRows.length === 0 && !w) {
    return (
      <View style={styles.center}>
        <ThemedStatusBar />
        <LynxPulseLoader message="Cargando envíos..." />
      </View>
    );
  }

  const modalities: { key: ModalityKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    ...(turboVisible ? [{ key: "turbo" as const, label: "Turbo", icon: "flash-outline" as const }] : []),
    { key: "flex", label: "Flex", icon: "cube-outline" },
    { key: "baul", label: "Baúl", icon: "briefcase-outline" },
    { key: "tradicional", label: "Tradicionales", icon: "mail-outline" },
  ];

  const routesBlock = () => {
    const isCurrent = sub === "current";
    const showsRoutes = modality === "flex" || modality === "turbo";
    if (!showsRoutes) return null;
    const title =
      sub === "tomorrow" ? "Programados para mañana" : isCurrent ? "Recorridos abiertos" : "Recorridos finalizados";
    const loadingRoutes =
      sub === "tomorrow" ? !!scheduled?.loading : isCurrent ? work.loading && !w : !!history?.loading && history.key === historyKey;
    const groupsState = sub === "tomorrow" ? scheduled?.groupsState : isCurrent && modality === "turbo" ? w?.groupsState : undefined;
    const groupsError = sub === "tomorrow" ? scheduled?.groupsError : isCurrent && modality === "turbo" ? w?.groupsError : null;
    const routeError = sub === "tomorrow" ? scheduled?.error : isCurrent ? work.error : history?.key === historyKey ? history?.error : null;
    const failedDays = isCurrent ? w?.failedDays ?? [] : sub === "finished" && history?.key === historyKey ? history.failedDays : [];
    // Envíos que el servidor puso en un recorrido sin ese recorrido a la vista: se avisa, no se esconde.
    const activeOfModality = modality === "flex" ? flexActive : turboActive;
    const rowsOfModality = modality === "flex" ? flexRows : turboRows;
    const missingRoutes = isCurrent && w && activeOfModality.length === 0 ? deliveriesInRoute(rowsOfModality.filter((r) => !isFinalizado(r))) : 0;
    // En curso es el día operativo de hoy. Un recorrido de un día anterior que
    // sigue abierto (el cierre de medianoche no corrió) no se esconde: va
    // aparte y con aviso, para cerrarlo o avisar a coordinación.
    const itemDate = (it: WorkItem) => (it.kind === "group" ? it.group.scheduled_date : it.route.scheduled_date);
    const todays = isCurrent ? view.routes.filter((it) => itemDate(it) >= today) : view.routes;
    const older = isCurrent ? view.routes.filter((it) => itemDate(it) < today) : [];
    const card = (it: WorkItem) => (
      <WorkItemCard
        key={it.kind === "group" ? `g${it.group.id}` : `r${it.route.id}`}
        item={it}
        onPress={() => openItem(it)}
        extra={isCurrent && itemDate(it) < today ? `Abierto desde ${dayLabel(itemDate(it), today)}` : null}
      />
    );

    return (
      <View style={styles.block}>
        <Text style={styles.blockTitle}>{title}</Text>

        {routeError ? (
          <Notice tone="error" text={routeError} action="Reintentar" onAction={sub === "tomorrow" ? loadScheduled : isCurrent ? work.refresh : loadHistory} />
        ) : null}
        {groupsError ? <Notice tone="error" text={groupsError} /> : null}
        {groupsState === "unsupported" ? (
          <Notice tone="info" text="El servidor todavía no agrupa los Turbos: se muestran de a uno." />
        ) : null}
        {failedDays.length ? (
          <Notice
            tone="warning"
            text={`No pudimos revisar ${failedDays.length === 1 ? "un día" : `${failedDays.length} días`}: puede haber recorridos que no se ven.`}
            action="Reintentar"
            onAction={isCurrent ? work.refresh : loadHistory}
          />
        ) : null}
        {sub === "finished" && history?.key === historyKey && history.tooLong ? (
          <Notice tone="info" text={`Para ver recorridos, elegí hasta ${HISTORY_MAX_DAYS} días. Los envíos del rango se ven abajo.`} />
        ) : null}
        {missingRoutes ? (
          <Notice
            tone="warning"
            text={`Tenés ${missingRoutes === 1 ? "un envío" : `${missingRoutes} envíos`} en recorrido y no encontramos su recorrido abierto. Actualizá y, si sigue igual, avisale a coordinación.`}
            action="Actualizar"
            onAction={work.refresh}
          />
        ) : null}

        {loadingRoutes ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.text.accent} />
            <Text style={styles.muted}>Cargando recorridos…</Text>
          </View>
        ) : todays.length ? (
          todays.map(card)
        ) : !routeError && !missingRoutes ? (
          <Text style={styles.muted}>
            {sub === "tomorrow"
              ? "No tenés Turbos programados para mañana."
              : isCurrent
              ? modality === "turbo" ? "No tenés Turbos en curso hoy." : "No tenés recorridos de reparto abiertos hoy."
              : "No hay recorridos finalizados en este período."}
          </Text>
        ) : null}

        {!loadingRoutes && older.length ? (
          <>
            <Notice
              tone="warning"
              text={`${older.length === 1 ? "Quedó abierto un recorrido" : `Quedaron abiertos ${older.length} recorridos`} de días anteriores. Cerralo si terminaste o avisale a coordinación.`}
            />
            {older.map(card)}
          </>
        ) : null}

        {modality === "turbo" && isCurrent && loadTotal(w?.turboLoad) ? (
          <Text style={styles.muted}>Turbos que llevás: {loadText(w?.turboLoad)}</Text>
        ) : null}

        {/* Tomar programados pide habilitación Turbo: sin ella solo se ven los suyos. */}
        {sub === "tomorrow" && w?.turboEnabled !== false ? (
          <Pressable style={styles.linkRow} onPress={() => navigation.navigate("TurboTomorrowScreen")} accessibilityRole="button">
            <Ionicons name="add-circle-outline" size={18} color={theme.text.accent} />
            <Text style={styles.linkRowText}>Tomar Turbos de mañana disponibles</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
          </Pressable>
        ) : null}

      </View>
    );
  };

  const periodChips = () => {
    if (sub !== "finished") return null;
    const options: Period[] = [{ kind: "today" }, { kind: "yesterday" }, { kind: "week" }];
    const isRange = period.kind === "range";
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent} style={styles.filtersBox}>
        {options.map((p) => {
          const active = period.kind === p.kind;
          return (
            <Pressable key={p.kind} onPress={() => setPeriod(p)} style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{periodLabel(p)}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            setDraft(isRange ? { from: period.from, to: period.to } : { from: null, to: null });
            setCalendarOpen(true);
          }}
          style={[styles.filterChip, isRange && styles.filterChipActive]}
        >
          <Ionicons name="calendar-outline" size={14} color={isRange ? theme.text.onPrimary : theme.text.muted} />
          <Text style={[styles.filterChipText, isRange && styles.filterChipTextActive]}>{isRange ? periodLabel(period) : "Rango"}</Text>
        </Pressable>
      </ScrollView>
    );
  };

  const bottomSpace = missions.length ? CONTINUE_BAR_SPACE : 0;

  return (
    <View style={styles.screen}>
      <ThemedStatusBar />
      <View style={styles.header}>
        <View style={styles.topLine}>
          <View style={styles.flex}>
            <Text style={styles.kicker}>DRIVER</Text>
            <Text style={styles.title}>Envíos</Text>
          </View>

        </View>

        {/* Las modalidades en una fila de anchos iguales: todas a la vista, sin
            scroll ni etiquetas cortadas. */}
        <View style={styles.modalities} accessibilityRole="tablist">
          {modalities.map((m) => {
            const active = modality === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => pickModality(m.key)}
                style={[styles.modalityChip, active && styles.modalityChipActive]}
                accessibilityRole="tab"
                accessibilityLabel={m.label}
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={m.icon} size={16} color={active ? theme.text.onPrimary : theme.text.muted} />
                <Text style={[styles.modalityText, active && styles.modalityTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Las ofertas se contestan en Alertas: acá solo el aviso, y de las de esta pestaña
            (Turbo: ofertas Turbo; Flex: recorridos ofrecidos; Baúl y Tradicionales: ninguna). */}
        {tabOffers ? (
          <Pressable onPress={() => openOfferInbox(navigation)} style={styles.offersHint} accessibilityRole="button" hitSlop={6}>
            <Ionicons name="pricetags-outline" size={14} color={theme.text.accent} />
            <Text style={styles.offersHintText}>
              {tabOffers === 1 ? `Tenés ${tabOfferWhat.one} sin contestar` : `Tenés ${tabOffers > 99 ? "99+" : tabOffers} ${tabOfferWhat.many} sin contestar`}: ver en Alertas
            </Text>
          </Pressable>
        ) : null}

        {modality === "turbo" || modality === "flex" ? (
          <View style={styles.segmented}>
            {SUBS[modality].map((s) => (
              <SegmentButton key={s.key} active={sub === s.key} icon={s.icon} label={s.label} onPress={() => setSub(s.key)} />
            ))}
          </View>
        ) : null}

        {periodChips()}
      </View>

      {modality === "baul" ? (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: 124 + bottomSpace }]}
          refreshControl={<RefreshControl refreshing={baulRefreshing} onRefresh={reloadBaul} tintColor={theme.colors.primary} />}
        >
          {baul?.status === "ok" ? (
            <BaulPanel baul={baul.baul} />
          ) : baul?.status === "unsupported" ? (
            <InfoPanel
              icon="briefcase-outline"
              title="Baúl"
              text="Pronto vas a ver acá lo que tenés en el Baúl: cobranzas por rendir, paquetes y cambios para devolver. Por ahora, consultalo con coordinación o en planta."
              tag="Función pendiente"
            />
          ) : baul?.status === "error" ? (
            <InfoPanel icon="briefcase-outline" title="Baúl" text={`${baul.message} Deslizá hacia abajo para reintentar.`} tag="Sin datos" />
          ) : (
            <InfoPanel icon="briefcase-outline" title="Baúl" text="Cargando…" tag="Baúl" />
          )}
        </ScrollView>
      ) : modality === "tradicional" ? (
        <ScrollView contentContainerStyle={[styles.listContent, { paddingBottom: 124 + bottomSpace }]}>
          <InfoPanel
            icon="mail-outline"
            title="Envíos tradicionales"
            text="Los envíos tradicionales todavía no se operan desde la app. Cuando estén disponibles, los vas a ver acá."
            tag="Próximamente"
          />
        </ScrollView>
      ) : (
        // Solo recorridos: cada envío se ve dentro del suyo (al tocar el recorrido).
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: 124 + bottomSpace }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        >
          {routesBlock()}
        </ScrollView>
      )}

      <ContinueBar missions={missions} onOpen={openMission} onSeeAll={() => goToDriverTab(navigation, "home")} />

      <DriverBottomNavigation activeTab="deliveries" />

      <Modal visible={calendarOpen} transparent animationType="fade" onRequestClose={() => setCalendarOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCalendarOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <ModalHeader title="Seleccionar rango" onClose={() => setCalendarOpen(false)} />

            <View style={styles.modalBody}>
              <Pressable style={styles.dateBtn} onPress={() => setPicker("FROM")}>
                <Text style={styles.dateBtnText}>Desde: {fmtDate(draft.from)}</Text>
              </Pressable>

              {picker === "FROM" && (
                <DateTimePicker
                  value={draft.from ? dateOf(draft.from) : new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  onChange={(_, d) => {
                    setPicker(null);
                    if (d) setDraft((x) => ({ ...x, from: isoOf(d) }));
                  }}
                />
              )}

              <Pressable style={styles.dateBtn} onPress={() => setPicker("TO")}>
                <Text style={styles.dateBtnText}>Hasta: {fmtDate(draft.to)}</Text>
              </Pressable>

              {picker === "TO" && (
                <DateTimePicker
                  value={draft.to ? dateOf(draft.to) : new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  onChange={(_, d) => {
                    setPicker(null);
                    if (d) setDraft((x) => ({ ...x, to: isoOf(d) }));
                  }}
                />
              )}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.primaryBtn, styles.modalActionBtn, !(draft.from && draft.to) && styles.iconButtonDisabled]}
                disabled={!(draft.from && draft.to)}
                onPress={() => {
                  if (draft.from && draft.to) setPeriod({ kind: "range", from: draft.from, to: draft.to });
                  setCalendarOpen(false);
                }}
              >
                <Text style={styles.primaryBtnText}>Aplicar</Text>
              </Pressable>

              <Pressable style={[styles.secondaryBtn, styles.modalActionBtn]} onPress={() => setCalendarOpen(false)}>
                <Text style={styles.secondaryBtnText}>Cancelar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const Notice = ({
  tone,
  text,
  action,
  onAction,
}: {
  tone: "error" | "warning" | "info";
  text: string;
  action?: string;
  onAction?: () => void;
}) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const t = tone === "error" ? theme.status.rejected : tone === "warning" ? theme.status.pending : theme.status.inTransit;
  return (
    <View style={[styles.notice, { backgroundColor: t.background, borderColor: t.border }]} accessibilityRole={tone === "error" ? "alert" : undefined}>
      <Ionicons name={tone === "info" ? "information-circle-outline" : "warning-outline"} size={16} color={t.icon} />
      <Text style={styles.noticeText}>{text}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={styles.noticeAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const InfoPanel = ({ icon, title, text, tag }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; tag: string }) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[theme.card, styles.info]}>
      <Ionicons name={icon} size={34} color={theme.text.accent} />
      <Text style={styles.infoTitle}>{title}</Text>
      <View style={styles.infoTag}>
        <Text style={styles.infoTagText}>{tag}</Text>
      </View>
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
};

const SegmentButton = ({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, active && styles.segmentButtonActive]} accessibilityState={{ selected: active }}>
      <Ionicons name={icon} size={14} color={active ? theme.text.onPrimary : theme.text.muted} />
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
};

const ModalHeader = ({ title, onClose }: { title: string; onClose: () => void }) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.modalHeader}>
      <Text style={styles.modalTitle}>{title}</Text>

      <Pressable onPress={onClose} style={styles.closeBtn}>
        <Ionicons name="close" size={18} color={theme.text.primary} />
      </Pressable>
    </View>
  );
};

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.surfaces.screen },
  flex: { flex: 1 },
  center: { flex: 1, backgroundColor: t.surfaces.screen, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  header: { paddingTop: global.SIZES.statusBarHeight + 14, paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.sm },
  topLine: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: t.spacing.md },
  kicker: { ...t.typography.kicker, marginBottom: 4 },
  title: { color: t.text.primary, fontSize: 30, lineHeight: 34, fontWeight: t.font.weight.black, letterSpacing: -1 },
  iconButtonDisabled: { opacity: 0.58 },
  offersHint: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 28, marginTop: -4, marginBottom: t.spacing.sm },
  offersHintText: { color: t.text.accent, fontSize: 13, fontWeight: t.font.weight.bold },
  modalities: { flexDirection: "row", gap: 6, marginBottom: t.spacing.md },
  modalityChip: { flex: 1, minHeight: 52, paddingHorizontal: 4, paddingVertical: 6, borderRadius: t.radius.md, alignItems: "center", justifyContent: "center", gap: 2, backgroundColor: t.surfaces.muted, borderWidth: 1, borderColor: t.borders.soft },
  modalityChipActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  modalityText: { color: t.text.muted, fontSize: 12, fontWeight: t.font.weight.black },
  modalityTextActive: { color: t.text.onPrimary },
  segmented: { flexDirection: "row", padding: 4, borderRadius: t.radius.full, backgroundColor: t.surfaces.muted, borderWidth: 1, borderColor: t.borders.soft, marginBottom: t.spacing.sm },
  segmentButton: { flex: 1, minHeight: 38, borderRadius: t.radius.full, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4, paddingHorizontal: 4 },
  segmentButtonActive: { backgroundColor: t.colors.primary },
  segmentText: { color: t.text.muted, fontSize: 11, fontWeight: t.font.weight.black },
  segmentTextActive: { color: t.text.onPrimary },
  block: { marginBottom: t.spacing.sm, gap: 8 },
  blockTitle: { ...t.typography.kicker, marginTop: t.spacing.sm },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  muted: { color: t.text.secondary, fontSize: 13, lineHeight: 18 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, paddingHorizontal: t.spacing.md, minHeight: 44, borderRadius: t.radius.lg, backgroundColor: t.surfaces.muted, borderWidth: 1, borderColor: t.borders.soft },
  linkRowText: { flex: 1, color: t.text.primary, fontSize: 14, fontWeight: "600" },
  notice: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, padding: t.spacing.md, borderRadius: t.radius.lg, borderWidth: 1 },
  noticeText: { flex: 1, color: t.text.primary, fontSize: 12, lineHeight: 17, fontWeight: t.font.weight.bold },
  noticeAction: { color: t.text.accent, fontSize: 12, fontWeight: t.font.weight.black },
  filtersBox: { flexGrow: 0, marginTop: 2 },
  filtersContent: { gap: t.spacing.sm, paddingRight: t.spacing.lg },
  filterChip: { height: 38, paddingHorizontal: 13, borderRadius: t.radius.full, backgroundColor: t.surfaces.muted, borderWidth: 1, borderColor: t.borders.soft, flexDirection: "row", alignItems: "center", gap: 6 },
  filterChipActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  filterChipText: { color: t.text.muted, fontSize: 12, fontWeight: t.font.weight.black },
  filterChipTextActive: { color: t.text.onPrimary },
  listContent: { paddingHorizontal: t.spacing.lg, paddingBottom: 124 },
  info: { alignItems: "center", gap: 10, padding: t.spacing.xl, marginTop: t.spacing.md },
  infoTitle: { color: t.text.primary, fontSize: 20, fontWeight: t.font.weight.black },
  infoTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: t.status.pending.border, backgroundColor: t.status.pending.background },
  infoTagText: { color: t.status.pending.text, fontSize: 11, fontWeight: t.font.weight.black },
  infoText: { color: t.text.secondary, fontSize: 14, lineHeight: 20, textAlign: "center" },
  backdrop: { flex: 1, backgroundColor: t.overlays.camera, padding: 20, justifyContent: "center" },
  modalCard: { borderRadius: t.radius.xxl, padding: t.spacing.lg, backgroundColor: t.surfaces.screenAlt, borderWidth: 1, borderColor: t.borders.default },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: t.spacing.md },
  modalTitle: { color: t.text.primary, fontSize: 18, fontWeight: t.font.weight.black, letterSpacing: -0.4 },
  closeBtn: { width: 34, height: 34, borderRadius: t.radius.full, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaces.card, borderWidth: 1, borderColor: t.borders.soft },
  modalBody: { gap: t.spacing.sm, marginBottom: t.spacing.md },
  primaryBtn: { backgroundColor: t.colors.primary, borderRadius: t.radius.lg, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: t.text.onPrimary, fontWeight: t.font.weight.black },
  secondaryBtn: { borderRadius: t.radius.lg, paddingVertical: 14, alignItems: "center", backgroundColor: t.surfaces.muted, borderWidth: 1, borderColor: t.borders.default },
  secondaryBtnText: { color: t.text.primary, fontWeight: t.font.weight.black },
  dateBtn: { paddingVertical: 14, paddingHorizontal: 14, backgroundColor: t.surfaces.card, borderWidth: 1, borderColor: t.borders.default, borderRadius: t.radius.lg, alignItems: "center" },
  dateBtnText: { color: t.text.primary, fontWeight: t.font.weight.bold },
  modalActions: { flexDirection: "row", gap: t.spacing.sm },
  modalActionBtn: { flex: 1 },
});

export default EnviosScreen;
