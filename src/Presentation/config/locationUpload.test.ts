// Pruebas de locationUpload.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/location-upload --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/config/jsonBody.ts src/Presentation/config/locationUpload.ts src/Presentation/config/locationUpload.test.ts
//   node /tmp/location-upload/locationUpload.test.js

import { parseJsonBody } from "./jsonBody";
import { classifyUpload, nextResumeDate, trackingPolicyOf } from "./locationUpload";

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

// Aviso «Empezó tu horario»: la próxima vez que en Buenos Aires son las HH:MM.
const iso = (d: Date | null) => (d ? d.toISOString() : null);
eq("aviso: a las 22:30 del 31-oct, reanuda 07:00 → 1-nov 07:00 de acá (10:00 UTC)", iso(nextResumeDate("07:00", new Date("2026-10-31T22:30:00-03:00"))), "2026-11-01T10:00:00.000Z");
eq("aviso: a las 05:00, el mismo día a las 07:00", iso(nextResumeDate("07:00", new Date("2026-11-01T05:00:00-03:00"))), "2026-11-01T10:00:00.000Z");
eq("aviso: a las 22:30 acá ya es otro día en UTC y no se saltea ninguno", iso(nextResumeDate("07:00", new Date("2026-11-01T01:30:00Z"))), "2026-11-01T10:00:00.000Z");
eq("aviso: justo a la hora, mañana", iso(nextResumeDate("07:00", new Date("2026-11-01T07:00:00-03:00"))), "2026-11-02T10:00:00.000Z");
eq("aviso: franja de noche (reanuda 22:00) a las 06:00", iso(nextResumeDate("22:00", new Date("2026-11-01T06:00:00-03:00"))), "2026-11-02T01:00:00.000Z");
eq("aviso: sin hora o rara, nada", [nextResumeDate(null), nextResumeDate("7:00"), nextResumeDate("25:00")], [null, null, null]);

if (failed) { console.log(`\n${failed} prueba(s) fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
