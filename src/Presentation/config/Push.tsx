// src/Presentation/config/Push.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import { postJson } from './Api';

// ✅ Handler unificado compatible con SDK 51+
Notifications.setNotificationHandler({
  handleNotification: async (): Promise<Notifications.NotificationBehavior> => ({
    shouldShowBanner: true,  // iOS
    shouldShowList: true,    // iOS
    shouldShowAlert: true,   // Android (y compatibilidad)
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ✅ Registrar token de notificación y enviar a tu backend
export async function setupPushAndRegisterDevice(params: {
  username: string;
  rol: 'seller' | 'driver' | 'admin';
  vehicleType?: string | null;
}) {
  if (!Device.isDevice) return null;

  // Permisos de notificaciones
  let perm = await Notifications.getPermissionsAsync();
  if (perm.status !== 'granted') {
    perm = await Notifications.requestPermissionsAsync();
    if (perm.status !== 'granted') return null;
  }

  // Token de Expo Push
  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // Ubicación inicial opcional
  let lat: number | null = null;
  let lng: number | null = null;
  try {
    const locPerm = await Location.requestForegroundPermissionsAsync();
    if (locPerm.status === 'granted') {
      const pos = await Location.getCurrentPositionAsync({});
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    }
  } catch {}

  // Registrar device en backend
  await postJson('/devices/register', {
    username: params.username,
    rol: params.rol,
    expoPushToken: token,
    platform: Device.osName?.toLowerCase() ?? null,
    vehicleType: params.vehicleType ?? null,
    lat,
    lng,
  });

  return token;
}

// ✅ Listener para manejar notificaciones entrantes
export function attachNotificationListeners({
  currentUser,
  onNewTrad,
  onAccepted,
  onAny,
}: {
  currentUser: { username: string; rol: 'seller' | 'driver' | 'admin' };
  onNewTrad?: (tracking: string) => void;
  onAccepted?: (tracking: string) => void;
  onAny?: (payload: {
    kind: 'NEW_TRAD' | 'TRAD_ACCEPTED' | 'INFO' | 'ALERT';
    title: string;
    body?: string;
    data?: any;
  }) => void;
}) {
  const save = (
    kind: 'NEW_TRAD' | 'TRAD_ACCEPTED' | 'INFO' | 'ALERT',
    title?: string | null,
    body?: string | null,
    data?: any
  ) => {
    onAny?.({
      kind,
      title:
        title ??
        (kind === 'NEW_TRAD'
          ? 'Nuevo envío'
          : kind === 'TRAD_ACCEPTED'
          ? 'Envío aceptado'
          : 'Notificación'),
      body: body ?? undefined,
      data,
    });
  };

  const sub1 = Notifications.addNotificationReceivedListener((n) => {
    const c = n.request?.content;
    const d: any = c?.data;
    if (!d) return;

    if (d.type === 'NEW_TRAD' && currentUser.rol === 'driver') {
      save('NEW_TRAD', c?.title ?? undefined, c?.body ?? undefined, d);
      onNewTrad?.(String(d.tracking || ''));
    }
    if (d.type === 'TRAD_ACCEPTED' && currentUser.rol === 'seller') {
      save('TRAD_ACCEPTED', c?.title ?? undefined, c?.body ?? undefined, d);
      onAccepted?.(String(d.tracking || ''));
    }
  });

  const sub2 = Notifications.addNotificationResponseReceivedListener((resp) => {
    const c = resp.notification?.request?.content;
    const d: any = c?.data;
    if (!d) return;

    if (d.type === 'NEW_TRAD' && currentUser.rol === 'driver') {
      save('NEW_TRAD', c?.title ?? undefined, c?.body ?? undefined, d);
      onNewTrad?.(String(d.tracking || ''));
    }
    if (d.type === 'TRAD_ACCEPTED' && currentUser.rol === 'seller') {
      save('TRAD_ACCEPTED', c?.title ?? undefined, c?.body ?? undefined, d);
      onAccepted?.(String(d.tracking || ''));
    }
  });

  return () => {
    sub1.remove();
    sub2.remove();
  };
}