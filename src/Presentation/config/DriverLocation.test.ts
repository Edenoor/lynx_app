// Pruebas de la subida del GPS (DriverLocation.ts): qué pasa con el buffer y
// con el seguimiento según lo que contesta el servidor. El repo no tiene Jest:
// se compila y se corre con node, desde la raíz del repo:
//   npx tsc --outDir /tmp/driver-location --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/config/DriverLocation.test.ts
//   node /tmp/driver-location/DriverLocation.test.js
// DriverLocation.ts se transpila al vuelo con el `typescript` del proyecto.
// expo-location, expo-task-manager, expo-battery, expo-notifications,
// AsyncStorage (en memoria), AppState, Api.tsx y SessionRenewal están
// simulados: no hay red. Las respuestas se arman con el parseJsonBody real,
// como llegan de Api.tsx. Los setInterval son falsos: se disparan a mano.

export {}; // módulo: sin esto, los nombres de acá chocan con los globales del DOM

const path = require("path");
const fs = require("fs");
const assert = require("assert/strict");

const APP = process.cwd();
const ts = require(path.join(APP, "node_modules", "typescript"));
(globalThis as any).__DEV__ = false;

const BUFFER_KEY = "driver_positions_buffer";
const storage = new Map<string, string>();
const native = { stops: 0, starts: 0, started: true, permissionChecks: 0 };
let posts: any[] = [];
let respond: (body: any) => any = () => ({ ok: true, status: 200 });
// GET /v2/driver-locations/me/policy (franja horaria).
let gets: string[] = [];
let policy: () => any = () => ({ ok: true, status: 200 });
const appState = { currentState: "background", listeners: [] as ((state: string) => void)[] };
const pushListeners: (() => void)[] = [];
const intervals = new Map<number, { fn: () => void; ms: number }>();
let nextInterval = 1;
(globalThis as any).setInterval = (fn: () => void, ms: number) => { const id = nextInterval++; intervals.set(id, { fn, ms }); return id; };
(globalThis as any).clearInterval = (id: number) => { intervals.delete(id); };
// Avisos locales programados (expo-notifications), por identificador.
const notices = { scheduled: new Map<string, any>(), channels: [] as any[], cancels: 0 };
const fix = () => ({ coords: { latitude: -34.6, longitude: -58.4, accuracy: 10, speed: 0, heading: 0 }, timestamp: Date.now() });

const MOCKS: Record<string, any> = {
  "expo-location": {
    hasStartedLocationUpdatesAsync: async () => native.started,
    stopLocationUpdatesAsync: async () => { native.stops++; native.started = false; },
    startLocationUpdatesAsync: async () => { native.starts++; native.started = true; },
    getForegroundPermissionsAsync: async () => { native.permissionChecks++; return { granted: true }; },
    getBackgroundPermissionsAsync: async () => { native.permissionChecks++; return { granted: true }; },
    getLastKnownPositionAsync: async () => fix(),
    getCurrentPositionAsync: async () => fix(),
    Accuracy: { High: 4, Balanced: 3 },
    ActivityType: { AutomotiveNavigation: 2 },
  },
  "expo-task-manager": { defineTask: () => {} },
  "expo-battery": { getBatteryLevelAsync: async () => 0.5 },
  "expo-notifications": {
    addNotificationReceivedListener: (fn: () => void) => { pushListeners.push(fn); return { remove: () => {} }; },
    setNotificationChannelAsync: async (id: string, channel: any) => { notices.channels.push([id, channel]); return null; },
    scheduleNotificationAsync: async (req: any) => { notices.scheduled.set(req.identifier, req); return req.identifier; },
    cancelScheduledNotificationAsync: async (id: string) => { notices.cancels++; notices.scheduled.delete(id); },
    SchedulableTriggerInputTypes: { DATE: "date" },
    AndroidImportance: { DEFAULT: 5 },
  },
  "@react-native-async-storage/async-storage": {
    __esModule: true,
    default: {
      getItem: async (k: string) => storage.get(k) ?? null,
      setItem: async (k: string, v: string) => { storage.set(k, v); },
      removeItem: async (k: string) => { storage.delete(k); },
    },
  },
  "react-native": {
    AppState: {
      get currentState() { return appState.currentState; },
      addEventListener: (_event: string, fn: (state: string) => void) => { appState.listeners.push(fn); return { remove: () => {} }; },
    },
  },
};
const RELATIVE: Record<string, any> = {
  Api: {
    postJsonWithTimeout: async (_p: string, body: any) => { posts.push(body); return respond(body); },
    getJsonWithTimeout: async (p: string) => { gets.push(p); return policy(); },
  },
  SessionRenewal: { renewSessionIfNeeded: async () => {} },
};

