// Pruebas de createTheme.ts en las 18 combinaciones (2 esquemas × 3 estilos ×
// 3 bordes): forma, compatibilidad con el AppTheme estático, contraste de texto
// y estados, escala de radios y diferencias entre estilos. El repo no tiene
// Jest: se compila y se corre con node (react-native se reemplaza por lo poco
// que usan global.ts y createTheme.ts).
//   npx tsc --outDir /tmp/theme --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/theme/AppTheme.tsx src/Presentation/theme/theme.test.ts
//   node /tmp/theme/theme.test.js

export {};

const Module = require("module");
const load = Module._load;
Module._load = function (request: string, ...rest: unknown[]) {
  if (request === "react-native") {
    return {
      Dimensions: { get: () => ({ width: 360, height: 800 }) },
      Platform: { OS: "android" },
      StatusBar: { currentHeight: 24 },
      StyleSheet: { hairlineWidth: 0.5 },
    };
  }
  return load.call(this, request, ...rest);
};

const { createTheme, radiusScale } = require("./createTheme");
const { AppTheme } = require("./AppTheme");
const { BORDER_RADIUS, DARK_COLORS, LIGHT_COLORS, MARBLE_DARK_COLORS, MARBLE_LIGHT_COLORS, SHADOWS } = require("./global");
const { RADIUS_PRESETS, VISUAL_STYLES } = require("./appearance");

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok || !detail ? "" : ` → ${detail}`}`);
};

const COMBOS: { scheme: string; style: string; radius: string }[] = [];
for (const scheme of ["dark", "light"]) for (const style of VISUAL_STYLES) for (const radius of RADIUS_PRESETS) COMBOS.push({ scheme, style, radius });
const nameOf = (o: { scheme: string; style: string; radius: string }) => `${o.scheme === "dark" ? "oscuro" : "claro"}/${o.style}/${o.radius}`;
const PALETTE: Record<string, any> = {
  "dark.classic": DARK_COLORS, "dark.minimal": DARK_COLORS, "dark.marble": MARBLE_DARK_COLORS,
  "light.classic": LIGHT_COLORS, "light.minimal": LIGHT_COLORS, "light.marble": MARBLE_LIGHT_COLORS,
};

check("18 combinaciones", COMBOS.length === 18);

// Forma: todas las combinaciones tienen exactamente las mismas claves
const paths = (o: any, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? paths(v, `${p}${k}.`) : [`${p}${k}`])).sort();
const at = (o: any, p: string) => p.split(".").reduce((n, k) => n[k], o);
const reference = JSON.stringify(paths(createTheme({ scheme: "dark" })));
check("las 18 tienen las mismas claves", COMBOS.every((o) => JSON.stringify(paths(createTheme(o))) === reference));

// Compatibilidad: el estático es el dinámico por defecto (oscuro, Classic, Equilibrado)
const def = createTheme({ scheme: "dark", style: "classic", radius: "balanced" });
check("AppTheme estático = tema por defecto (mismo objeto)", AppTheme === def && createTheme({ scheme: "dark" }) === def);
check("misma combinación → mismo objeto", createTheme({ scheme: "light", style: "marble", radius: "rounded" }) === createTheme({ scheme: "light", style: "marble", radius: "rounded" }));
check("Classic usa la paleta de siempre", def.colors === DARK_COLORS && def.surfaces.card === DARK_COLORS.card && def.borders.medium === DARK_COLORS.borderMedium);
check("Classic conserva las sombras", JSON.stringify(def.shadows.card) === JSON.stringify(SHADOWS.card) && JSON.stringify(def.shadows.glow) === JSON.stringify(SHADOWS.glow));
check("Equilibrado = escala de siempre", JSON.stringify(def.radius) === JSON.stringify(BORDER_RADIUS));
check("Classic: imagen de fondo como antes", def.backdrop.imageOpacity === 0.18);

// Ningún color de otra paleta se cuela (tipografías incluidas)
for (const o of COMBOS.filter((c) => c.radius === "balanced")) {
  const t = createTheme(o);
  const own = new Set(Object.values(PALETTE[`${o.scheme}.${o.style}`]));
  const leaks = paths(t)
    .filter((p) => /^(text|surfaces|typography)\./.test(p) && /color$|^text\.|^surfaces\./i.test(p))
    .filter((p) => typeof at(t, p) === "string" && !own.has(at(t, p)));
  check(`${nameOf(o)}: textos y superficies salen de su paleta`, leaks.length === 0, leaks.join(", "));
}

// Contraste (WCAG 2): las superficies translúcidas se evalúan compuestas sobre el fondo
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

// Fondos de lectura de una combinación: los de la paleta y las superficies que
// el tema realmente usa (en Minimal, las cards son el tinte del fondo).
const surfacesOf = (t: any): [string, string][] => {
  const c = t.colors;
  const solid = ["background", "backgroundAlt", "backgroundDeep", "surface", "surfaceSoft", "surfaceStrong"].map((k) => [k, c[k]] as [string, string]);
  const used = ["card", "cardStrong", "cardElevated", "muted", "input"].map((k) => [`surfaces.${k}`, over(t.surfaces[k], c.background)] as [string, string]);
  return [...solid, ...used];
};
const worstOver = (fg: string, bgs: [string, string][]) =>
  bgs.reduce((m, [k, bg]) => { const r = contrast(fg, bg); return r < m.r ? { r, k } : m; }, { r: Infinity, k: "" });

const STATUS_KEYS = ["delivered", "pending", "confirmed", "incident", "rejected", "cancelled", "inTransit", "neutral"];

for (const o of COMBOS.filter((c) => c.radius === "balanced")) {
  const t = createTheme(o);
  const n = nameOf(o);
  const bgs = surfacesOf(t);
  const expect = (label: string, fg: string, list: [string, string][], min: number) => {
    const w = worstOver(fg, list);
    check(`${n}: ${label} ≥ ${min}:1`, w.r >= min, `${w.r.toFixed(2)} sobre ${w.k}`);
  };

  expect("texto", t.text.primary, bgs, 4.5);
  expect("texto secundario", t.text.secondary, bgs, 4.5);
  expect("texto tenue", t.text.muted, bgs, 4.5);
  expect("acento (links, horarios)", t.text.accent, bgs, 4.5);
  expect("indicador dorado", t.colors.highlightGold, bgs, 4.5);
  expect("indicador verde", t.colors.highlightGreen, bgs, 4.5);
  check(`${n}: texto sobre botón primario ≥ 4.5:1`, contrast(t.text.onPrimary, t.colors.primary) >= 4.5);

  for (const key of STATUS_KEYS) {
    const tone = t.status[key];
    // Sobre su propio tinte, puesto en cualquiera de los fondos (en Minimal las filas son transparentes).
    const tints = bgs.map(([k, bg]) => [`su tinte sobre ${k}`, over(tone.background, bg)] as [string, string]);
    expect(`estado ${key}`, tone.text, [...bgs, ...tints], 4.5);
    // Rellenos: botón «Aceptar», contador de la barra y avisos.
    const min = 4.5;
    check(`${n}: texto sobre relleno ${key} ≥ ${min}:1`, contrast(tone.onSolid, tone.solid) >= min, contrast(tone.onSolid, tone.solid).toFixed(2));
  }

  // Los estados se distinguen: pendiente, positivo, negativo y en camino tienen colores distintos
  const families = ["pending", "confirmed", "rejected", "inTransit", "neutral"].map((k) => t.status[k].text);
  check(`${n}: pendiente, confirmado, rechazado, en camino y neutro son distintos`, new Set(families).size === 5);
}

// Los colores de estado no dependen del estilo ni de los bordes (salvo la paleta Marble clara, más profunda)
for (const scheme of ["dark", "light"]) {
  const base = createTheme({ scheme, style: "classic" }).status;
  check(`${scheme}: Minimal no cambia los estados`, JSON.stringify(createTheme({ scheme, style: "minimal", radius: "square" }).status) === JSON.stringify(base));
  check(`${scheme}: los bordes no cambian los estados`, JSON.stringify(createTheme({ scheme, style: "classic", radius: "rounded" }).status) === JSON.stringify(base));
}

// Radios
const ORDER = ["xs", "sm", "md", "lg", "xl", "xxl"];
for (const preset of RADIUS_PRESETS) {
  const r = radiusScale(preset);
  check(`${preset}: escala creciente`, ORDER.every((k, i) => i === 0 || r[ORDER[i - 1]] <= r[k]));
  check(`${preset}: entre 2 y 32`, ORDER.every((k) => r[k] >= 2 && r[k] <= 32));
  check(`${preset}: círculos y píldoras intactos (999)`, r.full === 999);
}
const [sq, bal, rnd] = RADIUS_PRESETS.map(radiusScale);
check("Recto < Equilibrado < Redondeado (md y lg)", sq.md < bal.md && bal.md < rnd.md && sq.lg < bal.lg && bal.lg < rnd.lg);
check("botones (md) nunca pasan la mitad de 44 px", [sq, bal, rnd].every((r) => r.md <= 22));
check("el preset llega a los tokens de componentes", createTheme({ scheme: "dark", radius: "square" }).card.borderRadius === sq.lg);

// Un panel con borde propio (destacado, error) lo cambia en los cuatro lados
for (const o of COMBOS) {
  const card = createTheme(o).card;
  check(`${nameOf(o)}: el panel no fija el borde inferior aparte`, !("borderBottomColor" in card) && !("borderBottomWidth" in card));
}

// Estilos: diferencias reales, no solo de color
for (const scheme of ["dark", "light"]) {
  const classic = createTheme({ scheme, style: "classic" });
  const minimal = createTheme({ scheme, style: "minimal" });
  const marble = createTheme({ scheme, style: "marble" });
  check(`${scheme}: Minimal sin sombras`, minimal.shadows.card.elevation === 0 && minimal.shadows.glow.elevation === 0 && minimal.card.elevation === 0);
  check(`${scheme}: Minimal sin contorno de card`, minimal.card.borderWidth === 0 && minimal.borders.medium === "transparent");
  check(`${scheme}: Minimal lista en filas con separador`, minimal.list.gap === 0 && minimal.listItem.borderBottomWidth === minimal.separator.width && minimal.listItem.backgroundColor === "transparent");
  check(`${scheme}: Classic lista en tarjetas`, classic.list.gap > 0 && JSON.stringify(classic.listItem) === JSON.stringify({ ...classic.card, borderBottomWidth: classic.card.borderWidth, borderBottomColor: classic.card.borderColor }));
  check(`${scheme}: Marble con superficies opacas`, ["card", "cardStrong", "cardElevated"].every((k) => rgb(marble.surfaces[k])[3] === 1));
  check(`${scheme}: Marble con sombra difusa y elevación baja`, marble.card.shadowRadius >= 12 && marble.card.elevation <= 2 && marble.card.shadowOpacity <= 0.3);
  check(`${scheme}: Marble con bordes de bajo contraste`, rgb(marble.borders.medium)[3] < rgb(classic.borders.medium)[3]);
  check(`${scheme}: Marble tiene paleta propia`, marble.colors.background !== classic.colors.background);
  check(`${scheme}: sin imagen de fondo en Minimal y Marble`, minimal.backdrop.imageOpacity === 0 && marble.backdrop.imageOpacity === 0);
}

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
