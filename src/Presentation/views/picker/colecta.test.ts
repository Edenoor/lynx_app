// Pruebas de colecta.ts (recepción por colecta del Picker). El repo no tiene
// Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/colecta --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/picker/colecta.test.ts
//   node /tmp/colecta/colecta.test.js

import {
  applyAttribution,
  attributionNotice,
  colectaReception,
  colectaTotals,
  dayLabel,
  findColecta,
  progressText,
  searchColectas,
  stopReceptionLabel,
} from "./colecta";
import type { Colecta, ColectaStop } from "./warehouseApi";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

const stop = (id: number, name: string | null, declarado: number | null, recibido = 0, reception_status = "PENDIENTE"): ColectaStop =>
  ({ route_stop_id: id, store_id: id * 10, store_name: name, declarado, recibido, reception_status });
const mananero: Colecta = {
  route_id: 586, status: "IN_PROGRESS", qr_token: null, name: "MAÑANERO 02",
  stops: [stop(1, "Insuoffice", 47, 10), stop(2, "Dress My Cell", 48, 48), stop(3, "Fix Salud", 102)],
};

// Totales: suma lo declarado y lo atribuido del servidor; sin declarar se cuenta aparte.
eq("totales del ejemplo: 197 declarados, 58 atribuidos", colectaTotals(mananero), { stores: 3, declared: 197, undeclared: 0, attributed: 58 });
eq("una tienda sin declarar no suma ni inventa cero", colectaTotals({ ...mananero, stops: [stop(1, "A", 5, 1), stop(2, "B", null, 3)] }), { stores: 2, declared: 5, undeclared: 1, attributed: 4 });

// Estado de recepción, solo por el estado de cada parada.
eq("todas pendientes: abierta", colectaReception(mananero), { kind: "open", label: "Recepción abierta" });
eq("una cerrada de tres: parcial", colectaReception({ ...mananero, stops: [stop(1, "A", 1, 1, "CORRECTA"), stop(2, "B", 1), stop(3, "C", 1)] }).label, "Recepción cerrada en 1 de 3 tiendas");
eq("todas cerradas correctas: cerrada", colectaReception({ ...mananero, stops: [stop(1, "A", 1, 1, "CORRECTA")] }), { kind: "closed", label: "Recepción cerrada" });
eq("cerrada con alguna diferencia: lo dice", colectaReception({ ...mananero, stops: [stop(1, "A", 1, 1, "CORRECTA"), stop(2, "B", 2, 1, "DIFERENCIA")] }).label, "Recepción cerrada con diferencias");
eq("estado de parada desconocido: se muestra tal cual", stopReceptionLabel("OTRO"), "OTRO");

// Búsqueda local por colecta o tienda, sin mayúsculas ni acentos.
const otra: Colecta = { route_id: 590, status: "PLANNED", qr_token: null, name: "Tarde Sur", stops: [stop(9, "Ropa Linda", 3)] };
const names = (l: Colecta[]) => l.map((c) => c.name);
eq("buscar por nombre de colecta (sin acento)", names(searchColectas([mananero, otra], "mananero")), ["MAÑANERO 02"]);
eq("buscar por tienda", names(searchColectas([mananero, otra], "ropa")), ["Tarde Sur"]);
eq("búsqueda vacía: todas, en el orden del servidor", names(searchColectas([mananero, otra], "  ")), ["MAÑANERO 02", "Tarde Sur"]);
eq("sin coincidencias: ninguna", names(searchColectas([mananero, otra], "zzz")), []);
eq("encontrar la elegida por id", findColecta([mananero, otra], 590)?.name, "Tarde Sur");
eq("la elegida ya no está: null", findColecta([mananero], 999), null);
eq("fecha sin pasar por Date", dayLabel("2026-11-18"), "18/11/2026");
eq("avance sin declarado: lo dice", progressText(3, null), "3 atribuidos (sin declarar)");

// La respuesta de cada escaneo actualiza la parada con los números del servidor.
const attributed = applyAttribution(mananero, { status: "ATRIBUIDO", route_id: 586, route_stop_id: 3, store_name: "Fix Salud", declarado: 102, recibido: 1, reception_status: "PENDIENTE" });
eq("ATRIBUIDO: la parada toma el recibido del servidor", attributed.stops.map((s) => s.recibido), [10, 48, 1]);
eq("YA_CONTADO: también trae la foto de la parada", applyAttribution(mananero, { status: "YA_CONTADO", route_id: 586, route_stop_id: 1, recibido: 10 }).stops[0].recibido, 10);
eq("RECHAZADO no cambia contadores", applyAttribution(mananero, { status: "RECHAZADO", reason: "OTRA_TIENDA", route_id: 586, route_stop_id: null }), mananero);
eq("ERROR no cambia contadores", applyAttribution(mananero, { status: "ERROR", route_id: 586 }), mananero);
eq("sin atribución (servidor viejo) no cambia nada", applyAttribution(mananero, undefined), mananero);
eq("de otra colecta: no se aplica", applyAttribution(mananero, { status: "ATRIBUIDO", route_id: 999, route_stop_id: 1, recibido: 99 }), mananero);
eq("cierre informado por el servidor: la parada queda cerrada", applyAttribution(mananero, { status: "YA_CONTADO", route_id: 586, route_stop_id: 2, recibido: 48, reception_status: "CORRECTA" }).stops[1].reception_status, "CORRECTA");

// Qué agrega a la tarjeta: línea si se sumó, aviso si no.
eq("ATRIBUIDO: línea con la tienda y el avance", attributionNotice({ status: "ATRIBUIDO", store_name: "Fix Salud", declarado: 102, recibido: 1 }), { line: "Atribuido a Fix Salud: 1 de 102", warning: null });
eq("YA_CONTADO: línea, sin aviso", attributionNotice({ status: "YA_CONTADO", store_name: "Insuoffice", declarado: 47, recibido: 10 }), { line: "Ya estaba atribuido a Insuoffice (10 de 47)", warning: null });
eq("RECHAZADO otra tienda: aviso con el motivo del servidor", attributionNotice({ status: "RECHAZADO", reason: "OTRA_TIENDA", text: "no es de ninguna tienda de esta colecta" }), { line: null, warning: "No se sumó a la colecta: no es de ninguna tienda de esta colecta." });
eq("RECHAZADO cerrada: aviso", attributionNotice({ status: "RECHAZADO", reason: "RECEPCION_CERRADA", text: "la recepción de esa parada ya está cerrada" }).warning, "No se sumó a la colecta: la recepción de esa parada ya está cerrada.");
eq("ERROR: aviso (la recepción quedó hecha)", attributionNotice({ status: "ERROR", text: "no se pudo registrar a qué colecta pertenece: la recepción quedó hecha" }).warning, "No se sumó a la colecta: no se pudo registrar a qué colecta pertenece: la recepción quedó hecha.");
eq("sin campo colecta: no se da por atribuido", attributionNotice(null), { line: null, warning: "El servidor no confirmó la atribución: no se sumó a la colecta." });
eq("estado desconocido: no se da por atribuido", attributionNotice({ status: "OTRO" as any }).line, null);

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
