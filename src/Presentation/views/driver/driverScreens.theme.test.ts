// Pruebas de las pantallas Driver con el tema dinámico (Mi cuenta, Envíos,
// Recorridos, Alertas, Mi domicilio, Turbo, QR y escaneo): las 18
// combinaciones, cambio en vivo sin perder estado, contraste de lo que se
// dibuja, radios, y que acciones, rutas y pedidos a la API sigan iguales.
// También lo de tema fijo: login, registro, recuperar, aviso de versión y
// onboarding en Light; visor de cámara oscuro; Seller/Picker con el de
// siempre; la transición entre lo público y Driver y la preferencia guardada.
// El repo no tiene Jest: se compila y se corre con node, desde la raíz:
//   npx tsc --outDir /tmp/driver-screens --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/driverScreens.theme.test.ts
//   node /tmp/driver-screens/driverScreens.theme.test.js
// Los archivos se transpilan al vuelo con el `typescript` del proyecto. Corren
// con un renderizador mínimo con hooks de verdad: cada componente guarda su
// estado, los setters vuelven a dibujar y los efectos corren después de cada
// render. Las pruebas buscan por texto y tocan botones; no siembran estados.
// La API, la navegación y lo nativo están simulados: nada sale del proceso.

export {};

const path = require("path");
const fs = require("fs");
const Module = require("module");

const APP = process.cwd();
const ts = require(path.join(APP, "node_modules", "typescript"));
const appRequire = Module.createRequire(path.join(APP, "package.json"));
const RealReact = appRequire("react");

// ---------- Renderizador mínimo con hooks ----------
type Slot = { v?: any; deps?: any[]; cleanup?: any; current?: any };
const instances = new Map<string, Slot[]>();
let hooks: Slot[] = [];
let hookIdx = 0;
let pending: (() => void)[] = [];
let dirty = false;
const contextOverride = new Map<any, any>();
const sameDeps = (a?: any[], b?: any[]) => !!a && !!b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
const slot = (): Slot => (hooks[hookIdx] ??= {}) && hooks[hookIdx++];

const FakeReact = {
  ...RealReact,
  useState: (init: any) => {
    const s = slot();
    if (!("v" in s)) s.v = typeof init === "function" ? init() : init;
    return [s.v, (x: any) => { const nv = typeof x === "function" ? x(s.v) : x; if (!Object.is(nv, s.v)) { s.v = nv; dirty = true; } }];
  },
  useEffect: (f: () => any, deps?: any[]) => {
    const s = slot();
    if (deps && sameDeps(s.deps, deps)) return;
    s.deps = deps;
    pending.push(() => { if (typeof s.cleanup === "function") s.cleanup(); s.cleanup = f(); });
  },
  useMemo: (f: () => any, deps?: any[]) => {
    const s = slot();
    if (!deps || !sameDeps(s.deps, deps)) { s.v = f(); s.deps = deps; }
    return s.v;
  },
  useCallback: (f: any, deps?: any[]) => FakeReact.useMemo(() => f, deps),
  useRef: (v: any) => { const s = slot(); if (!("current" in s)) s.current = v; return s; },
  useContext: (ctx: any) => (contextOverride.has(ctx) ? contextOverride.get(ctx) : ctx._currentValue),
};

// <Contexto.Provider value>: vale para lo que se dibuja adentro.
const CONTEXT_TYPES = [Symbol.for("react.context"), Symbol.for("react.provider")];

function draw(node: any, at: string): any {
  if (node === null || node === undefined || typeof node === "boolean") return null;
  if (Array.isArray(node)) return node.map((n, i) => draw(n, `${at}.${n?.key ?? i}`)).filter((x) => x !== null);
  if (typeof node !== "object") return String(node);
  if (node.type === RealReact.Fragment) return draw(node.props.children, at);
  if (node.type && CONTEXT_TYPES.includes(node.type.$$typeof)) {
    const ctx = node.type._context ?? node.type;
    const had = contextOverride.has(ctx);
    const prev = contextOverride.get(ctx);
    contextOverride.set(ctx, node.props.value);
    try {
      return draw(node.props.children, at);
    } finally {
      if (had) contextOverride.set(ctx, prev);
      else contextOverride.delete(ctx);
    }
  }
  if (typeof node.type === "function") {
    const key = `${at}>${node.type.name}`;
    if (!instances.has(key)) instances.set(key, []);
    const [prevHooks, prevIdx] = [hooks, hookIdx];
    hooks = instances.get(key)!; hookIdx = 0;
    const out = node.type(node.props);
    [hooks, hookIdx] = [prevHooks, prevIdx];
    return draw(out, key);
  }
  const { children, ...props } = node.props ?? {};
  return { type: node.type, props, children: draw(children, `${at}>${node.type}`) };
}
const tick = () => new Promise((r) => setImmediate(r));
let rootEl: any;
// Remontar desmonta lo anterior: corren los cleanups (intervalos, suscripciones).
async function mount(el: any) {
  for (const slots of instances.values()) for (const s of slots) if (typeof s.cleanup === "function") s.cleanup();
  instances.clear();
  pending = [];
  rootEl = el;
  return settle();
}
async function settle() {
  let tree: any;
  for (let n = 0; n < 40; n++) {
    dirty = false;
    tree = draw(rootEl, "root");
    const run = pending; pending = [];
    run.forEach((f) => f());
    await tick(); await tick();
    if (!dirty && !pending.length) return tree;
  }
  throw new Error("el render no se estabiliza");
}