// Cada caso carga el módulo de cero: el estado de la subida (sesión vencida,
// 403) es del módulo.
function load(file: string, cache: Map<string, any>): any {
  if (cache.has(file)) return cache.get(file).exports;
  const out = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} as any };
  cache.set(file, mod);
  const req = (spec: string) => {
    if (MOCKS[spec]) return MOCKS[spec];
    if (spec.startsWith("./")) {
      const name = spec.slice(2);
      if (RELATIVE[name]) return RELATIVE[name];
      return load(path.join(path.dirname(file), name + ".ts"), cache);
    }
    throw new Error("módulo sin simular: " + spec);
  };
  new Function("require", "module", "exports", out)(req, mod, mod.exports);
  return mod.exports;
}
const CONFIG = path.join(APP, "src", "Presentation", "config");
const fresh = () => load(path.join(CONFIG, "DriverLocation.ts"), new Map());
const { parseJsonBody } = load(path.join(CONFIG, "jsonBody.ts"), new Map());

const positions = (n: number) => Array.from({ length: n }, (_, i) => ({
  latitude: -34.6, longitude: -58.4, accuracy: 10, speed: null, heading: null, battery_level: 0.5,
  recorded_at: new Date(Date.UTC(2026, 9, 31, 12, 0, i)).toISOString(), source: "background",
}));
const buffer = (): any[] => JSON.parse(storage.get(BUFFER_KEY) ?? "[]");
const reset = (n: number) => {
  storage.clear();
  storage.set(BUFFER_KEY, JSON.stringify(positions(n)));
  posts = []; native.stops = 0; native.started = true;
};
const HTML = "<!DOCTYPE html><html><head><title>Sign in ・ Cloudflare Access</title></head><body>...</body></html>";

let failed = 0;
const check = async (name: string, fn: () => unknown) => {
  try { await fn(); console.log(`ok   ${name}`); }
  catch (e: any) { failed++; console.log(`FALLA ${name} → ${String(e?.message ?? e).split("\n")[0]}`); }
};

