// Pruebas de appearance.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/appearance --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/theme/appearance.test.ts
//   node /tmp/appearance/appearance.test.js

import { DEFAULT_APPEARANCE, normalizeAppearance, RADIUS_PRESETS, resolveScheme, VISUAL_STYLES } from "./appearance";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

// Por defecto: la apariencia de siempre
const D = { version: 1, colorMode: "dark", style: "classic", radius: "balanced" };
eq("predeterminado: oscuro + Classic + Equilibrado", DEFAULT_APPEARANCE, D);

// Valores válidos
for (const mode of ["light", "dark", "system"]) {
  eq(`conserva ${mode}`, normalizeAppearance({ ...D, colorMode: mode }), { ...D, colorMode: mode });
}
for (const style of VISUAL_STYLES) eq(`conserva estilo ${style}`, normalizeAppearance({ ...D, style }), { ...D, style });
for (const radius of RADIUS_PRESETS) eq(`conserva bordes ${radius}`, normalizeAppearance({ ...D, radius }), { ...D, radius });
eq("combinación completa", normalizeAppearance({ version: 1, colorMode: "dark", style: "marble", radius: "rounded" }), { version: 1, colorMode: "dark", style: "marble", radius: "rounded" });

// Guardado por la Fase 1 (solo colorMode): sigue valiendo, el resto por defecto
eq("Fase 1: claro", normalizeAppearance({ version: 1, colorMode: "light" }), { ...D, colorMode: "light" });
eq("Fase 1: sistema", normalizeAppearance({ version: 1, colorMode: "system" }), { ...D, colorMode: "system" });

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
eq("estilo desconocido, el resto se conserva", normalizeAppearance({ ...D, colorMode: "light", style: "neon" }), { ...D, colorMode: "light" });
eq("bordes desconocidos, el resto se conserva", normalizeAppearance({ ...D, style: "minimal", radius: 12 }), { ...D, style: "minimal" });
eq("estilo en mayúsculas no vale", normalizeAppearance({ ...D, style: "MARBLE" }), D);
eq("modo con otro tipo", normalizeAppearance({ version: 1, colorMode: 1 }), DEFAULT_APPEARANCE);
eq("mayúsculas no valen", normalizeAppearance({ colorMode: "LIGHT" }), DEFAULT_APPEARANCE);

// Otras versiones: se rescata lo válido y queda con la versión actual
eq("sin versión", normalizeAppearance({ colorMode: "light" }), { ...D, colorMode: "light" });
eq("versión vieja", normalizeAppearance({ version: 0, colorMode: "system" }), { ...D, colorMode: "system" });
eq("versión futura con campos nuevos", normalizeAppearance({ version: 2, colorMode: "light", style: "marble", accent: "pink" }), { ...D, colorMode: "light", style: "marble" });

// Restablecer = valores por defecto (lo que guarda resetAppearance)
eq("restablecer vuelve a oscuro + Classic + Equilibrado", normalizeAppearance(DEFAULT_APPEARANCE), D);

// Esquema resuelto
eq("claro fijo ignora el sistema", resolveScheme("light", "dark"), "light");
eq("oscuro fijo ignora el sistema", resolveScheme("dark", "light"), "dark");
eq("sistema claro", resolveScheme("system", "light"), "light");
eq("sistema oscuro", resolveScheme("system", "dark"), "dark");
eq("sistema sin dato → oscuro", resolveScheme("system", null), "dark");
eq("sistema undefined → oscuro", resolveScheme("system", undefined), "dark");

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
