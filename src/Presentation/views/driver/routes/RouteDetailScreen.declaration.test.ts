// Pruebas de pantalla de la declaración de paquetes por parada (RouteDetailScreen
// + DeclaredCountForm). El repo no tiene Jest: igual que las demás pruebas, se
// compila y se corre con node, desde la raíz del repo:
//   npx tsc --outDir /tmp/decl-screen --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/routes/RouteDetailScreen.declaration.test.ts
//   node /tmp/decl-screen/RouteDetailScreen.declaration.test.js
// La pantalla se transpila al vuelo con el `typescript` del proyecto y corre con
// un React de prueba: useState toma los valores de `states` en orden de llamada
// y sus setters registran lo que reciben; los efectos no corren. react-native,
// los íconos y Api.tsx están simulados: no hay red.

export {}; // módulo: sin esto, los nombres de acá chocan con los globales del DOM

const path = require("path");
const fs = require("fs");
const Module = require("module");
const assert = require("assert/strict");

const APP = process.cwd();
const ts = require(path.join(APP, "node_modules", "typescript"));
const appRequire = Module.createRequire(path.join(APP, "package.json"));
const RealReact = appRequire("react");
(globalThis as any).__DEV__ = false;

let states: any[] = [];
let stateIdx = 0;
let sets: [number, any][] = [];
const FakeReact = {
  ...RealReact,
  useState: (init: any) => {
    const i = stateIdx++;
    const v = states[i];
    return [v !== undefined ? v : typeof init === "function" ? init() : init, (x: any) => sets.push([i, x])];
  },
  useEffect: () => {},
  useCallback: (f: any) => f,
  useMemo: (f: any) => f(),
  useRef: (v: any) => ({ current: v }),
};

const alerts: any[][] = [];
const calls: any[][] = [];
let currentRoute: any = null;
let putImpl: (p: string, b: any) => Promise<any> = async () => ({ ok: true });
const ApiMock = {
  getJson: async (p: string) => { calls.push(["GET", p]); return { ok: true, route: currentRoute }; },
  putJson: (p: string, b: any) => { calls.push(["PUT", p, b]); return putImpl(p, b); },
  postJson: async (p: string, b: any) => { calls.push(["POST", p, b]); return { ok: true }; },
};

