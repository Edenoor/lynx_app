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
  scanLabel,
  SESSION_ERRORS_KEPT,
  SESSION_EXPIRED,
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

// 2) Lo que el modo necesita antes de pedir nada.
eq("vacío → no reconocida", short(payloadProblem("asignarme", parseScanPayload("   "))!), "error: No reconocemos esta etiqueta");
eq("colecta sin sender_id → pide el QR de ML", payloadProblem("colecta", parseScanPayload("47741557287"))?.detail, "Para ingresar un envío, escaneá el QR de Mercado Libre.");
eq("asignarme con tracking pelado → sigue", payloadProblem("asignarme", parseScanPayload("47741557287")), null);
eq("colecta con QR de ML → sigue", payloadProblem("colecta", parseScanPayload(ML_QR)), null);
eq("planta con estantería → sigue", payloadProblem("planta", parseScanPayload("LYNX:SHELF:3f2c1a9e-8b7d-4c6e-9f10-2a3b4c5d6e7f")), null);

// 3) Nombre del bulto en pantalla: tracking o genérico, nunca el contenido crudo.
eq("etiqueta: tracking", scanLabel(parseScanPayload(ML_QR)), "47000000101");
eq("etiqueta: estantería", scanLabel(parseScanPayload("LYNX:SHELF:3f2c1a9e-8b7d-4c6e-9f10-2a3b4c5d6e7f")), "Estantería");
eq("etiqueta: texto raro", scanLabel(parseScanPayload("https://ejemplo.test/x?token=secreto")), "Etiqueta sin tracking");

// 4) Asignarme (self-assign → claimByScan).
eq("asignado", assignFeedback({ ok: true, status: 200, result: "claimed", delivery_id: 24385, route: { id: 9 } }, "47000000101"), { tone: "success", title: "Envío asignado", detail: "47000000101" });
eq("ya era suyo, ahora retirado", short(assignFeedback({ ok: true, result: "loaded" }, "1")), "success: Envío retirado");
eq("lectura repetida del servidor (already) es éxito, no error", short(assignFeedback({ ok: true, result: "already" }, "1")), "success: Ya lo tenías cargado");
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
eq("asignarme sin respuesta", [noResponseFeedback("asignarme").tone, noResponseFeedback("asignarme").detail], ["warning", "No sabemos si quedó asignado. Revisalo antes de volver a escanearlo."]);
eq("colecta sin respuesta", noResponseFeedback("colecta").detail, "No sabemos si quedó ingresado. Revisalo antes de volver a escanearlo.");

// 8) Planta: la vista del Picker → verde / ámbar / rojo, sin el contenido leído.
eq("planta recibido", plantaFeedback({ tone: "success", title: "Ingresó a planta", shelf: "NORTE-1", lines: ["T-A · Tienda", "Ana · CP 1000", ""], warnings: [] }, null),
  { tone: "success", title: "Ingresó a planta", detail: "T-A · Tienda", shelf: "NORTE-1", warned: false });
eq("planta con avisos", plantaFeedback({ tone: "success", title: "Ya estaba en planta", shelf: "N-1", lines: ["T"], warnings: ["Está en N-1; le corresponde N-2."] }, null).warned, true);
eq("planta cerrado → ámbar", plantaFeedback({ tone: "neutral", title: "Envío cerrado: no vuelve a planta", shelf: null, lines: [], warnings: [] }, null).tone, "warning");
eq("planta error → rojo", plantaFeedback({ tone: "danger", title: "El envío no está en Lynx", shelf: null, lines: ["x"], warnings: [] }, 404).tone, "error");
eq("planta 401 → sesión vencida", plantaFeedback({ tone: "danger", title: "Tu sesión expiró", shelf: null, lines: [], warnings: [] }, 401), SESSION_EXPIRED);

// 9) Resumen de la sesión: contador de éxitos y errores, los más nuevos primero.
{
  let s = EMPTY_SESSION;
  s = recordScan(s, { tone: "success", title: "Envío asignado", detail: null }, "1001");
  s = recordScan(s, { tone: "success", title: "Envío asignado", detail: null }, "1002");
  s = recordScan(s, { tone: "error", title: "No se pudo asignar", detail: "Entregado" }, "1003");
  s = recordScan(s, { tone: "warning", title: "Sin respuesta del servidor", detail: null }, "1004");
  eq("dos éxitos, dos problemas", [s.ok, s.failed], [2, 2]);
  eq("errores del más nuevo al más viejo", s.errors.map((e) => e.code), ["1004", "1003"]);
  eq("texto del resumen", sessionSummary(s), "2 escaneados · 2 con error");
  eq("singular", sessionSummary(recordScan(EMPTY_SESSION, { tone: "success", title: "", detail: null }, "1")), "1 escaneado");
  eq("la sesión vacía no cambia", EMPTY_SESSION, { ok: 0, failed: 0, errors: [] });
  for (let i = 0; i < 30; i++) s = recordScan(s, { tone: "error", title: "x", detail: null }, String(i));
  eq(`guarda los últimos ${SESSION_ERRORS_KEPT} errores`, [s.errors.length, s.errors[0].code, s.failed], [SESSION_ERRORS_KEPT, "29", 32]);
}

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
