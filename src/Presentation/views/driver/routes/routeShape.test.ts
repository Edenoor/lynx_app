// Pruebas de routeShape.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/route-shape --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/routes/routeShape.test.ts
//   node /tmp/route-shape/routeShape.test.js

import { decodePolyline, shapeLines } from "./routeShape";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

// Codificador de referencia (el mismo algoritmo, al revés) para armar casos.
function encode(points: [number, number][], precision = 6): string {
  const f = 10 ** precision;
  let out = "", pLat = 0, pLng = 0;
  const one = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let s = "";
    while (n >= 0x20) { s += String.fromCharCode((0x20 | (n & 0x1f)) + 63); n >>= 5; }
    return s + String.fromCharCode(n + 63);
  };
  for (const [lat, lng] of points) {
    const a = Math.round(lat * f), b = Math.round(lng * f);
    out += one(a - pLat) + one(b - pLng);
    pLat = a; pLng = b;
  }
  return out;
}

// El ejemplo clásico de Google (precisión 5) y uno de Buenos Aires con precisión 6.
eq("ejemplo de Google, precisión 5", decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@", 5),
  [{ latitude: 38.5, longitude: -120.2 }, { latitude: 40.7, longitude: -120.95 }, { latitude: 43.252, longitude: -126.453 }]);
const ba: [number, number][] = [[-34.603722, -58.381592], [-34.608, -58.3712], [-34.6137, -58.3816]];
eq("Buenos Aires, precisión 6 (la de Valhalla)", decodePolyline(encode(ba)), ba.map(([latitude, longitude]) => ({ latitude, longitude })));
eq("vacía", decodePolyline(""), []);

const tramo1 = encode([[-34.60, -58.40], [-34.605, -58.405]]);
const tramo2 = encode([[-34.605, -58.405], [-34.61, -58.41]]);
const shape = { stop_ids: [11, 12, 13], shapes: [tramo1, tramo2], precision: 6 };
eq("se dibuja si el orden coincide (una línea por tramo)", shapeLines(shape, [11, 12, 13])?.map((l) => l.length), [2, 2]);
eq("una parada que el mapa muestra sin ubicación en el servidor no impide dibujar", shapeLines(shape, [11, 14, 12, 13])?.length, 2);
eq("orden distinto (sin confirmar o cambiado) → no se dibuja", shapeLines(shape, [11, 13, 12]), null);
eq("una parada del trazado que no está en el mapa → no se dibuja", shapeLines(shape, [11, 12]), null);
eq("polyline rota → no se dibuja (quedan los marcadores)", shapeLines({ ...shape, shapes: ["_"] }, [11, 12, 13]), null);

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
