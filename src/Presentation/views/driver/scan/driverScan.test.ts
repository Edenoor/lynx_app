// Pruebas de driverScan.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/driver-scan --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/scan/driverScan.test.ts
//   node /tmp/driver-scan/driverScan.test.js

import {
  assignFeedback,
  collectFeedback,
  EMPTY_SESSION,
  NO_CONNECTION,
  noResponseFeedback,
  parseScanPayload,
  payloadProblem,
  plantaFeedback,
  recordScan,
  roleProblem,
  scanBody,
  scanLabel,
  SESSION_ERRORS_KEPT,
  SESSION_EXPIRED,
  sessionRepeat,
  sessionSummary,
} from "./driverScan";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};
const short = (f: { tone: string; title: string }) => `${f.tone}: ${f.title}`;

// 1) Parseo: los tres formatos de siempre.
const ML_QR = '{"id":"47000000101","sender_id":123456,"hash_code":"abc","security_digit":"0"}';
eq("JSON de Mercado Libre", [parseScanPayload(ML_QR).id, parseScanPayload(ML_QR).senderId], ["47000000101", "123456"]);
eq("tracking pelado (no entra por JSON)", [parseScanPayload("47741557287").id, parseScanPayload("47741557287").senderId], ["47741557287", ""]);
eq("query-string", [parseScanPayload("shipping_id=4770001&sender_id=99").id, parseScanPayload("shipping_id=4770001&sender_id=99").senderId], ["4770001", "99"]);
eq("JSON inválido se lee como texto", parseScanPayload("{roto 47000000001").id, "47000000001");
eq("espacios alrededor", parseScanPayload("  47741557287 \n").raw, "47741557287");

// 2) Antes de pedir nada solo se frena lo vacío: qué etiqueta es lo decide el
// servidor (el mismo resolvedor que el Picker).
const LD_QR = '{"local":"1","did":1600274,"cliente":812,"empresa":72}';
const LYNX = "LYNX:PKG:LP000012345";
eq("vacío → no reconocida", short(payloadProblem(parseScanPayload("   "))!), "error: No reconocemos esta etiqueta");
eq("ML, LightData (QR y tipeado), Lynx, tracking pelado, código desconocido: no se rechazan en la app",
  [ML_QR, LD_QR, "LD:1600274", LYNX, "47741557287", "CUALQUIER-COSA-123"].map((r) => payloadProblem(parseScanPayload(r))), [null, null, null, null, null, null]);

// 3) Lo que va al servidor: el QR completo, sin prefijos perdidos ni campos parseados.
eq("ML: el JSON entero", scanBody(parseScanPayload(ML_QR)), { qr: ML_QR });
eq("LightData: el JSON entero (antes se rechazaba por no traer id)", scanBody(parseScanPayload(LD_QR)), { qr: LD_QR });
eq("Lynx: con su prefijo (antes viajaba «000012345»)", scanBody(parseScanPayload(LYNX)), { qr: LYNX });
eq("LightData tipeado: tal cual", scanBody(parseScanPayload("LD:1600274")), { qr: "LD:1600274" });
eq("código desconocido: tal cual (el servidor responde UNKNOWN_FORMAT)", scanBody(parseScanPayload("CUALQUIER-COSA-123")), { qr: "CUALQUIER-COSA-123" });
eq("sin espacios alrededor, sin otros campos (ni driverId ni shippingId)", Object.keys(scanBody(parseScanPayload("  47741557287 \n"))), ["qr"]);

// 4) Nombre del bulto en pantalla: el código que reconoce el chofer, nunca el contenido crudo.
eq("etiqueta: tracking", scanLabel(parseScanPayload(ML_QR)), "47000000101");
eq("etiqueta: Lynx completa", scanLabel(parseScanPayload(LYNX)), "LP000012345");
eq("etiqueta: LightData por QR y tipeado", [scanLabel(parseScanPayload(LD_QR)), scanLabel(parseScanPayload("ld 1600274"))], ["LightData 1600274", "LightData 1600274"]);
eq("etiqueta: estantería", scanLabel(parseScanPayload("LYNX:SHELF:3f2c1a9e-8b7d-4c6e-9f10-2a3b4c5d6e7f")), "Estantería");
eq("etiqueta: texto raro", scanLabel(parseScanPayload("https://ejemplo.test/x?token=secreto")), "Etiqueta sin tracking");

