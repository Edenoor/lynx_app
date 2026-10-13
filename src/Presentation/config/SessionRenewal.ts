// src/Presentation/config/SessionRenewal.ts
//
// Renovación de la sesión (C7). El JWT vence a las JWT_EXPIRES_IN del servidor
// y antes, al vencer, el GPS se cortaba y la app deslogueaba al chofer a mitad
// del turno. Ahora, cuando el token entra en la segunda mitad de su vida (y
// como mucho RENEW_BEFORE_MS antes de vencer), se pide uno nuevo a
// POST /v2/auth/renew.
//
// La llaman la tarea de GPS antes de cada subida (corre también en segundo
// plano, sin React) y UserContext al abrir la app, al volver a primer plano y
// cada tanto mientras está abierta. Un 401 de /renew significa que la sesión
// fue revocada (baja, cambio de clave o de rol): postJsonWithTimeout ya avisa
// al manejador de 401, que cierra la sesión.

import { currentSessionEpoch, readSession, saveSession } from "../../Data/sources/local/SessionStorage";
import { setAuthToken } from "../../Data/sources/remote/api/ApiDelivery";
import { postJsonWithTimeout } from "./Api";

const RENEW_BEFORE_MS = 2 * 60 * 60_000;
const RENEW_TIMEOUT_MS = 15_000;
// Tras una falla (sin red, servidor viejo sin /renew) no se reintenta en cada
// subida del GPS, que corre cada 30 s.
const RETRY_AFTER_FAIL_MS = 5 * 60_000;

type RenewedListener = (token: string) => void;
const listeners = new Set<RenewedListener>();

// UserContext se suscribe para que las pantallas que usan user.token tengan el
// nuevo.
export const onSessionRenewed = (listener: RenewedListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// Solo hacen falta `iat` y `exp`; la firma la valida el servidor.
const tokenLifetime = (token: string): { issuedAt: number; expiresAt: number } | null => {
  try {
    const part = token.split(".")[1];
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4);
    const payload = JSON.parse(atob(base64));
    if (typeof payload?.iat !== "number" || typeof payload?.exp !== "number") return null;
    return { issuedAt: payload.iat * 1000, expiresAt: payload.exp * 1000 };
  } catch {
    return null;
  }
};

// Con un umbral fijo de 2 h, un token que dura 2 h o menos estaría siempre
// "por vencer" y se renovaría en cada subida del GPS. La mitad de su vida
// garantiza que el token recién renovado no vuelva a calificar enseguida.
const shouldRenew = (lifetime: { issuedAt: number; expiresAt: number }, now: number) => {
  const remaining = lifetime.expiresAt - now;
  const threshold = Math.min(RENEW_BEFORE_MS, (lifetime.expiresAt - lifetime.issuedAt) / 2);
  // Vencido ya no se puede renovar: el próximo pedido da 401 y pide login.
  return remaining > 0 && remaining <= threshold;
};

const readToken = async (): Promise<{ session: any; token: string } | null> => {
  try {
    const raw = await readSession();
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.token ? { session, token: String(session.token) } : null;
  } catch {
    return null;
  }
};

let inflight: Promise<void> | null = null;
let lastFailAt = 0;

// La app y la tarea de GPS pueden pedirla a la vez: comparten una sola.
export const renewSessionIfNeeded = (): Promise<void> => {
  if (!inflight) {
    inflight = renew().finally(() => {
      inflight = null;
    });
  }
  return inflight;
};

const renew = async () => {
  if (Date.now() - lastFailAt < RETRY_AFTER_FAIL_MS) return;

  // Si mientras viaja el pedido se cierra la sesión o entra otro usuario, la
  // época cambia y el token renovado se descarta (ver SessionStorage).
  const epoch = currentSessionEpoch();
  const stored = await readToken();
  if (!stored) return;
  const lifetime = tokenLifetime(stored.token);
  if (!lifetime || !shouldRenew(lifetime, Date.now())) return;

  let res: any;
  try {
    res = await postJsonWithTimeout("/v2/auth/renew", {}, RENEW_TIMEOUT_MS);
  } catch (e: any) {
    lastFailAt = Date.now();
    if (__DEV__) console.log("[Lynx Auth] No se pudo renovar la sesión:", String(e?.message ?? e));
    return;
  }
  if (!res?.ok || typeof res.token !== "string") {
    lastFailAt = Date.now();
    if (__DEV__) console.log("[Lynx Auth] Renovación rechazada:", res?.status, res?.error);
    return;
  }

  // Si no se pudo guardar, el token actual sigue valiendo hasta que vence:
  // no se usa uno nuevo que la tarea de GPS no puede leer.
  let saved: boolean;
  try {
    saved = await saveSession(JSON.stringify({ ...stored.session, token: res.token }), epoch);
  } catch {
    lastFailAt = Date.now();
    return;
  }
  if (!saved) return;

  setAuthToken(res.token);
  listeners.forEach((listener) => listener(res.token));
  if (__DEV__) console.log("[Lynx Auth] Sesión renovada");
};
