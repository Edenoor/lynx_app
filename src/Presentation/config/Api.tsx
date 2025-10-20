export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.117:5000"; // cambiá la IP si hace falta

export const postJson = async (path: string, body: any) => {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json: any;
  try { json = await res.json(); } catch { json = { ok: res.ok, status: res.status }; }
  return json;
};