// 4) Asignarme (self-assign → claimByScan).
eq("asignado", assignFeedback({ ok: true, status: 200, result: "claimed", delivery_id: 24385, route: { id: 9 } }, "47000000101"), { tone: "success", title: "Envío asignado", detail: "47000000101" });
eq("retomado del Baúl: el recorrido al que fue", assignFeedback({ ok: true, result: "resumed", delivery_id: 5, route: { id: 12 } }, "47000000101"), { tone: "success", title: "Entrega retomada", detail: "47000000101 · agregado a tu recorrido #12" });
eq("retomado sin recorrido en la respuesta: sin número inventado", assignFeedback({ ok: true, result: "resumed" }, "1").detail, "1");
eq("ya era suyo, ahora retirado", short(assignFeedback({ ok: true, result: "loaded" }, "1")), "success: Envío retirado");
eq("ya lo tenía retirado (already): duplicado amarillo, no error", assignFeedback({ ok: true, result: "already", route: { id: 9 } }, "4700"),
  { tone: "duplicate", title: "Este paquete ya fue escaneado", detail: "4700 · ya lo tenías cargado en tu recorrido #9" });
eq("already sin recorrido en la respuesta", assignFeedback({ ok: true, result: "already" }, "4700").detail, "4700 · ya lo tenías cargado");
// Los 409 de claimByScan son errores reales, con su motivo: ninguno es duplicado.
for (const [code, error] of [
  ["RESERVED", "Este paquete está asignado a otro chofer (recorrido #7). Si te lo tenés que llevar, pedíselo al coordinador."],
  ["CLOSED", "El envío está entregado: no sale a reparto"],
  ["NOT_IN_WAREHOUSE", "El envío todavía no está en un depósito (COLLECTED): primero lo tiene que recibir un picker"],
  ["HELD_BY_DRIVER", "Este paquete lo tiene otro chofer: tiene que pasar por el depósito antes de volver a salir"],
  ["RETRY", "El paquete cambió de recorrido mientras se escaneaba: escanealo de nuevo"],
]) {
  const f = assignFeedback({ ok: false, status: 409, code, error }, "1");
  eq(`409 ${code} → error con el motivo, no duplicado`, [f.tone, f.detail], ["error", error]);
}
{
  const f = assignFeedback({ ok: false, status: 409, error: "El envío está entregado: no sale a reparto", code: "CLOSED" }, "1");
  eq("409 → rojo con el texto del servidor", [f.tone, f.title, f.detail], ["error", "No se pudo asignar", "El envío está entregado: no sale a reparto"]);
}
{
  const f = assignFeedback({ ok: false, status: 500, error: "duplicate key value violates unique constraint" }, "1");
  eq("500 → texto genérico, sin el error interno", f.detail, "Error del servidor. Probá de nuevo en un momento.");
}
eq("respuesta no JSON → genérico", assignFeedback({ ok: false, status: 200, invalidResponse: true, error: "Respuesta inesperada del servidor (200)" }, "1").detail, "Error del servidor. Probá de nuevo en un momento.");
eq("403 → sin permiso", short(assignFeedback({ ok: false, status: 403, error: "El usuario no tiene ficha de chofer activa" }, "1")), "error: Tu usuario no puede hacer esto");
eq("401 → sesión vencida (bloquea)", assignFeedback({ ok: false, status: 401, sessionExpired: true }, "1"), SESSION_EXPIRED);

// 5) Colecta (POST /v2/deliveries/scan).
eq("ingresado", collectFeedback({ ok: true, status: 200, success: true }, "47000000101"), { tone: "success", title: "Envío ingresado", detail: "47000000101" });
eq("success:false con 200 → error", short(collectFeedback({ ok: true, status: 200, success: false, error: "No se encontró la cuenta" }, "1")), "error: No se pudo ingresar");
eq("400 con texto", collectFeedback({ ok: false, status: 400, success: false, error: "No se encontró la cuenta" }, "1").detail, "No se encontró la cuenta");
eq("401 → sesión vencida", collectFeedback({ ok: false, status: 401, sessionExpired: true }, "1").sessionExpired, true);

// 6) Rol del chofer.
eq("rol ok", roleProblem({ ok: true, rol: "DRIVER", data: { id: 49, active: true } }), null);
eq("rol no DRIVER, sin mostrar el rol", roleProblem({ ok: true, rol: "SELLER", data: { id: 3 } })?.title, "Tu usuario no está habilitado como chofer");
eq("chofer inactivo", roleProblem({ ok: true, rol: "DRIVER", data: { id: 49, active: false } })?.title, "Tu cuenta de chofer está inactiva");
eq("rol 401", roleProblem({ ok: false, status: 401, sessionExpired: true }), SESSION_EXPIRED);
eq("sin conexión antes de escribir: dice que no se envió nada", NO_CONNECTION.detail, "No se envió nada. Volvé a escanearlo.");

// 7) Sin respuesta después de enviar: no se sabe si se aplicó, no se reintenta.
eq("asignarme sin respuesta (error de comunicación: rojo)", [noResponseFeedback("asignarme").tone, noResponseFeedback("asignarme").detail], ["error", "No sabemos si quedó asignado. Revisalo antes de volver a escanearlo."]);
eq("colecta sin respuesta", noResponseFeedback("colecta").detail, "No sabemos si quedó ingresado. Revisalo antes de volver a escanearlo.");

