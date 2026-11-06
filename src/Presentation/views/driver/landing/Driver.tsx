// src/Presentation/views/driver/DriverScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Linking,
  Modal,
  Switch,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StackScreenProps } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import useViewModel from "./ViewModel";
import useEnviosViewModel from "../Envios/ViewModel";
import { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import { postJson } from "../../../config/Api";
import { useNotifications } from "../../../context/NotificationContext";
import {
  setupPushAndRegisterDevice,
  attachNotificationListeners,
} from "../../../config/Push";
import {
  startDriverTracking,
  flushDriverPositions,
  readCurrentPosition,
  onTrackingChange,
} from "../../../config/DriverLocation";
import {
  acceptDeliveryAssignment,
  rejectDeliveryAssignment,
} from "./acceptApi";
import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import { confirmationNoticeText } from "../routes/collectionLabels";
import { todayIso } from "../routes/routesApi";
import {
  DriverBottomNavigation,
  DriverTabKey,
} from "../../../components/DriverBottomNavigation";
import DriverPerformanceCard from "../../../components/DriverPerformanceCard";
import { capNotice, loadTotal } from "../turbo/turboGroup";
import MissionCard from "../../../components/driver/MissionCard";
import DriverAvatar from "../../../components/driver/DriverAvatar";
import { loadDriverProfile, useDriverProfile } from "../account/driverProfileApi";
import { invalidateDriverWork, useDriverWork } from "../work/workSource";
import { offerNoticeText } from "../offers/offerInbox";
import { openOfferInbox, refreshOfferCount, setOfferTurboEnabled, showOfferNotice, useOfferCount } from "../offers/offerStore";
interface Props extends StackScreenProps<DriverStackParamList, "DriverScreen"> {}
type PendingAssignment = {
  deliveryId: string | number;
  tracking?: string | null;
  tienda?: string | null;
  direccion?: string | null;
  localidad?: string | null;
  provincia?: string | null;
  zona?: string | null;
};
type FeedbackModalState = {
  visible: boolean;
  type: "success" | "error" | "info";
  title: string;
  message: string;
};
const VEHICLE_KEYS_GUESS = [
  "vehicle",
  "vehiculo",
  "vehicleType",
  "tipo_vehiculo",
  "vehicle_type",
];
const getFirstWord = (value?: string | null): string => {
  if (!value || typeof value !== "string") return "";
  return value.trim().split(/\s+/)[0] || "";
};
const getDriverDisplayName = (user: any): string => {
  const firstName =
    getFirstWord(user?.first_name) ||
    getFirstWord(user?.firstName) ||
    getFirstWord(user?.name) ||
    getFirstWord(user?.username) ||
    getFirstWord(user?.email);
  return firstName || "driver";
};
const n = (value: any) => {
  const parsed = Number(value ?? 0);
  return Number.isNaN(parsed) ? 0 : parsed;
};
const fmtMoney = (value: any) => `$${n(value).toLocaleString("es-AR")}`;
const normalizeStatus = (estado?: string | null) =>
  String(estado ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
const isDelivered = (estado?: string | null) => {
  return normalizeStatus(estado).includes("entregado");
};
const isPending = (estado?: string | null) => {
  const status = normalizeStatus(estado);
  if (!status) return true;
  return !(
    status.includes("entregado") ||
    status.includes("reprogramado") ||
    status.includes("nadie") ||
    status.includes("cancel")
  );
};
const netoChofer = (item?: any | null) => {
  if (!item) return 0;
  const precio = n(item.precio_chofer);
  const pRaw = n(item.porcentaje_chofer);
  const factor = pRaw > 1 ? 1 - pRaw / 100 : 1 - pRaw;
  return Math.round(precio * factor * 100) / 100;
};
const DetailLine = ({
  label,
  value,
  force = false,
}: {
  label: string;
  value?: string | number | null;
  force?: boolean;
}) => {
  const styles = useThemedStyles(makeStyles);
  if (!force && !value) return null;
  return (
    <View style={styles.assignmentDetailRow}>
      <Text style={styles.assignmentDetailLabel}>{label}</Text>
      <Text style={styles.assignmentDetailValue}>
        {value ? String(value) : "—"}
      </Text>
    </View>
  );
};
export const DriverScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { user } = useViewModel();
  // La selfie del alta en el botón de perfil (una lectura por sesión).
  const driverProfile = useDriverProfile();
  useEffect(() => { loadDriverProfile((user as any)?.id); }, [(user as any)?.id]);
  const {
    list,
    loading: loadingLegacy,
    performanceAnalytics,
  } = useEnviosViewModel();
  const { add } = useNotifications();
  // Recorridos en la calle (misión activa): los mismos datos que Envíos,
  // leídos una vez. Las ofertas se ven en Alertas (contador en la barra).
  const { work } = useDriverWork();
  const missions = work?.missions ?? [];
  // Turbos que lleva hoy contra su tope (null: sin dato, un servidor anterior).
  const turboLoad = work?.turboLoad ?? null;
  const [turboOn, setTurboOn] = useState<boolean>(false);
  // null = todavía no se sabe; false = el coordinador no lo habilitó para turbos.
  const [turboEnabled, setTurboEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [turboPanelVisible, setTurboPanelVisible] = useState(false);
  const offerCount = useOfferCount();
  const mapRef = useRef<MapView>(null);
  const mapCentered = useRef(false);
  const [available] = useState<boolean>(true);
  // Modo en que quedó el seguimiento: si no es "background", se muestra un aviso fijo.
  // "forbidden": el servidor lo apagó con un 403 (sin ficha de chofer activa).
  // "paused": fuera del horario de trabajo; resumeAt es la hora en que vuelve.
  const [trackingMode, setTrackingMode] = useState<string | null>(null);
  const [resumeAt, setResumeAt] = useState<string | null>(null);
  // Posición real para el mapa: undefined = buscando, null = no disponible.
  const [myPosition, setMyPosition] = useState<
    { latitude: number; longitude: number } | null | undefined
  >(undefined);
  const insets = useSafeAreaInsets();
  const [pendingAssignment, setPendingAssignment] =
    useState<PendingAssignment | null>(null);
  const [assignmentActionLoading, setAssignmentActionLoading] = useState<
    "accept" | "reject" | null
  >(null);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    visible: false,
    type: "info",
    title: "",
    message: "",
  });
  useEffect(() => {
    if (!myPosition || mapCentered.current) return;
    mapCentered.current = true;
    mapRef.current?.animateToRegion({ ...myPosition, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 450);
  }, [myPosition]);
  const userId = (user as any)?.id;
  const username = (user as any)?.username || user?.email || user?.name || "";
  const driverDisplayName = useMemo(() => {
    return getDriverDisplayName(user);
  }, [user]);
  const legacyRows = useMemo(() => {
    return (list || []).filter(Boolean);
  }, [list]);
  const driverMetrics = useMemo(() => {
    const total = legacyRows.length;
    const delivered = legacyRows.filter((item) =>
      isDelivered(item?.estado)
    ).length;
    const closedOk =
      (performanceAnalytics?.eliteDeliveries ?? 0) +
      (performanceAnalytics?.post21Delivered ?? 0) +
      (performanceAnalytics?.post21Nobody ?? 0) +
      (performanceAnalytics?.post21Rescheduled ?? 0);
    const pending = legacyRows.filter((item) => isPending(item?.estado)).length;
    const neto = legacyRows.reduce((acc, item) => acc + netoChofer(item), 0);
    const effectiveness = total > 0 ? Math.round((closedOk / total) * 100) : 0;
    const score = total > 0 ? Math.round((effectiveness / 10) * 10) / 10 : 0;
    return {
      total,
      delivered,
      closedOk,
      pending,
      neto,
      effectiveness,
      score,
    };
  }, [legacyRows, performanceAnalytics]);
  const defaultVehicleType = useMemo(() => {
    const raw =
      VEHICLE_KEYS_GUESS.map((k) =>
        user && (user as any)[k] ? String((user as any)[k]) : ""
      ).find(Boolean) || "";
    const s = raw.toLowerCase();
    if (s.includes("moto") || s.includes("bike") || s.includes("moped")) {
      return "moto";
    }
    if (s.includes("auto") || s.includes("car")) {
      return "auto";
    }
    return "camioneta";
  }, [user]);
  const assignmentLocalidad =
    pendingAssignment?.localidad ||
    pendingAssignment?.provincia ||
    pendingAssignment?.zona ||
    null;
  const showFeedback = (
    type: FeedbackModalState["type"],
    title: string,
    message: string
  ) => {
    setFeedbackModal({
      visible: true,
      type,
      title,
      message,
    });
  };
  const closeFeedback = () => {
    setFeedbackModal((prev) => ({
      ...prev,
      visible: false,
    }));
  };
  const detachNotiRef = useRef<null | (() => void)>(null);
  useEffect(() => {
    if (!username || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        await setupPushAndRegisterDevice({
          userId,
          username,
          rol: "driver",
          vehicleType: defaultVehicleType,
        });
        if (cancelled) return;
        if (detachNotiRef.current) {
          detachNotiRef.current();
          detachNotiRef.current = null;
        }
        detachNotiRef.current = attachNotificationListeners({
          currentUser: { username, rol: "driver" },
          onAssignment: ({
            deliveryId,
            tracking,
            tienda,
            direccion,
            localidad,
            provincia,
            zona,
          }: any) => {
            setPendingAssignment({
              deliveryId,
              tracking,
              tienda,
              direccion,
              localidad,
              provincia,
              zona,
            });
          },
          onNewTrad: (tracking) => {
            if (!tracking) return;
            showFeedback(
              "info",
              "Nuevo envío cercano",
              `Tracking: ${tracking}`
            );
          },
          onAny: ({ kind, title, body, data }) => {
            add({ title, body, kind, data });
          },
          // Avisos de recorridos: al tocar la notificación se abre lo que
          // corresponde; con la app abierta solo se avisa, sin cambiarle la
          // pantalla en medio de un escaneo o una entrega.
          onRouteNotice: ({ kind, routeId, source, raw }) => {
            const nav = navigation as any;
            const isCollection = kind === "PICKUP_ASSIGNED" || kind === "PICKUP_REASSIGNED" || kind === "ROUTE_CONFIRMATION";
            // Sin routeId, o una colecta quitada (el detalle ya no es suyo:
            // 403), se abre la lista. Un recorrido ofrecido se contesta en
            // Alertas › Ofertas. El detalle consulta el estado vigente.
            const openList = () => nav.navigate(isCollection ? "CollectionsScreen" : "RoutesScreen");
            // Lo que muestran Inicio y Envíos cambió (colecta asignada, recorrido actualizado).
            invalidateDriverWork();
            if (kind === "ROUTE_OFFER") {
              const openOffers = () => openOfferInbox(nav);
              if (source === "response") openOffers();
              else showOfferNotice({ ...offerNoticeText("ROUTE_OFFER"), open: openOffers });
              return;
            }
            const open =
              kind === "PICKUP_REASSIGNED" || !routeId
                ? openList
                : () => nav.navigate("RouteDetailScreen", { routeId, name: raw?.template_name ? String(raw.template_name) : undefined });
            if (source === "response") {
              open();
              return;
            }
            if (kind === "PICKUP_ASSIGNED" || kind === "ROUTE_CONFIRMATION") {
              const confirmation = kind === "ROUTE_CONFIRMATION" ? confirmationNoticeText(raw, todayIso()) : null;
              Alert.alert(
                kind === "PICKUP_ASSIGNED" ? "Colecta asignada" : "Confirmación de colecta",
                kind === "PICKUP_ASSIGNED"
                  ? `Se te asignó la colecta${routeId ? ` #${routeId}` : ""}. Confirmá si podés hacerla.`
                  : confirmation
                  ? `${confirmation.title}. ${confirmation.body}`
                  : "Confirmá si podés hacerla.",
                [
                  { text: "Ahora no", style: "cancel" },
                  { text: "Ver colecta", onPress: open },
                ],
              );
            }
          },
          // Turbo ofrecido: si el chofer tocó la notificación se abre
          // Alertas › Ofertas; con la app abierta, un aviso arriba que no lo frena.
          onTurboOffer: ({ source, raw }) => {
            const openOffers = () => openOfferInbox(navigation);
            if (source === "response") {
              openOffers();
              return;
            }
            showOfferNotice({ ...offerNoticeText("TURBO_OFFER", raw), open: openOffers });
          },
        });
      } catch (_e) {
        showFeedback(
          "error",
          "Error de conexión",
          "No se pudo registrar el dispositivo para recibir alertas."
        );
      }
      // Seguimiento operativo: sigue en segundo plano y con la pantalla
      // bloqueada; se apaga al cerrar sesión, no al salir de esta pantalla.
      const tracking = await startDriverTracking({ available });
      if (cancelled) return;
      // Si la primera subida ya volvió con 403 o fuera de horario, ese aviso queda.
      setTrackingMode((prev) => (prev === "forbidden" || prev === "paused" ? prev : tracking.ok ? tracking.mode : tracking.reason === "error" ? "fallback" : "off"));
      const position = tracking.ok ? await readCurrentPosition() : null;
      if (cancelled) return;
      setMyPosition(position);
      if (!tracking.ok) {
        showFeedback(
          "info",
          "Ubicación desactivada",
          "Sin permiso de ubicación no se puede seguir tu recorrido. Activalo desde Ajustes."
        );
      } else if (tracking.mode === "foreground-only") {
        showFeedback(
          "info",
          "Ubicación solo con la app abierta",
          "Para seguir el recorrido con la pantalla bloqueada, permití la ubicación \"Siempre\" en Ajustes."
        );
      }
    })();
    // Al volver a primer plano se sube lo acumulado sin esperar al próximo fix.
    // También se renueva el push, como mucho cada 12 h: el servidor deja de
    // mandarle a un teléfono que no renovó el token en 7 días
    // (PUSH_INACTIVE_DAYS), y con la app viva en segundo plano esta pantalla
    // no se vuelve a montar.
    let lastPushRegisterAt = Date.now();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void flushDriverPositions();
        void readCurrentPosition().then((p) => {
          if (!cancelled && p) setMyPosition(p);
        });
        if (Date.now() - lastPushRegisterAt > 12 * 60 * 60 * 1000) {
          lastPushRegisterAt = Date.now();
          setupPushAndRegisterDevice({
            userId,
            username,
            rol: "driver",
            vehicleType: defaultVehicleType,
          }).catch(() => {});
        }
      }
    });
    return () => {
      cancelled = true;
      sub.remove();
      if (detachNotiRef.current) {
        detachNotiRef.current();
        detachNotiRef.current = null;
      }
    };
  }, [userId, username, available, defaultVehicleType, add]);
  // Lo que cambia el seguimiento después del arranque (también en segundo
  // plano) se avisa acá, con el aviso fijo de arriba: un 403 lo apaga, y la
  // franja horaria lo pone en pausa y lo vuelve a prender.
  useEffect(
    () => onTrackingChange((s) => {
      if (s.error === "forbidden") setTrackingMode("forbidden");
      else if (s.error === "schedule") {
        setTrackingMode("paused");
        setResumeAt(s.resumeAt ?? null);
      } else setTrackingMode(s.mode);
    }),
    []
  );
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!username) return;
      try {
        const r = await postJson("/driver/availability/get", { username });
        if (mounted && r?.ok !== false) {
          setTurboOn(Boolean(r?.turbo_active ?? false));
          if (typeof r?.turbo_enabled === "boolean") {
            setTurboEnabled(r.turbo_enabled);
            setOfferTurboEnabled(r.turbo_enabled);
          }
        }
      } catch (_e) {}
    })();
    return () => {
      mounted = false;
    };
  }, [username]);
  useFocusEffect(useCallback(() => { void refreshOfferCount(); }, []));
  const toggleTurbo = async (val: boolean) => {
    if (!username) return;
    setTurboOn(val);
    setSaving(true);
    try {
      const r = await postJson("/driver/availability/set", {
        username,
        turbo_active: val,
      });
      if (r?.ok === false) throw new Error(r?.error || "rechazado");
      if (typeof r?.turbo_enabled === "boolean") {
        setTurboEnabled(r.turbo_enabled);
        setOfferTurboEnabled(r.turbo_enabled);
      }
    } catch (_e) {
      setTurboOn(!val);
      showFeedback(
        "error",
        "No se pudo actualizar",
        "Intentá cambiar tu disponibilidad nuevamente."
      );
    } finally {
      setSaving(false);
    }
  };
  const handleAcceptAssignment = async () => {
    if (!pendingAssignment) return;
    try {
      setAssignmentActionLoading("accept");
      console.log("[Lynx Driver] Aceptando asignación:", {
        deliveryId: pendingAssignment.deliveryId,
      });
      await acceptDeliveryAssignment(pendingAssignment.deliveryId);
      setPendingAssignment(null);
      showFeedback("success", "Listo", "Aceptaste el envío asignado.");
    } catch (e: any) {
      console.log("[Lynx Driver] Error al aceptar:", e);
      showFeedback(
        "error",
        "No se pudo aceptar",
        e?.message || "No se pudo aceptar el envío."
      );
    } finally {
      setAssignmentActionLoading(null);
    }
  };
  const handleRejectAssignment = async () => {
    if (!pendingAssignment) return;
    try {
      setAssignmentActionLoading("reject");
      console.log("[Lynx Driver] Rechazando asignación:", {
        deliveryId: pendingAssignment.deliveryId,
      });
      await rejectDeliveryAssignment(pendingAssignment.deliveryId);
      setPendingAssignment(null);
      showFeedback(
        "info",
        "Asignación rechazada",
        "Avisamos a administración."
      );
    } catch (e: any) {
      console.log("[Lynx Driver] Error al rechazar:", e);
      showFeedback(
        "error",
        "No se pudo rechazar",
        e?.message || "No se pudo rechazar el envío."
      );
    } finally {
      setAssignmentActionLoading(null);
    }
  };
  const handleTabPress = (tab: DriverTabKey) => {
    if (tab === "home") {
      navigation.navigate("DriverScreen");
      return;
    }
    if (tab === "deliveries") {
      navigation.navigate("EnviosScreen");
      return;
    }
    if (tab === "scan") {
      navigation.navigate("DriverScanOptionsScreen");
      return;
    }
    if (tab === "activity") {
      navigation.navigate("NotificationsScreen");
    }
  };
  const feedbackTone =
    feedbackModal.type === "success"
      ? theme.status.confirmed
      : feedbackModal.type === "error"
      ? theme.status.rejected
      : theme.status.inTransit;
  const feedbackColor = feedbackTone.solid;
  const feedbackOverlay = feedbackTone.background;
  const feedbackBorder = feedbackTone.border;
  const feedbackIcon =
    feedbackModal.type === "success"
      ? "checkmark"
      : feedbackModal.type === "error"
      ? "close"
      : "information";
  return (
    <View style={styles.container}>
      <ThemedStatusBar />
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{ latitude: -34.6037, longitude: -58.3816, latitudeDelta: 0.3, longitudeDelta: 0.3 }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {myPosition ? <Marker coordinate={myPosition} /> : null}
      </MapView>
      <View style={styles.mapOverlay} />
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentInner, { paddingTop: insets.top + theme.spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        {trackingMode && trackingMode !== "background" ? (
          <Pressable onPress={trackingMode === "forbidden" || trackingMode === "paused" ? undefined : () => Linking.openSettings()} style={styles.trackingBanner}>
            <Ionicons name={trackingMode === "paused" ? "pause-circle-outline" : "warning-outline"} size={18} color="#1A1A1A" />
            <Text style={styles.trackingBannerText}>
              {trackingMode === "paused"
                ? `GPS en pausa${resumeAt ? ` hasta las ${resumeAt}` : ""}: fuera del horario de trabajo no se comparte tu ubicación.`
                : trackingMode === "forbidden"
                ? "Tu usuario no tiene ficha de chofer activa: se detuvo el seguimiento. Hablá con coordinación."
                : trackingMode === "off"
                ? "Ubicación desactivada: tu recorrido no se está siguiendo. Tocá para abrir Ajustes y permitirla."
                : trackingMode === "fallback"
                  ? "No se pudo activar el seguimiento en segundo plano: solo se comparte con la app abierta. Tocá para revisar Ajustes."
                  : "La ubicación solo se comparte con la app abierta. Tocá para permitir «Siempre» en Ajustes."}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.heroRow}>
          <View style={styles.hero}>
            <Text style={styles.kicker}>LYNX DRIVER</Text>
            <Text style={styles.title}>Hola {driverDisplayName}</Text>
            {/* Sin permiso ya lo explica el aviso de ubicación de arriba. */}
            {!myPosition && trackingMode !== "off" ? (
              <View style={styles.locationStatus}>
                <Ionicons name="locate-outline" size={14} color={theme.text.muted} />
                <Text style={styles.locationStatusText}>
                  {myPosition === undefined ? "Buscando tu ubicación…" : "No pudimos obtener tu ubicación."}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => setTurboPanelVisible(true)} style={styles.profileButton} accessibilityLabel="Opciones Turbo" accessibilityRole="button">
              <Ionicons name={turboEnabled === false ? "flash-outline" : "flash"} size={22} color={turboEnabled !== false && turboOn ? "#D59A19" : theme.text.muted} />
              {offerCount != null && offerCount > 0 && turboEnabled !== false ? <View style={styles.offerDot} /> : null}
            </Pressable>
          <Pressable
            onPress={() => navigation.navigate("DriverAccountScreen")}
            style={styles.profileButton}
            hitSlop={8}
            accessibilityLabel="Perfil"
          >
            <DriverAvatar uri={driverProfile?.selfie} size={42} fallback={<Ionicons name="person-outline" size={22} color={theme.text.primary} />} />
          </Pressable>
          </View>
        </View>
        <View style={styles.homeSpacer} />
        <View style={styles.homeBottom}>
        {missions.length ? (
          <View style={styles.missions}>
            <MissionCard mission={missions[0]} onPress={() => (navigation as any).navigate(missions[0].target.screen, missions[0].target.params)} />
            {/* Las demás en una fila cada una; si son muchas, el resto está en Envíos. */}
            {missions.slice(1, 1 + MORE_MISSIONS).map((m) => (
              <MissionCard key={m.key} mission={m} compact onPress={() => (navigation as any).navigate(m.target.screen, m.target.params)} />
            ))}
            {missions.length > 1 + MORE_MISSIONS ? (
              <Pressable onPress={() => navigation.navigate("EnviosScreen")} style={styles.moreMissions} accessibilityRole="button" hitSlop={6}>
                <Text style={styles.moreMissionsText}>
                  {missions.length - 1 - MORE_MISSIONS === 1 ? "Un recorrido más en curso" : `${missions.length - 1 - MORE_MISSIONS} recorridos más en curso`}: ver en Envíos
                </Text>
                <Ionicons name="chevron-forward" size={16} color={theme.text.accent} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <View style={styles.bottomCards}>
          <DriverPerformanceCard
            loading={loadingLegacy}
            // /v1/data/driver/me no filtra por fecha: son todos los envíos
            // del chofer. Cuando exista la performance semanal del servidor,
            // va acá con su período.
            periodLabel="Historial completo"
            score={driverMetrics.score}
            effectiveness={driverMetrics.effectiveness}
            totalDeliveries={driverMetrics.total}
            closedOk={driverMetrics.closedOk}
            delivered={driverMetrics.delivered}
            pending={driverMetrics.pending}
            earnings={fmtMoney(driverMetrics.neto)}
            eliteDeliveries={performanceAnalytics?.eliteDeliveries}
            post21Delivered={performanceAnalytics?.post21Delivered}
            post21Nobody={performanceAnalytics?.post21Nobody}
            post21Rescheduled={performanceAnalytics?.post21Rescheduled}
            post23Delivered={performanceAnalytics?.post23Delivered}
            post23Nobody={performanceAnalytics?.post23Nobody}
            post23Rescheduled={performanceAnalytics?.post23Rescheduled}
            post23InTransit={performanceAnalytics?.post23InTransit}
            delayedTotal={performanceAnalytics?.delayedTotal}
          />
        </View>
        </View>
      </ScrollView>
      <DriverBottomNavigation activeTab="home" onPress={handleTabPress} />
      <Modal transparent visible={turboPanelVisible} animationType="fade" onRequestClose={() => setTurboPanelVisible(false)}>
        <Pressable style={styles.feedbackOverlay} onPress={() => setTurboPanelVisible(false)}>
          <Pressable style={styles.turboSheet} onPress={() => {}}>
            <View style={styles.turboPanelHeader}>
              <Ionicons name="flash" size={24} color={turboEnabled !== false && turboOn ? "#D59A19" : theme.text.muted} />
              <Text style={styles.turboPanelTitle}>Turbo</Text>
              <Pressable onPress={() => setTurboPanelVisible(false)} accessibilityLabel="Cerrar opciones Turbo"><Ionicons name="close" size={23} color={theme.text.secondary} /></Pressable>
            </View>
            <Text style={styles.turboPanelDescription}>{turboEnabled === false ? "No habilitado. Pedile la habilitación a tu coordinador." : turboEnabled === null ? "Consultando habilitación de Turbo…" : turboOn ? "En línea para recibir Turbo" : "Fuera de línea para Turbo"}</Text>
            {turboEnabled === true ? (
              <View style={styles.turboToggleRow}>
                <Text style={styles.turboToggleText}>Disponible para Turbo</Text>
                <View style={styles.turboSwitchArea}>
                  <Switch
                    style={styles.turboSwitch}
                    value={turboOn}
                    onValueChange={toggleTurbo}
                    disabled={saving}
                    thumbColor={theme.text.primary}
                    trackColor={{ false: theme.borders.medium, true: theme.overlays.primary }}
                  />
                </View>
              </View>
            ) : null}
            {loadTotal(turboLoad) > 0 ? <Text style={styles.turboPanelDescription}>Turbos activos: {loadTotal(turboLoad)}</Text> : null}
            {capNotice(turboLoad) ? <Text style={styles.turboPanelDescription}>{capNotice(turboLoad)}</Text> : null}
            <Pressable style={styles.turboOffersButton} onPress={() => { setTurboPanelVisible(false); openOfferInbox(navigation); }} accessibilityRole="button"><Text style={styles.turboOffersText}>{offerCount != null && offerCount > 0 ? `Ver ofertas (${offerCount})` : "Ver ofertas"}</Text><Ionicons name="arrow-forward" size={18} color={theme.text.onPrimary} /></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        transparent
        visible={!!pendingAssignment}
        animationType="fade"
        onRequestClose={() => setPendingAssignment(null)}
      >
        <Pressable
          style={styles.assignmentOverlay}
          onPress={() => setPendingAssignment(null)}
        >
          <Pressable style={styles.assignmentCard} onPress={() => {}}>
            <View style={styles.assignmentTopRow}>
              <View style={styles.assignmentIcon}>
                <Ionicons
                  name="cube-outline"
                  size={24}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.assignmentHeaderText}>
                <Text style={styles.assignmentKicker}>NUEVA ASIGNACIÓN</Text>
                <Text style={styles.assignmentTitle}>
                  Nuevo envío asignado
                </Text>
              </View>
            </View>
            <Text style={styles.assignmentBody}>
              Tenés un nuevo envío para revisar. Podés aceptarlo ahora,
              rechazarlo o verlo más tarde desde Alertas.
            </Text>
            <View style={styles.assignmentDetailsBox}>
              <DetailLine
                label="Tracking"
                value={pendingAssignment?.tracking || "—"}
                force
              />
              <DetailLine
                label="Tienda"
                value={pendingAssignment?.tienda || "—"}
                force
              />
              <DetailLine
                label="Dirección"
                value={pendingAssignment?.direccion || "—"}
                force
              />
              <DetailLine
                label="Localidad"
                value={assignmentLocalidad || "—"}
                force
              />
            </View>
            <View style={styles.assignmentFooter}>
              <Pressable
                style={[styles.assignmentBtn, styles.assignmentBtnGhost]}
                onPress={() => setPendingAssignment(null)}
                disabled={!!assignmentActionLoading}
              >
                <Text style={styles.assignmentBtnGhostText}>Más tarde</Text>
              </Pressable>
              <Pressable
                style={[styles.assignmentBtn, styles.assignmentBtnReject]}
                onPress={handleRejectAssignment}
                disabled={!!assignmentActionLoading}
              >
                <Text style={styles.assignmentBtnRejectText}>
                  {assignmentActionLoading === "reject"
                    ? "Rechazando..."
                    : "Rechazar"}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.assignmentBtn, styles.assignmentBtnAccept]}
                onPress={handleAcceptAssignment}
                disabled={!!assignmentActionLoading}
              >
                <Text style={styles.assignmentBtnAcceptText}>
                  {assignmentActionLoading === "accept"
                    ? "Aceptando..."
                    : "Aceptar"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        transparent
        visible={feedbackModal.visible}
        animationType="fade"
        onRequestClose={closeFeedback}
      >
        <Pressable style={styles.feedbackOverlay} onPress={closeFeedback}>
          <Pressable style={styles.feedbackSheet} onPress={() => {}}>
            <View style={styles.feedbackHandle} />
            <View
              style={[
                styles.feedbackIconOuter,
                {
                  backgroundColor: feedbackOverlay,
                  borderColor: feedbackBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.feedbackIconInner,
                  { backgroundColor: feedbackColor },
                ]}
              >
                <Ionicons
                  name={feedbackIcon}
                  size={30}
                  color={feedbackTone.onSolid}
                />
              </View>
            </View>
            <Text style={styles.feedbackTitle}>{feedbackModal.title}</Text>
            <Text style={styles.feedbackMessage}>{feedbackModal.message}</Text>
            <Pressable style={styles.feedbackButton} onPress={closeFeedback}>
              <Text style={styles.feedbackButtonText}>OK</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};
// Recorridos en curso además del principal que se listan en Inicio.
const MORE_MISSIONS = 2;
const makeStyles = (t: Theme) => StyleSheet.create({
  homeSpacer: { flexGrow: 1, minHeight: 90 },
  homeBottom: { paddingBottom: 10 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  offerDot: { position: "absolute", top: 5, right: 5, width: 9, height: 9, borderRadius: 5, backgroundColor: "#D59A19" },
  turboSheet: { backgroundColor: t.surfaces.screenAlt, borderTopLeftRadius: t.radius.xxl, borderTopRightRadius: t.radius.xxl, padding: t.spacing.lg, paddingBottom: t.spacing.xl, gap: t.spacing.md },
  turboPanelHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  turboPanelTitle: { flex: 1, color: t.text.primary, fontSize: 20, fontWeight: "700" },
  turboPanelDescription: { color: t.text.secondary, fontSize: 14, lineHeight: 20 },
  turboToggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 64, marginBottom: 10 },
  turboSwitchArea: { minWidth: 76, minHeight: 58, alignItems: "center", justifyContent: "center", marginLeft: 12 },
  turboSwitch: { transform: [{ scaleX: 1.14 }, { scaleY: 1.14 }] },
  turboToggleText: { color: t.text.primary, fontSize: 15, fontWeight: "600" },
  turboOffersButton: { backgroundColor: t.colors.primary, minHeight: 48, borderRadius: t.radius.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  turboOffersText: { color: t.text.onPrimary, fontWeight: "700", fontSize: 15 },
  missions: {
    marginTop: t.spacing.md,
  },
  moreMissions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: t.spacing.sm,
    minHeight: 32,
  },
  moreMissionsText: {
    color: t.text.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  performanceToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: t.spacing.md,
    minHeight: 44,
  },
  performanceToggleText: {
    flex: 1,
    color: t.text.secondary,
    fontSize: 14,
    fontWeight: "700",
  },
  performanceToggleMeta: {
    color: t.text.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  container: {
    flex: 1,
    backgroundColor: t.surfaces.screen,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.overlays.map,
  },
  content: {
    flex: 1,
    zIndex: 10,
  },
  contentInner: {
    flexGrow: 1,
    paddingHorizontal: t.layout.screenPadding,
    paddingBottom: 108,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.spacing.sm,
  },
  hero: {
    flex: 1,
    gap: t.spacing.xs,
  },
  locationStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.xs,
  },
  locationStatusText: {
    ...t.typography.body,
    color: t.text.muted,
    fontSize: 13,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: t.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.surfaces.card,
    borderWidth: 1,
    borderColor: t.borders.default,
  },
  kicker: {
    ...t.typography.kicker,
  },
  title: {
    ...t.typography.titleLg,
  },
  subtitle: {
    ...t.typography.body,
  },
  bottomCards: {
    gap: t.spacing.sm,
    paddingTop: t.spacing.md,
  },
  assignmentOverlay: {
    flex: 1,
    backgroundColor: t.overlays.camera,
    justifyContent: "center",
    paddingHorizontal: t.spacing.lg,
  },
  assignmentCard: {
    borderRadius: t.radius.xxl,
    backgroundColor: t.surfaces.screenAlt,
    borderWidth: 1,
    borderColor: t.borders.medium,
    padding: t.spacing.lg,
    gap: t.spacing.md,
    ...t.shadows.card,
  },
  assignmentTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.md,
  },
  assignmentIcon: {
    width: 54,
    height: 54,
    borderRadius: t.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.overlays.primary,
    borderWidth: 1,
    borderColor: t.borders.primary,
  },
  assignmentHeaderText: {
    flex: 1,
  },
  assignmentKicker: {
    ...t.typography.kicker,
  },
  assignmentTitle: {
    color: t.text.primary,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: t.font.weight.black,
    letterSpacing: -0.7,
    marginTop: t.spacing.xs,
  },
  assignmentBody: {
    color: t.text.secondary,
    fontSize: t.font.size.sm,
    lineHeight: t.font.lineHeight.md,
    fontWeight: t.font.weight.medium,
  },
  assignmentDetailsBox: {
    borderRadius: t.radius.xl,
    backgroundColor: t.surfaces.card,
    borderWidth: 1,
    borderColor: t.borders.soft,
    overflow: "hidden",
  },
  assignmentDetailRow: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: t.borders.soft,
    gap: 3,
  },
  assignmentDetailLabel: {
    color: t.text.muted,
    fontSize: t.font.size.xxs,
    fontWeight: t.font.weight.black,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  assignmentDetailValue: {
    color: t.text.primary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: t.font.weight.bold,
  },
  assignmentFooter: {
    flexDirection: "row",
    gap: t.spacing.sm,
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  assignmentBtn: {
    minHeight: 44,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  assignmentBtnGhost: {
    backgroundColor: t.surfaces.card,
    borderWidth: 1,
    borderColor: t.borders.soft,
  },
  assignmentBtnReject: {
    backgroundColor: t.status.rejected.background,
    borderWidth: 1,
    borderColor: t.status.rejected.border,
  },
  assignmentBtnAccept: {
    backgroundColor: t.status.confirmed.solid,
  },
  assignmentBtnGhostText: {
    color: t.text.secondary,
    fontSize: t.font.size.sm,
    fontWeight: t.font.weight.black,
  },
  assignmentBtnRejectText: {
    color: t.status.rejected.text,
    fontSize: t.font.size.sm,
    fontWeight: t.font.weight.black,
  },
  assignmentBtnAcceptText: {
    color: t.status.confirmed.onSolid,
    fontSize: t.font.size.sm,
    fontWeight: t.font.weight.black,
  },
  feedbackOverlay: {
    flex: 1,
    backgroundColor: t.overlays.camera,
    justifyContent: "flex-end",
  },
  feedbackSheet: {
    borderTopLeftRadius: t.radius.xxl,
    borderTopRightRadius: t.radius.xxl,
    backgroundColor: t.surfaces.screenAlt,
    borderWidth: 1,
    borderColor: t.borders.medium,
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.xl,
    alignItems: "center",
    ...t.shadows.card,
  },
  feedbackHandle: {
    width: 46,
    height: 5,
    borderRadius: t.radius.full,
    backgroundColor: t.borders.strong,
    marginBottom: t.spacing.lg,
  },
  feedbackIconOuter: {
    width: 86,
    height: 86,
    borderRadius: t.radius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: t.spacing.lg,
  },
  feedbackIconInner: {
    width: 58,
    height: 58,
    borderRadius: t.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackTitle: {
    color: t.text.primary,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: t.font.weight.black,
    textAlign: "center",
  },
  feedbackMessage: {
    color: t.text.secondary,
    fontSize: t.font.size.md,
    lineHeight: 24,
    fontWeight: t.font.weight.medium,
    textAlign: "center",
    marginTop: t.spacing.sm,
  },
  feedbackButton: {
    width: "100%",
    minHeight: 54,
    borderRadius: t.radius.xl,
    backgroundColor: t.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: t.spacing.xl,
  },
  feedbackButtonText: {
    color: t.text.onPrimary,
    fontSize: t.font.size.md,
    fontWeight: t.font.weight.black,
  },
  trackingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFD54F",
    borderRadius: t.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  trackingBannerText: {
    flex: 1,
    color: "#1A1A1A",
    fontSize: 13,
    lineHeight: 18,
  },
});
export default DriverScreen;