const RN = {
  StyleSheet: { create: (s: any) => s, absoluteFill: {} },
  View: "View", Text: "Text", Pressable: "Pressable", ImageBackground: "ImageBackground", ScrollView: "ScrollView",
  SafeAreaView: "SafeAreaView", ActivityIndicator: "ActivityIndicator", TextInput: "TextInput",
  Alert: { alert: (...a: any[]) => alerts.push(a) },
  Linking: { openURL: () => Promise.resolve() },
  Platform: { OS: "android", select: (o: any) => o.android ?? o.default },
  Dimensions: { get: () => ({ width: 400, height: 800, scale: 2, fontScale: 1 }) },
  PixelRatio: { get: () => 2, roundToNearestPixel: (n: number) => n },
  StatusBar: { currentHeight: 24 },
  Appearance: { getColorScheme: () => "dark" },
  useWindowDimensions: () => ({ width: 400, height: 800 }),
};
const MOCKS: Record<string, any> = { "react-native": RN, "@expo/vector-icons": { Ionicons: "Ionicons" } };
const nav = { navigate: () => {}, goBack: () => {}, addListener: () => () => {} };

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
    if (spec.endsWith(".png")) return 1;
    if (spec.startsWith(".")) {
      const base = path.resolve(path.dirname(file), spec);
      if (base.endsWith(path.join("config", "Api"))) return ApiMock;
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
const textOf = (t: any): string => (t === null ? "" : typeof t === "string" ? t : Array.isArray(t) ? t.map(textOf).join("") : textOf(t.children));
const find = (t: any, pred: (n: any) => boolean, acc: any[] = []): any[] => {
  if (!t || typeof t === "string") return acc;
  if (Array.isArray(t)) { t.forEach((x) => find(x, pred, acc)); return acc; }
  if (pred(t)) acc.push(t);
  find(t.children, pred, acc);
  return acc;
};
const pressableWith = (tree: any, label: string) => find(tree, (n) => n.type === "Pressable" && textOf(n).trim() === label).pop();
const inputs = (t: any) => find(t, (n) => n.type === "TextInput" && n.props.accessibilityLabel === "Cantidad de paquetes retirados");
const tick = () => new Promise((r) => setImmediate(r));

const Detail = L("src/Presentation/views/driver/routes/RouteDetailScreen.tsx").default;
const { NO_NETWORK } = L("src/Presentation/views/driver/errorMessage.ts");

const stop = (p: any = {}) => ({
  id: 70, route_id: 5, sequence: 1, type: "PICKUP", status: "ARRIVED", arrived_at: null, completed_at: null, notes: null,
  store_id: 3, store_name: "ARROYITO", store_address: "Arcadini 4464", cutoff_snapshot: "09:00:00", window_snapshot: 1,
  pickup_time_snapshot: "08:30:00", collected_count: 0, store_ready_at: null, latitude_snapshot: null, longitude_snapshot: null,
  declared_count: null, declared_at: null, deliveries: [], ...p,
});
const route = (p: any = {}) => ({
  id: 5, type: "PICKUP", status: "IN_PROGRESS", scheduled_date: "2026-10-26", stops_count: 1, deliveries_count: 0,
  load_expected_count: null, load_confirmed_count: null, template_id: 2, departure_time: "09:00:00", driver_confirmation: "ACCEPTED",
  confirmation_state: "ACCEPTED", qr_token: "x", notes: null, started_at: null, completed_at: null, stops: [stop()], ...p,
});

// Orden de useState: detalle (route, busy, error, count, openStop, deadline) = 0-5;
// la parada abierta, que va primera (pending, notes, closing, closeError, declareError) = 6-10;
// su formulario (editing, text, invalid) = 11-13; después las demás paradas.
const IDX = { route: 0, declareError: 10, editing: 11, invalid: 13 };
const draw = (r: any, o: { open?: number; editing?: boolean; text?: string; declareError?: string } = {}) => {
  states = [r, false, null, "", o.open ?? r.stops[0]?.id, null, undefined, undefined, undefined, undefined, o.declareError, o.editing, o.text];
  stateIdx = 0; sets = []; calls.length = 0; alerts.length = 0;
  currentRoute = r;
  return render(RealReact.createElement(Detail, { navigation: nav, route: { params: { routeId: r.id, name: "MAÑANERO 02" } } }));
};
const setsAt = (i: number) => sets.filter(([k]) => k === i).map(([, v]) => v);
const puts = () => calls.filter((c) => c[0] === "PUT");
const submit = (t: any) => pressableWith(t, "Informar") ?? pressableWith(t, "Guardar");
const confirmButton = (text: string) => alerts[0][2].find((b: any) => b.text === text);
const replacedStop = () => setsAt(IDX.route).some((v) => typeof v === "function");

let failed = 0;
const check = async (name: string, fn: () => unknown) => {
  try { await fn(); console.log(`ok   ${name}`); }
  catch (e: any) { failed++; console.log(`FALLA ${name} → ${String(e?.message ?? e).split("\n")[0]}`); }
};

(async () => {
  await check("en curso, sin informar: tienda, horario, «Sin informar», teclado numérico y totales en cero", () => {
    const t = draw(route());
    const txt = textOf(t);
    assert.ok(txt.includes("Retiro · ARROYITO"));
    assert.ok(txt.includes("Retiro: 08:30"));
    assert.ok(txt.includes("Llegaste · Sin informar"), "estado en el encabezado de la parada");
    const [inp] = inputs(t);
    assert.ok(inp, "hay campo");
    assert.equal(inp.props.keyboardType, "number-pad");
    assert.ok(pressableWith(t, "Informar"));
    assert.match(txt, /Paquetes retirados.*0informados.*0tiendas informadas.*1tienda pendiente/);
  });

  await check("informar 14: PUT a la parada del recorrido con { count: 14 }, muestra lo guardado y recarga", async () => {
    putImpl = async () => ({ ok: true, stop: stop({ declared_count: 14 }) });
    const r = route();
    submit(draw(r, { text: "14" })).props.onPress();
    await tick(); await tick();
    assert.deepEqual(puts(), [["PUT", "/v2/routes/5/stops/70/declare-count", { count: 14 }]]);
    const upd = setsAt(IDX.route).find((v) => typeof v === "function");
    assert.equal(upd(r).stops[0].declared_count, 14, "reemplaza la parada en pantalla");
    assert.ok(calls.some((c) => c[0] === "GET" && c[1] === "/v2/routes/5"), "refresca desde el servidor");
    assert.equal(alerts.length, 0, "la primera declaración no pide confirmación");
  });

  await check("informar 0: viaja count 0 (no es «sin informar»)", async () => {
    putImpl = async () => ({ ok: true, stop: stop({ declared_count: 0 }) });
    submit(draw(route(), { text: "0" })).props.onPress();
    await tick();
    assert.deepEqual(puts()[0][2], { count: 0 });
  });

  await check("vacío, negativo, decimal o con signo: no llama a la API y explica", () => {
    for (const bad of ["", "-1", "2.5", "3,0", "+4"]) {
      submit(draw(route(), { text: bad })).props.onPress();
      assert.equal(puts().length, 0, bad);
      assert.ok(setsAt(IDX.invalid).some((v) => typeof v === "string" && v.length > 0), `mensaje para «${bad}»`);
    }
  });

  await check("doble toque: una sola solicitud", async () => {
    let resolve: (v: any) => void = () => {};
    putImpl = () => new Promise((r) => { resolve = r; });
    const btn = submit(draw(route(), { text: "5" }));
    btn.props.onPress(); btn.props.onPress(); btn.props.onPress();
    assert.equal(puts().length, 1);
    resolve({ ok: true, stop: stop({ declared_count: 5 }) });
    await tick();
  });

  await check("reintento después de un error: vuelve a permitir enviar", async () => {
    putImpl = async () => { throw new TypeError("Network request failed"); };
    const btn = submit(draw(route(), { text: "5" }));
    btn.props.onPress();
    await tick(); await tick();
    btn.props.onPress();
    await tick();
    assert.equal(puts().length, 2);
  });

  await check("ya informado y reabierto: muestra la cantidad del servidor y «Corregir», sin campo", () => {
    const t = draw(route({ stops: [stop({ declared_count: 14 })] }));
    const txt = textOf(t);
    assert.ok(txt.includes("Llegaste · Informado: 14 paquetes"));
    assert.ok(pressableWith(t, "Corregir"));
    assert.equal(inputs(t).length, 0);
    assert.match(txt, /14informados.*1tienda informada.*0tiendas pendientes/);
  });

  await check("corregir: pide confirmación antes de sobrescribir; «No» no envía", async () => {
    putImpl = async () => ({ ok: true, stop: stop({ declared_count: 12 }) });
    submit(draw(route({ stops: [stop({ declared_count: 14 })] }), { editing: true, text: "12" })).props.onPress();
    assert.equal(puts().length, 0, "nada antes de confirmar");
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0][0], "Corregir cantidad");
    assert.match(alerts[0][1], /Ya informaste 14\. ¿Reemplazarlo por 12\?/);
    confirmButton("No").onPress?.();
    assert.equal(puts().length, 0);
    confirmButton("Sí, corregir").onPress();
    await tick();
    assert.deepEqual(puts(), [["PUT", "/v2/routes/5/stops/70/declare-count", { count: 12 }]]);
  });

  await check("corregir con el mismo valor: no envía ni pregunta", () => {
    submit(draw(route({ stops: [stop({ declared_count: 14 })] }), { editing: true, text: "14" })).props.onPress();
    assert.equal(puts().length, 0);
    assert.equal(alerts.length, 0);
    assert.deepEqual(setsAt(IDX.editing), [false]);
  });

  await check("corregir de 3 a 0 también confirma", async () => {
    putImpl = async () => ({ ok: true, stop: stop({ declared_count: 0 }) });
    submit(draw(route({ stops: [stop({ declared_count: 3 })] }), { editing: true, text: "0" })).props.onPress();
    assert.equal(alerts.length, 1);
    confirmButton("Sí, corregir").onPress();
    await tick();
    assert.deepEqual(puts()[0][2], { count: 0 });
  });

  await check("varias tiendas: estado por parada y totales solo con declared_count (no collected_count)", () => {
    const txt = textOf(draw(route({
      stops: [
        stop({ id: 70, sequence: 1, declared_count: 14, collected_count: 99 }),
        stop({ id: 71, sequence: 2, store_name: "CENTRO", declared_count: 0, status: "DONE" }),
        stop({ id: 72, sequence: 3, store_name: "NORTE", declared_count: null, status: "PENDING" }),
      ],
    })));
    assert.match(txt, /14informados.*2tiendas informadas.*1tienda pendiente/);
    assert.ok(txt.includes("Informado: 14 paquetes") && txt.includes("Cerrada · Informado: 0 paquetes") && txt.includes("Pendiente · Sin informar"));
  });

  await check("tienda + Dropoff: «puntos de retiro» en los totales y el Dropoff también se declara", () => {
    const dropoff = stop({ id: 71, sequence: 2, store_id: null, store_name: null, warehouse_name: "DROPOFF NORTE", declared_count: null, status: "PENDING" });
    const t = draw(route({ stops: [stop({ declared_count: 4 }), dropoff] }), { open: 71 });
    const txt = textOf(t);
    assert.match(txt, /4informados.*1punto de retiro informado.*1punto de retiro pendiente/);
    assert.ok(!/tiendas? (informad|pendient)/.test(txt), "los totales no hablan de tiendas");
    assert.ok(txt.includes("Retiro · DROPOFF NORTE") && txt.includes("Pendiente · Sin informar"));
  });

  await check("403: muestra el error del servidor, no recarga ni da por guardado", async () => {
    putImpl = async () => ({ ok: false, status: 403, error: "la parada no es de un recorrido de este chofer" });
    submit(draw(route(), { text: "4" })).props.onPress();
    await tick(); await tick();
    assert.deepEqual(setsAt(IDX.declareError).filter(Boolean), ["la parada no es de un recorrido de este chofer"]);
    assert.ok(!replacedStop(), "no toca la parada");
    assert.ok(!calls.some((c) => c[0] === "GET"), "no recarga");
  });

  await check("401: el error llega a la parada (el cierre de sesión lo sigue haciendo Api.tsx)", async () => {
    putImpl = async () => ({ ok: false, status: 401, error: "Sesión vencida" });
    submit(draw(route(), { text: "4" })).props.onPress();
    await tick(); await tick();
    assert.deepEqual(setsAt(IDX.declareError).filter(Boolean), ["Sesión vencida"]);
    assert.ok(!replacedStop());
  });

  await check("sin conexión: «Sin conexión…» y nada guardado", async () => {
    putImpl = async () => { throw new TypeError("Network request failed"); };
    submit(draw(route(), { text: "4" })).props.onPress();
    await tick(); await tick();
    assert.deepEqual(setsAt(IDX.declareError).filter(Boolean), [NO_NETWORK]);
    assert.ok(!replacedStop());
  });

  await check("el error guardado se muestra en la parada", () => {
    assert.ok(textOf(draw(route(), { declareError: "la parada no pertenece a este recorrido" })).includes("la parada no pertenece a este recorrido"));
  });

  for (const [label, p, hint] of [
    ["pendiente de aceptar", { status: "ASSIGNED", driver_confirmation: null, confirmation_state: "PENDING" }, "cuando comiences"],
    ["aceptada sin iniciar", { status: "ASSIGNED" }, "cuando comiences"],
    ["planificada", { status: "PLANNED" }, "cuando comiences"],
    ["cancelada", { status: "CANCELLED" }, "cancelada"],
  ] as const) {
    await check(`${label}: solo lectura, sin campo ni «Corregir»`, () => {
      const t = draw(route({ ...p, stops: [stop({ status: "PENDING", declared_count: p.status === "CANCELLED" ? 3 : null })] }));
      assert.equal(inputs(t).length, 0);
      assert.ok(!pressableWith(t, "Corregir") && !pressableWith(t, "Informar"));
      assert.ok(textOf(t).includes(hint));
    });
  }

  await check("finalizada: permite informar y corregir", () => {
    const sin = draw(route({ status: "COMPLETED", stops: [stop({ status: "DONE" })] }));
    assert.ok(inputs(sin).length === 1 && pressableWith(sin, "Informar"));
    assert.ok(pressableWith(draw(route({ status: "COMPLETED", stops: [stop({ status: "DONE", declared_count: 8 })] })), "Corregir"));
  });

  await check("servidor sin la declaración (sin declared_count): no se ofrece ni se muestran totales", () => {
    const s: any = stop(); delete s.declared_count;
    const txt = textOf(draw(route({ stops: [s] })));
    assert.ok(!txt.includes("Sin informar") && !txt.includes("Paquetes retirados"));
  });

  await check("Turbo con retiro: sin declaración", () => {
    const txt = textOf(draw(route({ type: "TURBO", template_id: null, stops: [stop()] })));
    assert.ok(!txt.includes("Paquetes retirados") && !txt.includes("Sin informar"));
  });

  await check("reparto: sin panel de paquetes retirados", () => {
    const delivery = { id: 80, route_id: 5, sequence: 1, type: "DELIVERY", status: "PENDING", arrived_at: null, completed_at: null, notes: null,
      address: "Calle 1", postal_code: "5000", receiver_name: "Ana", deliveries: [] };
    const txt = textOf(draw(route({ type: "DELIVERY", template_id: null, stops: [delivery] })));
    assert.ok(!txt.includes("Paquetes retirados") && !txt.includes("Sin informar"));
  });

  if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
  console.log("\nTodas las pruebas pasaron");
})();
