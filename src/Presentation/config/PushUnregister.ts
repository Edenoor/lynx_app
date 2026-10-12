// Baja del token de push al cerrar sesión. Sin esto el servidor sigue
// mandando las notificaciones del usuario a este teléfono para siempre
// (turbos, colectas, avisos de envíos), aunque nadie esté logueado.
//
// - El token que se registró se guarda acá para poder darlo de baja aunque
//   ya no haya sesión ni red para pedírselo a Expo.
// - Si al cerrar sesión no hay red, la baja queda pendiente y se reintenta al
//   abrir la app sin sesión. Volver a registrar un token (login) la descarta:
//   el servidor ya lo reasigna al usuario nuevo.
// - Solo el cierre manual da de baja: la sesión vencida sola NO, porque el
//   teléfono sigue siendo del chofer y tiene que enterarse de la colecta.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "./Api";

const TOKEN_KEY = "lynx.push.token";
const PENDING_KEY = "lynx.push.unregisterPending";
const UNREGISTER_TIMEOUT_MS = 5000;

export async function rememberPushToken(token: string) {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {}
}

// El endpoint no pide sesión: la prueba de que el pedido viene de este
// teléfono es el propio token.
async function postUnregister(token: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UNREGISTER_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/v2/push/unregister`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      signal: controller.signal,
    });
    // 400 = el servidor no lo reconoce como token: reintentar no sirve.
    return res.ok || res.status === 400;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Nunca tira error ni demora el cierre de sesión más que el timeout.
export async function unregisterPushOnLogout() {
  let token: string | null = null;
  try {
    token = await AsyncStorage.getItem(TOKEN_KEY);
  } catch {}
  if (!token) return;

  const ok = await postUnregister(token);
  try {
    if (ok) await AsyncStorage.multiRemove([TOKEN_KEY, PENDING_KEY]);
    else await AsyncStorage.setItem(PENDING_KEY, token);
  } catch {}
}

export async function retryPendingPushUnregister() {
  let token: string | null = null;
  try {
    token = await AsyncStorage.getItem(PENDING_KEY);
  } catch {}
  if (!token) return;

  if (await postUnregister(token)) {
    try {
      // Si mientras tanto alguien inició sesión y registró el token, no se
      // borra lo nuevo.
      if ((await AsyncStorage.getItem(PENDING_KEY)) === token) {
        await AsyncStorage.multiRemove([TOKEN_KEY, PENDING_KEY]);
      }
    } catch {}
  }
}
