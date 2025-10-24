export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.wynflex.com.ar';

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

// export const API_URL =
//   process.env.EXPO_PUBLIC_API_URL ?? 'https://api.wynflex.com.ar'; // cambiá la IP si hace falta

// export const postJson = async (path: string, body: any) => {
//   const res = await fetch(`${API_URL}${path}`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(body),
//   });
//   let json: any;
//   try { json = await res.json(); } catch { json = { ok: res.ok, status: res.status }; }
//   return json;
// };