// 8) Planta: la vista del Picker (ya en verde / amarillo / rojo), sin el contenido leído.
eq("planta recibido", plantaFeedback({ tone: "success", title: "Ingresó a planta", shelf: "NORTE-1", lines: ["T-A · Tienda", "Ana · CP 1000", ""], warnings: [] }, null),
  { tone: "success", title: "Ingresó a planta", detail: "T-A · Tienda", shelf: "NORTE-1", warned: false });
eq("planta con avisos", plantaFeedback({ tone: "success", title: "Ingresó a planta", shelf: "N-1", lines: ["T"], warnings: ["Está en N-1; le corresponde N-2."] }, null).warned, true);
eq("planta ya estaba → amarillo", plantaFeedback({ tone: "duplicate", title: "Ya estaba en planta", shelf: "N-1", lines: ["T"], warnings: [] }, null).tone, "duplicate");
eq("planta cerrado → rojo", plantaFeedback({ tone: "error", title: "Envío cerrado: no vuelve a planta", shelf: null, lines: [], warnings: [] }, null).tone, "error");
eq("planta error → rojo", plantaFeedback({ tone: "error", title: "El envío no está en Lynx", shelf: null, lines: ["x"], warnings: [] }, 404).tone, "error");
eq("planta 401 → sesión vencida", plantaFeedback({ tone: "error", title: "Tu sesión expiró", shelf: null, lines: [], warnings: [] }, 401), SESSION_EXPIRED);

// 9) Resumen de la sesión: contador de éxitos y errores, los más nuevos primero.
{
  let s = EMPTY_SESSION;
  s = recordScan(s, { tone: "success", title: "Envío asignado", detail: null }, "1001");
  s = recordScan(s, { tone: "success", title: "Envío asignado", detail: null }, "1002");
  s = recordScan(s, { tone: "error", title: "No se pudo asignar", detail: "Entregado" }, "1003");
  s = recordScan(s, { tone: "error", title: "Sin respuesta del servidor", detail: null }, "1004");
  const before = s;
  s = recordScan(s, { tone: "duplicate", title: "Este paquete ya fue escaneado", detail: null }, "1001");
  eq("un duplicado no suma ni como escaneado ni como error", s, before);
  eq("dos éxitos, dos problemas", [s.ok, s.failed], [2, 2]);
  eq("códigos que salieron bien", s.done, ["1001", "1002"]);
  eq("errores del más nuevo al más viejo", s.errors.map((e) => e.code), ["1004", "1003"]);
  eq("texto del resumen", sessionSummary(s), "2 escaneados · 2 con error");
  eq("singular", sessionSummary(recordScan(EMPTY_SESSION, { tone: "success", title: "", detail: null }, "1")), "1 escaneado");
  eq("la sesión vacía no cambia", EMPTY_SESSION, { ok: 0, failed: 0, errors: [], done: [] });
  for (let i = 0; i < 30; i++) s = recordScan(s, { tone: "error", title: "x", detail: null }, String(i));
  eq(`guarda los últimos ${SESSION_ERRORS_KEPT} errores`, [s.errors.length, s.errors[0].code, s.failed], [SESSION_ERRORS_KEPT, "29", 32]);
}

// 10) Colecta: el servidor responde igual si ya estaba; lo repetido en la sesión es duplicado.
{
  const ok = collectFeedback({ ok: true, status: 200, success: true }, "4700");
  let s = EMPTY_SESSION;
  eq("primera vez: éxito", sessionRepeat("colecta", ok, s, "4700"), ok);
  s = recordScan(s, sessionRepeat("colecta", ok, s, "4700"), "4700");
  const again = sessionRepeat("colecta", ok, s, "4700");
  eq("el mismo bulto otra vez: duplicado", again, { tone: "duplicate", title: "Este paquete ya fue escaneado", detail: "4700 · ya lo ingresaste en esta sesión" });
  s = recordScan(s, again, "4700");
  eq("y no suma", [s.ok, s.failed], [1, 0]);
  eq("otro bulto: éxito", sessionRepeat("colecta", ok, s, "4701").tone, "success");
  eq("un error no se convierte", sessionRepeat("colecta", { tone: "error", title: "x", detail: null }, s, "4700").tone, "error");
  eq("etiqueta sin tracking: no se puede saber, éxito", sessionRepeat("colecta", ok, { ...s, done: ["Etiqueta sin tracking"] }, "Etiqueta sin tracking").tone, "success");
  eq("Planta: dos estanterías seguidas no son duplicado", sessionRepeat("planta", ok, { ...s, done: ["Estantería"] }, "Estantería").tone, "success");
  eq("Asignarme: lo decide el servidor (already), no la sesión", sessionRepeat("asignarme", ok, s, "4700").tone, "success");
}

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
