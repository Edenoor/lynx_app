// src/Presentation/config/Api.tsx
export const API_URL =
  (process.env.EXPO_PUBLIC_API_URL ?? "https://api.wynflex.com.ar").replace(/\/+$/, "");

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

  // opcional: normalizar ok si el backend no lo trae
  if (typeof json?.ok !== "boolean") json.ok = res.ok;
  if (typeof json?.status !== "number") json.status = res.status;

  return json;
};
