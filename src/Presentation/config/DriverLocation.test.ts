// Pruebas de la subida del GPS (DriverLocation.ts): qué pasa con el buffer y
// con el seguimiento según lo que contesta el servidor. El repo no tiene Jest:
// se compila y se corre con node, desde la raíz del repo:
//   npx tsc --outDir /tmp/driver-location --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/config/DriverLocation.test.ts
//   node /tmp/driver-location/DriverLocation.test.js
// DriverLocation.ts se transpila al vuelo con el `typescript` del proyecto.
// expo-location, expo-task-manager, expo-battery, AsyncStorage (en memoria),
// AppState, Api.tsx y SessionRenewal están simulados: no hay red. Las
// respuestas se arman con el parseJsonBody real, como llegan de Api.tsx.

export {}; // módulo: sin esto, los nombres de acá chocan con los globales del DOM

const path = require("path");
const fs = require("fs");
const assert = require("assert/strict");

const APP = process.cwd();
const ts = require(path.join(APP, "node_modules", "typescript"));
(globalThis as any).__DEV__ = false;

const BUFFER_KEY = "driver_positions_buffer";
const storage = new Map<string, string>();
const native = { stops: 0, started: true };
let posts: any[] = [];
let respond: (body: any) => any = () => ({ ok: true, status: 200 });

const MOCKS: Record<string, any> = {
  "expo-location": {
    hasStartedLocationUpdatesAsync: async () => native.started,
    stopLocationUpdatesAsync: async () => { native.stops++; native.started = false; },
    Accuracy: { High: 4, Balanced: 3 },
    ActivityType: { AutomotiveNavigation: 2 },
  },
  "expo-task-manager": { defineTask: () => {} },
  "expo-battery": { getBatteryLevelAsync: async () => 0.5 },
  "@react-native-async-storage/async-storage": {
    __esModule: true,
    default: {
      getItem: async (k: string) => storage.get(k) ?? null,
      setItem: async (k: string, v: string) => { storage.set(k, v); },
      removeItem: async (k: string) => { storage.delete(k); },
    },
  },
  "react-native": { AppState: { currentState: "background", addEventListener: () => ({ remove: () => {} }) } },
};
const RELATIVE: Record<string, any> = {
  Api: { postJsonWithTimeout: async (_p: string, body: any) => { posts.push(body); return respond(body); } },
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

  if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
  console.log("\nTodas las pruebas pasaron");
})();
