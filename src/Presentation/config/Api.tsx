// src/Presentation/config/Api.tsx
import { readSession } from "../../Data/sources/local/SessionStorage";
import { handleUnauthorized } from "../../Data/sources/remote/api/ApiDelivery";
import { parseJsonBody } from "./jsonBody";

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "https://api.wynflex.com.ar"
).replace(/\/+$/, "");

const getStoredToken = async (): Promise<string | null> => {
  try {
    const rawUser = await readSession();
    if (!rawUser) return null;

    const parsed = JSON.parse(rawUser);
    return parsed?.token ? String(parsed.token) : null;
  } catch {
    return null;
  }
};

const requestJson = async (
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: any
) => {
  const finalPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_URL}${finalPath}`;
  const token = await getStoredToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (__DEV__) console.log("API REQUEST:", `${method} ${url}`);

  const res = await fetch(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  // Sin JSON no hay éxito (ver jsonBody.ts); si ni se pudo leer, tampoco.
  let text: string | null;
  try {
    text = await res.text();
  } catch {
    text = null;
  }
  const json: any = text === null
    ? { ok: false, status: res.status, error: "No se pudo leer la respuesta del servidor" }
    : parseJsonBody(text, res.status);

  if (res.status === 401) {
    await handleUnauthorized();

    return {
      ...json,
      ok: false,
      status: 401,
      sessionExpired: true,
      message: json?.message || "Tu sesión expiró. Volvé a iniciar sesión.",
    };
  }

  return json;
};

export const getJson = async (path: string) => {
  return requestJson("GET", path);
};

// POST con tiempo límite NATIVO. `fetch` no tiene ninguno: con la app en
// segundo plano Android congela la red por ratos y el request no falla, se
// queda esperando para siempre (medido el 15-sep-2026: tres horas colgado y
// 434 posiciones retenidas hasta abrir la app). `XMLHttpRequest.timeout` lo
// aplica OkHttp (callTimeout) del lado nativo, así que corta aunque los timers
// de JS estén dormidos, que es justo el caso en segundo plano. Devuelve el
// mismo shape que `postJson` y rechaza (throw) ante timeout o falta de red.
// Un rechazo no dice si el servidor llegó a ejecutar el pedido.
export const postJsonWithTimeout = (path: string, body: any, timeoutMs: number) =>
  sendJsonWithTimeout("POST", path, body, timeoutMs);

export const putJsonWithTimeout = (path: string, body: any, timeoutMs: number) =>
  sendJsonWithTimeout("PUT", path, body, timeoutMs);

// GET con el mismo límite: para una consulta que se repite sola (el sondeo de
// ofertas Turbo), así una colgada no deja la pantalla sin refrescar.
export const getJsonWithTimeout = (path: string, timeoutMs: number) =>
  sendJsonWithTimeout("GET", path, undefined, timeoutMs);

const sendJsonWithTimeout = async (method: "GET" | "POST" | "PUT", path: string, body: any, timeoutMs: number) => {
  const finalPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_URL}${finalPath}`;
  const token = await getStoredToken();

  const json: any = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader("Content-Type", "application/json");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    // Sin JSON no hay éxito: así el GPS no da por subidas posiciones que
    // contestó una página HTML (las deja en el buffer y reintenta).
    xhr.onload = () => resolve(parseJsonBody(xhr.responseText, xhr.status));
    xhr.ontimeout = () => reject(new Error(`sin respuesta en ${timeoutMs} ms`));
    xhr.onerror = () => reject(new Error("sin red"));
    xhr.onabort = () => reject(new Error("request abortado"));
    xhr.send(body === undefined ? null : JSON.stringify(body));
  });

  if (json.status === 401) {
    // Sin await: el manejador cierra la sesión llamando a stopDriverTracking,
    // que espera a la subida del GPS en curso, y esa subida es justamente la
    // que está acá. Esperarlo trababa las dos (N-APP-3).
    void handleUnauthorized();
    return {
      ...json,
      ok: false,
      status: 401,
      sessionExpired: true,
      message: json?.message || "Tu sesión expiró. Volvé a iniciar sesión.",
    };
  }

  return json;
};

export const postJson = async (path: string, body: any) => {
  return requestJson("POST", path, body);
};

export const putJson = async (path: string, body: any) => {
  return requestJson("PUT", path, body);
};

export const patchJson = async (path: string, body: any) => {
  return requestJson("PATCH", path, body);
};

export const deleteJson = async (path: string) => {
  return requestJson("DELETE", path);
};