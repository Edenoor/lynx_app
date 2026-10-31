// Pruebas de locationUpload.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/location-upload --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/config/jsonBody.ts src/Presentation/config/locationUpload.ts src/Presentation/config/locationUpload.test.ts
//   node /tmp/location-upload/locationUpload.test.js

import { parseJsonBody } from "./jsonBody";
import { classifyUpload, trackingPolicyOf } from "./locationUpload";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

// Lo que llega de verdad: el cuerpo pasa por parseJsonBody (Api.tsx).
const json = (body: unknown, status: number) => parseJsonBody(JSON.stringify(body), status);
const html = (status: number) => parseJsonBody("<!DOCTYPE html><html><body>Sign in</body></html>", status);

eq("JSON 200 del servidor: aceptado", classifyUpload(json({ ok: true, accepted: 3, duplicated: 0 }, 200)), "accepted");
eq("HTML con 200 (login de un proxy): se reintenta, no se borra", classifyUpload(html(200)), "retry");
eq("HTML con 403 (un WAF): se reintenta, no es Lynx", classifyUpload(html(403)), "retry");
eq("HTML con 404: tampoco es Lynx", classifyUpload(html(404)), "retry");
eq("HTML con 502: se reintenta", classifyUpload(html(502)), "retry");
eq("JSON 403 de Lynx (sin ficha de chofer): forbidden", classifyUpload(json({ ok: false, error: "El usuario no tiene ficha de chofer activa" }, 403)), "forbidden");
eq("JSON 422 (lote inválido): se descarta", classifyUpload(json({ ok: false, error: "positions inválido" }, 422)), "discard");
eq("JSON 400: se descarta", classifyUpload(json({ ok: false, error: "x" }, 400)), "discard");
eq("401 (sesión vencida, también con HTML)", [classifyUpload({ ok: false, status: 401, sessionExpired: true }), classifyUpload(html(401))], ["session", "session"]);
eq("500, 408 y 429: se reintenta", [500, 408, 429].map((s) => classifyUpload(json({ ok: false }, s))), ["retry", "retry", "retry"]);
eq("sin status ni respuesta: se reintenta", [classifyUpload({ ok: false }), classifyUpload(null)], ["retry", "retry"]);
eq("cuerpo vacío 204: aceptado (vale el código)", classifyUpload(parseJsonBody("", 204)), "accepted");

// Franja horaria del GPS.
const pausa = json({ ok: true, accepted: 0, duplicated: 3, tracking: { activo: false, motivo: "fuera_de_franja", reanuda_a: "07:00" } }, 200);
eq("fuera del horario: el lote cuenta como recibido", classifyUpload(pausa), "accepted");
eq("fuera del horario: apagar hasta las 07:00", trackingPolicyOf(pausa), { activo: false, reanudaA: "07:00" });
eq("consulta en horario: prendido", trackingPolicyOf(json({ ok: true, tracking: { activo: true, motivo: "en_franja", hasta: "22:00" } }, 200)), { activo: true, reanudaA: null });
eq("sin política (servidor viejo o en horario): null", [trackingPolicyOf(json({ ok: true, accepted: 3 }, 200)), trackingPolicyOf(null), trackingPolicyOf(html(200))], [null, null, null]);
eq("política rara: sin `activo` booleano no vale; hora rara se ignora", [trackingPolicyOf({ tracking: { activo: "no" } }), trackingPolicyOf({ tracking: { activo: false, reanuda_a: "7" } })], [null, { activo: false, reanudaA: null }]);

if (failed) { console.log(`\n${failed} prueba(s) fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
