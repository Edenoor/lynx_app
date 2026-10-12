// src/Presentation/config/SessionRenewal.ts
//
// Renovación de la sesión (C7). El JWT vence a las JWT_EXPIRES_IN horas (8 h
// en prod) y antes, al vencer, el GPS se cortaba y la app deslogueaba al
// chofer a mitad del turno. Ahora, cuando al token le quedan menos de
// RENEW_BEFORE_MS, se pide uno nuevo a POST /v2/auth/renew.
//
// La llaman la tarea de GPS antes de cada subida (corre también en segundo
// plano, sin React) y UserContext al abrir la app, al volver a primer plano y
// cada tanto mientras está abierta. Un 401 de /renew significa que la sesión
// fue revocada (baja, cambio de clave o de rol): postJsonWithTimeout ya avisa
// al manejador de 401, que cierra la sesión.

import { readSession, saveSession } from "../../Data/sources/local/SessionStorage";
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

// Solo hace falta `exp`; la firma la valida el servidor.
const tokenExpiresAt = (token: string): number | null => {
  try {
    const part = token.split(".")[1];
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4);
    const payload = JSON.parse(atob(base64));
    return typeof payload?.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
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

  const stored = await readToken();
  if (!stored) return;
  const expiresAt = tokenExpiresAt(stored.token);
  // Vencido ya no se puede renovar: el próximo pedido da 401 y pide login.
  if (expiresAt === null || expiresAt <= Date.now() || expiresAt - Date.now() > RENEW_BEFORE_MS) return;

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

  // Si mientras viajaba se cerró la sesión o entró otro usuario, no se pisa.
  const current = await readToken();
  if (!current || current.token !== stored.token) return;

  await saveSession(JSON.stringify({ ...current.session, token: res.token }));
  setAuthToken(res.token);
  listeners.forEach((listener) => listener(res.token));
  if (__DEV__) console.log("[Lynx Auth] Sesión renovada");
};
