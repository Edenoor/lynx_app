// src/Presentation/views/driver/Envios/EnviosScreen.tsx
// Envíos del chofer por modalidad logística:
//   Turbo (si está habilitado o tiene Turbos): en curso, finalizados y
//     programados para mañana.
//   Flex: recorridos de reparto abiertos (también de días anteriores) y sus
//     envíos; finalizados por día o rango; el historial legacy (/v1).
//   Baúl: lo que el chofer tiene que rendir o devolver (GET /v2/baul/me).
//   Envíos tradicionales: próximamente.
// Arriba, la bandeja de ofertas con su contador; abajo, «Continuar» si hay un
// recorrido en la calle. Los recorridos se leen de workSource (compartido con
// Inicio); los envíos, del ViewModel de siempre.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  View,
  Text,
  FlatList,
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
import { File, Paths } from "expo-file-system/next";

import useEnviosViewModel from "./ViewModel";
import { classifyDelivery, deliveryKey } from "./deliveryState";
import { fetchMyBaul, BaulResult } from "./baulSource";
import BaulPanel from "./BaulPanel";
import { ApiDelivery } from "../../../../Data/sources/remote/api/ApiDelivery";
import global from "../../../theme/global";
import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import { LynxPulseLoader } from "../../../components/LynxPulseLoader";
import { DriverDeliveryStatCard } from "../../../components/driver/DriverDeliveryStatCard";
import { DriverDeliveryCard } from "../../../components/driver/DriverDeliveryCard";
import { DriverDeliveryDetailModal } from "../../../components/driver/DriverDeliveryDetailModal";
import WorkItemCard from "../../../components/driver/WorkItemCard";
import ContinueBar, { CONTINUE_BAR_SPACE } from "../../../components/driver/ContinueBar";
import {
  DriverBottomNavigation,
  DriverTabKey,
} from "../../../components/DriverBottomNavigation";
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
import { openOfferInbox, refreshOfferCount, useOfferCount } from "../offers/offerStore";
import { RouteSummary, tomorrowIso } from "../routes/routesApi";
import { loadText, loadTotal } from "../turbo/turboGroup";
import { errorMessage } from "../errorMessage";

type ModalityKey = "turbo" | "flex" | "baul" | "tradicional";
type SubKey = "current" | "finished" | "tomorrow" | "legacy";

