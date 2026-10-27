// Pruebas de stopDeclaration.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/decl --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/routes/stopDeclaration.ts src/Presentation/views/driver/routes/stopDeclaration.test.ts
//   node /tmp/decl/stopDeclaration.test.js

import { canDeclare, declarationLabel, declarationSummary, parseDeclaredCount, placeStatLabel, supportsDeclaration } from "./stopDeclaration";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

// Validación
eq("cero es válido", parseDeclaredCount("0"), { ok: true, count: 0 });
eq("positivo", parseDeclaredCount("14"), { ok: true, count: 14 });
eq("espacios alrededor", parseDeclaredCount(" 7 "), { ok: true, count: 7 });
eq("ceros a la izquierda", parseDeclaredCount("007"), { ok: true, count: 7 });
for (const bad of ["", "   ", "-1", "1.5", "1,5", "+3", "1e3", "12 3", "abc", "1234567"]) {
  eq(`rechaza «${bad}»`, parseDeclaredCount(bad).ok, false);
}

// Estados del recorrido
for (const s of ["IN_PROGRESS", "COMPLETED"]) eq(`declara en ${s}`, canDeclare(s), true);
for (const s of ["PLANNED", "ASSIGNED", "LOADED", "CANCELLED"]) eq(`no declara en ${s}`, canDeclare(s), false);

// Rótulos: null ≠ 0
eq("null → sin informar", declarationLabel(null), "Sin informar");
eq("undefined → sin informar", declarationLabel(undefined), "Sin informar");
eq("0 → informado", declarationLabel(0), "Informado: 0 paquetes");
eq("1 → singular", declarationLabel(1), "Informado: 1 paquete");
eq("14", declarationLabel(14), "Informado: 14 paquetes");

// Soporte del servidor
eq("retiro con campo", supportsDeclaration({ type: "PICKUP", declared_count: null }), true);
eq("servidor anterior (sin campo)", supportsDeclaration({ type: "PICKUP" }), false);
eq("entrega", supportsDeclaration({ type: "DELIVERY", declared_count: 3 }), false);

// Totales: solo declared_count, 0 cuenta como informada
eq("una tienda sin informar", declarationSummary([{ type: "PICKUP", store_id: 3, declared_count: null }]), { stops: 1, informed: 0, pending: 1, total: 0, allStores: true });
eq("una tienda con 0", declarationSummary([{ type: "PICKUP", store_id: 3, declared_count: 0 }]), { stops: 1, informed: 1, pending: 0, total: 0, allStores: true });
eq(
  "varias tiendas",
  declarationSummary([
    { type: "PICKUP", store_id: 1, declared_count: 14 },
    { type: "PICKUP", store_id: 2, declared_count: 0 },
    { type: "PICKUP", store_id: 3, declared_count: null },
    { type: "PICKUP", store_id: 4, declared_count: 6 },
  ]),
  { stops: 4, informed: 3, pending: 1, total: 20, allStores: true }
);
eq(
  "tienda + Dropoff: se declara en los dos y deja de ser «solo tiendas»",
  declarationSummary([
    { type: "PICKUP", store_id: 1, declared_count: 4 },
    { type: "PICKUP", store_id: null, declared_count: 9 },
  ]),
  { stops: 2, informed: 2, pending: 0, total: 13, allStores: false }
);
eq("ignora entregas y servidor sin campo", declarationSummary([{ type: "DELIVERY" }, { type: "PICKUP" }]), { stops: 0, informed: 0, pending: 0, total: 0, allStores: true });

// Rótulos de los totales
eq("tiendas informadas", placeStatLabel(2, true, "informed"), "tiendas informadas");
eq("tienda informada", placeStatLabel(1, true, "informed"), "tienda informada");
eq("tienda pendiente", placeStatLabel(1, true, "pending"), "tienda pendiente");
eq("cero tiendas pendientes", placeStatLabel(0, true, "pending"), "tiendas pendientes");
eq("mixta: puntos de retiro informados", placeStatLabel(2, false, "informed"), "puntos de retiro informados");
eq("mixta: punto de retiro informado", placeStatLabel(1, false, "informed"), "punto de retiro informado");
eq("mixta: puntos de retiro pendientes", placeStatLabel(3, false, "pending"), "puntos de retiro pendientes");

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