// ---------- Simulaciones ----------
const nav = { calls: [] as any[], navigate: (...a: any[]) => nav.calls.push(["navigate", ...a]), goBack: () => nav.calls.push(["goBack"]), addListener: () => () => {}, getParent: () => ({ reset: (a: any) => nav.calls.push(["reset", a]) }) };
const alerts: any[] = [];
const lastNav = () => nav.calls[nav.calls.length - 1];
const api = { calls: [] as string[], replies: {} as Record<string, any> };
const reply = (method: string, p: string) => {
  api.calls.push(`${method} ${p}`);
  const key = Object.keys(api.replies).find((k) => `${method} ${p}`.startsWith(k));
  return Promise.resolve(key ? api.replies[key] : { ok: true });
};
const host = (name: string) => name;
// Esquema nativo: lo que se le pide a Appearance y lo que informa useColorScheme.
// Como en Android, fijar un esquema hace que useColorScheme informe el fijado,
// y soltarlo (null) no lo corrige hasta que llega el aviso del sistema.
const native = { calls: [] as (string | null)[], reported: "dark" as string | null };
const camera = { permission: { granted: true } as any, request: async () => ({ granted: false, canAskAgain: true }) as any };
const RN = {
  StyleSheet: { create: (s: any) => s, hairlineWidth: 0.5, flatten: (s: any) => flat(s), absoluteFill: {}, absoluteFillObject: {} },
  View: "View", Text: "Text", ScrollView: "ScrollView", Pressable: "Pressable", TouchableOpacity: "TouchableOpacity",
  Image: "Image", ImageBackground: "ImageBackground", SafeAreaView: "SafeAreaView", ActivityIndicator: "ActivityIndicator",
  RefreshControl: "RefreshControl", TextInput: "TextInput", KeyboardAvoidingView: "KeyboardAvoidingView",
  Linking: { openSettings: () => {}, openURL: () => {} },
  AppState: { addEventListener: () => ({ remove: () => {} }) },
  ToastAndroid: { show: () => {}, LONG: 1 },
  Vibration: { vibrate: () => {} },
  Appearance: { setColorScheme: (s: string | null) => { native.calls.push(s ?? null); if (s) native.reported = s; } },
  useColorScheme: () => native.reported,
  Animated: {
    Value: class { constructor(public v: number) {} interpolate() { return 0; } },
    View: "Animated.View",
    loop: () => ({ start: () => {}, stop: () => {} }),
    sequence: () => ({}), parallel: () => ({}), timing: () => ({}), delay: () => ({}),
  },
  Easing: { inOut: () => ({}), ease: {} },
  Modal: ({ visible, children }: any) => (visible ? RealReact.createElement("Modal", null, children) : null),
  FlatList: ({ data, renderItem, ListEmptyComponent, keyExtractor }: any) =>
    RealReact.createElement("FlatList", null, data.length
      ? data.map((item: any, index: number) => RealReact.createElement("Item", { key: keyExtractor ? keyExtractor(item, index) : index }, renderItem({ item, index })))
      : ListEmptyComponent),
  Alert: { alert: (...a: any[]) => alerts.push(a) },
  Platform: { OS: "android", select: (o: any) => o.android ?? o.default },
  Dimensions: { get: () => ({ width: 360, height: 800 }) },
  StatusBar: { currentHeight: 24 },
};
const envios: any = { list: [], currentDeliveries: [], loading: false, error: null, currentError: null, reload: () => {}, username: "driver1" };
const MOCKS: Record<string, any> = {
  "react-native": RN,
  "@expo/vector-icons": { Ionicons: "Ionicons" },
  "expo-status-bar": { StatusBar: "StatusBar" },
  "@react-navigation/native": {
    useNavigation: () => nav,
    useFocusEffect: (cb: any) => FakeReact.useEffect(cb, [cb]),
    useIsFocused: () => true,
    DarkTheme: { dark: true, colors: {} },
    DefaultTheme: { dark: false, colors: {} },
    NavigationContainer: ({ theme, children }: any) => RealReact.createElement("NavigationContainer", { navTheme: theme }, children),
  },
  // Stack: dibuja solo las pantallas pedidas en stackScreens.
  "@react-navigation/native-stack": {
    createNativeStackNavigator: () => ({
      Navigator: ({ screenOptions, children }: any) => RealReact.createElement("Navigator", { style: screenOptions?.contentStyle }, children),
      Screen: ({ name, component }: any) => (registeredScreens.add(name), stackScreens.has(name) ? RealReact.createElement(component, { navigation: nav, route: { params: stackParams[name] ?? {} } }) : null),
    }),
  },
  "@react-native-community/datetimepicker": host("DateTimePicker"),
  "expo-file-system/next": { File: class {}, Paths: {} },
  "expo-file-system/legacy": {},
  "expo-location": { requestForegroundPermissionsAsync: async () => ({ status: "denied", canAskAgain: true }), Accuracy: { High: 4 } },
  "expo-camera": { CameraView: "CameraView", useCameraPermissions: () => [camera.permission, camera.request] },
  "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
  "expo-splash-screen": { preventAutoHideAsync: () => Promise.resolve(), hideAsync: () => Promise.resolve() },
  "react-native-maps": { __esModule: true, default: "MapView", Marker: "Marker" },
  "expo-constants": { __esModule: true, default: { expoConfig: { version: "1.0.0" } } },
};
const stackScreens = new Set<string>();
// Pantallas que registró el último stack dibujado.
const registeredScreens = new Set<string>();
// Cierres de sesión pedidos (el simulado no borra nada).
const session = { removed: 0 };
const stackParams: Record<string, any> = { Doc: { docKey: "dni_front" } };
const notis: any = { items: [], calls: [] as any[] };
["markRead", "markAllRead", "remove", "clear"].forEach((fn) => (notis[fn] = (...a: any[]) => notis.calls.push([fn, ...a])));
const onboarding = {
  state: { acceptedTerms: true, files: {}, completedLocal: false, vehicle: { type: "moto", brand: "Honda", model: "Wave", plate: "AB123CD", dni: "30111222", cuil: "20301112223" } },
  dispatch: () => {},
  userKey: "u1",
};
const UserContext = RealReact.createContext({ user: null, isAuthLoading: false });
// Preferencia guardada en el dispositivo (AsyncStorage) y lo que se escribe.
const storage = { stored: { version: 1, colorMode: "system", style: "marble", radius: "rounded" } as any, saved: [] as any[] };
const RELATIVE_MOCKS: [string, any][] = [
  ["config/Api", { getJson: (p: string) => reply("GET", p), postJson: (p: string) => reply("POST", p), putJson: (p: string) => reply("PUT", p) }],
  ["Envios/ViewModel", { __esModule: true, default: () => envios }],
  ["client/Landing/ViewModel", { __esModule: true, default: () => ({ user: { id: 7, username: "vendedor", rol: "SELLER" }, removeUserSession: () => { session.removed++; return Promise.resolve(); } }) }],
  ["config/Push", { setupPushAndRegisterDevice: async () => null, attachNotificationListeners: () => () => {} }],
  ["landing/ViewModel", { __esModule: true, default: () => ({ user: { first_name: "Ana María", email: "ana@lynx.test", username: "ana" }, removeUserSession: () => { session.removed++; return Promise.resolve(); } }) }],
  ["remote/api/ApiDelivery", { ApiDelivery: { post: () => { throw new Error("sin red en la prueba"); } } }],
  ["components/LynxPulseLoader", { LynxPulseLoader: host("LynxPulseLoader") }],
  ["context/NotificationContext", { useNotifications: () => notis }],
  ["context/UserContext", { UserContext, UserProvider: ({ children }: any) => children }],
  ["config/ScanSound", { playScanError: () => {}, playScanSuccess: () => {} }],
  ["home/ViewModel", { __esModule: true, default: () => ({ values: { username: "", password: "" }, onChange: () => {}, login: async () => ({ ok: false }), errorMessage: "", clearError: () => {} }) }],
  ["onboarding/OnboardingContext", { useOnboarding: () => onboarding, OnboardingProvider: ({ children }: any) => children }],
  ["onboarding/UploadDriverDocuments", { uploadDriverDocuments: () => new Promise(() => {}) }],
  ["onboarding/SaveDriverOnboardingBackend", { saveDriverOnboardingBackend: () => new Promise(() => {}) }],
  ["local/AppearanceStorage", { loadAppearance: () => Promise.resolve(storage.stored), saveAppearance: (v: any) => { storage.saved.push(v); return Promise.resolve(); } }],
];

const cache = new Map<string, { exports: any }>();
function load(file: string): any {
  const hit = cache.get(file);
  if (hit) return hit.exports;
  const out = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} as any };
  cache.set(file, mod);
  const req = (spec: string) => {
    if (spec in MOCKS) return MOCKS[spec];
    if (spec === "react") return FakeReact;
    if (spec.startsWith(".")) {
      if (/\.(png|jpg)$/.test(spec)) return { asset: spec };
      const base = path.resolve(path.dirname(file), spec).replace(/\\/g, "/");
      const mock = RELATIVE_MOCKS.find(([end]) => base.endsWith(end));
      if (mock) return mock[1];
      for (const ext of [".ts", ".tsx"]) if (fs.existsSync(base + ext)) return load(base + ext);
      throw new Error("no encuentro " + spec + " desde " + file);
    }
    try {
      return appRequire(spec);
    } catch (e: any) {
      throw new Error(`módulo sin simular: ${spec} (desde ${path.relative(APP, file)}): ${String(e?.message ?? e).split(/\r?\n/)[0]}`);
    }
  };
  new Function("require", "module", "exports", out)(req, mod, mod.exports);
  return mod.exports;
}
const L = (rel: string) => load(path.join(APP, rel).replace(/\\/g, "/"));

// ---------- Búsquedas en el árbol ----------
const flat = (style: any): any => (Array.isArray(style) ? Object.assign({}, ...style.map(flat)) : style || {});
const textOf = (n: any): string => (n === null ? "" : typeof n === "string" ? n : Array.isArray(n) ? n.map(textOf).join("") : textOf(n.children));
const all = (n: any, pred: (x: any) => boolean, out: any[] = []): any[] => {
  if (Array.isArray(n)) n.forEach((c) => all(c, pred, out));
  else if (n && typeof n === "object") { if (pred(n)) out.push(n); all(n.children, pred, out); }
  return out;
};
// El elemento tocable más chico que contiene el texto.
const pressable = (tree: any, text: string) => {
  const hits = all(tree, (x) => typeof x.props?.onPress === "function" && textOf(x).includes(text));
  if (!hits.length) throw new Error(`no hay botón con «${text}»`);
  return hits.reduce((a, b) => (textOf(b).length < textOf(a).length ? b : a));
};
async function press(tree: any, text: string) { pressable(tree, text).props.onPress(); return settle(); }
const byLabel = (tree: any, prefix: string) => all(tree, (x) => String(x.props?.accessibilityLabel ?? "").startsWith(prefix));

// ---------- Contraste (WCAG 2) ----------
const rgba = (s: string) => {
  if (s.startsWith("#")) return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)).concat(s.length === 9 ? parseInt(s.slice(7, 9), 16) / 255 : 1);
  const [r, g, b, a = 1] = (s.match(/[\d.]+/g) ?? []).map(Number);
  return [r, g, b, a];
};
const over = (fg: string, bg: string) => {
  const [r, g, b, a] = rgba(fg);
  const base = rgba(bg);
  return "#" + [r, g, b].map((v, i) => Math.round(v * a + base[i] * (1 - a)).toString(16).padStart(2, "0")).join("");
};
const lum = (s: string) =>
  rgba(s).slice(0, 3).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// Cada texto contra el fondo que realmente tiene debajo (capas compuestas desde
// el fondo de la pantalla). Textos ≥ 4.5:1, íconos ≥ 3:1.
function legibility(tree: any, screenBg: string) {
  const bad: string[] = [];
  let texts = 0;
  const walk = (n: any, bg: string, inherited?: string) => {
    if (Array.isArray(n)) return n.forEach((c) => walk(c, bg, inherited));
    if (!n || typeof n !== "object") return;
    if (n.type === "Modal") bg = screenBg;
    const st = flat(n.props.style);
    const here = st.backgroundColor && st.backgroundColor !== "transparent" ? over(st.backgroundColor, bg) : bg;
    if (n.type === "Text") {
      const color = st.color ?? inherited;
      const own = textOf(n).trim();
      if (own) {
        texts++;
        if (!color) bad.push(`«${own}» sin color`);
        else if (contrast(over(color, here), here) < 4.5) bad.push(`«${own}» ${contrast(over(color, here), here).toFixed(2)}`);
      }
      return walk(n.children, here, color);
    }
    if (n.type === "Ionicons" && n.props.color && contrast(over(n.props.color, here), here) < 3) bad.push(`ícono ${n.props.name} ${contrast(over(n.props.color, here), here).toFixed(2)}`);
    walk(n.children, here, inherited);
  };
  walk(tree, screenBg);
  return { bad, texts };
}

