// Pruebas de pickerOutcome.ts: color de cada resultado de la recepción en
// planta (Picker y Planta del chofer). El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/picker-outcome --module commonjs --target es2020 --strict --skipLibCheck --jsx react-native \
//     src/Presentation/views/picker/pickerOutcome.test.ts
//   node /tmp/picker-outcome/pickerOutcome.test.js

import { presentOutcome } from "./pickerOutcome";
import type { ReceiveStatus, ScanOutcome } from "./pickerScan";
import type { ReceiveResult } from "./warehouseApi";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};
const WH = "Depósito Norte";
const short = (o: ScanOutcome) => { const v = presentOutcome(o, WH); return `${v.tone}: ${v.title}`; };

const result = (over: Partial<ReceiveResult> = {}): ReceiveResult => ({
  delivery: { id: 7, tracking: "4700", store: "Tienda", receiver: "Ana", direccion: null, postal_code: "1414", tipo_envio: null, is_turbo: false },
  shelf: { id: 3, code: "N-1", name: null, unclassified: false, suggested: "N-1" },
  ops: { from: "COLLECTED", to: "SHELVED", transitions: ["ARRIVED_WAREHOUSE", "SHELVED"], already_here: false },
  alerts: [],
  ...over,
} as ReceiveResult);
const received = (status: ReceiveStatus, r: ReceiveResult = result()): ScanOutcome => ({ kind: "received", status, result: r });

// Correcto.
eq("ingresó: verde", short(received("received")), "success: Ingresó a planta");
eq("movido a otra estantería: verde", short({ kind: "moved", tracking: "4700", from: "N-1", to: "N-2" }), "success: Movido a N-2");

// Duplicado: el servidor lo dice con un campo concreto.
{
  const v = presentOutcome(received("alreadyHere", result({ ops: { from: "SHELVED", to: "SHELVED", transitions: [], already_here: true } })), WH);
  eq("ya estaba en planta (already_here): amarillo, con su estantería", [v.tone, v.title, v.shelf], ["duplicate", "Ya estaba en planta", "N-1"]);
}
{
  const v = presentOutcome({ kind: "moved", tracking: "4700", from: "N-1", to: "N-1" }, WH);
  eq("misma estantería (from = destino): amarillo, no se movió", [v.tone, v.title, v.lines[0]], ["duplicate", "Ya estaba en N-1", "4700 ya estaba en esa estantería: no se movió."]);
}
eq("movido sin estantería anterior: verde", short({ kind: "moved", tracking: "4700", from: null, to: "N-1" }), "success: Movido a N-1");

// Error real, con el motivo.
eq("cerrado: rojo", short(received("closed")), "error: Envío cerrado: no vuelve a planta");
eq("en un recorrido: rojo", short(received("inRoute")), "error: Asignado a un recorrido: no se reestantea");
eq("sin cambios y sin motivo: rojo (no se inventa un duplicado)", short(received("unchanged")), "error: Sin cambios");
eq("estantería antes que el paquete: rojo", short({ kind: "sequence", message: "Escaneá primero el paquete y después la estantería." }), "error: Escaneá primero el paquete y después la estantería.");
{
  const v = presentOutcome({ kind: "unknown", message: "No sabemos si quedó registrado." }, WH);
  eq("sin respuesta: rojo, dice que no se sabe", [v.tone, v.title, v.lines], ["error", "Sin respuesta del servidor", ["No sabemos si quedó registrado."]]);
}
const err = (category: "identification" | "conflict" | "access" | "server", status: number, message: string, operation: "receive" | "move" = "receive"): ScanOutcome =>
  ({ kind: "error", category, message, status, raw: null, operation });
for (const [o, want] of [
  [err("identification", 400, "QR ilegible"), "error: No reconocemos esta etiqueta"],
  [err("identification", 404, "No existe"), "error: El envío no está en Lynx"],
  [err("conflict", 409, "El envío está bajo custodia de otro Warehouse"), "error: No se puede recibir este envío"],
  [err("conflict", 409, "El envío está bajo custodia de otro Warehouse", "move"), "error: No se puede mover a esa estantería"],
  [err("access", 403, "Sin permiso"), "error: Tu usuario no puede operar acá"],
  [err("server", 500, "boom"), "error: Error del servidor: no se pudo confirmar la recepción"],
] as const) eq(`respuesta ${o.kind === "error" ? `${o.status} ${o.operation}` : ""} → ${want}`, short(o), want);
eq("un 409 no es duplicado: muestra el motivo del servidor", presentOutcome(err("conflict", 409, "El envío está bajo custodia de otro Warehouse"), WH).lines, ["El envío está bajo custodia de otro Warehouse"]);

// Recepción por colecta: la atribución agrega una línea o un aviso; el color
// y el título son los de la recepción física, siempre.
{
  const colecta = (c: ReceiveResult["colecta"]) => result({ colecta: c });
  const same = (status: ReceiveStatus, r: ReceiveResult) => {
    const plain = presentOutcome(received(status, result()), WH);
    const v = presentOutcome(received(status, r), WH, true);
    return v.tone === plain.tone && v.title === plain.title;
  };
  const ok = colecta({ status: "ATRIBUIDO", route_id: 586, route_stop_id: 3, store_name: "Fix Salud", declarado: 102, recibido: 7 });
  eq("colecta ATRIBUIDO: mismo verde y título, más la línea", [same("received", ok), presentOutcome(received("received", ok), WH, true).lines.includes("Atribuido a Fix Salud: 7 de 102")], [true, true]);
  const dup = colecta({ status: "YA_CONTADO", route_id: 586, route_stop_id: 3, store_name: "Fix Salud", declarado: 102, recibido: 7 });
  eq("colecta YA_CONTADO con física duplicada: amarillo, sin aviso", [same("alreadyHere", dup), presentOutcome(received("alreadyHere", dup), WH, true).warnings], [true, []]);
  const other = colecta({ status: "RECHAZADO", reason: "OTRA_TIENDA", text: "no es de ninguna tienda de esta colecta", route_id: 586, route_stop_id: null });
  const vo = presentOutcome(received("received", other), WH, true);
  eq("colecta RECHAZADO: sigue verde (se recibió) con el aviso primero", [same("received", other), vo.warnings[0]], [true, "No se sumó a la colecta: no es de ninguna tienda de esta colecta."]);
  const fail = colecta({ status: "ERROR", text: "no se pudo registrar a qué colecta pertenece: la recepción quedó hecha", route_id: 586 });
  eq("colecta ERROR: sigue verde con aviso", [same("received", fail), presentOutcome(received("received", fail), WH, true).warnings.length], [true, 1]);
  eq("colecta elegida y el servidor no la informa: aviso, sin atribuir", presentOutcome(received("received", result()), WH, true).warnings, ["El servidor no confirmó la atribución: no se sumó a la colecta."]);
  eq("sin colecta elegida: se ignora el campo (tarjeta de siempre)", presentOutcome(received("received", ok), WH), presentOutcome(received("received", result()), WH));
  eq("404 de colecta inexistente: no es «el envío no está en Lynx»", short(err("identification", 404, "la colecta elegida no existe")), "error: La colecta elegida no existe: no se recibió");
  eq("400 colecta_route_id inválido: mismo título", short(err("identification", 400, "colecta_route_id inválido")), "error: La colecta elegida no existe: no se recibió");
}

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
