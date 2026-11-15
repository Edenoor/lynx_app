// Pruebas de stopSearch.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/stop-search --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/routes/stopSearch.test.ts
//   node /tmp/stop-search/stopSearch.test.js

import { normalizeSearch, searchStops } from "./stopSearch";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`}`);
};

const d = (delivery_id: number, tracking: string | number | null, nombre_destinatario: string | null, direccion: string | null = null) => ({ delivery_id, tracking, nombre_destinatario, direccion });
const STOPS = [
  { id: 1, address: "Av. Córdoba 1200", receiver_name: "José Núñez", deliveries: [d(11, "46123456789", "José Núñez")] },
  { id: 2, address: "Mitre 10", receiver_name: null, deliveries: [d(21, "4600000001", "Ana Pérez"), d(22, "4600000002", "Luis Gómez"), d(23, 9988, "Marta Díaz")] },
  { id: 3, address: null, receiver_name: null, deliveries: [d(31, null, "Sin Tracking", "Paso 5, depto B")] },
];
const ids = (m: Map<number, number[]> | null) => (m ? [...m.entries()] : null);

eq("normaliza mayúsculas, acentos y espacios", normalizeSearch("  JOSÉ   Núñez "), "jose nunez");
eq("sin texto (o solo espacios): no hay búsqueda", [searchStops(STOPS, ""), searchStops(STOPS, "   ")], [null, null]);
eq("por destinatario, sin acentos ni mayúsculas", ids(searchStops(STOPS, "luis gomez")), [[2, [22]]]);
eq("por tracking parcial", ids(searchStops(STOPS, "0002")), [[2, [22]]]);
eq("por tracking con espacios: también por dígitos", ids(searchStops(STOPS, "4612 3456")), [[1, [11]]]);
eq("por dirección de la parada: la parada entera, sin envío destacado", ids(searchStops(STOPS, "cordoba 12")), [[1, []]]);
eq("por dirección del envío", ids(searchStops(STOPS, "depto b")), [[3, [31]]]);
eq("sin tracking: busca por el número del envío", ids(searchStops(STOPS, "31")), [[3, [31]]]);
eq("tracking numérico (no texto)", ids(searchStops(STOPS, "9988")), [[2, [23]]]);
eq("varias paradas: en su orden original", ids(searchStops(STOPS, "46")), [[1, [11]], [2, [21, 22]]]);
eq("en una parada con tres envíos, solo el que coincide se destaca", ids(searchStops(STOPS, "marta")), [[2, [23]]]);
eq("sin coincidencias: vacío (no null)", ids(searchStops(STOPS, "zzz")), []);
eq("texto con letras no busca por dígitos sueltos", ids(searchStops(STOPS, "a1")), []);

if (failed) { console.log(`\n${failed} prueba(s) fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