(async () => {
  await check("1200 posiciones y un HTML con 200 (proxy): quedan las 1200, marcadas «buffer»", async () => {
    const gps = fresh();
    reset(1200);
    respond = () => parseJsonBody(HTML, 200);
    const r = await gps.flushDriverPositions();
    assert.equal(buffer().length, 1200, "no se borra nada");
    assert.ok(buffer().every((p: any) => p.source === "buffer"), "se marcan como subidas con demora");
    assert.equal(posts.length, 1, "un solo intento por ciclo, no los 3 lotes");
    assert.deepEqual([r.sent, r.pending, r.stopped], [0, 1200, undefined]);
  });

  await check("HTML con 403 (un WAF): quedan todas y el seguimiento sigue", async () => {
    const gps = fresh();
    reset(1200);
    respond = () => parseJsonBody(HTML, 403);
    await gps.flushDriverPositions();
    assert.equal(buffer().length, 1200);
    assert.equal(native.stops, 0, "no se llama stopLocationUpdatesAsync");
  });

  await check("403 de Lynx (sin ficha de chofer): apaga sin borrar y avisa a la pantalla", async () => {
    const gps = fresh();
    reset(1200);
    const seen: any[] = [];
    gps.onTrackingChange((s: any) => seen.push(s));
    respond = () => parseJsonBody(JSON.stringify({ ok: false, error: "El usuario no tiene ficha de chofer activa" }), 403);
    const r = await gps.flushDriverPositions();
    assert.equal(native.stops, 1, "se detiene el seguimiento");
    assert.equal(buffer().length, 1200, "el buffer queda");
    assert.equal(r.stopped, true);
    assert.deepEqual(seen.map((s) => [s.mode, s.error]), [["off", "forbidden"]]);
    await gps.flushDriverPositions();
    assert.equal(posts.length, 1, "no vuelve a intentar hasta el próximo inicio");
    await gps.flushDriverPositions({ available: false });
    assert.equal(posts.length, 2, "el aviso de disponibilidad (cerrar sesión) sale igual");
    assert.deepEqual(posts[1].tracking && [posts[1].tracking.mode, posts[1].tracking.error], ["off", "forbidden"], "y lleva el diagnóstico");
  });

  await check("sin suscripción, el 403 no rompe la subida", async () => {
    const gps = fresh();
    reset(3);
    const off = gps.onTrackingChange(() => { throw new Error("no debería llamarse"); });
    off();
    respond = () => parseJsonBody(JSON.stringify({ ok: false, error: "x" }), 403);
    const r = await gps.flushDriverPositions();
    assert.equal(r.stopped, true);
  });

  await check("422 de Lynx (lote inválido): se descarta como antes, lote por lote", async () => {
    const gps = fresh();
    reset(1200);
    respond = () => parseJsonBody(JSON.stringify({ ok: false, error: "positions inválido" }), 422);
    const r = await gps.flushDriverPositions();
    assert.equal(buffer().length, 0);
    assert.equal(posts.length, 3);
    assert.equal(native.stops, 0);
    assert.deepEqual([r.sent, r.pending], [0, 0]);
  });

  await check("200 de Lynx: sube todo en lotes de 500, como antes", async () => {
    const gps = fresh();
    reset(1200);
    respond = (body) => parseJsonBody(JSON.stringify({ ok: true, accepted: body.positions.length, duplicated: 0 }), 200);
    const r = await gps.flushDriverPositions({ available: true });
    assert.deepEqual(posts.map((b) => b.positions.length), [500, 500, 200]);
    assert.deepEqual(posts.map((b) => b.available), [true, undefined, undefined], "available solo en el primero");
    assert.deepEqual([r.sent, r.pending, buffer().length], [1200, 0, 0]);
  });

  await check("502 JSON: se conserva y se marca «buffer», como antes", async () => {
    const gps = fresh();
    reset(10);
    respond = () => parseJsonBody(JSON.stringify({ ok: false, error: "Bad Gateway" }), 502);
    await gps.flushDriverPositions();
    assert.equal(buffer().length, 10);
    assert.ok(buffer().every((p: any) => p.source === "buffer"));
  });

  /* ===== Franja horaria: el servidor dice cuándo va el GPS ===== */

  // Un módulo nuevo con solo SUS escuchas (AppState, push) y sin intervalos.
  const nuevo = () => {
    appState.listeners.length = 0;
    pushListeners.length = 0;
    intervals.clear();
    storage.clear();
    posts = []; gets = [];
    native.stops = 0; native.starts = 0; native.started = false; native.permissionChecks = 0;
    appState.currentState = "active";
    respond = (body) => parseJsonBody(JSON.stringify({ ok: true, accepted: body.positions?.length ?? 0, duplicated: 0 }), 200);
    return fresh();
  };
  const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };
  const fuera = (reanuda = "07:00") => parseJsonBody(JSON.stringify({ ok: true, tracking: { activo: false, motivo: "fuera_de_franja", reanuda_a: reanuda } }), 200);
  const enFranja = () => parseJsonBody(JSON.stringify({ ok: true, tracking: { activo: true, motivo: "en_franja", hasta: "22:00" } }), 200);
  const POLICY = "/v2/driver-locations/me/policy";
  const correrIntervalos = () => [...intervals.values()].forEach((t) => t.fn());
  const last = (list: any[]) => list[list.length - 1];

  await check("el POST fuera de horario apaga el seguimiento, sin latidos, y avisa hasta qué hora", async () => {
    const gps = nuevo();
    const seen: any[] = [];
    gps.onTrackingChange((s: any) => seen.push(s));
    policy = enFranja;
    assert.equal((await gps.startDriverTracking({ available: true })).mode, "background");
    assert.equal(native.starts, 1);
    await settle();

    storage.set(BUFFER_KEY, JSON.stringify(positions(3)));
    respond = () => parseJsonBody(JSON.stringify({ ok: true, accepted: 0, duplicated: 3, tracking: { activo: false, motivo: "fuera_de_franja", reanuda_a: "07:00" } }), 200);
    const r = await gps.flushDriverPositions();
    assert.equal(native.stops, 1, "stopLocationUpdatesAsync");
    assert.equal(native.started, false);
    assert.equal(buffer().length, 0, "el servidor ya las contó: salen del buffer y no se reintentan");
    assert.equal(r.sent, 3);
    assert.deepEqual([last(seen).mode, last(seen).error, last(seen).resumeAt], ["off", "schedule", "07:00"]);

    // Pasan los 5 minutos del latido: no sale nada (el sondeo de la pausa solo pregunta).
    posts = [];
    policy = () => fuera("07:00");
    correrIntervalos();
    await settle();
    assert.equal(posts.length, 0, "ningún latido ni posición");
    assert.equal(native.starts, 1, "sigue apagado");
  });

  await check("fuera de horario no arranca ni pide permisos; al volver a primer plano en horario, arranca", async () => {
    const gps = nuevo();
    const seen: any[] = [];
    gps.onTrackingChange((s: any) => seen.push(s));
    policy = () => fuera("07:00");
    const r = await gps.startDriverTracking({ available: true });
    assert.deepEqual(r, { ok: true, mode: "paused", resumeAt: "07:00" });
    assert.deepEqual([native.starts, native.permissionChecks, posts.length], [0, 0, 0]);
    assert.equal(last(seen).error, "schedule");

    policy = enFranja;
    appState.listeners.forEach((fn) => fn("active"));
    await settle();
    assert.equal(native.starts, 1, "startLocationUpdatesAsync");
    assert.equal(last(seen).mode, "background", "Inicio saca el aviso");
    assert.deepEqual(gets, [POLICY, POLICY]);
    assert.equal(last(posts).available, true, "vuelve como arrancó la pantalla");
  });

  await check("un push también pregunta; con la app en segundo plano no rearranca (Android no deja)", async () => {
    const gps = nuevo();
    policy = () => fuera("07:00");
    await gps.startDriverTracking({ available: true });
    policy = enFranja;
    appState.currentState = "background";
    pushListeners.forEach((fn) => fn());
    await settle();
    assert.equal(gets.length, 2, "preguntó");
    assert.equal(native.starts, 0, "pero no abre el servicio desde segundo plano");

    appState.currentState = "active";
    pushListeners.forEach((fn) => fn());
    await settle();
    assert.equal(native.starts, 1);
  });

  await check("en pausa con la app abierta, el sondeo de 5 min lo prende cuando empieza el horario", async () => {
    const gps = nuevo();
    policy = () => fuera("07:00");
    await gps.startDriverTracking({ available: true });
    assert.deepEqual([...intervals.values()].map((t) => t.ms), [5 * 60_000], "solo el sondeo, sin latido");
    correrIntervalos();
    await settle();
    assert.equal(native.starts, 0, "todavía fuera de horario");
    policy = enFranja;
    correrIntervalos();
    await settle();
    assert.equal(native.starts, 1);
    assert.equal(intervals.size, 1, "queda el latido; el sondeo se apagó");
  });

  await check("sin red al preguntar arranca como siempre; al cerrar sesión deja de preguntar", async () => {
    const gps = nuevo();
    policy = () => { throw new Error("sin red"); };
    assert.equal((await gps.startDriverTracking({ available: true })).mode, "background");
    assert.equal(native.starts, 1);

    policy = () => fuera("07:00");
    await gps.flushDriverPositions();
    await gps.stopDriverTracking({ available: false });
    gets = [];
    pushListeners.forEach((fn) => fn());
    appState.listeners.forEach((fn) => fn("active"));
    correrIntervalos();
    await settle();
    assert.deepEqual([gets.length, intervals.size], [0, 0]);
  });

  /* ===== Aviso «Empezó tu horario» ===== */

  const avisos = () => [...notices.scheduled.values()];
  const reiniciarAvisos = () => { notices.scheduled.clear(); notices.channels = []; notices.cancels = 0; };

  await check("en pausa programa «Empezó tu horario» para la próxima hora de inicio, en su canal", async () => {
    const gps = nuevo();
    reiniciarAvisos();
    policy = () => fuera("07:00");
    const antes = Date.now();
    await gps.startDriverTracking({ available: true });
    await settle();
    assert.equal(avisos().length, 1);
    const [aviso] = avisos();
    assert.equal(aviso.identifier, gps.RESUME_NOTICE_ID);
    assert.deepEqual([aviso.content.title, aviso.content.body], ["Empezó tu horario", "Abrí Lynx para compartir tu ubicación y recibir Turbos."]);
    assert.equal(aviso.content.data.type, "GPS_RESUME");
    assert.equal(aviso.trigger.type, "date");
    assert.equal(aviso.trigger.channelId, gps.RESUME_CHANNEL_ID);
    const at = aviso.trigger.date.getTime();
    assert.ok(at > antes && at <= antes + 24 * 3600_000, "dentro de las próximas 24 h");
    assert.equal(new Date(at - 3 * 3600_000).toISOString().slice(11, 16), "07:00", "a las 07:00 de Buenos Aires");
    assert.deepEqual(notices.channels.map(([id, c]) => [id, c.name]), [[gps.RESUME_CHANNEL_ID, "Horario del GPS"]]);
  });

  await check("una pausa nueva reemplaza el aviso (mismo identificador) y al volver el GPS se cancela", async () => {
    const gps = nuevo();
    reiniciarAvisos();
    policy = () => fuera("07:00");
    await gps.startDriverTracking({ available: true });
    policy = () => fuera("08:30"); // cambiaron la franja en el panel
    correrIntervalos();
    await settle();
    assert.equal(avisos().length, 1, "uno solo");
    assert.equal(new Date(avisos()[0].trigger.date.getTime() - 3 * 3600_000).toISOString().slice(11, 16), "08:30");

    policy = enFranja;
    appState.listeners.forEach((fn) => fn("active"));
    await settle();
    assert.equal(native.starts, 1);
    assert.equal(avisos().length, 0, "con el GPS prendido no hay aviso pendiente");
  });

  await check("al cerrar sesión se cancela, y una respuesta que llega después no lo vuelve a programar", async () => {
    const gps = nuevo();
    reiniciarAvisos();
    policy = () => fuera("07:00");
    await gps.startDriverTracking({ available: true });
    await settle();
    assert.equal(avisos().length, 1);
    storage.set(BUFFER_KEY, JSON.stringify(positions(2)));
    respond = () => parseJsonBody(JSON.stringify({ ok: true, accepted: 0, duplicated: 2, tracking: { activo: false, motivo: "fuera_de_franja", reanuda_a: "07:00" } }), 200);
    await gps.stopDriverTracking({ available: false });
    await settle();
    assert.equal(avisos().length, 0);
  });

  if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
  console.log("\nTodas las pruebas pasaron");
})();
