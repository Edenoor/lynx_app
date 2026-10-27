// Pruebas de ThemeProvider y de las primitivas (ThemedCard, Separator,
// StatusChip): cambios en vivo, persistencia, restablecer y modo Automático.
// El repo no tiene Jest: se compila y se corre con node, desde la raíz:
//   npx tsc --outDir /tmp/theme-runtime --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/theme/themeRuntime.test.ts
//   node /tmp/theme-runtime/themeRuntime.test.js
// Los archivos se transpilan al vuelo con el `typescript` del proyecto y corren
// con un React de prueba: useState toma los valores de `states` en orden, los
// setters registran lo que reciben, los efectos se guardan para correrlos a
// mano y useContext devuelve `contextValue`. react-native, el splash, la barra
// de estado y AsyncStorage están simulados.

export {};

const path = require("path");
const fs = require("fs");
const Module = require("module");

const APP = process.cwd();
const ts = require(path.join(APP, "node_modules", "typescript"));
const appRequire = Module.createRequire(path.join(APP, "package.json"));
const RealReact = appRequire("react");

let states: any[] = [];
let stateIdx = 0;
let sets: [number, any][] = [];
let effects: (() => any)[] = [];
let contextValue: any;
const FakeReact = {
  ...RealReact,
  useState: (init: any) => {
    const i = stateIdx++;
    const v = states[i];
    return [v !== undefined ? v : typeof init === "function" ? init() : init, (x: any) => sets.push([i, x])];
  },
  useEffect: (f: () => any) => { effects.push(f); },
  useCallback: (f: any) => f,
  useMemo: (f: any) => f(),
  // Sin estado entre renders: cada render es el primero.
  useRef: (v: any) => ({ current: v }),
  useContext: (ctx: any) => (contextValue !== undefined ? contextValue : ctx._currentValue),
};

let systemScheme: string | null = "dark";
const forced: any[] = [];
const saved: any[] = [];
// Lo que «había guardado» al abrir la app: como lo dejaba la Fase 1 más un estilo, sin bordes.
const stored: any = { version: 1, colorMode: "light", style: "marble" };
const splash = { prevented: 0, hidden: 0 };
const RN = {
  StyleSheet: { create: (s: any) => s, hairlineWidth: 0.5 },
  View: "View", Text: "Text",
  Appearance: { setColorScheme: (s: any) => forced.push(s) },
  useColorScheme: () => systemScheme,
  Dimensions: { get: () => ({ width: 360, height: 800 }) },
  Platform: { OS: "android" },
  StatusBar: { currentHeight: 24 },
};
const MOCKS: Record<string, any> = {
  "react-native": RN,
  "@expo/vector-icons": { Ionicons: "Ionicons" },
  "expo-status-bar": { StatusBar: "StatusBar" },
  "expo-splash-screen": {
    preventAutoHideAsync: () => { splash.prevented++; return Promise.resolve(true); },
    hideAsync: () => { splash.hidden++; return Promise.resolve(); },
  },
};
const StorageMock = {
  loadAppearance: () => Promise.resolve(stored),
  saveAppearance: (v: any) => { saved.push(v); return Promise.resolve(); },
};

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
    if (MOCKS[spec]) return MOCKS[spec];
    if (spec === "react") return FakeReact;
    if (spec.startsWith(".")) {
      const base = path.resolve(path.dirname(file), spec);
      if (base.endsWith("AppearanceStorage")) return StorageMock;
      for (const ext of [".ts", ".tsx"]) if (fs.existsSync(base + ext)) return load(base + ext);
      throw new Error("no encuentro " + spec + " desde " + file);
    }
    return appRequire(spec);
  };
  new Function("require", "module", "exports", out)(req, mod, mod.exports);
  return mod.exports;
}
const L = (rel: string) => load(path.join(APP, rel));

