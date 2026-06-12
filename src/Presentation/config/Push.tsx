// src/Presentation/config/Push.ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as Location from "expo-location";
import { postJson } from "./Api";

type MobileRole = "seller" | "driver" | "admin";
type NotiKind = "NEW_TRAD" | "TRAD_ACCEPTED" | "INFO" | "ALERT";

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
  username: string;
  rol: MobileRole;
  vehicleType?: string | null;
}) {
  if (!Device.isDevice) {
    console.log("[Lynx Push Mobile] No es dispositivo físico. Expo push no disponible.");
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

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  console.log("==============================================");
  console.log("[Lynx Push Mobile] Expo Push Token:");
  console.log(token);
  console.log("==============================================");

  let lat: number | null = null;
  let lng: number | null = null;

  try {
    const locPerm = await Location.requestForegroundPermissionsAsync();

    if (locPerm.status === "granted") {
      const pos = await Location.getCurrentPositionAsync({});
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    }
  } catch (error) {
    console.log("[Lynx Push Mobile] No se pudo obtener ubicación inicial:", error);
  }

  try {
    const response = await postJson("/devices/register", {
      username: params.username,
      rol: params.rol,
      expoPushToken: token,
      pushToken: token,
      platform: Device.osName?.toLowerCase() ?? null,
      deviceName: Device.deviceName ?? null,
      vehicleType: params.vehicleType ?? null,
      lat,
      lng,
    });

    console.log("[Lynx Push Mobile] Registro legacy /devices/register:", response);
  } catch (error) {
    console.log("[Lynx Push Mobile] Error registrando device legacy:", error);
  }

  return token;
}

export function attachNotificationListeners({
  currentUser,
  onNewTrad,
  onAccepted,
  onAny,
}: {
  currentUser: { username: string; rol: MobileRole };
  onNewTrad?: (tracking: string) => void;
  onAccepted?: (tracking: string) => void;
  onAny?: (payload: {
    kind: NotiKind;
    title: string;
    body?: string;
    data?: any;
  }) => void;
}) {
  const normalizeKind = (type?: unknown): NotiKind => {
    const normalized = String(type ?? "").toUpperCase();

    if (normalized === "NEW_TRAD") return "NEW_TRAD";
    if (normalized === "TRAD_ACCEPTED") return "TRAD_ACCEPTED";
    if (normalized.includes("ALERT")) return "ALERT";

    return "INFO";
  };

  const save = (
    kind: NotiKind,
    title?: string | null,
    body?: string | null,
    data?: any,
  ) => {
    onAny?.({
      kind,
      title:
        title ??
        (kind === "NEW_TRAD"
          ? "Nuevo envío"
          : kind === "TRAD_ACCEPTED"
          ? "Envío aceptado"
          : "Notificación"),
      body: body ?? undefined,
      data,
    });
  };

  const handleNotificationContent = (
    content: Notifications.NotificationContent | undefined,
    source: "received" | "response",
  ) => {
    if (!content) return;

    const data: any = content.data ?? {};
    const type = data?.type;
    const kind = normalizeKind(type);

    console.log(`[Lynx Push Mobile] Notificación ${source}:`, {
      title: content.title,
      body: content.body,
      data,
    });

    save(kind, content.title ?? undefined, content.body ?? undefined, data);

    if (kind === "NEW_TRAD" && currentUser.rol === "driver") {
      onNewTrad?.(String(data?.tracking || data?.trackingId || ""));
      return;
    }

    if (kind === "TRAD_ACCEPTED" && currentUser.rol === "seller") {
      onAccepted?.(String(data?.tracking || data?.trackingId || ""));
    }
  };

  const sub1 = Notifications.addNotificationReceivedListener((notification) => {
    handleNotificationContent(notification.request?.content, "received");
  });

  const sub2 = Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotificationContent(
      response.notification?.request?.content,
      "response",
    );
  });

  return () => {
    sub1.remove();
    sub2.remove();
  };
}