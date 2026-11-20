// Pruebas de assignedWarehouse.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/assigned-wh --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/picker/assignedWarehouse.test.ts
//   node /tmp/assigned-wh/assignedWarehouse.test.js

import { assignedWarehouseProblem } from "./assignedWarehouse";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

eq("servidor viejo: sin aviso", assignedWarehouseProblem(undefined), null);
eq("sin depósito", assignedWarehouseProblem(null), "No tenés un depósito asignado: pedíselo a quien da accesos.");
eq("depósito inactivo", assignedWarehouseProblem({ id: 3, name: "Planta Sur", active: false }), "Tu depósito asignado (Planta Sur) está inactivo: pedí que te asignen otro.");
eq("con depósito activo", assignedWarehouseProblem({ id: 3, name: "Planta Sur", active: true }), null);

if (failed) { console.log(`\n${failed} fallaron`); process.exit(1); }
console.log("\ntodo ok");