// Todos los colores dibujados salen del tema (nada fijo de la paleta oscura).
const themeStrings = (t: any) => {
  const set = new Set<string>();
  const add = (o: any) => Object.values(o).forEach((v) => (typeof v === "string" ? set.add(v) : v && typeof v === "object" && add(v)));
  add(t);
  return set;
};
function foreignColors(tree: any, t: any) {
  const own = themeStrings(t);
  const out = new Set<string>();
  for (const n of all(tree, () => true)) {
    const st = flat(n.props.style);
    for (const [k, v] of Object.entries({ ...st, iconColor: n.props.color, tint: n.props.tintColor })) {
      if (typeof v === "string" && /color$|^iconColor$|^tint$/i.test(k) && k !== "shadowColor" && !own.has(v)) out.add(`${n.type}.${k}=${v}`);
    }
  }
  return [...out];
}

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok || !detail ? "" : ` → ${detail}`}`);
};

// ---------- Datos de prueba ----------
const TODAY = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
const DELIVERIES = [
  { id: 1, numero_tracking: "T1", direccion: "Av. Corrientes 1234", nombre_fantasia: "Tienda Uno", estado: "En camino", precio_chofer: "1000", porcentaje_chofer: "10", metodo_envio: "flex" },
  { id: 2, numero_tracking: "T2", direccion: "Mitre 55", nombre_fantasia: "Tienda Dos", estado: "Pendiente", precio_chofer: "800", porcentaje_chofer: "0", metodo_envio: "turbo" },
  { id: 3, numero_tracking: "T3", direccion: "Belgrano 900", nombre_fantasia: "Tienda Tres", estado: "Entregado", precio_chofer: "1200", porcentaje_chofer: "0" },
  { id: 4, numero_tracking: "T4", direccion: "San Martín 10", nombre_fantasia: "Tienda Cuatro", estado: "Reprogramado", precio_chofer: "500", porcentaje_chofer: "0" },
];
const ROUTES = [
  { id: 11, type: "DELIVERY", status: "ASSIGNED", scheduled_date: TODAY, stops_count: 3, deliveries_count: 7, load_expected_count: 7, load_confirmed_count: null },
  { id: 12, type: "TURBO", status: "IN_PROGRESS", scheduled_date: TODAY, stops_count: 1, deliveries_count: 1, load_expected_count: null, load_confirmed_count: null },
  { id: 13, type: "PICKUP", status: "ASSIGNED", scheduled_date: TODAY, stops_count: 2, deliveries_count: 0, load_expected_count: null, load_confirmed_count: null },
  { id: 14, type: "DELIVERY", status: "COMPLETED", scheduled_date: TODAY, stops_count: 4, deliveries_count: 9, load_expected_count: 9, load_confirmed_count: 9 },
];
const setRoutesApi = () => {
  api.calls = [];
  api.replies = {
    "GET /v2/routes/mine": { ok: true, routes: ROUTES },
    "GET /v2/turbo/offers/mine": { ok: true, offers: [{ route_id: 90 }] },
    "GET /v2/offers/mine": { ok: true, offers: [{ id: 5, route_id: 77, kind: "ROUTE", scheduled_date: TODAY, expires_at: new Date().toISOString(), seconds_left: 300, deliveries: 4, first_addresses: ["Calle 1"] }] },
  };
};

const NOW = Date.now();
const NOTIS = [
  { id: "a", kind: "PICKUP_ASSIGNED", title: "Colecta asignada", body: "MAÑANERO 02 para hoy", read: false, createdAt: NOW - 1000, data: { route_id: 31, template_name: "MAÑANERO 02" } },
  { id: "b", kind: "ASSIGNMENT_ACCEPTED", title: "Envío aceptado", body: "T9 quedó a tu nombre", read: true, createdAt: NOW - 2000, data: { tracking: "T9" } },
  { id: "c", kind: "ASSIGNMENT_REJECTED", title: "Envío rechazado", body: "T8 vuelve a la lista", read: true, createdAt: NOW - 3000, data: {} },
  { id: "d", kind: "TURBO_OFFER", title: "Turbo disponible", body: "Retiro a 2 km", read: false, createdAt: NOW - 4000, data: {} },
  { id: "e", kind: "PICKUP_REASSIGNED", title: "Colecta quitada", body: "TARDE 01", read: true, createdAt: NOW - 5000, data: { route_id: 32 } },
  { id: "f", kind: "INFO", title: "Aviso", body: "Mantenimiento programado", read: true, createdAt: NOW - 6000, data: {} },
];
// Vencimientos relativos a cuando se arma la respuesta: 2 min y 9 s (urgente).
const turbos = (now = Date.now()) => [
  { route_id: 90, expires_at: new Date(now + 120_000).toISOString(), store_name: "Tienda Turbo", store_address: "Rivadavia 100", receiver_name: "Comprador", delivery_address: "Sarmiento 20", delivery_postal_code: "1000", distance_km: 2.5, deadline_at: new Date(now + 3_600_000).toISOString() },
  { route_id: 91, expires_at: new Date(now + 9_000).toISOString(), store_name: "Tienda Apurada", store_address: "Mitre 1", receiver_name: "Otro", delivery_address: "Paso 5", delivery_postal_code: null, distance_km: 1, deadline_at: null },
];
const setDriverApi = () => {
  api.calls = [];
  api.replies = {
    "GET /v2/driver-home/me": { ok: true, home: { address: "Lavalle 300" } },
    "GET /v2/driver-home/geo/search": { ok: true, candidates: [{ latitude: -34.6, longitude: -58.4, displayName: "Lavalle 300, CABA", road: "Lavalle", houseNumber: "300", city: "CABA" }] },
    "PUT /v2/driver-home/me": { ok: true, home: { address: "Lavalle 300, CABA" } },
    "GET /v2/turbo/offers/mine": { ok: true, offers: turbos() },
    "POST /v2/turbo/offers/90/accept": { ok: true, route: { id: 90 } },
    "POST /v2/turbo/offers/90/decline": { ok: true },
    "GET /v2/routes/31": { ok: true, route: { id: 31, type: "PICKUP", status: "ASSIGNED", scheduled_date: TODAY, stops: [], driver_confirmation: "PENDING" } },
  };
  notis.items = NOTIS;
  notis.calls = [];
};

(async () => {
  const { createTheme } = L("src/Presentation/theme/createTheme.ts");
  const { ThemeContext } = L("src/Presentation/theme/ThemeContext.ts");
  const { RADIUS_PRESETS, VISUAL_STYLES } = L("src/Presentation/theme/appearance.ts");
  const Account = L("src/Presentation/views/driver/account/DriverAccountScreen.tsx").default;
  const { EnviosScreen } = L("src/Presentation/views/driver/Envios/EnviosScreen.tsx");
  const Routes = L("src/Presentation/views/driver/routes/RoutesScreen.tsx").default;
  const Alerts = L("src/Presentation/views/common/NotificationScreen.tsx").default;
  const Home = L("src/Presentation/views/driver/account/DriverHomeScreen.tsx").default;
  const Turbo = L("src/Presentation/views/driver/turbo/TurboOffersScreen.tsx").default;
  const ScanOptions = L("src/Presentation/views/driver/scan/DriverScanOptionsScreen.tsx").default;
  const Scan = L("src/Presentation/views/driver/scan/DriverScanScreen.tsx").default;

  const useTheme = (t: any) => contextOverride.set(ThemeContext, { theme: t, preferences: {}, setAppearance: () => {}, resetAppearance: () => {} });
  const screens: [string, () => any, () => void][] = [
    ["Mi cuenta", () => RealReact.createElement(Account), () => { api.replies = { "GET /v2/driver-home/me": { ok: true, home: { address: "Lavalle 300" } } }; }],
    ["Envíos", () => RealReact.createElement(EnviosScreen, { navigation: nav }), () => { envios.currentDeliveries = DELIVERIES; }],
    ["Recorridos", () => RealReact.createElement(Routes, { navigation: nav, route: { params: undefined } }), setRoutesApi],
    ["Alertas", () => RealReact.createElement(Alerts), setDriverApi],
    ["Mi domicilio", () => RealReact.createElement(Home), setDriverApi],
    ["Turbo", () => RealReact.createElement(Turbo, { navigation: nav, route: { params: undefined } }), setDriverApi],
    ["QR", () => RealReact.createElement(ScanOptions, { navigation: nav, route: { params: undefined } }), setDriverApi],
  ];

  // 1) Las 18 combinaciones: dibuja, fondo del tema, legible y sin colores fijos.
  for (const scheme of ["dark", "light"]) for (const style of VISUAL_STYLES) for (const radius of RADIUS_PRESETS) {
    const t = createTheme({ scheme, style, radius });
    useTheme(t);
    for (const [name, el, prepare] of screens) {
      prepare();
      const tree = await mount(el());
      const combo = `${name} ${scheme}/${style}/${radius}`;
      const root = flat(tree.props.style);
      const { bad, texts } = legibility(tree, t.surfaces.screen);
      check(`${combo}: fondo de pantalla del tema`, root.backgroundColor === t.surfaces.screen, root.backgroundColor);
      check(`${combo}: ${texts} textos legibles`, texts > 5 && bad.length === 0, bad.slice(0, 4).join(" · "));
      const foreign = foreignColors(tree, t);
      check(`${combo}: todos los colores salen del tema`, foreign.length === 0, foreign.slice(0, 4).join(" · "));
      check(`${combo}: barra de estado según el esquema`, all(tree, (x) => x.type === "StatusBar").some((x) => x.props.style === (scheme === "dark" ? "light" : "dark")));
    }
  }

  // 2) Estilos y bordes: listas en filas en Minimal, tarjetas en Classic, radios del preset.
  for (const radius of RADIUS_PRESETS) {
    const t = createTheme({ scheme: "dark", style: "classic", radius });
    useTheme(t);
    const acc = await mount(screens[0][1]());
    const profile = all(acc, (x) => x.type === "Image")[0];
    const card = all(acc, (x) => x.type === "View" && all(x, (y) => y === profile).length > 0 && flat(x.props.style).borderRadius !== undefined && x !== profile).pop();
    check(`Mi cuenta ${radius}: tarjeta de perfil con radio xxl del preset (${t.radius.xxl})`, flat(card.props.style).borderRadius === t.radius.xxl);
    screens[2][2]();
    const rt = await mount(screens[2][1]());
    const row = pressable(rt, "Reparto #11");
    check(`Recorridos ${radius}: fila con radio lg del preset (${t.radius.lg})`, flat(row.props.style).borderRadius === t.radius.lg);
  }
  for (const style of VISUAL_STYLES) {
    const t = createTheme({ scheme: "light", style, radius: "balanced" });
    useTheme(t);
    envios.currentDeliveries = DELIVERIES;
    const env = await mount(screens[1][1]());
    const card = flat(pressable(env, "Av. Corrientes 1234").props.style);
    setRoutesApi();
    const rt = await mount(screens[2][1]());
    const routeRow = flat(pressable(rt, "Reparto #11").props.style);
    if (style === "minimal") {
      check("Minimal: envío como fila plana con separador", card.backgroundColor === "transparent" && card.borderBottomWidth === t.separator.width && card.marginBottom === 0);
      check("Minimal: recorrido como fila plana con separador", routeRow.backgroundColor === "transparent" && routeRow.borderBottomWidth === t.separator.width);
    } else {
      check(`${style}: envío como tarjeta del tema`, card.backgroundColor === t.surfaces.card && card.borderWidth === 1 && card.marginBottom === t.list.gap);
      check(`${style}: recorrido como tarjeta del tema`, routeRow.backgroundColor === t.surfaces.card && routeRow.borderRadius === t.radius.lg);
    }
    if (style === "marble") check("Marble: tarjeta con sombra suave", card.elevation === 2 && card.shadowRadius >= 12);
  }

  // 3) Cambio en vivo: otro tema sin remontar; el estado de la pantalla se conserva.
  {
    const dark = createTheme({ scheme: "dark", style: "classic" });
    const marble = createTheme({ scheme: "dark", style: "marble", radius: "rounded" });
    const light = createTheme({ scheme: "light", style: "minimal", radius: "square" });
    useTheme(dark);
    envios.currentDeliveries = DELIVERIES;
    let tree = await mount(screens[1][1]());
    tree = await press(tree, "Finalizados");
    check("Envíos: «Finalizados» muestra los cerrados", textOf(tree).includes("Belgrano 900") && !textOf(tree).includes("Av. Corrientes 1234"));
    useTheme(marble);
    tree = await settle();
    check("en vivo: Marble + Redondeado se aplica sin remontar", flat(tree.props.style).backgroundColor === marble.surfaces.screen && flat(pressable(tree, "Belgrano 900").props.style).borderRadius === marble.radius.lg);
    check("en vivo: la pestaña elegida se conserva", textOf(tree).includes("Historial de envíos cerrados") && !textOf(tree).includes("Av. Corrientes 1234"));
    useTheme(light);
    tree = await settle();
    check("en vivo: Claro + Minimal + Recto", flat(tree.props.style).backgroundColor === light.surfaces.screen && flat(pressable(tree, "Belgrano 900").props.style).backgroundColor === "transparent");
    check("en vivo: legible en claro", legibility(tree, light.surfaces.screen).bad.length === 0, legibility(tree, light.surfaces.screen).bad.join(" · "));
  }

  // 4) Acciones y rutas: las mismas que antes del cambio visual.
  useTheme(createTheme({ scheme: "dark" }));
  {
    nav.calls = []; alerts.length = 0;
    screens[0][2]();
    let tree = await mount(screens[0][1]());
    check("Mi cuenta: domicilio leído de la API", textOf(tree).includes("Lavalle 300"));
    tree = await press(tree, "Configuración");
    check("Mi cuenta: Configuración abre Apariencia", JSON.stringify(lastNav()) === JSON.stringify(["navigate", "AppearanceScreen"]));
    tree = await press(tree, "Mi domicilio");
    check("Mi cuenta: Mi domicilio abre su pantalla", JSON.stringify(lastNav()) === JSON.stringify(["navigate", "DriverHomeScreen"]));
    for (const [tab, route] of [["Envíos", "EnviosScreen"], ["QR", "DriverScanOptionsScreen"], ["Colectas", "CollectionsScreen"], ["Alertas", "NotificationsScreen"]]) {
      tree = await press(tree, tab);
      check(`Mi cuenta: barra → ${tab}`, JSON.stringify(lastNav()) === JSON.stringify(["navigate", route]));
    }
    tree = await press(tree, "Cerrar sesión");
    check("Mi cuenta: cerrar sesión pide confirmación (sin cerrar)", alerts.length === 1 && alerts[0][0] === "Cerrar sesión" && alerts[0][2].map((b: any) => b.text).join("|") === "Cancelar|Cerrar sesión" && !nav.calls.some((c) => c[0] === "reset"));
    nav.calls = []; session.removed = 0;
    await alerts[0][2].find((b: any) => b.text === "Cerrar sesión").onPress();
    tree = await settle();
    check("Mi cuenta: confirmar cierra la sesión sin navegar a mano (sin RESET a HomeScreen)", session.removed === 1 && nav.calls.length === 0, JSON.stringify(nav.calls));
    check("Mi cuenta: filas con el separador del tema", all(tree, (x) => x.type === "Pressable" && textOf(x).includes("Vehículo")).every((x) => flat(x.props.style).borderBottomWidth === 0.5));
  }
  {
    nav.calls = [];
    envios.currentDeliveries = DELIVERIES;
    let tree = await mount(screens[1][1]());
    check("Envíos: «En curso» muestra los no finalizados", ["Av. Corrientes 1234", "Mitre 55"].every((s) => textOf(tree).includes(s)) && !textOf(tree).includes("Belgrano 900"));
    const chips = byLabel(tree, "Estado: ").map((x) => x.props.accessibilityLabel);
    check("Envíos: estados con chip (texto de siempre)", JSON.stringify(chips) === JSON.stringify(["Estado: En camino", "Estado: A retirar"]), chips.join(", "));
    const dark = createTheme({ scheme: "dark" });
    const chipBg = (label: string) => flat(byLabel(tree, `Estado: ${label}`)[0].props.style).backgroundColor;
    check("Envíos: «En camino» con el color en camino, «A retirar» con el de pendiente", chipBg("En camino") === dark.status.inTransit.background && chipBg("A retirar") === dark.status.pending.background);
    tree = await press(tree, "Finalizados");
    check("Envíos: finalizados con «Entregado» e «Reprogramado» (incidencia)", chipBg("Entregado") === dark.status.delivered.background && chipBg("Reprogramado") === dark.status.incident.background);
    tree = await press(tree, "En curso");
    tree = await press(tree, "Recorridos de reparto, Turbo y ofertas");
    check("Envíos: abre Recorridos", JSON.stringify(lastNav()) === JSON.stringify(["navigate", "RoutesScreen"]));
    tree = await press(tree, "Mitre 55");
    check("Envíos: tocar un envío abre su detalle", all(tree, (x) => x.type === "Modal").some((m) => textOf(m).includes("DETALLE") && textOf(m).includes("T2")));
    tree = await press(all(tree, (x) => x.type === "Modal")[0], "Cerrar");
    check("Envíos: el detalle se cierra", !all(tree, (x) => x.type === "Modal").length);
    tree = await press(tree, "Neto");
    check("Envíos: el neto abre los totales visibles", all(tree, (x) => x.type === "Modal").some((m) => textOf(m).includes("Totales visibles") && textOf(m).includes("$1.700")));
  }
  {
    nav.calls = [];
    setRoutesApi();
    let tree = await mount(screens[2][1]());
    check("Recorridos: mismos pedidos a la API", JSON.stringify([...api.calls].sort()) === JSON.stringify([`GET /v2/routes/mine?date=${TODAY}`, "GET /v2/offers/mine", "GET /v2/turbo/offers/mine"].sort()), api.calls.join(", "));
    const order = all(tree, (x) => x.type === "Item").map((x) => textOf(x).match(/#\d+/)?.[0]);
    check("Recorridos: sin colectas y en el orden del servidor", JSON.stringify(order) === JSON.stringify(["#11", "#12", "#14"]), order.join(", "));
    const chips = byLabel(tree, "Estado: ").map((x) => x.props.accessibilityLabel);
    check("Recorridos: estado con chip y el texto de siempre", JSON.stringify(chips) === JSON.stringify(["Estado: Asignado", "Estado: En curso", "Estado: Completado"]), chips.join(", "));
    tree = await press(tree, "Turbo #12");
    check("Recorridos: tocar un recorrido abre su detalle", JSON.stringify(lastNav()) === JSON.stringify(["navigate", "RouteDetailScreen", { routeId: 12 }]));
    tree = await press(tree, "un turbo ofrecido");
    check("Recorridos: el aviso Turbo abre las ofertas", JSON.stringify(lastNav()) === JSON.stringify(["navigate", "TurboOffersScreen"]));
    api.calls = [];
    tree = await press(tree, "Aceptar");
    check("Recorridos: aceptar la oferta hace el mismo pedido y recarga", api.calls[0] === "POST /v2/offers/77/accept" && api.calls.some((c) => c.startsWith("GET /v2/routes/mine")));
    api.calls = [];
    tree = await press(tree, "No");
    check("Recorridos: rechazar la oferta hace el mismo pedido", api.calls[0] === "POST /v2/offers/77/decline");
  }

  const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

  // 5) Alertas: tono por tipo, no leídas, detalle y acciones de siempre.
  {
    const t = createTheme({ scheme: "dark" });
    useTheme(t);
    nav.calls = []; setDriverApi();
    let tree = await mount(screens[3][1]());
    const txt = textOf(tree);
    check("Alertas: cuenta las sin leer", txt.includes("2 notificaci") && txt.includes("sin leer"));
    check("Alertas: la más nueva primero", txt.indexOf("Colecta asignada") < txt.indexOf("Mantenimiento programado"));
    const icon = (title: string) => all(pressable(tree, title), (x) => x.type === "Ionicons")[0].props.color;
    check("Alertas: tono por tipo (aceptado, rechazado, quitada, info, asignada)",
      icon("Envío aceptado") === t.status.confirmed.icon && icon("Envío rechazado") === t.status.rejected.icon &&
      icon("Colecta quitada") === t.status.pending.icon && icon("Mantenimiento") === t.status.neutral.icon && icon("MAÑANERO 02 para hoy") === t.status.inTransit.icon);
    check("Alertas: punto en las 2 sin leer", all(tree, (x) => x.type === "View" && flat(x.props.style).width === 7 && flat(x.props.style).backgroundColor === t.status.rejected.text).length === 2);
    tree = await press(tree, "Marcar leídas");
    tree = await press(tree, "Vaciar");
    check("Alertas: marcar leídas y vaciar llaman al contexto", same(notis.calls, [["markAllRead"], ["clear"]]));
    notis.calls = []; api.calls = [];
    tree = await press(tree, "MAÑANERO 02 para hoy");
    const modal = () => all(tree, (x) => x.type === "Modal")[0];
    check("Alertas: abrir marca leída y consulta el recorrido en vivo", same(notis.calls, [["markRead", "a"]]) && api.calls.includes("GET /v2/routes/31"));
    check("Alertas: el detalle muestra la colecta", !!modal() && textOf(modal()).includes("MAÑANERO 02"));
    tree = await press(modal(), "Ver colecta");
    check("Alertas: «Ver colecta» abre el detalle del recorrido", same(lastNav(), ["navigate", "RouteDetailScreen", { routeId: 31, name: "MAÑANERO 02" }]) && !modal());
    tree = await press(tree, "Retiro a 2 km");
    tree = await press(modal(), "Ver ofertas");
    check("Alertas: Turbo → ofertas", same(lastNav(), ["navigate", "TurboOffersScreen"]));
    tree = await press(tree, "TARDE 01");
    tree = await press(modal(), "Ver colectas");
    check("Alertas: colecta quitada → Colectas", same(lastNav(), ["navigate", "CollectionsScreen"]));
    notis.calls = [];
    tree = await press(tree, "Mantenimiento programado");
    tree = await press(modal(), "Eliminar");
    check("Alertas: eliminar quita esa alerta (ya leída: no se vuelve a marcar)", same(notis.calls, [["remove", "f"]]));
    for (const [tab, route] of [["Inicio", "DriverScreen"], ["Envíos", "EnviosScreen"], ["QR", "DriverScanOptionsScreen"]]) {
      tree = await press(tree, tab);
      check(`Alertas: barra → ${tab}`, same(lastNav(), ["navigate", route]));
    }
    for (const scheme of ["dark", "light"]) for (const style of VISUAL_STYLES) {
      const th = createTheme({ scheme, style });
      useTheme(th); setDriverApi();
      tree = await mount(screens[3][1]());
      tree = await press(tree, "MAÑANERO 02 para hoy");
      const { bad, texts } = legibility(modal(), th.surfaces.screen);
      check(`Alertas ${scheme}/${style}: detalle legible (${texts} textos)`, texts > 5 && !bad.length, bad.join(" · "));
      const rowStyle = flat(pressable(tree, "Envío aceptado").props.style);
      check(`Alertas ${scheme}/${style}: fila del tema`, style === "minimal" ? rowStyle.backgroundColor === "transparent" && rowStyle.borderBottomWidth === th.separator.width : rowStyle.backgroundColor === th.surfaces.card);
    }
  }

  // 6) Mi domicilio: los mismos pedidos y validaciones.
  {
    const t = createTheme({ scheme: "light", style: "marble" });
    useTheme(t);
    nav.calls = []; alerts.length = 0; setDriverApi();
    let tree = await mount(screens[4][1]());
    check("Mi domicilio: lee el domicilio cargado", textOf(tree).includes("Lavalle 300") && api.calls[0] === "GET /v2/driver-home/me");
    all(tree, (x) => x.type === "TextInput")[0].props.onChangeText("Lavalle 300, CABA");
    tree = await settle();
    byLabel(tree, "Buscar dirección")[0].props.onPress();
    tree = await settle();
    check("Mi domicilio: busca con el mismo pedido", api.calls.some((c) => c.startsWith("GET /v2/driver-home/geo/search?")));
    check("Mi domicilio: con un resultado lo propone", textOf(tree).includes("Se guarda:"));
    tree = await press(tree, "Guardar domicilio");
    check("Mi domicilio: guarda con PUT y avisa", api.calls.includes("PUT /v2/driver-home/me") && alerts.some((a) => a[0] === "Domicilio guardado"));
    tree = await press(tree, "Borrar");
    check("Mi domicilio: borrar pide confirmación (sin borrar)", alerts[alerts.length - 1][0] === "Borrar domicilio" && api.calls.filter((c) => c === "PUT /v2/driver-home/me").length === 1);
    tree = await press(tree, "Estoy en mi casa");
    const err = all(tree, (x) => x.type === "Text" && textOf(x).startsWith("Sin permiso de ubicación"))[0];
    check("Mi domicilio: sin permiso, el error de siempre con el rojo del tema", !!err && flat(err.props.style).color === t.status.rejected.text);
    check("Mi domicilio: el error es legible", legibility(tree, t.surfaces.screen).bad.length === 0, legibility(tree, t.surfaces.screen).bad.join(" · "));
    tree = await press(tree, "Mi cuenta");
    check("Mi domicilio: volver", same(lastNav(), ["goBack"]));
  }

  // 7) Turbo: contador y urgencia visibles en los tres estilos; mismos pedidos.
  for (const style of VISUAL_STYLES) {
    const t = createTheme({ scheme: "light", style });
    useTheme(t);
    setDriverApi();
    const tree = await mount(screens[5][1]());
    const card = (id: number) => all(tree, (x) => x.type === "View" && flat(x.props.style).gap === 6 && textOf(x).includes(`Turbo #${id}`))[0];
    const [calm, urgent] = [flat(card(90).props.style), flat(card(91).props.style)];
    check(`Turbo ${style}: la oferta conserva el contorno`, calm.borderWidth === 1 && calm.borderColor === t.colors.primary);
    check(`Turbo ${style}: la que vence pronto se marca en rojo`, urgent.borderWidth === 1 && urgent.borderColor === t.status.rejected.text);
    const badge = all(card(91), (x) => x.type === "Text" && /s para responder/.test(textOf(x)))[0];
    check(`Turbo ${style}: contador urgente en rojo y con cifras fijas`, flat(badge.props.style).color === t.status.rejected.text && flat(badge.props.style).fontVariant?.[0] === "tabular-nums");
  }
  {
    useTheme(createTheme({ scheme: "dark" }));
    nav.calls = []; setDriverApi();
    let tree = await mount(screens[5][1]());
    check("Turbo: consulta las mismas ofertas", api.calls[0] === "GET /v2/turbo/offers/mine");
    const card90 = () => all(tree, (x) => x.type === "View" && flat(x.props.style).gap === 6 && textOf(x).includes("Turbo #90"))[0];
    api.calls = [];
    pressable(card90(), "Acepto").props.onPress();
    tree = await settle();
    check("Turbo: aceptar hace el mismo pedido y abre el recorrido", api.calls[0] === "POST /v2/turbo/offers/90/accept" && same(lastNav(), ["navigate", "RouteDetailScreen", { routeId: 90 }]));
    setDriverApi();
    tree = await mount(screens[5][1]());
    api.calls = [];
    pressable(card90(), "Paso").props.onPress();
    tree = await settle();
    check("Turbo: pasar hace el mismo pedido y saca la oferta", api.calls[0] === "POST /v2/turbo/offers/90/decline" && !textOf(tree).includes("Turbo #90"));
  }

  // 8) QR: mismas opciones y destinos; Colectar sigue derivando a LightData.
  {
    useTheme(createTheme({ scheme: "dark", style: "minimal" }));
    nav.calls = []; alerts.length = 0;
    let tree = await mount(screens[6][1]());
    tree = await press(tree, "Colectar");
    check("QR: Colectar avisa que es por LightData (sin abrir la cámara)", alerts[0]?.[0] === "Colectar desde LightData" && !nav.calls.length);
    for (const [label, call] of [["Asignar", ["navigate", "DriverScanScreen", { mode: "asignarme" }]], ["Planta", ["navigate", "DriverScanScreen", { mode: "planta" }]], ["Pendientes", ["navigate", "EnviosScreen"]]] as const) {
      tree = await press(tree, label);
      check(`QR: ${label}`, same(lastNav(), call));
    }
  }

  // 9) Escaneo: visor oscuro fijo sobre la cámara; permiso con la apariencia elegida.
  {
    const { DEFAULT_THEME } = L("src/Presentation/theme/FixedTheme.tsx");
    const light = createTheme({ scheme: "light", style: "marble", radius: "rounded" });
    useTheme(light);
    camera.permission = { granted: true };
    let tree = await mount(RealReact.createElement(Scan, { navigation: nav, route: { params: { mode: "asignarme" } } }));
    const cam = all(tree, (x) => x.type === "CameraView")[0];
    check("Escaneo: la cámara lee QR igual que antes", !!cam && same(cam.props.barcodeScannerSettings, { barcodeTypes: ["qr"] }) && typeof cam.props.onBarcodeScanned === "function");
    const bgs = all(tree, () => true).map((x) => flat(x.props.style).backgroundColor);
    check("Escaneo: la barra sobre la cámara va con el oscuro de siempre", bgs.includes(DEFAULT_THEME.surfaces.cardElevated) && !bgs.includes(light.surfaces.cardElevated));
    check("Escaneo: el visor es legible sobre la cámara", legibility(tree, "#000000").bad.length === 0, legibility(tree, "#000000").bad.join(" · "));
    camera.permission = null;
    camera.request = () => new Promise(() => {}); // el permiso todavía se está pidiendo
    tree = await mount(RealReact.createElement(Scan, { navigation: nav, route: { params: { mode: "planta" } } }));
    const box = all(tree, (x) => x.type === "View" && all(x, (y) => y.type === "LynxPulseLoader").length > 0).pop();
    check("Escaneo: preparando la cámara, con la apariencia elegida", flat(box.props.style).backgroundColor === light.surfaces.screen);
    camera.permission = { granted: true };
  }

  // 10) Cargador compartido: el logo (silueta blanca) se ve también en claro.
  {
    const { LynxPulseLoader } = L("src/Presentation/components/LynxPulseLoader.tsx");
    for (const scheme of ["dark", "light"]) {
      const t = createTheme({ scheme });
      useTheme(t);
      const tree = await mount(RealReact.createElement("View", { style: { backgroundColor: t.surfaces.screen } }, RealReact.createElement(LynxPulseLoader, { message: "Cargando..." })));
      const logo = all(tree, (x) => x.type === "Image")[0];
      check(`Cargador ${scheme}: logo teñido con el texto y legible`, flat(logo.props.style).tintColor === t.text.primary && legibility(tree, t.surfaces.screen).bad.length === 0);
    }
  }

  // 11) Tema fijo (FixedTheme): lo de adentro ve el fijo, no puede cambiar la
  // apariencia, fija lo nativo y soltarlo vuelve a la preferencia sin remontar.
  const { FixedTheme, PUBLIC_THEME, DEFAULT_THEME } = L("src/Presentation/theme/FixedTheme.tsx");
  const { NativeSchemeContext } = L("src/Presentation/theme/ThemeContext.ts");
  const seen: any[] = [];
  let ctxSeen: any;
  function Probe() {
    const ctx = FakeReact.useContext(ThemeContext);
    const [n, setN] = FakeReact.useState(0);
    seen.push(ctx.theme);
    ctxSeen = { ...ctx, bump: () => setN(n + 1), n };
    return RealReact.createElement("Probe", null);
  }
  {
    const outer = createTheme({ scheme: "dark", style: "marble", radius: "rounded" });
    const writes: any[] = [];
    contextOverride.set(ThemeContext, { theme: outer, preferences: storage.stored, setAppearance: (p: any) => writes.push(p), resetAppearance: () => writes.push("reset") });
    const locks: any[] = [];
    contextOverride.set(NativeSchemeContext, (s: any) => locks.push(s));
    let fixed: any = PUBLIC_THEME;
    const el = () => RealReact.createElement(FixedTheme, { theme: fixed, native: true }, RealReact.createElement(Probe));
    await mount(el());
    check("FixedTheme: adentro se ve Light + Classic + Equilibrado", ctxSeen.theme === PUBLIC_THEME && PUBLIC_THEME.scheme === "light" && PUBLIC_THEME.style === "classic" && PUBLIC_THEME.radiusPreset === "balanced");
    ctxSeen.setAppearance({ style: "minimal" }); ctxSeen.resetAppearance();
    check("FixedTheme: desde adentro no se cambia la apariencia guardada", writes.length === 0);
    check("FixedTheme: fija lo nativo en claro", same(locks, ["light"]));
    ctxSeen.bump(); await settle();
    fixed = null; rootEl = el(); await settle();
    check("FixedTheme: sin tema fijo vuelve la preferencia", ctxSeen.theme === outer);
    check("FixedTheme: el cambio no remonta (se conserva el estado)", ctxSeen.n === 1);
    check("FixedTheme: suelta lo nativo", same(locks, ["light", null]));
    contextOverride.delete(NativeSchemeContext);
  }

  // 12) Pantallas públicas: Light fijo sin importar la preferencia ni el teléfono.
  {
    const { HomeScreen } = L("src/Presentation/views/auth/home/Home.tsx");
    const { RegisterScreen } = L("src/Presentation/views/auth/register/Register.tsx");
    const { RecuperarScreen } = L("src/Presentation/views/auth/recuperar/Recuperar.tsx");
    const publics: [string, any][] = [["Login", HomeScreen], ["Crear cuenta", RegisterScreen], ["Recuperar", RecuperarScreen]];
    for (const [name, C] of publics) {
      const outputs: string[] = [];
      for (const outer of [createTheme({ scheme: "dark", style: "marble", radius: "rounded" }), createTheme({ scheme: "light", style: "minimal", radius: "square" })]) {
        useTheme(outer);
        const tree = await mount(RealReact.createElement(FixedTheme, { theme: PUBLIC_THEME, native: true }, RealReact.createElement(C, { navigation: nav })));
        outputs.push(JSON.stringify(tree));
        const { bad, texts } = legibility(tree, PUBLIC_THEME.surfaces.screen);
        check(`${name} (con ${outer.scheme}/${outer.style} guardado): fondo claro y legible (${texts} textos)`, flat(tree.props.style).backgroundColor === PUBLIC_THEME.surfaces.screen && !bad.length, bad.join(" · "));
        const foreign = foreignColors(tree, PUBLIC_THEME);
        check(`${name}: todos los colores del tema claro`, !foreign.length, foreign.join(" · "));
        check(`${name}: barra de estado con íconos oscuros`, all(tree, (x) => x.type === "StatusBar").some((x) => x.props.style === "dark"));
      }
      check(`${name}: igual con cualquier preferencia`, outputs[0] === outputs[1]);
    }
    useTheme(createTheme({ scheme: "dark" }));
    const tree = await mount(RealReact.createElement(FixedTheme, { theme: PUBLIC_THEME }, RealReact.createElement(HomeScreen, { navigation: nav })));
    const logo = all(tree, (x) => x.type === "Image")[0];
    check("Login: el logo con el color de marca sobre claro", flat(logo.props.style).tintColor === PUBLIC_THEME.colors.primary);
  }

  // 13) Aviso de versión: pantalla pública, Light fijo.
  {
    const { AppVersionGate } = L("src/Presentation/components/AppVersionGate.tsx");
    const realFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async () => ({ ok: true, json: async () => ({ min: "9.0.0", updateUrl: "https://example.test/lynx.apk" }) });
    useTheme(createTheme({ scheme: "dark", style: "marble" }));
    const locks: any[] = [];
    contextOverride.set(NativeSchemeContext, (s: any) => locks.push(s));
    const tree = await mount(RealReact.createElement(AppVersionGate, null, RealReact.createElement("App", null)));
    (globalThis as any).fetch = realFetch;
    contextOverride.delete(NativeSchemeContext);
    check("Versión vieja: bloquea con el aviso", textOf(tree).includes("Actualizá Lynx") && !all(tree, (x) => x.type === "App").length);
    check("Versión vieja: en Light fijo, legible", flat(tree.props.style).backgroundColor === PUBLIC_THEME.surfaces.screen && legibility(tree, PUBLIC_THEME.surfaces.screen).bad.length === 0);
    check("Versión vieja: barra de estado oscura y nativo en claro", all(tree, (x) => x.type === "StatusBar")[0]?.props.style === "dark" && same(locks, ["light"]));
  }

  // 14) Onboarding del chofer: Light fijo aunque el chofer tenga otra apariencia.
  {
    const { OnboardingStackNavigator } = L("src/Presentation/navigator/OnboardingStackNavigator.tsx");
    useTheme(createTheme({ scheme: "dark", style: "marble", radius: "rounded" }));
    const locks: any[] = [];
    contextOverride.set(NativeSchemeContext, (s: any) => locks.push(s));
    for (const [name, rel] of [["Intro", "IntroScreen"], ["Terms", "TermsScreen"], ["Vehicle", "VehicleScreen"], ["Review", "ReviewSubmitScreen"], ["Submit", "SubmitScreen"]]) {
      stackScreens.clear(); stackScreens.add(name);
      locks.length = 0;
      const tree = await mount(RealReact.createElement(OnboardingStackNavigator));
      const screen = tree.children;
      const { bad, texts } = legibility(screen, PUBLIC_THEME.surfaces.screen);
      check(`Onboarding ${rel}: claro y legible (${texts} textos)`, texts > 2 && !bad.length, bad.slice(0, 4).join(" · "));
      const foreign = foreignColors(screen, PUBLIC_THEME);
      check(`Onboarding ${rel}: todos los colores del tema claro`, !foreign.length, foreign.slice(0, 4).join(" · "));
      check(`Onboarding ${rel}: barra de estado oscura`, all(screen, (x) => x.type === "StatusBar").some((x) => x.props.style === "dark"));
      check(`Onboarding ${rel}: fondo del stack claro y nativo en claro`, flat(tree.props.style).backgroundColor === PUBLIC_THEME.colors.background && locks[locks.length - 1] === "light");
    }
    stackScreens.clear();
    contextOverride.delete(NativeSchemeContext);
  }

  // 15) App completa: tema por área, transición sin cuadro intermedio y la
  // preferencia guardada intacta. Preferencia: «Sistema» + Marble + Redondeado;
  // teléfono en oscuro. Fijar lo nativo en claro hace que useColorScheme
  // informe claro; al soltarlo sigue informando claro hasta el aviso real.
  {
    RELATIVE_MOCKS.unshift(["components/AppVersionGate", { AppVersionGate: ({ children }: any) => children }]);
    RELATIVE_MOCKS.unshift(["navigator/MainStackNavigator", { MainStackNavigator: Probe }]);
    contextOverride.delete(ThemeContext);
    native.calls = []; native.reported = "dark"; storage.saved = [];
    const App = L("App.tsx").default;
    const user = (u: any, isAuthLoading = false) => contextOverride.set(UserContext, { user: u, isAuthLoading });
    const driverTheme = createTheme({ scheme: "dark", style: "marble", radius: "rounded" });
    const DRIVER = { rol: "DRIVER", username: "ana", token: "x" };

    user(null, true);
    let tree = await mount(RealReact.createElement(App));
    check("App: mientras se lee la sesión, lo público", ctxSeen.theme === PUBLIC_THEME);
    check("App: mientras se lee la sesión no se fija lo nativo", !native.calls.includes("light"));
    user(null);
    tree = await settle();
    check("App: login en Light fijo", ctxSeen.theme === PUBLIC_THEME && all(tree, (x) => x.type === "NavigationContainer")[0].props.navTheme.colors.background === PUBLIC_THEME.colors.background);
    check("App: en el login lo nativo va en claro", native.calls[native.calls.length - 1] === "light" && native.reported === "light");
    ctxSeen.setAppearance({ style: "minimal" });
    tree = await settle();
    check("App: desde el login no se cambia la apariencia", storage.saved.length === 0 && ctxSeen.theme === PUBLIC_THEME);

    seen.length = 0;
    user(DRIVER);
    tree = await settle();
    check("App: al entrar, la apariencia del chofer desde el primer cuadro (sin flash claro)", seen.length > 0 && seen.every((x) => x === driverTheme), seen.map((x) => `${x.scheme}/${x.style}`).join(", "));
    check("App: al entrar se suelta lo nativo (vuelve a «Sistema»)", native.calls[native.calls.length - 1] === null);
    check("App: navegación con los colores del chofer", all(tree, (x) => x.type === "NavigationContainer")[0].props.navTheme.colors.background === driverTheme.colors.background);
    native.reported = "dark";
    tree = await settle();
    check("App: llega el aviso real del sistema y sigue igual", ctxSeen.theme === driverTheme);
    native.reported = "light";
    tree = await settle();
    check("App: «Sistema» sigue al teléfono después del login", ctxSeen.theme === createTheme({ scheme: "light", style: "marble", radius: "rounded" }));
    native.reported = "dark";
    tree = await settle();

    user(null);
    tree = await settle();
    check("App: al cerrar sesión, otra vez Light fijo", ctxSeen.theme === PUBLIC_THEME && native.calls[native.calls.length - 1] === "light");
    check("App: login y logout no escriben la preferencia", storage.saved.length === 0);
    seen.length = 0;
    user(DRIVER);
    tree = await settle();
    check("App: al volver a entrar, la misma apariencia", seen.every((x) => x === driverTheme) && ctxSeen.theme === driverTheme);
    ctxSeen.setAppearance({ style: "classic" });
    tree = await settle();
    check("App: el chofer cambia la apariencia y se guarda con la misma clave y forma", same(storage.saved, [{ version: 1, colorMode: "system", style: "classic", radius: "rounded" }]) && ctxSeen.theme === createTheme({ scheme: "dark", style: "classic", radius: "rounded" }));
    for (const [area, u] of [["Seller", { rol: "SELLER", username: "s", token: "x" }], ["Picker", { rol: "ADMIN", profile: "PICKER", username: "p", token: "x" }]] as const) {
      user(u);
      tree = await settle();
      check(`App: ${area} con el oscuro de siempre (no toma la apariencia del chofer)`, ctxSeen.theme === DEFAULT_THEME && native.calls[native.calls.length - 1] === "dark");
    }
    user(DRIVER);
    tree = await settle();
    check("App: Driver después de otra área, con su apariencia", ctxSeen.theme === createTheme({ scheme: "dark", style: "classic", radius: "rounded" }) && native.calls[native.calls.length - 1] === null);
  }

  // 16) Login: un solo panel (opaco y sin sombra) entre el fondo y los campos.
  // En Android, una superficie translúcida con elevation se ve como dos recuadros.
  {
    const { HomeScreen } = L("src/Presentation/views/auth/home/Home.tsx");
    useTheme(createTheme({ scheme: "dark" }));
    const tree = await mount(RealReact.createElement(FixedTheme, { theme: PUBLIC_THEME }, RealReact.createElement(HomeScreen, { navigation: nav })));
    const input = all(tree, (x) => x.type === "TextInput")[0];
    const path: any[] = [];
    const find = (n: any, trail: any[]): boolean => {
      if (Array.isArray(n)) return n.some((c) => find(c, trail));
      if (!n || typeof n !== "object") return false;
      if (n === input) { path.push(...trail); return true; }
      return find(n.children, [...trail, n]);
    };
    find(tree, []);
    const surfaces = path.slice(1).filter((n) => { const bg = flat(n.props.style).backgroundColor; return bg && bg !== "transparent"; });
    const panel = flat(surfaces[0]?.props.style ?? {});
    check("Login: un solo panel entre el fondo y los campos", surfaces.length === 1, surfaces.map((n) => flat(n.props.style).backgroundColor).join(" · "));
    check("Login: el panel es opaco y sin sombra", rgba(panel.backgroundColor ?? "")[3] === 1 && !panel.elevation && !panel.shadowOpacity, JSON.stringify(panel));
    const field = flat(input.props.style);
    check("Login: el campo se distingue del panel sin ser otra tarjeta", field.backgroundColor !== panel.backgroundColor && rgba(field.backgroundColor)[3] === 1 && !field.elevation);
  }

  // 17) Onboarding con cámara: interfaz en claro (encabezado, pie, permiso);
  // solo el área del video queda oscura.
  {
    const { OnboardingStackNavigator } = L("src/Presentation/navigator/OnboardingStackNavigator.tsx");
    useTheme(createTheme({ scheme: "dark", style: "marble" }));
    for (const [name, label] of [["Selfie", "Selfie"], ["Doc", "DNI"]]) {
      stackScreens.clear(); stackScreens.add(name);
      camera.permission = { granted: true };
      let tree = await mount(RealReact.createElement(OnboardingStackNavigator));
      const cam = all(tree, (x) => x.type === "CameraView")[0];
      const opaque = all(tree, (x) => x.type === "View" && flat(x.props.style).backgroundColor === PUBLIC_THEME.colors.surface);
      check(`${label}: la cámara sigue igual`, !!cam && typeof cam.props.facing === "string");
      check(`${label}: pantalla clara y pie claro con el botón de captura`, flat(tree.children[0].props.style).backgroundColor === PUBLIC_THEME.surfaces.screen && opaque.some((v) => textOf(v).includes("Capturar")));
      const lg = legibility(tree, PUBLIC_THEME.surfaces.screen);
      check(`${label}: textos legibles`, lg.bad.length === 0, lg.bad.join(" · "));
      check(`${label}: barra de estado con íconos oscuros`, all(tree, (x) => x.type === "StatusBar").some((x) => x.props.style === "dark"));
      const videoArea = all(tree, (x) => x.type === "View" && flat(x.props.style).overflow === "hidden" && all(x, (y) => y === cam).length > 0)[0];
      check(`${label}: el área del video queda oscura`, !!videoArea && flat(videoArea.props.style).backgroundColor === DEFAULT_THEME.surfaces.screenDeep);
      camera.permission = { granted: false };
      tree = await mount(RealReact.createElement(OnboardingStackNavigator));
      const lp = legibility(tree, PUBLIC_THEME.surfaces.screen);
      check(`${label}: permiso de cámara en claro y legible`, textOf(tree).includes("Permiso de cámara") && flat(tree.children[0].props.style).backgroundColor === PUBLIC_THEME.surfaces.screen && lp.bad.length === 0, lp.bad.join(" · "));
      check(`${label}: «Dar permiso» sigue pidiendo el permiso`, typeof pressable(tree, "Dar permiso").props.onPress === "function");
    }
    stackScreens.clear();
    camera.permission = { granted: true };
  }

  // 18) Recorridos: «volver» y el selector de días, separados y de 44 px; la
  // fecha con mayúscula solo al principio; mismos pedidos al cambiar de día.
  for (const style of VISUAL_STYLES) {
    const t = createTheme({ scheme: "light", style });
    useTheme(t);
    nav.calls = []; setRoutesApi();
    let tree = await mount(screens[2][1]());
    const [back] = byLabel(tree, "Volver");
    const [prev] = byLabel(tree, "Día anterior");
    const box = (n: any) => flat(n.props.style);
    check(`Recorridos ${style}: volver y día anterior de 44 px, sin hitSlop que se pise`, box(back).width >= 44 && box(back).height >= 44 && box(prev).width >= 44 && box(prev).height >= 44 && !back.props.hitSlop && !prev.props.hitSlop);
    const rowOf = (n: any) => all(tree, (x) => x.type === "View" && Array.isArray(x.children) && x.children.includes(n))[0];
    check(`Recorridos ${style}: en bloques distintos, el de días con superficie propia`, rowOf(back) !== rowOf(prev) && box(rowOf(prev)).backgroundColor === t.surfaces.card);
    const title = all(rowOf(prev), (x) => x.type === "Text")[0];
    const shown = textOf(title);
    check(`Recorridos ${style}: fecha con mayúscula inicial («${shown}»)`, !box(title).textTransform && shown[0] === shown[0].toUpperCase() && / de /.test(shown));
    api.calls = [];
    prev.props.onPress();
    tree = await settle();
    const d = new Date(`${TODAY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1);
    check(`Recorridos ${style}: día anterior consulta la misma ruta`, api.calls.includes(`GET /v2/routes/mine?date=${d.toISOString().slice(0, 10)}`), api.calls.join(", "));
    byLabel(tree, "Volver")[0].props.onPress();
    check(`Recorridos ${style}: volver sale de la pantalla`, same(lastNav(), ["goBack"]));
  }

  // 19) Al login se llega solo porque se cierra la sesión: MainStackNavigator
  // monta HomeScreen cuando no hay usuario. Un navigate/reset a "HomeScreen"
  // desde un área con sesión apunta a una ruta que no está registrada (RESET
  // «not handled by any navigator»). Vale también para Seller (views/client).
  {
    const base = path.join(APP, "src", "Presentation");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        const rel = path.relative(base, p).replace(/\\/g, "/");
        if (e.isDirectory()) { if (!/^views\/(WIP|deprecated)$/.test(rel)) walk(p); continue; }
        if (!/\.tsx?$/.test(e.name) || /\.test\.ts$/.test(e.name)) continue;
        const src = fs.readFileSync(p, "utf8");
        if (/(navigate|replace|push)\(\s*["']HomeScreen["']|name:\s*["']HomeScreen["'](?!\s*component)/.test(src)) offenders.push(rel);
      }
    };
    walk(base);
    check("Nadie navega ni resetea a HomeScreen desde un área con sesión", offenders.length === 0, offenders.join(", "));
  }

  // 20) Seller: «Cerrar sesión» cierra la sesión y no navega a mano.
  {
    const { ClientScreen } = L("src/Presentation/views/client/Landing/Client.tsx");
    nav.calls = []; session.removed = 0;
    let tree = await mount(RealReact.createElement(ClientScreen, { navigation: nav, route: { params: undefined } }));
    const menu = all(tree, (x) => typeof x.props?.onPress === "function" && textOf(x) === "")[0];
    menu.props.onPress();
    tree = await settle();
    await pressable(tree, "Cerrar sesión").props.onPress();
    tree = await settle();
    check("Seller: cerrar sesión la cierra sin navegar a mano (sin RESET a HomeScreen)", session.removed === 1 && !nav.calls.some((c) => c[0] === "reset"), JSON.stringify(nav.calls));
  }

  // 21) MainStackNavigator: con sesión registra solo el stack del rol; sin
  // sesión, el login. Es lo que lleva al login después de cerrar sesión.
  {
    // Los stacks de cada área no importan acá (y traen GPS, mapas, etc.).
    for (const [end, name] of [["navigator/DriverStackNavigator", "DriverStackNavigator"], ["navigator/SellerStackNavigator", "SellerStackNavigator"], ["navigator/PickerStackNavigator", "PickerStackNavigator"], ["admin/AdminWebScreen", "AdminWebScreen"]]) {
      RELATIVE_MOCKS.unshift([end, { [name]: () => null }]);
    }
    const { MainStackNavigator } = L("src/Presentation/navigator/MainStackNavigator.tsx");
    stackScreens.clear();
    const screensFor = async (u: any) => {
      contextOverride.set(UserContext, { user: u, isAuthLoading: false });
      registeredScreens.clear();
      await mount(RealReact.createElement(MainStackNavigator));
      return [...registeredScreens].sort().join(",");
    };
    for (const [area, u, expected] of [
      ["Seller", { rol: "SELLER", username: "s", token: "x" }, "SellerStackNavigator"],
      ["Driver", { rol: "DRIVER", username: "d", token: "x" }, "DriverStackNavigator"],
      ["Picker", { rol: "ADMIN", profile: "PICKER", username: "p", token: "x" }, "PickerStackNavigator"],
    ] as const) {
      check(`Navegación: con sesión de ${area}, solo su stack (sin HomeScreen)`, (await screensFor(u)) === expected);
      check(`Navegación: al cerrar sesión de ${area}, el login`, (await screensFor(null)) === "HomeScreen,RecuperarScreen,RegisterScreen");
    }
    contextOverride.delete(UserContext);
  }

  if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
  console.log("\nTodas las pruebas pasaron");
  process.exit(0);
})().catch((e) => { console.log("FALLA", e?.stack ?? e); process.exit(1); });
