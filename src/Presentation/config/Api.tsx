// src/Presentation/config/Api.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "https://api.wynflex.com.ar"
).replace(/\/+$/, "");

type UnauthorizedHandler = () => void | Promise<void>;

let unauthorizedHandler: UnauthorizedHandler | null = null;
let isHandlingUnauthorized = false;

export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  unauthorizedHandler = handler;
};

export const handleUnauthorizedResponse = async () => {
  if (isHandlingUnauthorized) return;

  isHandlingUnauthorized = true;

  try {
    await unauthorizedHandler?.();
  } finally {
    setTimeout(() => {
      isHandlingUnauthorized = false;
    }, 1000);
  }
};

const getStoredToken = async (): Promise<string | null> => {
  try {
    const rawUser = await AsyncStorage.getItem("user");
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

  console.log("API REQUEST:", `${method} ${url}`);

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
    await handleUnauthorizedResponse();

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