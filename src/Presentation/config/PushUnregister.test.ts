// Pruebas de PushUnregister.ts: a nombre de quién queda el token de push de
// este teléfono al cerrar sesión, al vencer la sesión y al entrar otro usuario.
// El repo no tiene Jest: se compila y se corre con node (AsyncStorage, Api y
// fetch simulados; nada sale del proceso).
//   npx tsc --outDir /tmp/push-unregister --module commonjs --target es2020 --strict --skipLibCheck --jsx react-native \
//     src/Presentation/config/PushUnregister.test.ts
//   node /tmp/push-unregister/PushUnregister.test.js

export {};

const Module = require("module");
const store = new Map<string, string>();
const AsyncStorage = {
  getItem: async (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: async (k: string, v: string) => { store.set(k, v); },
  removeItem: async (k: string) => { store.delete(k); },
  multiSet: async (pairs: [string, string][]) => { pairs.forEach(([k, v]) => store.set(k, v)); },
  multiGet: async (keys: string[]) => keys.map((k) => [k, store.has(k) ? store.get(k)! : null]),
  multiRemove: async (keys: string[]) => { keys.forEach((k) => store.delete(k)); },
};
const origLoad = Module._load;
Module._load = function (request: string, ...rest: any[]) {
  if (request === "@react-native-async-storage/async-storage") return { __esModule: true, default: AsyncStorage };
  if (request === "./Api") return { API_URL: "https://api.test" };
  return origLoad.call(this, request, ...rest);
};

// El servidor: cada baja pedida (el token) y si responde.
const unregistered: string[] = [];
let online = true;
(globalThis as any).fetch = async (url: string, init: any) => {
  if (!online) throw new Error("Network request failed");
  if (url !== "https://api.test/v2/push/unregister" || init?.method !== "POST") throw new Error(`pedido inesperado ${url}`);
  unregistered.push(JSON.parse(init.body).token);
  return { ok: true, status: 200 };
};

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};
const reset = () => { store.clear(); unregistered.length = 0; online = true; };
const keys = () => [...store.keys()].sort();

(async () => {
  // Después de los simulados (un import arriba se cargaría antes).
  const P = await import("./PushUnregister");
  // Login de un chofer: el token queda a su nombre.
  reset();
  await P.rememberPushToken("ExpoToken[A]", 38);
  eq("registrar guarda el token y su dueño", [store.get("lynx.push.token"), store.get("lynx.push.owner")], ["ExpoToken[A]", "38"]);
  await P.releasePushTokenOfOthers(38);
  await P.releasePushTokenOfOthers("38");
  eq("el mismo usuario (número o texto) no da de baja nada", unregistered, []);

  // Su sesión vence (no se da de baja) y entra un Picker en el mismo teléfono.
  await P.releasePushTokenOfOthers(7);
  eq("otro usuario: se da de baja el token del anterior", unregistered, ["ExpoToken[A]"]);
  eq("y no queda nada anotado", keys(), []);

  // Sin red al entrar: queda pendiente y se reintenta.
  reset();
  await P.rememberPushToken("ExpoToken[A]", 38);
  online = false;
  await P.releasePushTokenOfOthers(7);
  eq("sin red: la baja queda pendiente", store.get("lynx.push.unregisterPending"), "ExpoToken[A]");
  online = true;
  await P.releasePushTokenOfOthers(7, { trustUnknownOwner: true });
  eq("al recuperar la sesión con red, se reintenta la pendiente", [unregistered, keys()], [["ExpoToken[A]"], []]);

  // Si el que entra registra su push, el token pasa a ser suyo y nada pendiente.
  reset();
  await P.rememberPushToken("ExpoToken[A]", 38);
  online = false;
  await P.releasePushTokenOfOthers(7);
  online = true;
  await P.rememberPushToken("ExpoToken[A]", 7);
  await P.releasePushTokenOfOthers(7);
  eq("registrar a nombre del nuevo descarta la baja pendiente", [unregistered, store.get("lynx.push.owner"), store.has("lynx.push.unregisterPending")], [[], "7", false]);

  // Token de una versión anterior (sin dueño anotado).
  reset();
  store.set("lynx.push.token", "ExpoToken[V]");
  await P.releasePushTokenOfOthers(38, { trustUnknownOwner: true });
  eq("sesión recuperada y token sin dueño: se deja (lo más probable es que sea suyo)", unregistered, []);
  await P.releasePushTokenOfOthers(7);
  eq("login y token sin dueño: se da de baja", unregistered, ["ExpoToken[V]"]);

  // Sin token o sin usuario, no se pide nada.
  reset();
  await P.releasePushTokenOfOthers(7);
  await P.rememberPushToken("ExpoToken[A]", 38);
  await P.releasePushTokenOfOthers(undefined);
  await P.releasePushTokenOfOthers("");
  eq("sin token, o sin id de usuario, no hay pedidos", unregistered, []);

  // Cerrar sesión sigue dando de baja y borra también el dueño.
  await P.unregisterPushOnLogout();
  eq("cerrar sesión: baja y nada anotado", [unregistered, keys()], [["ExpoToken[A]"], []]);

  // Una baja que no llega nunca tira error ni frena el login.
  reset();
  await P.rememberPushToken("ExpoToken[A]", 38);
  (globalThis as any).fetch = (_: string, init: any) =>
    new Promise((_r, reject) => init.signal.addEventListener("abort", () => reject(new Error("Aborted"))));
  const t0 = Date.now();
  await P.releasePushTokenOfOthers(7);
  eq("si el servidor no responde, se corta a los 5 s y queda pendiente", [Date.now() - t0 < 6500, store.get("lynx.push.unregisterPending")], [true, "ExpoToken[A]"]);

  console.log(failed ? `\n${failed} FALLAS` : "\nOK");
  process.exit(failed ? 1 : 0);
})();