const SUBS: Record<"turbo" | "flex", { key: SubKey; label: string; icon: keyof typeof Ionicons.glyphMap }[]> = {
  turbo: [
    { key: "current", label: "En curso", icon: "flash-outline" },
    { key: "finished", label: "Finalizados", icon: "checkmark-circle-outline" },
    { key: "tomorrow", label: "Mañana", icon: "calendar-outline" },
  ],
  flex: [
    { key: "current", label: "En curso", icon: "flash-outline" },
    { key: "finished", label: "Finalizados", icon: "checkmark-circle-outline" },
    { key: "legacy", label: "Historial", icon: "archive-outline" },
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

const n = (v: any) => {
  const x = Number(v ?? 0);
  return Number.isNaN(x) ? 0 : x;
};

const fmtMoney = (v: any) => `$${n(v).toLocaleString("es-AR")}`;

const buildExcelFileName = (username?: string | null) => {
  const cleanName = String(username || "driver")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `envios_${cleanName || "driver"}.xlsx`;
};

const tryParseDate = (s?: string | null): Date | null => {
  if (!s) return null;

  const trimmed = String(s).trim();
  const iso = new Date(trimmed);
  if (!isNaN(iso.getTime())) return iso;

  const m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);

  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const y = Number(m[3]!.length === 2 ? `20${m[3]}` : m[3]);
    const dt = new Date(y, mo, d);
    if (!isNaN(dt.getTime())) return dt;
  }

  return null;
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

const inDays = (item: Envio, days: string[] | null) => {
  if (!days) return true;
  const d = tryParseDate(getDateValue(item));
  return !!d && days.includes(isoOf(d));
};

const netoChofer = (it?: Envio | null) => {
  if (!it) return 0;

  if (it.neto_chofer !== undefined && it.neto_chofer !== null) {
    return n(it.neto_chofer);
  }

  const precio = n(it.precio_chofer);
  const pRaw = n(it.porcentaje_chofer);
  const factor = pRaw > 1 ? 1 - pRaw / 100 : 1 - pRaw;

  return Math.round(precio * factor * 100) / 100;
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
  const {
    list,
    currentDeliveries,
    loading,
    error,
    currentError,
    reload,
    username,
  } = useEnviosViewModel();
  const work = useDriverWork();
  const offerCount = useOfferCount();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const legacyRows = useMemo(
    () => ((list || []).filter(Boolean) as Envio[]),
    [list]
  );

  const currentRows = useMemo(
    () =>
      ((currentDeliveries || []).filter(Boolean) as any[]).map(
        normalizeCurrentDelivery
      ),
    [currentDeliveries]
  );

  const [refreshing, setRefreshing] = useState(false);
  const [modality, setModality] = useState<ModalityKey>("flex");
  const [picked, setPicked] = useState(false);
  const [sub, setSub] = useState<SubKey>("current");
  const [finishedPeriod, setFinishedPeriod] = useState<Period>({ kind: "today" });
  const [legacyPeriod, setLegacyPeriod] = useState<Period>({ kind: "all" });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draft, setDraft] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [picker, setPicker] = useState<null | "FROM" | "TO">(null);

  const [selected, setSelected] = useState<Envio | null>(null);
  const [showTotals, setShowTotals] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  const [history, setHistory] = useState<History | null>(null);
  const [scheduled, setScheduled] = useState<Scheduled | null>(null);
  const [baul, setBaul] = useState<BaulResult | null>(null);

  const w = work.work;
  const today = w?.today ?? isoOf(new Date());
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

  const period = sub === "legacy" ? legacyPeriod : finishedPeriod;
  const setPeriod = sub === "legacy" ? setLegacyPeriod : setFinishedPeriod;
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

  useEffect(() => {
    if (modality === "baul" && !baul) void fetchMyBaul().then(setBaul);
  }, [modality, baul]);

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

  const handleDownloadWeeklyExcel = useCallback(async () => {
    if (!username) {
      Alert.alert(
        "No se puede descargar",
        "No encontramos el nombre legacy del chofer en la sesión."
      );
      return;
    }

    if (downloadingExcel) return;

    try {
      setDownloadingExcel(true);

      const Sharing = await import("expo-sharing");

      const response = await ApiDelivery.post(
        "/v1/data/driver/print",
        { username },
        {
          responseType: "arraybuffer",
          headers: {
            Accept:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        }
      );

      const fileName = buildExcelFileName(username);
      const file = new File(Paths.cache, fileName);
      const bytes = new Uint8Array(response.data);

      await file.write(bytes);

      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        Alert.alert(
          "Excel generado",
          "El archivo se generó correctamente, pero este dispositivo no permite compartirlo desde la app."
        );
        return;
      }

      await Sharing.shareAsync(file.uri, {
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Descargar Excel semanal",
        UTI: "com.microsoft.excel.xlsx",
      });
    } catch (e: any) {
      const message =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "No se pudo descargar el Excel semanal.";

      Alert.alert("Error descargando Excel", message);
    } finally {
      setDownloadingExcel(false);
    }
  }, [downloadingExcel, username]);

  const handleTabPress = useCallback(
    (tabKey: DriverTabKey) => {
      if (tabKey === "deliveries") return;

      if (tabKey === "home") {
        navigation.navigate("DriverScreen");
        return;
      }

      if (tabKey === "scan") {
        navigation.navigate("DriverScanOptionsScreen");
        return;
      }

      if (tabKey === "activity") {
        navigation.navigate("NotificationsScreen");
      }
    },
    [navigation]
  );

  const openItem = (it: WorkItem) =>
    it.kind === "group"
      ? navigation.navigate("TurboGroupScreen", { groupId: it.group.id })
      : navigation.navigate("RouteDetailScreen", { routeId: it.route.id });
  const openMission = (m: Mission) => navigation.navigate(m.target.screen, m.target.params);

  // ---------- Lo que muestra la vista elegida ----------

  const view = useMemo(() => {
    const deliveriesView = modality === "flex" || (modality === "turbo" && sub === "finished");
    let rows: Envio[] = [];
    let routes: WorkItem[] = [];
    if (modality === "flex" && sub === "current") {
      rows = flexRows.filter((r) => !isFinalizado(r));
      routes = flexActive;
    } else if (modality === "flex" && sub === "finished") {
      rows = flexRows.filter(isFinalizado).filter((r) => inDays(r, days));
      routes = closedOf(history?.key === historyKey ? history.routes : [], "flex").map((route) => ({ kind: "route", route }));
    } else if (modality === "flex" && sub === "legacy") {
      rows = legacyRows.filter((r) => inDays(r, days));
    } else if (modality === "turbo" && sub === "current") {
      routes = turboActive;
    } else if (modality === "turbo" && sub === "finished") {
      rows = turboRows.filter(isFinalizado).filter((r) => inDays(r, days));
      routes = closedOf(history?.key === historyKey ? history.routes : [], "turbo").map((route) => ({ kind: "route", route }));
    } else if (modality === "turbo" && sub === "tomorrow") {
      routes = scheduled?.items ?? [];
    }
    return { rows, routes, showStats: deliveriesView && rows.length > 0 };
  }, [modality, sub, flexRows, flexActive, legacyRows, turboActive, turboRows, days, history, historyKey, scheduled]);

  const visibleTotals = useMemo(() => {
    const states = view.rows.map(classifyDelivery);
    return {
      totalEnvios: view.rows.length,
      entregados: states.filter((s) => s.phase === "delivered").length,
      pendientes: states.filter((s) => !s.finished).length,
      atencion: states.filter((s) => s.attention).length,
      montoBruto: view.rows.reduce((acc, it) => acc + n(it.precio_chofer), 0),
      netoFinal: view.rows.reduce((acc, it) => acc + netoChofer(it), 0),
    };
  }, [view.rows]);

  if (loading && legacyRows.length === 0 && currentRows.length === 0 && !w) {
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
    const showsRoutes = (modality === "flex" || modality === "turbo") && sub !== "legacy";
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
            text={`Tenés ${missingRoutes === 1 ? "un envío" : `${missingRoutes} envíos`} en recorrido y no encontramos el recorrido abierto en los días revisados.`}
            action="Buscar más atrás"
            onAction={work.searchFurtherBack}
          />
        ) : null}

        {loadingRoutes ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.text.accent} />
            <Text style={styles.muted}>Cargando recorridos…</Text>
          </View>
        ) : view.routes.length ? (
          view.routes.map((it) => (
            <WorkItemCard
              key={it.kind === "group" ? `g${it.group.id}` : `r${it.route.id}`}
              item={it}
              onPress={() => openItem(it)}
              extra={it.kind === "route" && isCurrent && it.route.scheduled_date < today ? `Abierto desde ${dayLabel(it.route.scheduled_date, today)}` : null}
            />
          ))
        ) : !routeError && !missingRoutes ? (
          <Text style={styles.muted}>
            {sub === "tomorrow"
              ? "No tenés Turbos programados para mañana."
              : isCurrent
              ? modality === "turbo" ? "No tenés Turbos en curso." : "No tenés recorridos de reparto abiertos."
              : "No hay recorridos finalizados en este período."}
          </Text>
        ) : null}

        {isCurrent && w?.checkedFrom ? (
          <View style={styles.lookback}>
            <Text style={styles.muted}>Revisamos recorridos abiertos desde {dayLabel(w.checkedFrom, today)}.</Text>
            <Pressable onPress={work.searchFurtherBack} hitSlop={8} accessibilityRole="button">
              <Text style={styles.link}>Buscar más atrás</Text>
            </Pressable>
          </View>
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

        {modality === "flex" || sub === "finished" ? (
          <Text style={[styles.blockTitle, styles.blockTitleSpaced]}>Envíos</Text>
        ) : null}
      </View>
    );
  };

  const periodChips = () => {
    if (!(sub === "finished" || sub === "legacy")) return null;
    const options: Period[] = sub === "legacy" ? [{ kind: "all" }, { kind: "today" }] : [{ kind: "today" }, { kind: "yesterday" }];
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

  const listHeader = (
    <View>
      {routesBlock()}
      {view.showStats ? (
        <View style={styles.statsGrid}>
          <DriverDeliveryStatCard
            neto={fmtMoney(visibleTotals.netoFinal)}
            entregados={visibleTotals.entregados}
            pendientes={visibleTotals.pendientes}
            atencion={visibleTotals.atencion}
            onPressNeto={() => setShowTotals(true)}
          />
        </View>
      ) : null}
      {(modality === "flex" && sub !== "legacy" && currentError) || (modality === "turbo" && sub === "finished" && currentError) ? (
        <Notice tone="error" text={currentError} />
      ) : null}
      {modality === "flex" && sub === "legacy" && error ? <Notice tone="error" text={error} /> : null}
    </View>
  );

  const deliveriesEmpty =
    modality === "flex" || (modality === "turbo" && sub === "finished") ? (
      <View style={styles.emptyBox}>
        <Ionicons name="file-tray-outline" size={30} color={theme.text.muted} />
        <Text style={styles.emptyTitle}>
          {sub === "current" ? "No hay envíos en curso" : sub === "legacy" ? "No hay envíos en el historial" : "No hay envíos finalizados"}
        </Text>
        <Text style={styles.emptyText}>
          {sub === "current" ? "Cuando te asignen envíos, aparecen acá." : "Probá con otro período o actualizá la pantalla."}
        </Text>
      </View>
    ) : null;

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

          <View style={styles.headerActions}>
            {modality === "flex" && sub === "legacy" ? (
              <Pressable
                style={[styles.iconButton, styles.downloadButton, downloadingExcel && styles.iconButtonDisabled]}
                onPress={handleDownloadWeeklyExcel}
                disabled={downloadingExcel}
                accessibilityLabel="Descargar Excel semanal"
              >
                <Ionicons name={downloadingExcel ? "hourglass-outline" : "download-outline"} size={19} color={theme.text.onPrimary} />
              </Pressable>
            ) : null}
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

        {/* Las ofertas se contestan en Alertas: acá solo el aviso. */}
        {offerCount ? (
          <Pressable onPress={() => openOfferInbox(navigation)} style={styles.offersHint} accessibilityRole="button" hitSlop={6}>
            <Ionicons name="pricetags-outline" size={14} color={theme.text.accent} />
            <Text style={styles.offersHintText}>
              {offerCount === 1 ? "Tenés una oferta sin contestar" : `Tenés ${offerCount > 99 ? "99+" : offerCount} ofertas sin contestar`}: ver en Alertas
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
        <FlatList
          data={view.rows}
          keyExtractor={deliveryKey}
          contentContainerStyle={[styles.listContent, { paddingBottom: 124 + bottomSpace }]}
          ListHeaderComponent={listHeader}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          renderItem={({ item }) => {
            if (!item) return null;
            return <DriverDeliveryCard delivery={item} onPress={() => setSelected(item)} />;
          }}
          ListEmptyComponent={deliveriesEmpty}
        />
      )}

      <ContinueBar missions={missions} onOpen={openMission} onSeeAll={() => navigation.navigate("DriverScreen")} />

      <DriverBottomNavigation activeTab="deliveries" onPress={handleTabPress} />

      <DriverDeliveryDetailModal visible={!!selected} delivery={selected} onClose={() => setSelected(null)} />

      <Modal visible={showTotals} transparent animationType="fade" onRequestClose={() => setShowTotals(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowTotals(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <ModalHeader title="Totales visibles" onClose={() => setShowTotals(false)} />

            <View style={styles.modalBody}>
              <Row label="Envíos" value={String(visibleTotals.totalEnvios)} />
              <Row label="Entregados" value={String(visibleTotals.entregados)} />
              <Row label="Pendientes" value={String(visibleTotals.pendientes)} />
              <Row label="Atención" value={String(visibleTotals.atencion)} />
              <Row label="Bruto chofer" value={fmtMoney(visibleTotals.montoBruto)} />
              <Row label="Neto chofer" value={fmtMoney(visibleTotals.netoFinal)} />
            </View>

            <Pressable style={styles.primaryBtn} onPress={() => setShowTotals(false)}>
              <Text style={styles.primaryBtnText}>Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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

const Row = ({ label, value }: { label: string; value?: string | null }) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.rowLine}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={3}>
        {value ?? "—"}
      </Text>
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
  headerActions: { flexDirection: "row", gap: t.spacing.sm, alignItems: "center" },
  iconButton: { width: 42, height: 42, borderRadius: t.radius.full, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaces.card, borderWidth: 1, borderColor: t.borders.default },
  downloadButton: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
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
  blockTitleSpaced: { marginTop: t.spacing.md },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  muted: { color: t.text.secondary, fontSize: 13, lineHeight: 18 },
  lookback: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  link: { color: t.text.accent, fontSize: 13, fontWeight: t.font.weight.black },
  linkRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, paddingHorizontal: t.spacing.md, minHeight: 44, borderRadius: t.radius.lg, backgroundColor: t.surfaces.muted, borderWidth: 1, borderColor: t.borders.soft },
  linkRowText: { flex: 1, color: t.text.primary, fontSize: 14, fontWeight: "600" },
  notice: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, padding: t.spacing.md, borderRadius: t.radius.lg, borderWidth: 1 },
  noticeText: { flex: 1, color: t.text.primary, fontSize: 12, lineHeight: 17, fontWeight: t.font.weight.bold },
  noticeAction: { color: t.text.accent, fontSize: 12, fontWeight: t.font.weight.black },
  statsGrid: { marginVertical: t.spacing.sm },
  filtersBox: { flexGrow: 0, marginTop: 2 },
  filtersContent: { gap: t.spacing.sm, paddingRight: t.spacing.lg },
  filterChip: { height: 38, paddingHorizontal: 13, borderRadius: t.radius.full, backgroundColor: t.surfaces.muted, borderWidth: 1, borderColor: t.borders.soft, flexDirection: "row", alignItems: "center", gap: 6 },
  filterChipActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  filterChipText: { color: t.text.muted, fontSize: 12, fontWeight: t.font.weight.black },
  filterChipTextActive: { color: t.text.onPrimary },
  listContent: { paddingHorizontal: t.spacing.lg, paddingBottom: 124 },
  emptyBox: { paddingTop: 28, alignItems: "center" },
  emptyTitle: { color: t.text.primary, fontSize: 16, fontWeight: t.font.weight.black, marginTop: t.spacing.md },
  emptyText: { color: t.text.muted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 6, paddingHorizontal: 26 },
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
  rowLine: { flexDirection: "row", alignItems: "flex-start", gap: t.spacing.md },
  rowLabel: { width: 112, color: t.text.muted, fontSize: 11, fontWeight: t.font.weight.black, textTransform: "uppercase" },
  rowValue: { flex: 1, color: t.text.primary, fontSize: 13, lineHeight: 18, fontWeight: t.font.weight.bold },
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
