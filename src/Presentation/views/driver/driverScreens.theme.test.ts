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
// Las cachés compartidas entre pantallas (trabajo del chofer, ofertas) se
// vacían en cada montaje, como al entrar con otra sesión.
let resetCaches = () => {};
async function mount(el: any) {
  for (const slots of instances.values()) for (const s of slots) if (typeof s.cleanup === "function") s.cleanup();
  resetCaches();
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
// Sonidos de resultado del escáner, en orden.
const sounds: string[] = [];
const lastNav = () => nav.calls[nav.calls.length - 1];
const api = { calls: [] as string[], replies: {} as Record<string, any> };
// Una respuesta armada que es un Error rechaza (sin red, sin respuesta a
// tiempo); una lista se consume de a una por pedido (la última se repite).
const reply = (method: string, p: string) => {
  api.calls.push(`${method} ${p}`);
  const key = Object.keys(api.replies).find((k) => `${method} ${p}`.startsWith(k));
  const armed = key ? api.replies[key] : { ok: true };
  const r = Array.isArray(armed) ? (armed.length > 1 ? armed.shift() : armed[0]) : armed;
  return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
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
  // Como en React Native: el encabezado arriba y, sin datos, el vacío.
  FlatList: ({ data, renderItem, ListEmptyComponent, ListHeaderComponent, keyExtractor }: any) =>
    RealReact.createElement("FlatList", null, ListHeaderComponent ?? null, data.length
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
  "react-native-safe-area-context": { SafeAreaView: "SafeAreaView", useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  "expo-splash-screen": { preventAutoHideAsync: () => Promise.resolve(), hideAsync: () => Promise.resolve() },
  "react-native-maps": { __esModule: true, default: "MapView", Marker: "Marker" },
  "react-native-svg": { __esModule: true, default: "Svg", Circle: "Circle" },
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
const gpsPolicy = { refreshes: 0 };
const push: { handlers: any } = { handlers: null };
const RELATIVE_MOCKS: [string, any][] = [
  ["config/Api", {
    getJson: (p: string) => reply("GET", p), postJson: (p: string) => reply("POST", p), putJson: (p: string) => reply("PUT", p),
    getJsonWithTimeout: (p: string) => reply("GET", p), postJsonWithTimeout: (p: string) => reply("POST", p), putJsonWithTimeout: (p: string) => reply("PUT", p),
  }],
  ["Envios/ViewModel", { __esModule: true, default: () => envios }],
  ["client/Landing/ViewModel", { __esModule: true, default: () => ({ user: { id: 7, username: "vendedor", rol: "SELLER" }, removeUserSession: () => { session.removed++; return Promise.resolve(); } }) }],
  // Los manejadores de push que registra Inicio, para simular una oferta que llega.
  ["config/Push", { setupPushAndRegisterDevice: async () => null, attachNotificationListeners: (h: any) => { push.handlers = h; return () => {}; } }],
  // Cuántas veces una pantalla pidió la política del GPS (franja horaria).
  ["config/DriverLocation", {
    refreshTrackingPolicy: () => { gpsPolicy.refreshes++; return Promise.resolve(); },
    startDriverTracking: async () => ({ ok: true, mode: "background" }), flushDriverPositions: async () => {},
    readCurrentPosition: async () => null, onTrackingChange: () => () => {},
  }],
  ["landing/ViewModel", { __esModule: true, default: () => ({ user: { id: 7, first_name: "Ana María", email: "ana@lynx.test", username: "ana" }, removeUserSession: () => { session.removed++; return Promise.resolve(); } }) }],
  ["remote/api/ApiDelivery", { ApiDelivery: { post: () => { throw new Error("sin red en la prueba"); } } }],
  ["components/LynxPulseLoader", { LynxPulseLoader: host("LynxPulseLoader") }],
  ["context/NotificationContext", { useNotifications: () => notis }],
  ["context/UserContext", { UserContext, UserProvider: ({ children }: any) => children }],
  ["config/ScanSound", { playScanError: () => { sounds.push("error"); }, playScanSuccess: () => { sounds.push("success"); } }],
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
const UPDATED = new Date().toISOString();
const DELIVERIES = [
  { id: 1, numero_tracking: "T1", direccion: "Av. Corrientes 1234", nombre_fantasia: "Tienda Uno", estado: "En camino", precio_chofer: "1000", porcentaje_chofer: "10", metodo_envio: "flex", updated_at: UPDATED },
  { id: 2, numero_tracking: "T2", direccion: "Mitre 55", nombre_fantasia: "Tienda Dos", estado: "Pendiente", precio_chofer: "800", porcentaje_chofer: "0", metodo_envio: "turbo", updated_at: UPDATED },
  { id: 3, numero_tracking: "T3", direccion: "Belgrano 900", nombre_fantasia: "Tienda Tres", estado: "Entregado", precio_chofer: "1200", porcentaje_chofer: "0", updated_at: UPDATED },
  { id: 4, numero_tracking: "T4", direccion: "San Martín 10", nombre_fantasia: "Tienda Cuatro", estado: "Reprogramado", precio_chofer: "500", porcentaje_chofer: "0", updated_at: UPDATED },
  // Forma real de /v2/drivers/:id/deliveries (caso Dancona): id es el de delivery_status.
  { id: 1384, delivery_id: 24385, numero_tracking: "T5", direccion: "Lavalle 300", nombre_fantasia: "Tienda Cinco", status: "Entregado", status_ml: "delivered", ops_status: "DELIVERED", precio_chofer: "0", porcentaje_chofer: "0", updated_at: UPDATED },
];
const ROUTES = [
  { id: 11, type: "DELIVERY", status: "ASSIGNED", scheduled_date: TODAY, stops_count: 3, deliveries_count: 7, load_expected_count: 7, load_confirmed_count: null },
  { id: 12, type: "TURBO", status: "IN_PROGRESS", scheduled_date: TODAY, stops_count: 1, deliveries_count: 1, load_expected_count: null, load_confirmed_count: null },
  { id: 13, type: "PICKUP", status: "ASSIGNED", scheduled_date: TODAY, stops_count: 2, deliveries_count: 0, load_expected_count: null, load_confirmed_count: null },
  { id: 14, type: "DELIVERY", status: "COMPLETED", scheduled_date: TODAY, stops_count: 4, deliveries_count: 9, load_expected_count: 9, load_confirmed_count: 9 },
];
const shiftIso = (iso: string, days: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const YESTERDAY = shiftIso(TODAY, -1);
const TOMORROW = shiftIso(TODAY, 1);
// Un reparto que quedó abierto de ayer (en la calle) y su detalle.
const OLD_ROUTE = { id: 8, type: "DELIVERY", status: "IN_PROGRESS", scheduled_date: YESTERDAY, stops_count: 3, deliveries_count: 3, load_expected_count: 3, load_confirmed_count: 3 };
const ROUTE_OFFER = { id: 5, route_id: 77, kind: "ROUTE", scheduled_date: TODAY, expires_at: new Date(Date.now() + 300_000).toISOString(), seconds_left: 300, deliveries: 4, first_addresses: ["Calle 1"] };
const stopOf = (id: number, sequence: number, type: string, status: string, extra: any = {}) => ({ id, route_id: 8, sequence, type, status, arrived_at: null, completed_at: null, notes: null, deliveries: [], ...extra });
// Envíos: los recorridos de hoy, uno abierto de ayer, el detalle de los que están en la calle y las ofertas.
const setEnviosApi = (over: Record<string, any> = {}) => {
  api.calls = [];
  api.replies = {
    ...over,
    [`GET /v2/routes/mine?date=${TODAY}`]: over[`GET /v2/routes/mine?date=${TODAY}`] ?? { ok: true, routes: ROUTES },
    [`GET /v2/routes/mine?date=${YESTERDAY}`]: over[`GET /v2/routes/mine?date=${YESTERDAY}`] ?? { ok: true, routes: [OLD_ROUTE] },
    "GET /v2/routes/mine": over["GET /v2/routes/mine"] ?? { ok: true, routes: [] },
    "GET /v2/routes/8": { ok: true, route: { ...OLD_ROUTE, qr_token: "q", notes: null, started_at: null, completed_at: null,
      stops: [stopOf(1, 1, "DELIVERY", "DONE", { address: "Mitre 10" }), stopOf(2, 2, "DELIVERY", "PENDING", { address: "Paso 5" }), stopOf(3, 3, "DELIVERY", "PENDING", { address: "Olazábal 7" })] } },
    "GET /v2/routes/12": { ok: true, route: { ...ROUTES[1], qr_token: "q", notes: null, started_at: null, completed_at: null,
      stops: [stopOf(4, 1, "PICKUP", "DONE", { store_name: "Tienda Turbo" }), stopOf(5, 2, "DELIVERY", "PENDING", { address: "Sarmiento 20" })] } },
    "GET /v2/turbo/groups/mine": over["GET /v2/turbo/groups/mine"] ?? { ok: true, groups: [], load: null },
    "POST /driver/availability/get": over["POST /driver/availability/get"] ?? { ok: true, turbo_enabled: true, turbo_active: false },
    "GET /v2/turbo/offers/mine": { ok: true, offers: turbos() },
    "GET /v2/offers/mine": { ok: true, offers: [ROUTE_OFFER] },
  };
};
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
    "GET /v2/offers/mine": { ok: true, offers: [] },
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
  const { DriverScreen: HomeScreen } = L("src/Presentation/views/driver/landing/Driver.tsx");
  const OfferBanner = L("src/Presentation/components/driver/OfferNoticeBanner.tsx").default;
  const { resetDriverWork } = L("src/Presentation/views/driver/work/workSource.ts");
  const { resetOfferStore } = L("src/Presentation/views/driver/offers/offerStore.ts");
  resetCaches = () => { resetDriverWork(); resetOfferStore(); };

  const useTheme = (t: any) => contextOverride.set(ThemeContext, { theme: t, preferences: {}, setAppearance: () => {}, resetAppearance: () => {} });
  const screens: [string, () => any, () => void][] = [
    ["Mi cuenta", () => RealReact.createElement(Account), () => { api.replies = { "GET /v2/driver-home/me": { ok: true, home: { address: "Lavalle 300" } } }; }],
    ["Envíos", () => RealReact.createElement(EnviosScreen, { navigation: nav }), () => { envios.currentDeliveries = DELIVERIES; envios.list = []; setEnviosApi(); }],
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
    screens[1][2]();
    const env = await press(await mount(screens[1][1]()), "Flex");
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
    screens[1][2]();
    let tree = await press(await mount(screens[1][1]()), "Flex");
    tree = await press(tree, "Finalizados");
    check("Envíos: «Finalizados» muestra los cerrados", textOf(tree).includes("Belgrano 900") && !textOf(tree).includes("Av. Corrientes 1234"));
    useTheme(marble);
    tree = await settle();
    check("en vivo: Marble + Redondeado se aplica sin remontar", flat(tree.props.style).backgroundColor === marble.surfaces.screen && flat(pressable(tree, "Belgrano 900").props.style).borderRadius === marble.radius.lg);
    check("en vivo: la modalidad y la pestaña elegidas se conservan", textOf(tree).includes("Recorridos finalizados") && !textOf(tree).includes("Av. Corrientes 1234"));
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
  // 4b) Envíos por modalidad: Turbo, Flex, Baúl y Tradicionales, con la
  // bandeja de ofertas arriba y «Continuar» si hay un recorrido en la calle.
  {
    const js = (x: any) => JSON.stringify(x);
    const dark = createTheme({ scheme: "dark" });
    useTheme(dark);
    nav.calls = [];
    screens[1][2]();
    let tree = await mount(screens[1][1]());
    const modalities = all(tree, (x) => x.props?.accessibilityRole === "tab").map(textOf);
    check("Envíos: cuatro modalidades; Turbo porque el chofer está habilitado", js(modalities) === js(["Turbo", "Flex", "Baúl", "Tradicionales"]), modalities.join(", "));
    const prev = Array.from({ length: 7 }, (_, i) => `GET /v2/routes/mine?date=${shiftIso(TODAY, -(i + 1))}`);
    check("Envíos: hoy (pidiendo también los abiertos), los 7 días anteriores, grupos, habilitación, el detalle de lo que está en la calle y las ofertas",
      [`GET /v2/routes/mine?date=${TODAY}&open=1`, ...prev, `GET /v2/turbo/groups/mine?date=${TODAY}`, "POST /driver/availability/get", "GET /v2/routes/8", "GET /v2/routes/12", "GET /v2/turbo/offers/mine", "GET /v2/offers/mine"].every((c) => api.calls.includes(c)), api.calls.join(", "));
    check("Envíos: ni rutas administrativas ni el Baúl de admin", !api.calls.some((c) => /\/v2\/baul|\/v2\/routes\?|\/v2\/drivers\/\d+\/legacy/.test(c)), api.calls.join(", "));
    check("Envíos: un solo pedido por día (sin duplicados)", new Set(api.calls).size === api.calls.length, api.calls.join(", "));

    // Turbo en curso: el Turbo en la calle; ni repartos ni colectas.
    check("Turbo › En curso: el Turbo en la calle, sin repartos ni colectas", textOf(tree).includes("Turbo #12") && !textOf(tree).includes("Reparto #11") && !textOf(tree).includes("Colecta #13"));
    tree = await press(tree, "Turbo #12");
    check("Turbo › En curso: abre el recorrido", js(lastNav()) === js(["navigate", "RouteDetailScreen", { routeId: 12 }]));

    // Continuar: el recorrido más viejo en la calle, y los demás en Inicio.
    const [cont] = byLabel(tree, "Continuar ");
    check("Envíos: «Continuar» lleva al reparto que quedó abierto de ayer", !!cont && textOf(cont).includes("Reparto #8") && textOf(cont).includes("Entregá en Paso 5"), cont ? textOf(cont) : "sin barra");
    cont.props.onPress();
    check("Envíos: «Continuar» abre ese recorrido", js(lastNav()) === js(["navigate", "RouteDetailScreen", { routeId: 8 }]));
    tree = await press(tree, "+1");
    check("Envíos: con dos en la calle, «+1» los muestra en Inicio", js(lastNav()) === js(["navigate", "DriverScreen"]));

    // Ofertas: acceso directo con el contador (2 Turbos sueltos + 1 recorrido).
    const [offers] = byLabel(tree, "Ofertas");
    check("Envíos: «Ofertas» con el contador de pendientes", offers?.props.accessibilityLabel === "Ofertas: 3 sin contestar" && textOf(offers).includes("3"), offers?.props.accessibilityLabel);
    offers.props.onPress();
    check("Envíos: «Ofertas» abre la bandeja", js(lastNav()) === js(["navigate", "TurboOffersScreen"]));

    // Flex en curso: repartos abiertos (también de ayer) y sus envíos.
    tree = await press(tree, "Flex");
    const txt = textOf(tree);
    check("Flex › En curso: el reparto de ayer (lo dice) y el de hoy; sin Turbos", txt.includes("Reparto #8") && txt.includes("Abierto desde ayer") && txt.includes("Reparto #11") && !txt.includes("Turbo #12"), txt.slice(0, 300));
    check("Flex › En curso: envíos abiertos, sin el Turbo ni los cerrados", ["Av. Corrientes 1234", "San Martín 10"].every((x) => txt.includes(x)) && !txt.includes("Mitre 55") && !txt.includes("Belgrano 900") && !txt.includes("Lavalle 300"));
    const chips = byLabel(tree, "Estado: ").map((x) => x.props.accessibilityLabel);
    check("Flex › En curso: estados de los recorridos y de los envíos; el no entregado sigue abierto", js(chips) === js(["Estado: En curso", "Estado: Asignado", "Estado: En camino", "Estado: No entregado"]), chips.join(", "));
    const chipBg = (label: string) => flat(byLabel(tree, `Estado: ${label}`)[0].props.style).backgroundColor;
    check("Flex: «No entregado» con el color de incidencia (no verde)", chipBg("No entregado") === dark.status.incident.background);
    check("Flex: dice desde qué día revisó los abiertos", txt.includes(`Revisamos recorridos abiertos desde ${L("src/Presentation/views/driver/work/driverWork.ts").dayLabel(shiftIso(TODAY, -7), TODAY)}`));
    api.calls = [];
    tree = await press(tree, "Buscar más atrás");
    check("Flex: «Buscar más atrás» revisa otra semana", Array.from({ length: 14 }, (_, i) => `GET /v2/routes/mine?date=${shiftIso(TODAY, -(i + 1))}`).every((c) => api.calls.includes(c)), api.calls.join(", "));
    tree = await press(tree, "Reparto #11");
    check("Flex: tocar un reparto abre su detalle", js(lastNav()) === js(["navigate", "RouteDetailScreen", { routeId: 11 }]));
    tree = await press(tree, "Av. Corrientes 1234");
    check("Flex: tocar un envío abre su detalle", all(tree, (x) => x.type === "Modal").some((m) => textOf(m).includes("DETALLE") && textOf(m).includes("T1")));
    tree = await press(all(tree, (x) => x.type === "Modal")[0], "Cerrar");
    tree = await press(tree, "Neto");
    check("Flex: el neto suma solo los envíos Flex visibles", all(tree, (x) => x.type === "Modal").some((m) => textOf(m).includes("Totales visibles") && textOf(m).includes("$1.400")));
    tree = await press(all(tree, (x) => x.type === "Modal")[0], "Cerrar");

    // Flex finalizados: hoy por defecto, ayer y rango.
    api.calls = [];
    tree = await press(tree, "Finalizados");
    let fin = textOf(tree);
    check("Flex › Finalizados: el reparto completado de hoy y los envíos entregados (también el de status_ml «delivered»)",
      fin.includes("Reparto #14") && fin.includes("Belgrano 900") && fin.includes("Lavalle 300") && !fin.includes("San Martín 10") && !fin.includes("Reparto #11"), fin.slice(0, 300));
    check("Flex › Finalizados: pide los recorridos del día", api.calls.includes(`GET /v2/routes/mine?date=${TODAY}`), api.calls.join(", "));
    api.calls = [];
    tree = await press(tree, "Ayer");
    fin = textOf(tree);
    check("Flex › Finalizados › Ayer: otro día, sin los de hoy", api.calls.includes(`GET /v2/routes/mine?date=${YESTERDAY}`) && !fin.includes("Belgrano 900") && fin.includes("No hay recorridos finalizados en este período"), api.calls.join(", "));
    tree = await press(tree, "Rango");
    check("Flex › Finalizados: «Rango» abre el selector de fechas", all(tree, (x) => x.type === "Modal").some((m) => textOf(m).includes("Seleccionar rango")));
    tree = await press(all(tree, (x) => x.type === "Modal")[0], "Cancelar");

    // Historial legacy (/v1): se conserva, con la descarga del Excel.
    envios.list = [{ id: 1, numero_tracking: "L1", direccion: "Viejo 1", nombre_fantasia: "Legacy", estado: "Entregado", precio_chofer: "0", porcentaje_chofer: "0" }];
    tree = await settle();
    tree = await press(tree, "Historial");
    check("Flex › Historial: la información legacy sigue a mano, con el Excel", textOf(tree).includes("Viejo 1") && byLabel(tree, "Descargar Excel semanal").length === 1);
    envios.list = [];

    // Baúl: sin contrato para el chofer, no se pide nada ni se clasifica.
    api.calls = [];
    tree = await press(tree, "Baúl");
    check("Baúl: estado de función pendiente, sin datos inventados", textOf(tree).includes("Función pendiente") && textOf(tree).includes("Pronto vas a ver acá") && !textOf(tree).includes("San Martín 10"));
    check("Baúl: no pide nada al servidor", !api.calls.length, api.calls.join(", "));
    tree = await press(tree, "Tradicionales");
    check("Tradicionales: «Próximamente»", textOf(tree).includes("Próximamente") && textOf(tree).includes("Envíos tradicionales"));
    for (const scheme of ["dark", "light"]) {
      const th = createTheme({ scheme });
      useTheme(th);
      tree = await settle();
      check(`Tradicionales ${scheme}: legible`, legibility(tree, th.surfaces.screen).bad.length === 0, legibility(tree, th.surfaces.screen).bad.join(" · "));
      tree = await press(tree, "Baúl");
      check(`Baúl ${scheme}: legible`, legibility(tree, th.surfaces.screen).bad.length === 0, legibility(tree, th.surfaces.screen).bad.join(" · "));
      tree = await press(tree, "Tradicionales");
    }
    useTheme(dark);

    // Turbo › Mañana: separado de lo de hoy; servidor sin grupos (404 en HTML) ≠ error.
    setEnviosApi({
      [`GET /v2/routes/mine?date=${TOMORROW}`]: { ok: true, routes: [{ id: 20, type: "TURBO", status: "ASSIGNED", scheduled_date: TOMORROW, stops_count: 2, deliveries_count: 1, load_expected_count: null, load_confirmed_count: null }] },
      [`GET /v2/turbo/groups/mine?date=${TOMORROW}`]: { ok: false, status: 404, invalidResponse: true, error: "Respuesta inesperada del servidor (404)", message: "Respuesta inesperada del servidor (404)" },
    });
    tree = await mount(screens[1][1]());
    check("Turbo › En curso: lo de mañana no se mezcla con hoy", !textOf(tree).includes("Turbo #20"));
    tree = await press(tree, "Mañana");
    check("Turbo › Mañana: mis Turbos programados", textOf(tree).includes("Programados para mañana") && textOf(tree).includes("Turbo #20"));
    check("Turbo › Mañana: un servidor sin grupos se informa como no soportado, no como error", textOf(tree).includes("todavía no agrupa los Turbos") && !textOf(tree).includes("Respuesta inesperada"));
    tree = await press(tree, "Tomar Turbos de mañana disponibles");
    check("Turbo › Mañana: acceso a los Turbos de mañana para tomar", js(lastNav()) === js(["navigate", "TurboTomorrowScreen"]));

    // Errores reales: se muestran como error, no como «no tenés nada».
    setEnviosApi({
      [`GET /v2/routes/mine?date=${TODAY}`]: { ok: false, status: 500, error: "Error interno del servidor" },
      "GET /v2/turbo/groups/mine": { ok: false, status: 500, error: "Falla en grupos" },
    });
    tree = await mount(screens[1][1]());
    let e = textOf(tree);
    check("Error: sin los recorridos de hoy, el error con «Reintentar» (no «sin recorridos»)", e.includes("Error interno del servidor") && e.includes("Reintentar") && !e.includes("No tenés Turbos en curso"), e.slice(0, 300));
    tree = await press(tree, "Flex");
    e = textOf(tree);
    check("Error: en Flex tampoco dice que no hay repartos", e.includes("Error interno del servidor") && !e.includes("No tenés recorridos de reparto abiertos"));
    setEnviosApi({ "GET /v2/turbo/groups/mine": { ok: false, status: 500, error: "Falla en grupos" } });
    tree = await mount(screens[1][1]());
    check("Error: un 5xx de grupos es un error a la vista, no «no soportado»", textOf(tree).includes("Falla en grupos") && !textOf(tree).includes("todavía no agrupa"));
    setEnviosApi({ [`GET /v2/routes/mine?date=${shiftIso(TODAY, -3)}`]: new Error("sin red") });
    tree = await press(await mount(screens[1][1]()), "Flex");
    check("Error: un día anterior que no se pudo leer se avisa", textOf(tree).includes("No pudimos revisar un día"));
    for (const scheme of ["dark", "light"]) {
      const th = createTheme({ scheme });
      useTheme(th);
      setEnviosApi({ [`GET /v2/routes/mine?date=${TODAY}`]: { ok: false, status: 500, error: "Error interno del servidor" } });
      tree = await mount(screens[1][1]());
      check(`Error ${scheme}: legible`, legibility(tree, th.surfaces.screen).bad.length === 0, legibility(tree, th.surfaces.screen).bad.join(" · "));
    }
    useTheme(dark);

    // Cargando: mientras no llegan los de hoy.
    setEnviosApi({ [`GET /v2/routes/mine?date=${TODAY}`]: new Promise(() => {}) });
    tree = await press(await mount(screens[1][1]()), "Flex");
    check("Cargando: «Cargando recorridos…» y sin «no tenés»", textOf(tree).includes("Cargando recorridos") && !textOf(tree).includes("No tenés recorridos de reparto abiertos"));

    // Envíos en recorrido sin recorrido abierto a la vista: se avisa (no se esconde).
    setEnviosApi({ [`GET /v2/routes/mine?date=${TODAY}`]: { ok: true, routes: [] }, [`GET /v2/routes/mine?date=${YESTERDAY}`]: { ok: true, routes: [] } });
    envios.currentDeliveries = [{ id: 40, numero_tracking: "T40", direccion: "Viamonte 40", nombre_fantasia: "Tienda", ops_status: "OUT_FOR_DELIVERY", status_ml: "shipped", updated_at: UPDATED }];
    tree = await press(await mount(screens[1][1]()), "Flex");
    check("Flex: envíos en recorrido sin recorrido abierto en los días revisados → aviso con «Buscar más atrás»", textOf(tree).includes("en recorrido y no encontramos el recorrido abierto"));
    check("Flex: sin nada en la calle, sin «Continuar»", !byLabel(tree, "Continuar ").length);
    setEnviosApi({ [`GET /v2/routes/mine?date=${TODAY}`]: { ok: true, routes: [] }, [`GET /v2/routes/mine?date=${YESTERDAY}`]: { ok: true, routes: [] } });
    envios.currentDeliveries = [{ id: 41, numero_tracking: "T41", direccion: "Viamonte 41", nombre_fantasia: "Tienda", ops_status: "ASSIGNED_TO_ROUTE", is_turbo: true, updated_at: UPDATED }];
    tree = await mount(screens[1][1]());
    check("Turbo: un Turbo en recorrido sin el recorrido a la vista también se avisa", textOf(tree).includes("en recorrido y no encontramos el recorrido abierto") && !textOf(tree).includes("No tenés Turbos en curso."));

    // Sin Turbo habilitado ni Turbos: no aparece la modalidad.
    setEnviosApi({ "POST /driver/availability/get": { ok: true, turbo_enabled: false }, [`GET /v2/routes/mine?date=${TODAY}`]: { ok: true, routes: [ROUTES[0]] } });
    envios.currentDeliveries = DELIVERIES.filter((d: any) => d.metodo_envio !== "turbo");
    tree = await mount(screens[1][1]());
    check("Sin Turbo habilitado ni Turbos: arranca en Flex y no muestra Turbo", !all(tree, (x) => x.props?.accessibilityRole === "tab").some((x) => textOf(x) === "Turbo") && textOf(tree).includes("Reparto #11"));
    envios.currentDeliveries = DELIVERIES;

    // Cerrar sesión desmonta el stack del chofer: lo leído no queda para el próximo.
    // (Sin el vaciado de cada montaje de la prueba: lo tiene que hacer el stack.)
    {
      const { DriverStackNavigator } = L("src/Presentation/navigator/DriverStackNavigator.tsx");
      const keep = resetCaches;
      setEnviosApi();
      await mount(screens[1][1]());
      resetCaches = () => {};
      await mount(RealReact.createElement(DriverStackNavigator));
      await mount(RealReact.createElement("View"));
      setEnviosApi({ [`GET /v2/routes/mine?date=${TODAY}`]: new Promise(() => {}) });
      tree = await mount(screens[1][1]());
      check("Sesión: al desmontar el stack del chofer no quedan recorridos del anterior (no hay «Continuar» ni Turbo #12)",
        !byLabel(tree, "Continuar ").length && !textOf(tree).includes("Turbo #12") && api.calls.some((c) => c.startsWith(`GET /v2/routes/mine?date=${TODAY}`)));
      check("Sesión: tampoco el contador de ofertas del anterior antes de leerlo de nuevo", byLabel(tree, "Ofertas")[0]?.props.accessibilityLabel !== "Ofertas: 3 sin contestar" || api.calls.includes("GET /v2/turbo/offers/mine"));
      resetCaches = keep;
    }

    // Barra: Inicio, QR y Alertas.
    nav.calls = [];
    for (const [tab, route] of [["Inicio", "DriverScreen"], ["QR", "DriverScanOptionsScreen"], ["Alertas", "NotificationsScreen"]]) {
      tree = await press(tree, tab);
      check(`Envíos: barra → ${tab}`, js(lastNav()) === js(["navigate", route]));
    }
  }
  {
    nav.calls = [];
    setRoutesApi();
    let tree = await mount(screens[2][1]());
    // Más los grupos Turbo del día (varios Turbos de una tienda se ven como uno).
    check("Recorridos: mismos pedidos a la API", JSON.stringify([...api.calls].sort()) === JSON.stringify([`GET /v2/routes/mine?date=${TODAY}`, "GET /v2/offers/mine", "GET /v2/turbo/offers/mine", `GET /v2/turbo/groups/mine?date=${TODAY}`].sort()), api.calls.join(", "));
    const order = all(tree, (x) => x.type === "Item").map((x) => textOf(x).match(/#\d+/)?.[0]);
    check("Recorridos: sin colectas y en el orden del servidor", JSON.stringify(order) === JSON.stringify(["#11", "#12", "#14"]), order.join(", "));
    const chips = byLabel(tree, "Estado: ").map((x) => x.props.accessibilityLabel);
    check("Recorridos: estado con chip y el texto de siempre", JSON.stringify(chips) === JSON.stringify(["Estado: Asignado", "Estado: En curso", "Estado: Completado"]), chips.join(", "));
    tree = await press(tree, "Turbo #12");
    check("Recorridos: tocar un recorrido abre su detalle", JSON.stringify(lastNav()) === JSON.stringify(["navigate", "RouteDetailScreen", { routeId: 12 }]));
    check("Recorridos: las ofertas no se contestan acá (sin botones duplicados)", !all(tree, (x) => typeof x.props?.onPress === "function" && ["Aceptar", "No"].includes(textOf(x))).length);
    tree = await press(tree, "2 ofertas sin contestar");
    check("Recorridos: el acceso con el contador (Turbo + recorrido) abre la bandeja", JSON.stringify(lastNav()) === JSON.stringify(["navigate", "TurboOffersScreen"]));
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
    api.calls = []; gpsPolicy.refreshes = 0;
    pressable(card90(), "Acepto").props.onPress();
    tree = await settle();
    check("Turbo: aceptado, pregunta la política del GPS (un Turbo asignado lo mantiene prendido)", gpsPolicy.refreshes === 1, String(gpsPolicy.refreshes));
    check("Turbo: aceptar hace el mismo pedido y abre el recorrido", api.calls[0] === "POST /v2/turbo/offers/90/accept" && same(lastNav(), ["navigate", "RouteDetailScreen", { routeId: 90 }]));
    setDriverApi();
    tree = await mount(screens[5][1]());
    api.calls = [];
    pressable(card90(), "Paso").props.onPress();
    tree = await settle();
    check("Turbo: pasar hace el mismo pedido y saca la oferta", api.calls[0] === "POST /v2/turbo/offers/90/decline" && !textOf(tree).includes("Turbo #90"));

    // La cuenta regresiva la manda el servidor (seconds_left): con el reloj del
    // teléfono adelantado, expires_at ya pasó pero la oferta sigue viva.
    setDriverApi();
    api.replies["GET /v2/turbo/offers/mine"] = { ok: true, offers: [{ ...turbos()[0], expires_at: new Date(Date.now() - 60_000).toISOString(), seconds_left: 40 }] };
    tree = await mount(screens[5][1]());
    const left = textOf(all(card90(), (x) => x.type === "Text" && /para responder|vencida/.test(textOf(x)))[0]);
    check("Turbo: con el reloj del teléfono adelantado cuenta con seconds_left (no «vencida»)", /^(39|40) s para responder$/.test(left), left);
    check("Turbo: y «Acepto» queda habilitado", pressable(card90(), "Acepto").props.disabled === false);

    // «Acepto» sin respuesta: la tarjeta queda confirmando y se reintenta; el
    // servidor contesta «ya es tuyo» y se abre el recorrido.
    setDriverApi();
    api.replies["POST /v2/turbo/offers/90/accept"] = [new Error("sin red"), { ok: true, already: true, route: { id: 90 } }];
    tree = await mount(screens[5][1]());
    nav.calls = []; api.calls = [];
    pressable(card90(), "Acepto").props.onPress();
    tree = await settle();
    check("Turbo: sin respuesta al aceptar, la tarjeta queda «Confirmando el Turbo…» y no navega", textOf(card90()).includes("Confirmando el Turbo") && !nav.calls.length, textOf(card90()));
    check("Turbo: mientras confirma, las otras ofertas no se pueden aceptar", all(tree, (x) => x.type === "Pressable" && textOf(x) === "Acepto").every((x) => x.props.disabled === true));
    await new Promise((r) => setTimeout(r, 1700));
    tree = await settle();
    check("Turbo: el reintento responde «ya es tuyo» y abre el recorrido", api.calls.filter((c) => c === "POST /v2/turbo/offers/90/accept").length === 2 && same(lastNav(), ["navigate", "RouteDetailScreen", { routeId: 90 }]), api.calls.join(", "));

    // Ningún intento responde: aviso con «Reintentar» y «Ver recorridos».
    setDriverApi();
    api.replies["POST /v2/turbo/offers/90/accept"] = [new Error("sin red"), new Error("sin respuesta en 15000 ms"), new Error("sin red"), { ok: true, route: { id: 90 } }];
    tree = await mount(screens[5][1]());
    nav.calls = []; api.calls = [];
    pressable(card90(), "Acepto").props.onPress();
    await new Promise((r) => setTimeout(r, 3300));
    tree = await settle();
    check("Turbo: sin confirmar después de 3 intentos, lo dice y ofrece «Reintentar» y «Ver recorridos»", textOf(card90()).includes("No pudimos confirmar el Turbo #90") && api.calls.filter((c) => c.endsWith("/90/accept")).length === 3 && !nav.calls.length, textOf(card90()));
    tree = await press(card90(), "Ver recorridos");
    check("Turbo: «Ver recorridos» abre Recorridos", same(lastNav(), ["navigate", "RoutesScreen"]));
    tree = await press(card90(), "Reintentar");
    check("Turbo: «Reintentar» vuelve a aceptar y abre el recorrido", same(lastNav(), ["navigate", "RouteDetailScreen", { routeId: 90 }]));

    // Respuesta final del servidor: la tarjeta se va con su mensaje, sin reintentar.
    setDriverApi();
    api.replies["POST /v2/turbo/offers/90/accept"] = { ok: false, status: 409, code: "TAKEN", error: "ya lo tomó otro chofer" };
    tree = await mount(screens[5][1]());
    api.calls = []; gpsPolicy.refreshes = 0;
    pressable(card90(), "Acepto").props.onPress();
    tree = await settle();
    check("Turbo: si el Turbo ya no está (409), no pregunta la política del GPS", gpsPolicy.refreshes === 0, String(gpsPolicy.refreshes));
    check("Turbo: 409 TAKEN saca la tarjeta con el mensaje del servidor, sin reintentar", !textOf(tree).includes("Turbo #90") && textOf(tree).includes("ya lo tomó otro chofer") && api.calls.filter((c) => c.endsWith("/accept")).length === 1);

    // «Paso» sin respuesta: la tarjeta sigue (si no, vuelve en el próximo sondeo).
    setDriverApi();
    api.replies["POST /v2/turbo/offers/90/decline"] = new Error("sin red");
    tree = await mount(screens[5][1]());
    pressable(card90(), "Paso").props.onPress();
    tree = await settle();
    check("Turbo: si «Paso» no llega, la tarjeta sigue y avisa en castellano", !!card90() && textOf(tree).includes("No se pudo avisar que pasás") && textOf(tree).includes("Sin conexión"), textOf(tree));
    setDriverApi();
    api.replies["POST /v2/turbo/offers/90/decline"] = { ok: false, status: 409, code: "NOT_OFFERED", error: "no tenés una oferta pendiente de este turbo" };
    tree = await mount(screens[5][1]());
    pressable(card90(), "Paso").props.onPress();
    tree = await settle();
    check("Turbo: «Paso» de una oferta que ya no está (409) la saca", !card90());
  }

  // 7b) Bandeja de ofertas: Turbos, lotes y recorridos ofrecidos en una sola
  // lista, lo que vence primero arriba; cada uno con su contrato de siempre.
  {
    const js = (x: any) => JSON.stringify(x);
    useTheme(createTheme({ scheme: "dark" }));
    const withRouteOffer = () => { setDriverApi(); api.replies["GET /v2/offers/mine"] = { ok: true, offers: [{ ...ROUTE_OFFER, seconds_left: 60 }] }; };
    const routeCard = (tree: any) => all(tree, (x) => x.type === "View" && flat(x.props.style).gap === 6 && textOf(x).includes("Recorrido #77"))[0];
    withRouteOffer(); nav.calls = [];
    let tree = await mount(screens[5][1]());
    const order = all(tree, (x) => x.type === "Item").map((x) => textOf(x).match(/Turbo #9[01]|Recorrido #77/)?.[0]);
    check("Bandeja: Turbos y recorridos juntos, lo que vence primero arriba", js(order) === js(["Turbo #91", "Recorrido #77", "Turbo #90"]), order.join(", "));
    check("Bandeja: título de ofertas (no solo Turbo)", textOf(tree).includes("Ofertas para vos"));
    check("Bandeja: pide las dos fuentes de siempre", api.calls.includes("GET /v2/turbo/offers/mine") && api.calls.includes("GET /v2/offers/mine"), api.calls.join(", "));
    check("Bandeja: el recorrido ofrecido muestra envíos, direcciones y plazo", textOf(routeCard(tree)).includes("4 envíos") && textOf(routeCard(tree)).includes("Calle 1") && /para responder/.test(textOf(routeCard(tree))));
    api.calls = []; gpsPolicy.refreshes = 0;
    api.replies["POST /v2/offers/77/accept"] = { ok: true };
    tree = await press(routeCard(tree), "Aceptar");
    check("Bandeja: aceptar un recorrido usa POST /v2/offers/77/accept y abre el recorrido", api.calls[0] === "POST /v2/offers/77/accept" && js(lastNav()) === js(["navigate", "RouteDetailScreen", { routeId: 77 }]) && gpsPolicy.refreshes === 1, api.calls.join(", "));
    withRouteOffer();
    tree = await mount(screens[5][1]());
    api.calls = [];
    tree = await press(routeCard(tree), "Rechazar");
    check("Bandeja: rechazar usa POST /v2/offers/77/decline y saca la tarjeta", api.calls[0] === "POST /v2/offers/77/decline" && !routeCard(tree));
    withRouteOffer();
    api.replies["POST /v2/offers/77/accept"] = { ok: false, status: 409, error: "La oferta ya no está disponible" };
    tree = await mount(screens[5][1]());
    tree = await press(routeCard(tree), "Aceptar");
    check("Bandeja: 409 saca la tarjeta con el mensaje del servidor", !routeCard(tree) && textOf(tree).includes("La oferta ya no está disponible"));
    withRouteOffer();
    api.replies["POST /v2/offers/77/accept"] = new Error("sin red");
    tree = await mount(screens[5][1]());
    api.calls = []; nav.calls = [];
    tree = await press(routeCard(tree), "Aceptar");
    check("Bandeja: sin respuesta al aceptar un recorrido no se reintenta solo y lo dice", api.calls.filter((c) => c === "POST /v2/offers/77/accept").length === 1 && !!routeCard(tree) && textOf(tree).includes("No pudimos confirmar el recorrido") && !nav.calls.length);
    setDriverApi();
    api.replies["GET /v2/offers/mine"] = { ok: false, status: 500, error: "Falla de ofertas" };
    tree = await mount(screens[5][1]());
    check("Bandeja: si fallan los recorridos ofrecidos, los Turbos se ven igual y el error está a la vista", textOf(tree).includes("Turbo #90") && textOf(tree).includes("No se pudieron cargar los recorridos ofrecidos") && textOf(tree).includes("Falla de ofertas"));
    setDriverApi();
    api.replies["GET /v2/turbo/offers/mine"] = { ok: true, offers: turbos().map((o) => ({ ...o, group_id: 7 })) };
    tree = await mount(screens[5][1]());
    check("Bandeja: un lote va en una sola tarjeta", textOf(tree).includes("Lote de 2 Turbos") && all(tree, (x) => x.type === "Item").length === 1);
    setDriverApi();
    api.replies["GET /v2/turbo/offers/mine"] = { ok: true, offers: [] };
    tree = await mount(screens[5][1]());
    check("Bandeja: vacía, lo dice", textOf(tree).includes("No tenés ofertas ahora"));
    for (const scheme of ["dark", "light"]) {
      const th = createTheme({ scheme });
      useTheme(th);
      withRouteOffer();
      tree = await mount(screens[5][1]());
      check(`Bandeja ${scheme}: legible con Turbos y recorridos`, legibility(tree, th.surfaces.screen).bad.length === 0, legibility(tree, th.surfaces.screen).bad.join(" · "));
    }
  }

  // 7c) Inicio: la misión activa arriba (varias a la vez), acceso a ofertas
  // con el contador, y las ofertas que llegan con la app abierta como aviso
  // que no bloquea.
  {
    const js = (x: any) => JSON.stringify(x);
    const dark = createTheme({ scheme: "dark" });
    useTheme(dark);
    const homeEl = () => RealReact.createElement(RealReact.Fragment, null,
      RealReact.createElement(HomeScreen, { navigation: nav, route: { params: {} } }),
      RealReact.createElement(OfferBanner));
    setEnviosApi(); nav.calls = []; alerts.length = 0; push.handlers = null;
    let tree = await mount(homeEl());
    const txt = textOf(tree);
    check("Inicio: misión activa con lo que sigue y el progreso", ["EN CURSO", "Reparto #8", "Desde ayer", "Entregá en Paso 5", "1 de 3 paradas"].every((x) => txt.includes(x)), txt.slice(0, 400));
    check("Inicio: la misión va antes que las ofertas y la tarjeta Turbo", txt.indexOf("EN CURSO") < txt.indexOf("Ofertas") && txt.indexOf("Ofertas") < txt.indexOf("Turbo", txt.indexOf("Ofertas") + 1));
    tree = await press(tree, "Continuar recorrido");
    check("Inicio: «Continuar recorrido» abre el recorrido", js(lastNav()) === js(["navigate", "RouteDetailScreen", { routeId: 8 }]));
    const [second] = byLabel(tree, "Continuar Turbo #12");
    check("Inicio: el segundo recorrido en la calle, en una fila", !!second);
    second.props.onPress();
    check("Inicio: la fila abre ese recorrido", js(lastNav()) === js(["navigate", "RouteDetailScreen", { routeId: 12 }]));
    const [offers] = byLabel(tree, "Ofertas");
    check("Inicio: «Ofertas» con el contador", offers?.props.accessibilityLabel === "Ofertas: 3 sin contestar", offers?.props.accessibilityLabel);
    offers.props.onPress();
    check("Inicio: «Ofertas» abre la bandeja", js(lastNav()) === js(["navigate", "TurboOffersScreen"]));
    for (const scheme of ["dark", "light"]) {
      const th = createTheme({ scheme });
      useTheme(th);
      tree = await settle();
      const card = all(tree, (x) => x.type === "View" && textOf(x).startsWith("EN CURSO") && flat(x.props.style).backgroundColor === th.surfaces.card)[0];
      check(`Inicio ${scheme}: tarjeta de misión legible`, !!card && legibility(card, th.surfaces.screen).bad.length === 0, card ? legibility(card, th.surfaces.screen).bad.join(" · ") : "sin tarjeta");
      check(`Inicio ${scheme}: fila de ofertas legible`, legibility(byLabel(tree, "Ofertas")[0], th.surfaces.screen).bad.length === 0);
    }
    useTheme(dark);

    // Ofertas que llegan con la app abierta: aviso arriba, sin diálogo.
    check("Inicio: se registran los avisos de push", !!push.handlers?.onTurboOffer && !!push.handlers?.onRouteNotice);
    nav.calls = []; alerts.length = 0;
    push.handlers.onTurboOffer({ routeId: 90, source: "received", raw: { storeName: "Tienda Uno" } });
    tree = await settle();
    const banner = () => byLabel(tree, "Turbo disponible. Ver ofertas")[0];
    check("Push Turbo con la app abierta: aviso que no bloquea (sin diálogo ni cambio de pantalla)", !alerts.length && !nav.calls.length && !!banner() && textOf(tree).includes("Tienda Uno. El primero que acepta se lo queda."));
    for (const scheme of ["dark", "light"]) {
      const th = createTheme({ scheme });
      useTheme(th);
      tree = await settle();
      const node = all(tree, (x) => x.props?.accessibilityRole === "alert")[0];
      check(`Aviso de oferta ${scheme}: legible`, !!node && legibility(node, th.surfaces.screen).bad.length === 0, node ? legibility(node, th.surfaces.screen).bad.join(" · ") : "sin aviso");
    }
    useTheme(dark);
    banner().props.onPress();
    tree = await settle();
    check("Aviso: tocarlo abre la bandeja y se cierra", js(lastNav()) === js(["navigate", "TurboOffersScreen"]) && !banner());
    push.handlers.onRouteNotice({ kind: "ROUTE_OFFER", routeId: 77, source: "received", raw: {} });
    tree = await settle();
    check("Push recorrido ofrecido: aviso, sin diálogo", !alerts.length && byLabel(tree, "Te ofrecieron un recorrido. Ver ofertas").length === 1);
    byLabel(tree, "Cerrar aviso")[0].props.onPress();
    tree = await settle();
    check("Aviso: se puede cerrar", !byLabel(tree, "Te ofrecieron un recorrido").length);
    nav.calls = [];
    push.handlers.onRouteNotice({ kind: "ROUTE_OFFER", routeId: 77, source: "response", raw: {} });
    push.handlers.onTurboOffer({ routeId: 90, source: "response", raw: {} });
    check("Push tocada (recorrido o Turbo): abre la bandeja", js(nav.calls) === js([["navigate", "TurboOffersScreen"], ["navigate", "TurboOffersScreen"]]), js(nav.calls));
    push.handlers.onRouteNotice({ kind: "PICKUP_ASSIGNED", routeId: 31, source: "received", raw: {} });
    check("Push colecta asignada: sigue con su confirmación de siempre", alerts.length === 1 && alerts[0][0] === "Colecta asignada");

    // Sin nada en la calle: sin tarjeta de misión.
    setEnviosApi({ [`GET /v2/routes/mine?date=${TODAY}`]: { ok: true, routes: [ROUTES[0]] }, [`GET /v2/routes/mine?date=${YESTERDAY}`]: { ok: true, routes: [] } });
    tree = await mount(homeEl());
    check("Inicio: sin recorridos en la calle, sin misión (y «Ofertas» sigue)", !textOf(tree).includes("EN CURSO") && byLabel(tree, "Ofertas").length === 1);
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

  // 9b) Planta: la estantería mueve solo el bulto que quedó en planta, con la
  // regla del Picker (pickerScan). Cada lectura deja su resultado en la
  // tarjeta, sin diálogos: la cámara sigue lista para la siguiente.
  {
    useTheme(createTheme({ scheme: "dark" }));
    const SHELF = "LYNX:SHELF:3f2c1a9e-8b7d-4c6e-9f10-2a3b4c5d6e7f";
    const received = (id: number, tracking: string) => ({
      ok: true, delivery: { id, tracking, store: "Tienda Uno", receiver: "Ana", direccion: null, postal_code: "1000", tipo_envio: "flex", is_turbo: false },
      shelf: { id: 3, code: "NORTE-1", name: null, unclassified: false, suggested: null },
      ops: { from: "ENTERED", to: "SHELVED", transitions: ["ARRIVED_WAREHOUSE", "SHELVED"], already_here: false }, alerts: [],
    });
    const cards: string[] = [];
    const scanAll = async (codes: string[]) => {
      api.calls = []; alerts.length = 0; cards.length = 0;
      let tree = await mount(RealReact.createElement(Scan, { navigation: nav, route: { params: { mode: "planta" } } }));
      for (const data of codes) {
        all(tree, (x) => x.type === "CameraView")[0].props.onBarcodeScanned({ data });
        tree = await settle();
        cards.push(String(all(tree, (x) => x.props?.accessibilityRole === "alert")[0]?.props.accessibilityLabel ?? ""));
      }
    };
    const lastCard = () => cards[cards.length - 1] ?? "";

    api.replies = { "POST /v2/warehouse/receive": [received(1, "T-A"), { ok: false, status: 404, error: "El envío no está en Lynx" }] };
    await scanAll(["46001", "46002", SHELF]);
    check("Planta: si la recepción del siguiente falla, la estantería no mueve el bulto anterior", !api.calls.some((c) => c.startsWith("PUT ")), api.calls.join(", "));
    check("Planta: y pide escanear primero el paquete", lastCard().startsWith("Escaneá primero el paquete"), lastCard());
    check("Planta: sin diálogos", alerts.length === 0, JSON.stringify(alerts));

    api.replies = { "POST /v2/warehouse/receive": { ...received(2, "T-C"), shelf: null, ops: { from: "DELIVERED", to: "DELIVERED", transitions: [], already_here: false }, alerts: [{ code: "CLOSED", text: "Envío entregado" }] } };
    await scanAll(["46003", SHELF]);
    check("Planta: un bulto cerrado no queda para mover", !api.calls.some((c) => c.startsWith("PUT ")), api.calls.join(", "));

    api.replies = { "POST /v2/warehouse/receive": received(1, "T-A"), "PUT /v2/warehouse/deliveries/1/shelf": new Error("sin respuesta en 15000 ms") };
    await scanAll(["46001", SHELF]);
    check("Planta: sin respuesta al mover, avisa que no se sabe si se movió (no «ninguna modificación»)", lastCard().includes("No sabemos si se movió") && !lastCard().includes("No se realizó ninguna modificación"), lastCard());

    api.replies = { "POST /v2/warehouse/receive": received(1, "T-A"), "PUT /v2/warehouse/deliveries/1/shelf": { ok: true, from: "NORTE-1", shelf: { id: 4, code: "NORTE-2", name: null } } };
    await scanAll(["46001", SHELF]);
    check("Planta: bulto y después estantería lo mueve, con el mismo pedido", api.calls.includes("PUT /v2/warehouse/deliveries/1/shelf") && lastCard().startsWith("Estantería NORTE-2"), `${api.calls.join(", ")} | ${lastCard()}`);
    check("Planta: la recepción muestra la estantería", cards[0].startsWith("Estantería NORTE-1. Ingresó a planta"), cards[0]);
    check("Planta: no muestra el contenido leído de la etiqueta", !cards.some((c) => c.includes("Leído") || c.includes(SHELF)), cards.join(" | "));
  }

  // 9c) Escaneo continuo (Asignarme y Colecta): verde o rojo sin diálogos,
  // contador de la sesión, sin lecturas duplicadas ni reintentos solos. Solo
  // la sesión vencida frena con un diálogo.
  {
    const dark = createTheme({ scheme: "dark" });
    useTheme(dark);
    camera.permission = { granted: true };
    contextOverride.set(UserContext, { user: { id: 38, rol: "DRIVER" }, isAuthLoading: false, getUserSession: async () => ({ id: 38 }) });
    const ROLE = { ok: true, rol: "DRIVER", data: { id: 49, active: true, vehiculo: "Moto", patente: "AB123CD" } };
    const ML = (id: string) => `{"id":"${id}","sender_id":777,"hash_code":"h","security_digit":"0"}`;
    const cardNode = (tree: any) => all(tree, (x) => x.props?.accessibilityRole === "alert")[0];
    const card = (tree: any) => String(cardNode(tree)?.props.accessibilityLabel ?? "");
    const summary = (tree: any) => String(all(tree, (x) => /escaneado/.test(String(x.props?.accessibilityLabel ?? "")))[0]?.props.accessibilityLabel ?? "");
    const writes = () => api.calls.filter((c) => c.startsWith("PUT /v2/deliveries/self-assign") || c.startsWith("POST /v2/deliveries/scan")).length;
    const open = async (mode: string) => {
      api.calls = []; alerts.length = 0; sounds.length = 0; nav.calls = [];
      return mount(RealReact.createElement(Scan, { navigation: nav, route: { params: { mode } } }));
    };
    const scan = async (tree: any, data: string) => {
      all(tree, (x) => x.type === "CameraView")[0].props.onBarcodeScanned({ data });
      return settle();
    };

    // Éxito: verde, sonido, sin diálogo, cámara lista, contador.
    api.replies = { "GET /v2/users/38/role": ROLE, "PUT /v2/deliveries/self-assign": { ok: true, result: "claimed", delivery_id: 24385, route: { id: 900 } } };
    let tree = await open("asignarme");
    tree = await scan(tree, ML("47000000101"));
    check("Asignarme: éxito en verde, sin diálogo", card(tree) === "Envío asignado. 47000000101" && alerts.length === 0, `${card(tree)} | ${JSON.stringify(alerts)}`);
    check("Asignarme: color de éxito del visor oscuro", flat(cardNode(tree).props.style).borderColor === dark.status.delivered.text);
    check("Asignarme: sonido de éxito", same(sounds, ["success"]), sounds.join(","));
    check("Asignarme: la cámara sigue lista", all(tree, (x) => x.type === "CameraView").length === 1);
    check("Asignarme: contador de la sesión", summary(tree) === "1 escaneado", summary(tree));
    check("Asignarme: mismo pedido que antes (rol + self-assign)", same(api.calls, ["GET /v2/users/38/role", "PUT /v2/deliveries/self-assign"]), api.calls.join(", "));
    check("Asignarme: sin ids internos, patente ni vehículo en pantalla", !/24385|AB123CD|Moto|driver_data|user\.id|Backend|PRODUCCIÓN/.test(textOf(tree)), textOf(tree));

    // Dos códigos distintos seguidos: los dos se procesan; el rol se pide una vez.
    tree = await scan(tree, ML("47000000102"));
    check("Asignarme: segundo código distinto, sin tocar nada", writes() === 2 && summary(tree) === "2 escaneados", `${api.calls.join(", ")} | ${summary(tree)}`);
    check("Asignarme: el chofer se resuelve una sola vez por pantalla", api.calls.filter((c) => c.startsWith("GET /v2/users/")).length === 1, api.calls.join(", "));

    // Lectura repetida del mismo código (sigue a la vista): no se reenvía.
    tree = await scan(tree, ML("47000000102"));
    tree = await scan(tree, ML("47000000102"));
    check("Asignarme: el mismo código a la vista no se vuelve a enviar", writes() === 2, api.calls.join(", "));

    // Mientras hay un pedido en curso no se lee otra etiqueta.
    let release: (v: any) => void = () => {};
    api.replies["PUT /v2/deliveries/self-assign"] = new Promise((r) => (release = r));
    tree = await scan(tree, ML("47400000001"));
    check("Asignarme: «Asignando envío...» mientras espera", all(tree, (x) => x.type === "LynxPulseLoader" && x.props.message === "Asignando envío...").length === 1);
    tree = await scan(tree, ML("47400000002"));
    check("Asignarme: con un pedido en curso no se lee otro código", writes() === 3, api.calls.join(", "));
    // Respuesta tardía: llega y se muestra igual, sin diálogo.
    release({ ok: true, result: "already" });
    tree = await settle();
    check("Asignarme: respuesta tardía se muestra al llegar", card(tree) === "Ya lo tenías cargado. 47400000001" && alerts.length === 0, card(tree));

    // Error recuperable: rojo con el texto del servidor, error en el resumen, cámara lista.
    api.replies["PUT /v2/deliveries/self-assign"] = { ok: false, status: 409, error: "El envío está entregado: no sale a reparto" };
    tree = await scan(tree, ML("47400000003"));
    check("Asignarme: error recuperable en rojo, sin diálogo", card(tree) === "No se pudo asignar. El envío está entregado: no sale a reparto" && alerts.length === 0, card(tree));
    check("Asignarme: color de error", flat(cardNode(tree).props.style).borderColor === dark.status.rejected.text);
    check("Asignarme: sonido de error", sounds[sounds.length - 1] === "error", sounds.join(","));
    check("Asignarme: el error queda en el resumen", summary(tree).startsWith("3 escaneados · 1 con error"), summary(tree));
    tree = await press(tree, "✓ 3");
    check("Asignarme: el resumen lista los errores con el tracking", textOf(tree).includes("Errores de esta sesión") && textOf(tree).includes("47400000003 · No se pudo asignar"), textOf(tree));
    const before = writes();
    tree = await scan(tree, ML("47400000004"));
    check("Asignarme: después del error se sigue escaneando", writes() === before + 1);

    // Pérdida de conexión después de enviar: ámbar, no se sabe si se aplicó, sin reintento.
    api.replies["PUT /v2/deliveries/self-assign"] = new Error("sin red");
    const sent = writes();
    tree = await scan(tree, ML("47400000005"));
    check("Asignarme: sin red después de enviar avisa que no se sabe si quedó", card(tree) === "Sin respuesta del servidor. No sabemos si quedó asignado. Revisalo antes de volver a escanearlo.", card(tree));
    tree = await settle();
    check("Asignarme: sin reintento automático", writes() === sent + 1, api.calls.join(", "));

    // 5xx: genérico, sin el texto interno.
    api.replies["PUT /v2/deliveries/self-assign"] = { ok: false, status: 500, error: "duplicate key value violates unique constraint" };
    tree = await scan(tree, ML("47400000006"));
    check("Asignarme: 500 sin el error interno", card(tree) === "No se pudo asignar. Error del servidor. Probá de nuevo en un momento.", card(tree));

    // Sesión vencida: el único diálogo; la cámara se apaga.
    api.replies["PUT /v2/deliveries/self-assign"] = { ok: false, status: 401, sessionExpired: true };
    tree = await scan(tree, ML("47400000007"));
    check("Asignarme: sesión vencida → diálogo bloqueante", alerts.length === 1 && alerts[0][0] === "Tu sesión expiró", JSON.stringify(alerts));
    check("Asignarme: con la sesión vencida la cámara se apaga", all(tree, (x) => x.type === "CameraView").length === 0);
    alerts[0][2].find((b: any) => b.text === "Entendido").onPress();
    tree = await settle();
    check("Asignarme: «Entendido» cierra el escáner", same(lastNav(), ["goBack"]), JSON.stringify(nav.calls));

    // Colecta: mismo contrato (POST /v2/deliveries/scan con sender_id y shipping_id).
    api.replies = { "POST /v2/deliveries/scan": { ok: true, status: 200, success: true } };
    tree = await open("colecta");
    tree = await scan(tree, ML("47411111111"));
    check("Colecta: éxito en verde, sin diálogo", card(tree) === "Envío ingresado. 47411111111" && alerts.length === 0, card(tree));
    check("Colecta: un solo pedido, sin buscar el rol", same(api.calls, ["POST /v2/deliveries/scan"]), api.calls.join(", "));
    tree = await scan(tree, "47422222222");
    check("Colecta: tracking sin cuenta de ML → rojo, sin pedido", card(tree).startsWith("No reconocemos esta etiqueta") && api.calls.length === 1 && alerts.length === 0, card(tree));
    api.replies["POST /v2/deliveries/scan"] = { ok: true, status: 200, success: false, error: "No se encontró la cuenta del vendedor" };
    tree = await scan(tree, ML("47433333333"));
    check("Colecta: success:false en rojo con el motivo", card(tree) === "No se pudo ingresar. No se encontró la cuenta del vendedor", card(tree));

    // Cambio de modo en la misma pantalla: sesión nueva; lo que llega tarde del modo anterior se descarta.
    let late: (v: any) => void = () => {};
    api.replies = { "POST /v2/deliveries/scan": new Promise((r) => (late = r)) };
    tree = await scan(tree, ML("47444444444"));
    rootEl = RealReact.createElement(Scan, { navigation: nav, route: { params: { mode: "asignarme" } } });
    tree = await settle();
    check("Cambio de modo: título y resumen nuevos", textOf(tree).includes("Asignarme envío") && !summary(tree) && !card(tree), `${summary(tree)} | ${card(tree)}`);
    const soundsBefore = sounds.length;
    late({ ok: true, status: 200, success: true });
    tree = await settle();
    check("Cambio de modo: la respuesta tardía del modo anterior no se muestra ni suena", !card(tree) && !summary(tree) && sounds.length === soundsBefore, `${card(tree)} | ${sounds.join(",")}`);

    // Cierre con un pedido pendiente: al llegar la respuesta no hay diálogo, sonido ni error.
    let pendingReply: (v: any) => void = () => {};
    api.replies = { "GET /v2/users/38/role": ROLE, "PUT /v2/deliveries/self-assign": new Promise((r) => (pendingReply = r)) };
    tree = await open("asignarme");
    tree = await scan(tree, ML("47455555555"));
    tree = await press(tree, "Inicio");
    check("Cierre: la barra navega con el pedido en curso", same(lastNav(), ["navigate", "DriverScreen"]));
    tree = await mount(RealReact.createElement("View", null));
    let crashed = "";
    try { pendingReply({ ok: false, status: 401, sessionExpired: true }); await settle(); } catch (e: any) { crashed = String(e?.message ?? e); }
    check("Cierre: la respuesta tardía no abre diálogos ni suena", !crashed && alerts.length === 0 && sounds.length === 0, `${crashed} | ${JSON.stringify(alerts)} | ${sounds.join(",")}`);

    // Light/Dark: el visor es oscuro fijo y legible con cualquier apariencia, también con la tarjeta y el resumen.
    for (const scheme of ["light", "dark"]) {
      useTheme(createTheme({ scheme, style: "marble" }));
      api.replies = { "GET /v2/users/38/role": ROLE, "PUT /v2/deliveries/self-assign": [{ ok: true, result: "claimed" }, { ok: false, status: 409, error: "Este paquete lo tiene otro chofer" }] };
      tree = await open("asignarme");
      tree = await scan(tree, ML("47466666661"));
      const okLeg = legibility(tree, "#000000");
      tree = await scan(tree, ML("47466666662"));
      tree = await press(tree, "✓ 1");
      const errLeg = legibility(tree, "#000000");
      check(`Escaneo ${scheme}: tarjeta verde, roja y resumen legibles sobre la cámara`, okLeg.bad.length === 0 && errLeg.bad.length === 0 && okLeg.texts > 2, [...okLeg.bad, ...errLeg.bad].join(" · "));
      check(`Escaneo ${scheme}: mismos colores del visor oscuro`, flat(cardNode(tree).props.style).borderColor === dark.status.rejected.text);
    }
    contextOverride.delete(UserContext);
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
      if (C !== HomeScreen) {
        nav.calls = [];
        const t = await mount(RealReact.createElement(FixedTheme, { theme: PUBLIC_THEME }, RealReact.createElement(C, { navigation: nav })));
        await press(t, "Entendido");
        check(`${name}: «Entendido» vuelve al login`, JSON.stringify(nav.calls) === JSON.stringify([["goBack"]]), JSON.stringify(nav.calls));
      }
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

  // 20b) Seller: el menú de envío y Envío tradicional son blancos (texto legible
  // sobre blanco) y Alertas no trae la barra del chofer: vuelve con la flecha.
  {
    const { ClientScreen } = L("src/Presentation/views/client/Landing/Client.tsx");
    const { EnvioTradicionalScreen } = L("src/Presentation/views/client/Landing/EnvioTradicionalScreen.tsx");
    const Alerts = L("src/Presentation/views/common/NotificationScreen.tsx").default;
    useTheme(createTheme({ scheme: "dark" }));
    nav.calls = [];
    let tree = await mount(RealReact.createElement(ClientScreen, { navigation: nav, route: { params: undefined } }));
    tree = await press(tree, "Solicitar envío");
    const menu = all(tree, (x) => x.type === "Modal" && textOf(x).includes("¿Qué tipo de envío"))[0];
    const leg = menu ? legibility(menu, "#FFFFFF") : { bad: ["sin menú"], texts: 0 };
    check(`Seller: menú de envío legible sobre blanco (${leg.texts} textos)`, leg.texts >= 3 && !leg.bad.length, leg.bad.join(" · "));
    tree = await mount(RealReact.createElement(EnvioTradicionalScreen, { navigation: nav, route: { params: undefined } }));
    const inputs = all(tree, (x) => x.type === "TextInput");
    const onWhite = (c?: string) => (c ? contrast(over(c, "#FFFFFF"), "#FFFFFF") : 0);
    check("Envío tradicional: lo escrito se lee sobre el campo blanco", inputs.length === 2 && inputs.every((x) => flat(x.props.style).backgroundColor === "#FFFFFF" && onWhite(flat(x.props.style).color) >= 4.5));
    check("Envío tradicional: la ayuda del campo se ve", inputs.every((x) => onWhite(x.props.placeholderTextColor) >= 2.5), inputs.map((x) => x.props.placeholderTextColor).join(", "));
    setDriverApi();
    tree = await mount(RealReact.createElement(Alerts, { area: "seller" }));
    const txt = textOf(tree);
    check("Alertas del vendedor: sin la barra ni la marca del chofer", !["Inicio", "Colectas", "QR", "LYNX DRIVER"].some((s) => txt.includes(s)) && txt.includes("LYNX"));
    nav.calls = [];
    byLabel(tree, "Volver")[0].props.onPress();
    await settle();
    check("Alertas del vendedor: la flecha vuelve", JSON.stringify(nav.calls) === JSON.stringify([["goBack"]]), JSON.stringify(nav.calls));
    tree = await mount(RealReact.createElement(Alerts));
    check("Alertas del chofer: con su barra y sin flecha", textOf(tree).includes("LYNX DRIVER") && textOf(tree).includes("Colectas") && !byLabel(tree, "Volver").length);
  }

  // 20c) Envíos: un Turbo lleva su etiqueta. El servidor manda las filas de
  // deliveries tal cual (tipo_envio "flex" también en los Turbo; lo que los
  // marca es is_turbo), y la tarjeta y el detalle dicen «Turbo».
  {
    useTheme(createTheme({ scheme: "dark" }));
    envios.currentDeliveries = [
      { id: 21, tracking: "46001", direccion: "Gurruchaga 1500", nombre_fantasia: "Kiosco Norte", status: "En camino", tipo_envio: "flex", is_turbo: true },
      { id: 22, tracking: "46002", direccion: "Thames 800", nombre_fantasia: "Kiosco Sur", status: "En camino", tipo_envio: "flex", is_turbo: false },
    ];
    setEnviosApi();
    let tree = await press(await mount(screens[1][1]()), "Flex");
    const flex = textOf(pressable(tree, "Thames 800"));
    check("Envíos: un Turbo no aparece en Flex", !textOf(tree).includes("Gurruchaga 1500"));
    envios.currentDeliveries = envios.currentDeliveries.map((r: any) => ({ ...r, status: "Entregado", updated_at: UPDATED }));
    tree = await press(await mount(screens[1][1]()), "Turbo");
    tree = await press(tree, "Finalizados");
    const turbo = textOf(pressable(tree, "Gurruchaga 1500"));
    check("Envíos: el Turbo dice «Turbo» en la tarjeta", turbo.includes("Turbo") && !turbo.includes("Flex"), turbo);
    check("Envíos: el resto sigue diciendo «Flex»", flex.includes("Flex") && !flex.includes("Turbo"), flex);
    tree = await press(tree, "Gurruchaga 1500");
    const detalle = all(tree, (x) => x.type === "Modal").find((m) => textOf(m).includes("DETALLE"));
    check("Envíos: el detalle del Turbo dice Método «Turbo»", !!detalle && textOf(detalle).includes("Turbo"));
    envios.currentDeliveries = DELIVERIES;
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
