// Pruebas de routeStatus.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/route-status --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/routes/routeStatus.test.ts
//   node /tmp/route-status/routeStatus.test.js

import { routeStatusKey } from "./routeStatus";
import type { RouteStatus } from "./routesApi";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

const ALL: [RouteStatus, string][] = [
  ["PLANNED", "neutral"],
  ["ASSIGNED", "neutral"],
  ["LOADED", "neutral"],
  ["IN_PROGRESS", "inTransit"],
  ["COMPLETED", "delivered"],
  ["CANCELLED", "cancelled"],
];
for (const [status, want] of ALL) eq(`${status} → ${want}`, routeStatusKey(status), want);

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
