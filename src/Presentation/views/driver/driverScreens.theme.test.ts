// Pruebas de Mi cuenta, Envíos y Recorridos con el tema dinámico: las 18
// combinaciones, cambio en vivo sin perder estado, contraste de lo que se
// dibuja, radios, y que acciones, rutas y pedidos a la API sigan iguales.
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

function draw(node: any, at: string): any {
  if (node === null || node === undefined || typeof node === "boolean") return null;
  if (Array.isArray(node)) return node.map((n, i) => draw(n, `${at}.${n?.key ?? i}`)).filter((x) => x !== null);
  if (typeof node !== "object") return String(node);
  if (node.type === RealReact.Fragment) return draw(node.props.children, at);
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
async function mount(el: any) { instances.clear(); rootEl = el; return settle(); }
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
const RN = {
  StyleSheet: { create: (s: any) => s, hairlineWidth: 0.5, flatten: (s: any) => flat(s) },
  View: "View", Text: "Text", ScrollView: "ScrollView", Pressable: "Pressable", TouchableOpacity: "TouchableOpacity",
  Image: "Image", ImageBackground: "ImageBackground", SafeAreaView: "SafeAreaView", ActivityIndicator: "ActivityIndicator",
  RefreshControl: "RefreshControl", TextInput: "TextInput",
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
  },
  "@react-native-community/datetimepicker": host("DateTimePicker"),
  "expo-file-system/next": { File: class {}, Paths: {} },
};
const RELATIVE_MOCKS: [string, any][] = [
  ["config/Api", { getJson: (p: string) => reply("GET", p), postJson: (p: string) => reply("POST", p), putJson: (p: string) => reply("PUT", p) }],
  ["Envios/ViewModel", { __esModule: true, default: () => envios }],
  ["landing/ViewModel", { __esModule: true, default: () => ({ user: { first_name: "Ana María", email: "ana@lynx.test", username: "ana" }, removeUserSession: () => { throw new Error("no se cierra sesión en la prueba"); } }) }],
  ["remote/api/ApiDelivery", { ApiDelivery: { post: () => { throw new Error("sin red en la prueba"); } } }],
  ["components/LynxPulseLoader", { LynxPulseLoader: host("LynxPulseLoader") }],
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
    return appRequire(spec);
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

(async () => {
  const { createTheme } = L("src/Presentation/theme/createTheme.ts");
  const { ThemeContext } = L("src/Presentation/theme/ThemeContext.ts");
  const { RADIUS_PRESETS, VISUAL_STYLES } = L("src/Presentation/theme/appearance.ts");
  const Account = L("src/Presentation/views/driver/account/DriverAccountScreen.tsx").default;
  const { EnviosScreen } = L("src/Presentation/views/driver/Envios/EnviosScreen.tsx");
  const Routes = L("src/Presentation/views/driver/routes/RoutesScreen.tsx").default;

  const useTheme = (t: any) => contextOverride.set(ThemeContext, { theme: t, preferences: {}, setAppearance: () => {}, resetAppearance: () => {} });
  const screens: [string, () => any, () => void][] = [
    ["Mi cuenta", () => RealReact.createElement(Account), () => { api.replies = { "GET /v2/driver-home/me": { ok: true, home: { address: "Lavalle 300" } } }; }],
    ["Envíos", () => RealReact.createElement(EnviosScreen, { navigation: nav }), () => { envios.currentDeliveries = DELIVERIES; }],
    ["Recorridos", () => RealReact.createElement(Routes, { navigation: nav, route: { params: undefined } }), setRoutesApi],
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

  if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
  console.log("\nTodas las pruebas pasaron");
})().catch((e) => { console.log("FALLA", e?.stack ?? e); process.exit(1); });
