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
// Usuario al que se registró el token (el servidor lo tiene a su nombre).
const OWNER_KEY = "lynx.push.owner";
const UNREGISTER_TIMEOUT_MS = 5000;

export async function rememberPushToken(token: string, ownerId: number | string) {
  try {
    await AsyncStorage.multiSet([[TOKEN_KEY, token], [OWNER_KEY, String(ownerId)]]);
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
    if (ok) await AsyncStorage.multiRemove([TOKEN_KEY, PENDING_KEY, OWNER_KEY]);
    else await AsyncStorage.setItem(PENDING_KEY, token);
  } catch {}
}

// Al entrar un usuario: si el token de este teléfono quedó a nombre de otro
// (su sesión venció sin cerrar sesión, o la baja quedó pendiente), se da de
// baja antes de seguir. Si no, el que entra ve los avisos del anterior —sus
// mensajes de chat incluidos— cuando no registra su propio push (un Picker
// sin push habilitado). El que sí lo registra lo vuelve a pedir enseguida a su
// nombre. Hay que esperarla ANTES de mostrar la app: la baja borra el token
// en el servidor sea de quien sea, y no puede pisar el registro nuevo.
// Sin dueño anotado (token de una versión anterior) y sesión recuperada
// (`trustUnknownOwner`) se deja: lo más probable es que sea de ese usuario.
export async function releasePushTokenOfOthers(userId: number | string | null | undefined, { trustUnknownOwner = false } = {}) {
  if (userId == null || userId === "") return;
  let token: string | null = null;
  let owner: string | null = null;
  let pending: string | null = null;
  try {
    [token, owner, pending] = (await AsyncStorage.multiGet([TOKEN_KEY, OWNER_KEY, PENDING_KEY])).map(([, v]) => v);
  } catch {
    return;
  }
  const stale = token && (owner ? owner !== String(userId) : !trustUnknownOwner) ? token : pending;
  if (!stale) return;

  const ok = await postUnregister(stale);
  try {
    if (ok) await AsyncStorage.multiRemove([TOKEN_KEY, PENDING_KEY, OWNER_KEY]);
    else await AsyncStorage.setItem(PENDING_KEY, stale);
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
