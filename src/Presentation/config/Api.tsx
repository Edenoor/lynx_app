// src/Presentation/config/Api.tsx
import { readSession } from "../../Data/sources/local/SessionStorage";
import { handleUnauthorized } from "../../Data/sources/remote/api/ApiDelivery";

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

  let json: any;

  try {
    json = await res.json();
  } catch {
    json = { ok: res.ok, status: res.status };
  }

  if (typeof json?.ok !== "boolean") json.ok = res.ok;
  if (typeof json?.status !== "number") json.status = res.status;

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
export const postJsonWithTimeout = async (path: string, body: any, timeoutMs: number) => {
  const finalPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_URL}${finalPath}`;
  const token = await getStoredToken();

  const json: any = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader("Content-Type", "application/json");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.onload = () => {
      const okStatus = xhr.status >= 200 && xhr.status < 300;
      let parsed: any;
      try {
        parsed = JSON.parse(xhr.responseText);
      } catch {
        parsed = { ok: okStatus, status: xhr.status };
      }
      if (parsed === null || typeof parsed !== "object") parsed = { ok: okStatus, status: xhr.status };
      if (typeof parsed.ok !== "boolean") parsed.ok = okStatus;
      if (typeof parsed.status !== "number") parsed.status = xhr.status;
      resolve(parsed);
    };
    xhr.ontimeout = () => reject(new Error(`sin respuesta en ${timeoutMs} ms`));
    xhr.onerror = () => reject(new Error("sin red"));
    xhr.onabort = () => reject(new Error("request abortado"));
    xhr.send(JSON.stringify(body));
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