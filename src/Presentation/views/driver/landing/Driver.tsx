// src/Presentation/views/driver/DriverScreen.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { StackScreenProps } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";

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
  startDriverHeartbeat,
  stopDriverHeartbeat,
} from "../../../config/HeartBeat";

import {
  acceptDeliveryAssignment,
  rejectDeliveryAssignment,
} from "./acceptApi";

import AppTheme from "../../../theme/AppTheme";
import {
  DriverBottomNavigation,
  DriverTabKey,
} from "../../../components/DriverBottomNavigation";
import DriverPerformanceCard from "../../../components/DriverPerformanceCard";
import DriverTurboStatusCard from "../../../components/DriverTurboStatusCard";

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

const successOverlay = `${AppTheme.colors.success}22`;
const successBorder = `${AppTheme.colors.success}55`;
const dangerOverlay = `${AppTheme.colors.danger}22`;
const dangerBorder = `${AppTheme.colors.danger}55`;
const primaryOverlay = AppTheme.overlays.primary;
const primaryBorder = AppTheme.borders.primary;

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
  const { user } = useViewModel();

  const {
    list,
    loading: loadingLegacy,
    performanceAnalytics,
  } = useEnviosViewModel();

  const { add } = useNotifications();

  const [turboOn, setTurboOn] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [available] = useState<boolean>(true);

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
        });

        startDriverHeartbeat(username, available, defaultVehicleType);
      } catch (_e) {
        showFeedback(
          "error",
          "Error de conexión",
          "No se pudo registrar el dispositivo para recibir alertas."
        );
      }
    })();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        startDriverHeartbeat(username, available, defaultVehicleType);
      } else {
        stopDriverHeartbeat();
      }
    });

    return () => {
      cancelled = true;

      sub.remove();
      stopDriverHeartbeat();

      if (detachNotiRef.current) {
        detachNotiRef.current();
        detachNotiRef.current = null;
      }
    };
  }, [userId, username, available, defaultVehicleType, add]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!username) return;

      try {
        const r = await postJson("/driver/availability/get", { username });

        if (mounted && r?.ok !== false) {
          setTurboOn(Boolean(r?.turbo_active ?? false));
        }
      } catch (_e) {}
    })();

    return () => {
      mounted = false;
    };
  }, [username]);

  const toggleTurbo = async (val: boolean) => {
    if (!username) return;

    setTurboOn(val);
    setSaving(true);

    try {
      await postJson("/driver/availability/set", {
        username,
        turbo_active: val,
      });
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
      return;
    }

    if (tab === "profile") {
      navigation.navigate("DriverAccountScreen");
    }
  };

  const feedbackColor =
    feedbackModal.type === "success"
      ? AppTheme.colors.success
      : feedbackModal.type === "error"
      ? AppTheme.colors.danger
      : AppTheme.colors.primary;

  const feedbackOverlay =
    feedbackModal.type === "success"
      ? successOverlay
      : feedbackModal.type === "error"
      ? dangerOverlay
      : primaryOverlay;

  const feedbackBorder =
    feedbackModal.type === "success"
      ? successBorder
      : feedbackModal.type === "error"
      ? dangerBorder
      : primaryBorder;

  const feedbackIcon =
    feedbackModal.type === "success"
      ? "checkmark"
      : feedbackModal.type === "error"
      ? "close"
      : "information";

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: -34.6037,
          longitude: -58.3816,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        <Marker coordinate={{ latitude: -34.6037, longitude: -58.3816 }} />
      </MapView>

      <View style={styles.mapOverlay} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.kicker}>LYNX DRIVER</Text>
          <Text style={styles.title}>Hola {driverDisplayName}</Text>
          <Text style={styles.subtitle}>
            Todo listo para operar tus envíos.
          </Text>
        </View>

        <View style={styles.bottomCards}>
          <DriverTurboStatusCard
            active={turboOn}
            saving={saving}
            activeTrips={0}
            onToggle={toggleTurbo}
          />

          <DriverPerformanceCard
            loading={loadingLegacy}
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
      </ScrollView>

      <DriverBottomNavigation activeTab="home" onPress={handleTabPress} />

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
                  color={AppTheme.colors.primary}
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
                  color={AppTheme.colors.white}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.surfaces.screen,
  },

  map: {
    ...StyleSheet.absoluteFillObject,
  },

  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: AppTheme.overlays.camera,
  },

  content: {
    flex: 1,
    zIndex: 10,
  },

  contentInner: {
    flexGrow: 1,
    paddingHorizontal: AppTheme.layout.screenPadding,
    paddingTop: AppTheme.layout.headerTopPadding + 72,
    paddingBottom: 108,
  },

  hero: {
    gap: AppTheme.spacing.sm,
  },

  kicker: {
    ...AppTheme.typography.kicker,
  },

  title: {
    ...AppTheme.typography.titleLg,
  },

  subtitle: {
    ...AppTheme.typography.body,
  },

  bottomCards: {
    marginTop: "auto",
    gap: AppTheme.spacing.sm,
    paddingTop: AppTheme.spacing.xl,
  },

  assignmentOverlay: {
    flex: 1,
    backgroundColor: AppTheme.overlays.camera,
    justifyContent: "center",
    paddingHorizontal: AppTheme.spacing.lg,
  },

  assignmentCard: {
    borderRadius: AppTheme.radius.xxl,
    backgroundColor: AppTheme.surfaces.screenAlt,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    padding: AppTheme.spacing.lg,
    gap: AppTheme.spacing.md,
    ...AppTheme.shadows.card,
  },

  assignmentTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.md,
  },

  assignmentIcon: {
    width: 54,
    height: 54,
    borderRadius: AppTheme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.overlays.primary,
    borderWidth: 1,
    borderColor: AppTheme.borders.primary,
  },

  assignmentHeaderText: {
    flex: 1,
  },

  assignmentKicker: {
    ...AppTheme.typography.kicker,
  },

  assignmentTitle: {
    color: AppTheme.text.primary,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: AppTheme.font.weight.black,
    letterSpacing: -0.7,
    marginTop: AppTheme.spacing.xs,
  },

  assignmentBody: {
    color: AppTheme.text.secondary,
    fontSize: AppTheme.font.size.sm,
    lineHeight: AppTheme.font.lineHeight.md,
    fontWeight: AppTheme.font.weight.medium,
  },

  assignmentDetailsBox: {
    borderRadius: AppTheme.radius.xl,
    backgroundColor: AppTheme.surfaces.card,
    borderWidth: 1,
    borderColor: AppTheme.borders.soft,
    overflow: "hidden",
  },

  assignmentDetailRow: {
    paddingHorizontal: AppTheme.spacing.md,
    paddingVertical: AppTheme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.borders.soft,
    gap: 3,
  },

  assignmentDetailLabel: {
    color: AppTheme.text.muted,
    fontSize: AppTheme.font.size.xxs,
    fontWeight: AppTheme.font.weight.black,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  assignmentDetailValue: {
    color: AppTheme.text.primary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: AppTheme.font.weight.bold,
  },

  assignmentFooter: {
    flexDirection: "row",
    gap: AppTheme.spacing.sm,
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },

  assignmentBtn: {
    minHeight: 44,
    paddingHorizontal: AppTheme.spacing.md,
    borderRadius: AppTheme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },

  assignmentBtnGhost: {
    backgroundColor: AppTheme.surfaces.card,
    borderWidth: 1,
    borderColor: AppTheme.borders.soft,
  },

  assignmentBtnReject: {
    backgroundColor: dangerOverlay,
    borderWidth: 1,
    borderColor: dangerBorder,
  },

  assignmentBtnAccept: {
    backgroundColor: AppTheme.colors.success,
  },

  assignmentBtnGhostText: {
    color: AppTheme.text.secondary,
    fontSize: AppTheme.font.size.sm,
    fontWeight: AppTheme.font.weight.black,
  },

  assignmentBtnRejectText: {
    color: AppTheme.colors.danger,
    fontSize: AppTheme.font.size.sm,
    fontWeight: AppTheme.font.weight.black,
  },

  assignmentBtnAcceptText: {
    color: AppTheme.colors.white,
    fontSize: AppTheme.font.size.sm,
    fontWeight: AppTheme.font.weight.black,
  },

  feedbackOverlay: {
    flex: 1,
    backgroundColor: AppTheme.overlays.camera,
    justifyContent: "flex-end",
  },

  feedbackSheet: {
    borderTopLeftRadius: AppTheme.radius.xxl,
    borderTopRightRadius: AppTheme.radius.xxl,
    backgroundColor: AppTheme.surfaces.screenAlt,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    paddingHorizontal: AppTheme.spacing.lg,
    paddingTop: AppTheme.spacing.md,
    paddingBottom: AppTheme.spacing.xl,
    alignItems: "center",
    ...AppTheme.shadows.card,
  },

  feedbackHandle: {
    width: 46,
    height: 5,
    borderRadius: AppTheme.radius.full,
    backgroundColor: AppTheme.borders.strong,
    marginBottom: AppTheme.spacing.lg,
  },

  feedbackIconOuter: {
    width: 86,
    height: 86,
    borderRadius: AppTheme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: AppTheme.spacing.lg,
  },

  feedbackIconInner: {
    width: 58,
    height: 58,
    borderRadius: AppTheme.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },

  feedbackTitle: {
    color: AppTheme.text.primary,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: AppTheme.font.weight.black,
    textAlign: "center",
  },

  feedbackMessage: {
    color: AppTheme.text.secondary,
    fontSize: AppTheme.font.size.md,
    lineHeight: 24,
    fontWeight: AppTheme.font.weight.medium,
    textAlign: "center",
    marginTop: AppTheme.spacing.sm,
  },

  feedbackButton: {
    width: "100%",
    minHeight: 54,
    borderRadius: AppTheme.radius.xl,
    backgroundColor: AppTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: AppTheme.spacing.xl,
  },

  feedbackButtonText: {
    color: AppTheme.colors.white,
    fontSize: AppTheme.font.size.md,
    fontWeight: AppTheme.font.weight.black,
  },
});

export default DriverScreen;