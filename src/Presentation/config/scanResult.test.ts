// Pruebas de scanResult.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/scan-result --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/config/scanResult.test.ts
//   node /tmp/scan-result/scanResult.test.js

import { scanSignal } from "./scanResult";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

eq("correcto: bip de éxito y vibración corta", scanSignal("success"), { sound: "success", vibration: [0, 80, 60, 120] });
eq("duplicado: sin sonido (ni de error) y vibración suave", scanSignal("duplicate"), { sound: null, vibration: [0, 60, 80, 60] });
eq("error: bip de error y vibración larga", scanSignal("error"), { sound: "error", vibration: [0, 250, 100, 250] });
eq("correcto con avisos: mismo bip, otra vibración", scanSignal("success", true), { sound: "success", vibration: [0, 120, 80, 120] });
eq("los avisos no cambian un duplicado ni un error", [scanSignal("duplicate", true), scanSignal("error", true)], [scanSignal("duplicate"), scanSignal("error")]);

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
