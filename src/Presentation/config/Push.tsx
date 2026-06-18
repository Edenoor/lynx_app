import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as Location from "expo-location";
import { Platform } from "react-native";
import { getJson, postJson, putJson } from "./Api";

type MobileRole = "seller" | "driver" | "admin";

export type NotiKind =
  | "NEW_TRAD"
  | "TRAD_ACCEPTED"
  | "ASIGNACION"
  | "DRIVER_ASIGNADO"
  | "ASSIGNMENT_ACCEPTED"
  | "ASSIGNMENT_REJECTED"
  | "INFO"
  | "ALERT";

const EXPO_PROJECT_ID = "57ae574a-011e-4d21-8627-821f480087a5";

let activeReceivedSubscription: Notifications.Subscription | null = null;
let activeResponseSubscription: Notifications.Subscription | null = null;

Notifications.setNotificationHandler({
  handleNotification: async (): Promise<Notifications.NotificationBehavior> => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupPushAndRegisterDevice(params: {
  userId: number | string;
  username: string;
  rol: MobileRole;
  vehicleType?: string | null;
}) {
  console.log("[Lynx Push Mobile] Iniciando setup push...", {
    userId: params.userId,
    username: params.username,
    rol: params.rol,
    vehicleType: params.vehicleType ?? null,
  });

  if (!Device.isDevice) {
    console.log("[Lynx Push Mobile] No es dispositivo físico.");
    return null;
  }

  let perm = await Notifications.getPermissionsAsync();
  console.log("[Lynx Push Mobile] Permiso inicial:", perm.status);

  if (perm.status !== "granted") {
    perm = await Notifications.requestPermissionsAsync();
    console.log("[Lynx Push Mobile] Permiso solicitado:", perm.status);

    if (perm.status !== "granted") {
      console.log("[Lynx Push Mobile] Permiso denegado.");
      return null;
    }
  }

  let token = "";

  try {
    const response = await Notifications.getExpoPushTokenAsync({
      projectId: EXPO_PROJECT_ID,
    });

    token = response.data;

    console.log("==============================================");
    console.log("[Lynx Push Mobile] Expo Push Token:");
    console.log(token);
    console.log("==============================================");
  } catch (error) {
    console.log("[Lynx Push Mobile] Error obteniendo Expo Push Token:", error);
    return null;
  }

  let lat: number | null = null;
  let lng: number | null = null;

  try {
    const locPerm = await Location.getForegroundPermissionsAsync();
    let finalLocPerm = locPerm;

    if (locPerm.status !== "granted") {
      finalLocPerm = await Location.requestForegroundPermissionsAsync();
    }

    console.log("[Lynx Push Mobile] Permiso ubicación:", finalLocPerm.status);

    if (finalLocPerm.status === "granted") {
      const pos = await Location.getCurrentPositionAsync({});
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;

      console.log("[Lynx Push Mobile] Ubicación inicial:", { lat, lng });
    }
  } catch (error) {
    console.log("[Lynx Push Mobile] No se pudo obtener ubicación inicial:", error);
  }

  try {
    const deviceResponse = await getJson(`/v2/users/${params.userId}/devices`);

    console.log("[Lynx Push Mobile] Device del usuario:", deviceResponse);

    let finalDeviceId =
      deviceResponse?.devices?.id ||
      deviceResponse?.device?.id ||
      deviceResponse?.devices?.[0]?.id ||
      deviceResponse?.device?.[0]?.id;

    if (!finalDeviceId) {
      console.log(
        "[Lynx Push Mobile] No se encontró deviceId. Intentando crear device..."
      );

      const createDeviceResponse = await postJson("/v2/devices", {
        userID: params.userId,
      });

      console.log(
        "[Lynx Push Mobile] Respuesta crear device:",
        createDeviceResponse
      );

      finalDeviceId =
        createDeviceResponse?.deviceID ||
        createDeviceResponse?.deviceId ||
        createDeviceResponse?.device?.id ||
        createDeviceResponse?.devices?.id ||
        createDeviceResponse?.devices?.[0]?.id;

      if (!finalDeviceId) {
        console.log(
          "[Lynx Push Mobile] No se pudo obtener deviceId luego de crear device."
        );
        return token;
      }
    }

    console.log("[Lynx Push Mobile] Actualizando token para device:", {
      finalDeviceId,
      token,
      platform: Platform.OS,
      name: Device.deviceName ?? null,
    });

    const response = await putJson(`/v2/devices/${finalDeviceId}/token`, {
      token,
      platform: Platform.OS,
      name: Device.deviceName ?? null,
      lat,
      lng,
    });

    console.log("[Lynx Push Mobile] Respuesta update token:", response);
  } catch (error) {
    console.log("[Lynx Push Mobile] Error actualizando token del device:", error);
  }

  return token;
}

export function attachNotificationListeners({
  currentUser,
  onNewTrad,
  onAccepted,
  onAssignment,
  onAny,
}: {
  currentUser: { username: string; rol: MobileRole };
  onNewTrad?: (tracking: string) => void;
  onAccepted?: (tracking: string) => void;
  onAssignment?: (payload: {
    deliveryId: string;
    tracking?: string;
    tienda?: string;
    direccion?: string;
    localidad?: string;
    raw?: any;
  }) => void;
  onAny?: (payload: {
    kind: NotiKind;
    title: string;
    body?: string;
    data?: any;
  }) => void;
}) {
  const normalizeKind = (
    type?: unknown,
    data?: any,
    title?: string | null
  ): NotiKind => {
    const normalized = String(type ?? "").toUpperCase().trim();
    const titleNormalized = String(title ?? "").toUpperCase().trim();

    if (normalized === "NEW_TRAD") return "NEW_TRAD";
    if (normalized === "TRAD_ACCEPTED") return "TRAD_ACCEPTED";
    if (normalized === "ASIGNACION") return "ASIGNACION";
    if (normalized === "DRIVER_ASIGNADO") return "DRIVER_ASIGNADO";
    if (normalized === "ASSIGNMENT_ACCEPTED") return "ASSIGNMENT_ACCEPTED";
    if (normalized === "ASSIGNMENT_REJECTED") return "ASSIGNMENT_REJECTED";

    if (data?.deliveryId && titleNormalized.includes("NUEVO ENVÍO ASIGNADO")) {
      return "ASIGNACION";
    }

    if (normalized.includes("REJECT")) return "ASSIGNMENT_REJECTED";
    if (normalized.includes("ACCEPT")) return "ASSIGNMENT_ACCEPTED";
    if (normalized.includes("ALERT")) return "ALERT";

    return "INFO";
  };

  const save = (
    kind: NotiKind,
    title?: string | null,
    body?: string | null,
    data?: any
  ) => {
    onAny?.({
      kind,
      title:
        title ??
        (kind === "NEW_TRAD"
          ? "Nuevo envío"
          : kind === "TRAD_ACCEPTED"
          ? "Envío aceptado"
          : kind === "ASIGNACION"
          ? "Nuevo envío asignado"
          : kind === "DRIVER_ASIGNADO"
          ? "Driver asignado"
          : kind === "ASSIGNMENT_ACCEPTED"
          ? "Asignación aceptada"
          : kind === "ASSIGNMENT_REJECTED"
          ? "Asignación rechazada"
          : "Notificación"),
      body: body ?? undefined,
      data,
    });
  };

  const handleNotificationContent = (
    content: Notifications.NotificationContent | undefined,
    source: "received" | "response"
  ) => {
    if (!content) return;

    const data: any = content.data ?? {};
    const kind = normalizeKind(data?.type, data, content.title);

    console.log(`[Lynx Push Mobile] Notificación ${source}:`, {
      kind,
      title: content.title,
      body: content.body,
      data,
    });

    if (kind === "DRIVER_ASIGNADO") {
      console.log("[Lynx Push Mobile] Notificación seller DRIVER_ASIGNADO:", {
        title: content.title,
        body: content.body,
        data,
      });
    }

    if (source === "received") {
      save(kind, content.title ?? undefined, content.body ?? undefined, data);
    }

    if (
      source === "received" &&
      kind === "ASIGNACION" &&
      currentUser.rol === "driver"
    ) {
      const deliveryId = String(data?.deliveryId || data?.delivery_id || data?.id || "");

      if (!deliveryId) {
        console.log("[Lynx Push Mobile] ASIGNACION sin deliveryId:", data);
        return;
      }

      onAssignment?.({
        deliveryId,
        tracking: data?.tracking ? String(data.tracking) : undefined,
        tienda: data?.tienda ? String(data.tienda) : undefined,
        direccion: data?.direccion ? String(data.direccion) : undefined,
        localidad: data?.localidad ? String(data.localidad) : undefined,
        raw: data,
      });

      return;
    }

    if (kind === "NEW_TRAD" && currentUser.rol === "driver") {
      onNewTrad?.(String(data?.tracking || data?.trackingId || ""));
      return;
    }

    if (kind === "TRAD_ACCEPTED" && currentUser.rol === "seller") {
      onAccepted?.(String(data?.tracking || data?.trackingId || ""));
    }
  };

  if (activeReceivedSubscription) {
    activeReceivedSubscription.remove();
    activeReceivedSubscription = null;
  }

  if (activeResponseSubscription) {
    activeResponseSubscription.remove();
    activeResponseSubscription = null;
  }

  activeReceivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      handleNotificationContent(notification.request?.content, "received");
    }
  );

  activeResponseSubscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationContent(
        response.notification?.request?.content,
        "response"
      );
    });

  return () => {
    if (activeReceivedSubscription) {
      activeReceivedSubscription.remove();
      activeReceivedSubscription = null;
    }

    if (activeResponseSubscription) {
      activeResponseSubscription.remove();
      activeResponseSubscription = null;
    }
  };
}