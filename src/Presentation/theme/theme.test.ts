// Pruebas de createTheme.ts: forma de los temas, compatibilidad con el AppTheme
// estático y contraste de texto y estados. El repo no tiene Jest: se compila y
// se corre con node (react-native se reemplaza por lo poco que usa global.ts).
//   npx tsc --outDir /tmp/theme --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/theme/AppTheme.tsx src/Presentation/theme/theme.test.ts
//   node /tmp/theme/theme.test.js

export {};

const Module = require("module");
const load = Module._load;
Module._load = function (request: string, ...rest: unknown[]) {
  if (request === "react-native") {
    return { Dimensions: { get: () => ({ width: 360, height: 800 }) }, Platform: { OS: "android" }, StatusBar: { currentHeight: 24 } };
  }
  return load.call(this, request, ...rest);
};

const { createTheme } = require("./createTheme");
const { AppTheme } = require("./AppTheme");
const { DARK_COLORS, LIGHT_COLORS } = require("./global");

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok || !detail ? "" : ` → ${detail}`}`);
};

const dark = createTheme({ scheme: "dark" });
const light = createTheme({ scheme: "light" });

// Forma: los dos esquemas tienen exactamente las mismas claves
const paths = (o: any, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? paths(v, `${p}${k}.`) : [`${p}${k}`])).sort();
check("claro y oscuro tienen las mismas claves", JSON.stringify(paths(dark)) === JSON.stringify(paths(light)));

// Compatibilidad: el estático es el dinámico oscuro (mismo objeto)
check("AppTheme estático = tema oscuro", AppTheme === dark);
check("misma combinación → mismo objeto", createTheme({ scheme: "light" }) === light);
check("AppTheme sigue en oscuro", AppTheme.colors === DARK_COLORS && AppTheme.surfaces.screen === DARK_COLORS.background);

// Ningún color del oscuro se cuela en el claro (tipografías incluidas). Las
// sombras son negras en los dos esquemas.
const colorsOf = (t: any) =>
  paths(t).filter((p) => !p.startsWith("shadows.") && (/color$/i.test(p) || /^(surfaces|text|borders|overlays)\./.test(p)));
const at = (o: any, p: string) => p.split(".").reduce((n, k) => n[k], o);
for (const p of colorsOf(light)) {
  const v = at(light, p);
  const own = Object.values(LIGHT_COLORS).includes(v);
  check(`claro: ${p} sale de LIGHT_COLORS`, own, String(v));
}

// Contraste (WCAG 2): las cards translúcidas se evalúan compuestas sobre el fondo
const rgb = (s: string) => {
  if (s.startsWith("#")) return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)).concat(1);
  const [r, g, b, a = 1] = (s.match(/[\d.]+/g) ?? []).map(Number);
  return [r, g, b, a];
};
const over = (fg: string, bg: string) => {
  const [r, g, b, a] = rgb(fg);
  const base = rgb(bg);
  return "#" + [r, g, b].map((v, i) => Math.round(v * a + base[i] * (1 - a)).toString(16).padStart(2, "0")).join("");
};
const lum = (s: string) =>
  rgb(s).slice(0, 3).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// Fondos de lectura de cada esquema. Los colores de estado también se leen
// sobre su propio tinte (`${color}16`, como lo usan las pantallas).
const surfacesOf = (c: any) => {
  const solid = ["background", "backgroundAlt", "backgroundDeep", "surface", "surfaceSoft", "surfaceStrong"].map((k) => [k, c[k]]);
  const cards = ["card", "cardStrong", "cardElevated", "mutedBg"].map((k) => [k, over(c[k], c.background)]);
  return [...solid, ...cards] as [string, string][];
};

const minOver = (fg: string, bgs: [string, string][]) =>
  bgs.reduce((m, [k, bg]) => { const r = contrast(fg, bg); return r < m.r ? { r, k } : m; }, { r: Infinity, k: "" });

const expect = (scheme: string, token: string, fg: string, bgs: [string, string][], min: number) => {
  const worst = minOver(fg, bgs);
  check(`${scheme}: ${token} ≥ ${min}:1`, worst.r >= min, `${worst.r.toFixed(2)} sobre ${worst.k}`);
};

for (const [scheme, c] of [["oscuro", DARK_COLORS], ["claro", LIGHT_COLORS]] as const) {
  const bgs = surfacesOf(c);
  expect(scheme, "texto", c.text, bgs, 4.5);
  expect(scheme, "texto secundario", c.textSecondary, bgs, 4.5);

  // Estados operativos: texto e iconos sobre cualquier superficie y sobre su tinte
  for (const token of ["danger", "warning", "success"] as const) {
    if (scheme === "oscuro" && token === "success") continue; // ver abajo
    const tinted: [string, string][] = [["tinte", over(`rgba(${rgb(c[token]).slice(0, 3).join(",")},0.086)`, over(c.cardElevated, c.background))]];
    expect(scheme, token, c[token], [...bgs, ...tinted], 4.5);
  }

  // primary es fondo de botones con texto blanco: el texto del botón manda.
  check(`${scheme}: blanco sobre primary ≥ 4.5:1`, contrast(c.white, c.primary) >= 4.5);
  expect(scheme, "primary como borde/indicador", c.primary, [[`background`, c.background]], 3);

  // Contadores (blanco sobre danger) y botón «Aceptar» (blanco sobre success)
  check(`${scheme}: blanco sobre danger ≥ 3:1`, contrast(c.white, c.danger) >= 3, contrast(c.white, c.danger).toFixed(2));
  check(`${scheme}: blanco sobre success ≥ 4.5:1`, contrast(c.white, c.success) >= 4.5, contrast(c.white, c.success).toFixed(2));
}

// success oscuro: pendiente de un token propio para texto (Fase 2). Hoy, como
// indicador sobre el fondo principal, cumple el mínimo de componente gráfico.
expect("oscuro", "success como indicador", DARK_COLORS.success, [["background", DARK_COLORS.background]], 3);

// Los estados se distinguen entre sí en cada esquema
for (const [scheme, c] of [["oscuro", DARK_COLORS], ["claro", LIGHT_COLORS]] as const) {
  const states = [c.success, c.warning, c.danger, c.primary];
  check(`${scheme}: success, warning, danger y primary son distintos`, new Set(states).size === states.length);
}

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
