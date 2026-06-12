// src/Presentation/config/Api.tsx

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

export const postJson = async (path: string, body: any) => {
  const finalPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_URL}${finalPath}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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