function render(node: any): any {
  if (node === null || node === undefined || typeof node === "boolean") return null;
  if (Array.isArray(node)) return node.map(render).filter((x) => x !== null);
  if (typeof node !== "object") return String(node);
  if (typeof node.type === "function") return render(node.type(node.props));
  if (node.type === RealReact.Fragment) return render(node.props.children);
  const { children, ...props } = node.props ?? {};
  return { type: node.type, props, children: render(children) };
}
const flat = (style: any): any => (Array.isArray(style) ? Object.assign({}, ...style.map(flat)) : style || {});
const tick = () => new Promise((r) => setImmediate(r));
const last = <T,>(a: T[]) => a[a.length - 1];
const hasText = (n: any, s: string): boolean => (typeof n === "string" ? n === s : Array.isArray(n) ? n.some((c) => hasText(c, s)) : !!n && hasText(n.children, s));

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok || !detail ? "" : ` → ${detail}`}`);
};

const { ThemeProvider } = L("src/Presentation/theme/ThemeProvider.tsx");
const { createTheme } = L("src/Presentation/theme/createTheme.ts");
const { DEFAULT_APPEARANCE } = L("src/Presentation/theme/appearance.ts");
const ThemedCard = L("src/Presentation/components/ThemedCard.tsx").default;
const Separator = L("src/Presentation/components/Separator.tsx").default;
const StatusChip = L("src/Presentation/components/StatusChip.tsx").default;

// Renderiza el provider con `prefs` como estado y devuelve el valor del contexto.
const provide = (prefs: any) => {
  states = [prefs]; stateIdx = 0; sets = []; effects = [];
  const tree = render(RealReact.createElement(ThemeProvider, null, "contenido"));
  // El valor del ThemeContext (el provider de afuera es el del esquema nativo).
  const find = (n: any): any => (!n || typeof n !== "object" ? undefined : n.props?.value?.theme ? n : [].concat(n.children).map(find).find(Boolean));
  return { tree, value: find(tree)?.props?.value };
};

(async () => {
  check("el splash se retiene hasta hidratar", splash.prevented === 1);

  // Hidratación
  const before = provide(null);
  check("sin preferencias cargadas no dibuja nada (sin flash)", before.tree === null);
  effects[0]();
  await tick();
  const hydrated = sets.filter(([i]) => i === 0).map(([, v]) => v);
  check("hidrata con lo guardado y completa lo que falta", hydrated.length === 1 && JSON.stringify(hydrated[0]) === JSON.stringify({ version: 1, colorMode: "light", style: "marble", radius: "balanced" }), JSON.stringify(hydrated));

  // Tema según preferencias
  const dark = provide(DEFAULT_APPEARANCE);
  check("por defecto: tema oscuro Classic Equilibrado (mismo objeto que AppTheme)", dark.value.theme === createTheme({ scheme: "dark" }));
  check("dibuja los hijos con el tema", hasText(dark.tree, "contenido"));

  const marble = provide({ version: 1, colorMode: "dark", style: "marble", radius: "rounded" });
  check("Marble + Oscuro + Redondeado", marble.value.theme === createTheme({ scheme: "dark", style: "marble", radius: "rounded" }));
  check("cambiar la preferencia cambia el tema (en vivo)", marble.value.theme !== dark.value.theme);

  // Automático sigue al sistema
  systemScheme = "light";
  const autoLight = provide({ ...DEFAULT_APPEARANCE, colorMode: "system" });
  systemScheme = "dark";
  const autoDark = provide({ ...DEFAULT_APPEARANCE, colorMode: "system" });
  systemScheme = null;
  const autoNull = provide({ ...DEFAULT_APPEARANCE, colorMode: "system" });
  check("Automático con el teléfono en claro → claro", autoLight.value.theme.scheme === "light");
  check("Automático con el teléfono en oscuro → oscuro", autoDark.value.theme.scheme === "dark");
  check("Automático sin dato del sistema → oscuro", autoNull.value.theme.scheme === "dark");
  systemScheme = "light";
  check("Claro fijo ignora el sistema", provide({ ...DEFAULT_APPEARANCE, colorMode: "light" }).value.theme.scheme === "light");
  check("Oscuro fijo ignora el sistema", provide({ ...DEFAULT_APPEARANCE, colorMode: "dark" }).value.theme.scheme === "dark");

  // Componentes nativos: modo fijo o seguir al sistema
  forced.length = 0;
  provide({ ...DEFAULT_APPEARANCE, colorMode: "light" }); effects.forEach((f) => f());
  provide({ ...DEFAULT_APPEARANCE, colorMode: "system" }); effects.forEach((f) => f());
  check("Appearance.setColorScheme: claro fijo y null para Automático", JSON.stringify(forced) === JSON.stringify(["light", null]), JSON.stringify(forced));
  check("el splash se oculta al tener preferencias", splash.hidden >= 1);

  // Cambiar, guardar y restablecer
  saved.length = 0;
  const current = { version: 1, colorMode: "dark", style: "classic", radius: "balanced" };
  const v = provide(current).value;
  v.setAppearance({ style: "minimal" });
  check("setAppearance aplica en el momento", JSON.stringify(last(sets)) === JSON.stringify([0, { ...current, style: "minimal" }]));
  check("setAppearance guarda la preferencia completa", JSON.stringify(last(saved)) === JSON.stringify({ ...current, style: "minimal" }));
  v.setAppearance({ radius: "square", colorMode: "light" });
  check("cambios combinados conservan lo demás", JSON.stringify(last(saved)) === JSON.stringify({ ...current, radius: "square", colorMode: "light" }));
  provide({ version: 1, colorMode: "light", style: "marble", radius: "rounded" }).value.resetAppearance();
  check("restablecer vuelve a oscuro + Classic + Equilibrado y lo guarda", JSON.stringify(last(saved)) === JSON.stringify(DEFAULT_APPEARANCE) && JSON.stringify(last(sets)?.[1]) === JSON.stringify(DEFAULT_APPEARANCE));

  // Primitivas: reaccionan al tema del contexto
  const withTheme = (theme: any, el: any) => { contextValue = { theme }; const t = render(el); contextValue = undefined; return t; };
  const classic = createTheme({ scheme: "dark" });
  const minimal = createTheme({ scheme: "light", style: "minimal" });
  const marbleT = createTheme({ scheme: "dark", style: "marble", radius: "rounded" });

  const cardClassic = flat(withTheme(classic, RealReact.createElement(ThemedCard, { style: { padding: 4 } })).props.style);
  const cardMarble = flat(withTheme(marbleT, RealReact.createElement(ThemedCard, null)).props.style);
  const rowMinimal = flat(withTheme(minimal, RealReact.createElement(ThemedCard, { variant: "row" })).props.style);
  check("ThemedCard Classic: superficie y borde de siempre + estilo propio", cardClassic.backgroundColor === classic.surfaces.card && cardClassic.borderWidth === 1 && cardClassic.padding === 4);
  check("ThemedCard Marble: opaca, con sombra suave y radio redondeado", cardMarble.backgroundColor === marbleT.surfaces.card && cardMarble.elevation === 2 && cardMarble.borderRadius === marbleT.radius.lg);
  check("ThemedCard fila en Minimal: sin fondo, con separador inferior", rowMinimal.backgroundColor === "transparent" && rowMinimal.borderBottomWidth === 0.5 && rowMinimal.borderWidth === 0);

  const sep = flat(withTheme(minimal, RealReact.createElement(Separator, null)).props.style);
  check("Separator usa color y grosor del tema", sep.height === minimal.separator.width && sep.backgroundColor === minimal.separator.color);

  const ICONS = new Set<string>();
  for (const [theme, label] of [[classic, "oscuro"], [minimal, "claro minimal"]] as const) {
    for (const key of ["delivered", "pending", "confirmed", "incident", "rejected", "cancelled", "inTransit", "neutral"]) {
      const chip = withTheme(theme, RealReact.createElement(StatusChip, { status: key, label: "Etiqueta" }));
      const icon = chip.children.find((c: any) => c.type === "Ionicons");
      const text = chip.children.find((c: any) => c.type === "Text");
      const tone = theme.status[key];
      ICONS.add(icon.props.name);
      check(`StatusChip ${key} (${label}): ícono y texto con los colores del estado`,
        icon.props.color === tone.icon && flat(text.props.style).color === tone.text && flat(chip.props.style).backgroundColor === tone.background && String(text.children) === "Etiqueta");
    }
  }
  check("StatusChip: un ícono distinto por estado (no depende solo del color)", ICONS.size === 8);

  if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
  console.log("\nTodas las pruebas pasaron");
})();
