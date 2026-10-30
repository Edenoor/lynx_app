// Pruebas de jsonBody.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/jsonbody --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/config/jsonBody.ts src/Presentation/config/jsonBody.test.ts
//   node /tmp/jsonbody/jsonBody.test.js

import { parseJsonBody } from "./jsonBody";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

// La página de login de Cloudflare Access, tal como llega después de seguir el 302.
const ACCESS = `<!DOCTYPE html><html><head><title>Sign in ・ Cloudflare Access</title></head><body>...</body></html>`;

eq("JSON 200 sin ok: ok por el código y conserva los datos", parseJsonBody(`{"turbo_active":true}`, 200), { turbo_active: true, ok: true, status: 200 });
eq("JSON 200 con ok:false del servidor: manda el servidor", parseJsonBody(`{"ok":false,"error":"rechazado"}`, 200), { ok: false, error: "rechazado", status: 200 });
eq("JSON 409: el error y el código del servidor", parseJsonBody(`{"ok":false,"error":"ya lo tomó otro chofer","code":"TAKEN"}`, 409), { ok: false, error: "ya lo tomó otro chofer", code: "TAKEN", status: 409 });
const access = parseJsonBody(ACCESS, 200);
eq("HTML con 200 (login de Access): NO es éxito", access.ok, false);
eq("HTML con 200: se marca y trae un mensaje para mostrar", [access.invalidResponse, access.status, access.error, access.message], [true, 200, "Respuesta inesperada del servidor (200)", "Respuesta inesperada del servidor (200)"]);
eq("HTML con 502: tampoco", parseJsonBody("<html>Bad Gateway</html>", 502).ok, false);
eq("texto suelto con 200: tampoco", parseJsonBody("OK", 200).ok, false);
eq("cuerpo vacío 204: vale el código", parseJsonBody("", 204), { ok: true, status: 204 });
eq("cuerpo vacío 200 (o solo espacios): vale el código", parseJsonBody("  \n", 200), { ok: true, status: 200 });
eq("cuerpo vacío 500: no", parseJsonBody(null, 500), { ok: false, status: 500 });
const lista = parseJsonBody(`[1,2]`, 200);
eq("una lista JSON sigue siendo lista, con ok y status", [Array.isArray(lista), lista.length, lista.ok, lista.status], [true, 2, true, 200]);
eq("JSON null: vale el código", parseJsonBody("null", 200), { ok: true, status: 200 });
eq("status de texto del servidor: se reemplaza por el HTTP (como antes)", parseJsonBody(`{"status":"ASSIGNED"}`, 200).status, 200);

if (failed) { console.log(`\n${failed} prueba(s) fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
