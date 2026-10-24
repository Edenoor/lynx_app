// Pruebas de addressQuery.ts y de ../errorMessage.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/home --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/account/addressQuery.ts src/Presentation/views/driver/errorMessage.ts \
//     src/Presentation/views/driver/account/addressQuery.test.ts
//   node /tmp/home/account/addressQuery.test.js

import { splitAddressQuery } from "./addressQuery";
import { errorMessage, NO_NETWORK } from "../errorMessage";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

// Calle y localidad
eq("calle y localidad", splitAddressQuery("Av. Rivadavia 1234, Caballito"), { direccion: "Av. Rivadavia 1234", localidad: "Caballito" });
eq("sin coma viaja entero", splitAddressQuery("Corrientes 1234"), { direccion: "Corrientes 1234" });
eq("espacios de más", splitAddressQuery("  Belgrano   550 ,   Morón  "), { direccion: "Belgrano 550", localidad: "Morón" });
eq("localidad con número", splitAddressQuery("Mitre 200, 25 de Mayo"), { direccion: "Mitre 200", localidad: "25 de Mayo" });
eq("varias comas: corta en la última", splitAddressQuery("Mitre 200, Ramos Mejía, La Matanza"), { direccion: "Mitre 200, Ramos Mejía", localidad: "La Matanza" });
eq("número después de la coma no es localidad", splitAddressQuery("San Martín, 1250"), { direccion: "San Martín, 1250" });
eq("coma final", splitAddressQuery("Corrientes 1234,"), { direccion: "Corrientes 1234" });
eq("solo localidad tras coma vacía", splitAddressQuery(", Morón"), { direccion: ", Morón" });
eq("vacío", splitAddressQuery("   "), { direccion: "" });

// Mensajes de error
eq("sin red (fetch de RN)", errorMessage(new TypeError("Network request failed"), "x"), NO_NETWORK);
eq("sin red (web)", errorMessage(new TypeError("Failed to fetch"), "x"), NO_NETWORK);
eq("mensaje del servidor pasa tal cual", errorMessage(new Error("La parada ya está cerrada"), "x"), "La parada ya está cerrada");
eq("sin mensaje: el de respaldo", errorMessage(new Error(""), "No se pudo"), "No se pudo");
eq("no es un Error", errorMessage(undefined, "No se pudo"), "No se pudo");
eq("mensaje no texto", errorMessage({ message: 42 }, "No se pudo"), "No se pudo");

console.log(failed ? `\n${failed} pruebas fallaron` : "\nTodas las pruebas pasaron");
if (failed) throw new Error(`${failed} pruebas fallaron`);
