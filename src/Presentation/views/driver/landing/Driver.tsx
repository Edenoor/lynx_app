// src/Presentation/views/driver/DriverScreen.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { StackScreenProps } from "@react-navigation/stack";

import useViewModel from "./ViewModel";
import useEnviosViewModel from "../Envios/ViewModel";
import { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import { postJson } from "../../../config/Api";
import { useOnboarding } from "../../../onboarding/OnboardingContext";
import { useNotifications } from "../../../context/NotificationContext";

import {
  setupPushAndRegisterDevice,
  attachNotificationListeners,
} from "../../../config/Push";
import {
  startDriverHeartbeat,
  stopDriverHeartbeat,
} from "../../../config/HeartBeat";

import AppTheme from "../../../theme/AppTheme";
import {
  DriverBottomNavigation,
  DriverTabKey,
} from "../../../components/DriverBottomNavigation";
import DriverPerformanceCard from "../../../components/DriverPerformanceCard";
import DriverTurboStatusCard from "../../../components/DriverTurboStatusCard";
import DriverQrActionGrid from "../../../components/DriverQrActionGrid";

interface Props extends StackScreenProps<DriverStackParamList, "DriverScreen"> {}

const VEHICLE_KEYS_GUESS = [
  "vehicle",
  "vehiculo",
  "vehicleType",
  "tipo_vehiculo",
  "vehicle_type",
];

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

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

async function acceptShipmentInline(tracking: string, driverUsername: string) {
  const res = await fetch(`${API_BASE}/envios/${tracking}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ driverUsername }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || "Error al aceptar envío");
  }
}

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

  const detachNotiRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    if (!username) return;

    (async () => {
      try {
        await setupPushAndRegisterDevice({
          username,
          rol: "driver",
          vehicleType: defaultVehicleType,
        });

        detachNotiRef.current = attachNotificationListeners({
          currentUser: { username, rol: "driver" },
          onNewTrad: (tracking) => {
            if (!tracking) return;

            Alert.alert(
              "Nuevo envío cercano",
              `Tracking: ${tracking}`,
              [
                { text: "Más tarde" },
                {
                  text: "Aceptar ahora",
                  onPress: async () => {
                    try {
                      await acceptShipmentInline(tracking, username);
                      Alert.alert("Listo ✅", `Tomaste el envío ${tracking}`);
                    } catch (e: any) {
                      Alert.alert("Error", e?.message || "No se pudo aceptar");
                    }
                  },
                },
              ],
              { cancelable: true }
            );
          },
          onAny: ({ kind, title, body, data }) => {
            add({ title, body, kind, data });
          },
        });

        startDriverHeartbeat(username, available, defaultVehicleType);
      } catch (_e) {}
    })();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        startDriverHeartbeat(username, available, defaultVehicleType);
      } else {
        stopDriverHeartbeat();
      }
    });

    return () => {
      sub.remove();
      stopDriverHeartbeat();

      if (detachNotiRef.current) {
        detachNotiRef.current();
      }
    };
  }, [username, available, defaultVehicleType, add]);

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
    } finally {
      setSaving(false);
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

  modalOverlay: {
    flex: 1,
    backgroundColor: AppTheme.overlays.camera,
    justifyContent: "flex-end",
  },

  modalContent: {
    backgroundColor: AppTheme.surfaces.screen,
    borderTopLeftRadius: AppTheme.radius.xxl,
    borderTopRightRadius: AppTheme.radius.xxl,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    padding: AppTheme.spacing.lg,
    gap: AppTheme.spacing.md,
  },

  modalKicker: {
    ...AppTheme.typography.kicker,
  },

  modalTitle: {
    ...AppTheme.typography.titleMd,
  },

  modalCancel: {
    color: AppTheme.text.muted,
    fontSize: AppTheme.font.size.md,
    fontWeight: AppTheme.font.weight.bold,
    textAlign: "center",
    paddingVertical: AppTheme.spacing.md,
  },

  debugButton: {
    backgroundColor: AppTheme.colors.black,
    padding: AppTheme.spacing.md,
    borderRadius: AppTheme.radius.md,
    alignItems: "center",
  },

  debugButtonText: {
    color: AppTheme.colors.white,
    fontWeight: AppTheme.font.weight.bold,
  },
});

export default DriverScreen;