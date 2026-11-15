// Pruebas de driverTabs.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/driver-tabs --module commonjs --target es2020 --strict --skipLibCheck \
//     --esModuleInterop --jsx react-jsx src/Presentation/navigator/driverTabs.test.ts
//   node /tmp/driver-tabs/Presentation/navigator/driverTabs.test.js

import { goToDriverTab, StackReset, StackRoute, tabStack } from "./driverTabs";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`}`);
};

const H: StackRoute = { key: "h", name: "DriverScreen" };
const E: StackRoute = { key: "e", name: "EnviosScreen", params: { x: 1 } };
const C: StackRoute = { key: "c", name: "CollectionsScreen" };
const R: StackRoute = { key: "r", name: "RoutesScreen" };
const D: StackRoute = { key: "d", name: "RouteDetailScreen", params: { routeId: 8 } };
const O: StackRoute = { key: "o", name: "RouteOrganizeScreen", params: { routeId: 8 } };

eq("desde Inicio a Envíos: [Inicio, Envíos]", tabStack([H], "deliveries"), { index: 1, routes: [H, { name: "EnviosScreen" }] });
eq("cambiar de sección no acumula: Envíos → Colectas deja [Inicio, Colectas]", tabStack([H, E], "collections"), { index: 1, routes: [H, { name: "CollectionsScreen" }] });
eq("Inicio desde cualquier lado: solo Inicio, la misma pantalla", tabStack([H, E, R, D], "home"), { index: 0, routes: [H] });
eq("desde un detalle, la pestaña activa vuelve a la raíz de su sección (con su estado)", tabStack([H, E, R, D, O], "deliveries"), { index: 1, routes: [H, E] });
eq("Recorridos → Envíos: [Inicio, Envíos], sin otro Envíos", tabStack([H, E, R], "deliveries"), { index: 1, routes: [H, E] });
eq("en la raíz de la sección: nada que hacer", tabStack([H, C], "collections"), null);
eq("en Inicio y tocar Inicio: nada que hacer", tabStack([H], "home"), null);
eq("stacks viejos con duplicados: quedan dos pantallas", tabStack([H, E, C, H, E], "activity"), { index: 1, routes: [H, { name: "NotificationsScreen" }] });
eq("sin Inicio en el stack (no debería pasar): lo agrega", tabStack([E], "scan"), { index: 1, routes: [{ name: "DriverScreen" }, { name: "DriverScanOptionsScreen" }] });

const calls: StackReset[] = [];
const nav = (index: number, routes: StackRoute[]) => ({ getState: () => ({ index, routes }), reset: (s: StackReset) => calls.push(s) });
goToDriverTab(nav(3, [H, E, R, D]), "collections");
eq("goToDriverTab: un solo reset con el stack nuevo", calls, [{ index: 1, routes: [H, { name: "CollectionsScreen" }] }]);
calls.length = 0;
goToDriverTab(nav(1, [H, E]), "deliveries");
eq("goToDriverTab: en la raíz no hace reset", calls, []);
calls.length = 0;
goToDriverTab(nav(1, [H, E, D]), "home");
eq("goToDriverTab: mira hasta la pantalla a la vista (index)", calls, [{ index: 0, routes: [H] }]);
calls.length = 0;
goToDriverTab({ getState: () => undefined, reset: (s: StackReset) => calls.push(s) }, "deliveries");
eq("goToDriverTab: sin estado todavía, arma [Inicio, sección]", calls, [{ index: 1, routes: [{ name: "DriverScreen" }, { name: "EnviosScreen" }] }]);

if (failed) { console.log(`\n${failed} prueba(s) fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
