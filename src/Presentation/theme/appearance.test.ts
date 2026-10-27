// Pruebas de appearance.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/appearance --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/theme/appearance.test.ts
//   node /tmp/appearance/appearance.test.js

import { DEFAULT_APPEARANCE, normalizeAppearance, resolveScheme } from "./appearance";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

// Por defecto: la apariencia de siempre
eq("predeterminado oscuro", DEFAULT_APPEARANCE, { version: 1, colorMode: "dark" });

// Valores válidos
for (const mode of ["light", "dark", "system"]) {
  eq(`conserva ${mode}`, normalizeAppearance({ version: 1, colorMode: mode }), { version: 1, colorMode: mode });
}

// Nada guardado o guardado roto → valores por defecto
for (const [name, raw] of [
  ["null", null],
  ["undefined", undefined],
  ["texto", "dark"],
  ["número", 3],
  ["arreglo", ["light"]],
  ["objeto vacío", {}],
] as const) {
  eq(`${name} → por defecto`, normalizeAppearance(raw), DEFAULT_APPEARANCE);
}

// Campos inválidos o desconocidos
eq("modo desconocido", normalizeAppearance({ version: 1, colorMode: "sepia" }), DEFAULT_APPEARANCE);
eq("modo con otro tipo", normalizeAppearance({ version: 1, colorMode: 1 }), DEFAULT_APPEARANCE);
eq("mayúsculas no valen", normalizeAppearance({ colorMode: "LIGHT" }), DEFAULT_APPEARANCE);

// Otras versiones: se rescata lo válido y queda con la versión actual
eq("sin versión", normalizeAppearance({ colorMode: "light" }), { version: 1, colorMode: "light" });
eq("versión vieja", normalizeAppearance({ version: 0, colorMode: "system" }), { version: 1, colorMode: "system" });
eq("versión futura con campos nuevos", normalizeAppearance({ version: 2, colorMode: "light", style: "marble" }), { version: 1, colorMode: "light" });

// Esquema resuelto
eq("claro fijo ignora el sistema", resolveScheme("light", "dark"), "light");
eq("oscuro fijo ignora el sistema", resolveScheme("dark", "light"), "dark");
eq("sistema claro", resolveScheme("system", "light"), "light");
eq("sistema oscuro", resolveScheme("system", "dark"), "dark");
eq("sistema sin dato → oscuro", resolveScheme("system", null), "dark");
eq("sistema undefined → oscuro", resolveScheme("system", undefined), "dark");

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
