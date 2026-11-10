// Pruebas de vehicleOptions.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/vehicle-options --module commonjs --target es2020 --strict --skipLibCheck --jsx react-jsx \
//     src/Presentation/onboarding/vehicleOptions.ts src/Presentation/onboarding/vehicleOptions.test.ts
//   node /tmp/vehicle-options/vehicleOptions.test.js

import { VEHICLE_CATALOG } from "./VehicleCatalog";
import { aMano, filtrar, limpiarTexto, marcasDe, MAX_MARCA, MAX_MODELO, MAX_VEHICULO, modelosDe, vehiculoCompleto } from "./vehicleOptions";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

// El catálogo: cada tipo con marcas, cada marca con modelos, sin repetidos y
// sin «·» (lo que se guarda los separa con ese punto).
for (const [tipo, marcas] of Object.entries(VEHICLE_CATALOG) as [string, Record<string, string[]>][]) {
  eq(`${tipo}: tiene marcas`, Object.keys(marcas).length > 0, true);
  for (const [marca, modelos] of Object.entries(marcas)) {
    eq(`${tipo} · ${marca}: modelos sin repetir`, new Set(modelos).size === modelos.length && modelos.length > 0, true);
    eq(`${tipo} · ${marca}: sin «·» y dentro del largo`, [marca, ...modelos].every((x) => !x.includes("·")) && marca.length <= MAX_MARCA && modelos.every((m) => m.length <= MAX_MODELO), true);
  }
}

eq("marcas en orden alfabético", marcasDe("moto").slice(0, 4), ["Bajaj", "Benelli", "Corven", "Gilera"]);
eq("Citroën se ordena entre Chevrolet y Fiat", marcasDe("auto").slice(0, 4), ["Chery", "Chevrolet", "Citroën", "Fiat"]);
eq("modelos en orden alfabético con números", modelosDe("moto", "Honda").slice(0, 4), ["Biz 125", "CB 125F", "CB 190R", "CB 250 Twister"]);
eq("sin tipo o sin marca no hay opciones", [marcasDe(""), modelosDe("moto", null), modelosDe("moto", "Inventada")], [[], [], []]);

eq("buscar sin mayúsculas ni acentos", filtrar(marcasDe("auto"), "citroen"), ["Citroën"]);
eq("buscar por parte del nombre", filtrar(modelosDe("moto", "Honda"), "xr"), ["XR 150L", "XR 190L", "XR 250 Tornado", "XRE 300"]);
eq("buscador vacío: todas", filtrar(["A", "B"], "  "), ["A", "B"]);

eq("lo escrito a mano: sin espacios de más, «·» ni < >", limpiarTexto("  Royal  Enfield · <Classic> ", 40), "Royal Enfield Classic");
eq("lo escrito a mano: corta al máximo", limpiarTexto("x".repeat(40), MAX_MARCA).length, MAX_MARCA);

eq("marca y modelo de la lista: nada a mano", aMano("moto", "Honda", "Wave 110"), { marca: false, modelo: false });
eq("modelo que no está (por ejemplo uno cargado antes del catálogo nuevo)", aMano("moto", "Honda", "Wave"), { marca: false, modelo: true });
eq("marca a mano: el modelo también", aMano("moto", "Royal Enfield", "Classic 350"), { marca: true, modelo: true });
eq("sin cargar: nada a mano", aMano("", null, null), { marca: false, modelo: false });

eq("completo con marca y modelo", vehiculoCompleto("Honda", "Wave 110"), true);
eq("incompleto sin modelo o con marca de una letra", [vehiculoCompleto("Honda", " "), vehiculoCompleto("H", "Wave")], [false, false]);

// Lo que se guarda («tipo · marca · modelo») entra en los 60 del servidor aun en el peor caso (utilitario, ambos a mano al máximo).
const peor = ["utilitario", "x".repeat(MAX_MARCA), "y".repeat(MAX_MODELO)].join(" · ");
eq("el más largo posible entra en el límite del servidor", peor.length <= MAX_VEHICULO, true);
// Catálogo ampliado (10-nov): motos de reparto, autos y utilitarios actuales.
eq("motos: Guerrero, Hero y la Tornado", [marcasDe("moto").includes("Guerrero"), marcasDe("moto").includes("Hero"), modelosDe("moto", "Honda").includes("XR 250 Tornado")], [true, true, true]);
eq("autos actuales", [modelosDe("auto", "Volkswagen").includes("Nivus"), modelosDe("auto", "Renault").includes("Kardian"), modelosDe("auto", "Fiat").includes("Fastback")], [true, true, true]);
eq("utilitarios: RAM 1000 y Mitsubishi L200", [modelosDe("utilitario", "RAM"), modelosDe("utilitario", "Mitsubishi")], [["1000", "Rampage"], ["L200"]]);
eq("lo guardado antes sigue en la lista (compatibilidad)", aMano("auto", "Volkswagen", "Gol Trend"), { marca: false, modelo: false });

if (failed) { console.log(`${failed} fallas`); process.exit(1); }
console.log("todo ok");
