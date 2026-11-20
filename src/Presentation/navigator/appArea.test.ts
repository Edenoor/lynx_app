// Pruebas de appArea.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/app-area --module commonjs --target es2020 --strict --skipLibCheck \
//     --esModuleInterop --jsx react-jsx src/Presentation/navigator/appArea.test.ts
//   node /tmp/app-area/Presentation/navigator/appArea.test.js

import { baulSoloConsulta, hasPermission, PERMISSION, resolveAppArea, sameAccess } from "./appArea";
import { User } from "../../Domain/entities/User";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`}`);
};
const u = (over: Partial<User>): User => ({ id: "1", username: "x", name: "x", rol: "ADMIN", token: "t", ...over } as User);

eq("sin sesión: login", resolveAppArea(null), "auth");
eq("chofer: su área, tenga lo que tenga", resolveAppArea(u({ rol: "DRIVER" as User["rol"], permissions: [PERMISSION.RECIBIR] })), "driver");
eq("vendedor", resolveAppArea(u({ rol: "SELLER" as User["rol"] })), "seller");

// Por permisos (servidor nuevo).
eq("Picker con sus permisos: depósito", resolveAppArea(u({ profile: "PICKER", permissions: ["deposito.ver", PERMISSION.RECIBIR, PERMISSION.BAUL_OPERAR] })), "picker");
eq("Coordinador con un rol de recibir: depósito, sin ser Picker", resolveAppArea(u({ profile: "COORDINADOR", permissions: ["colectas.ver", PERMISSION.RECIBIR] })), "picker");
eq("sin perfil, solo operar baúl: depósito", resolveAppArea(u({ profile: null, permissions: [PERMISSION.BAUL_OPERAR] })), "picker");
eq("Coordinador sin permiso de operar: Web", resolveAppArea(u({ profile: "COORDINADOR", permissions: ["colectas.ver", "deposito.ver", "deposito.baul"] })), "adminWeb");
eq("perfil Picker al que el servidor no le da operar (ficha desactivada): Web", resolveAppArea(u({ profile: "PICKER", permissions: [] })), "adminWeb");

// Servidor anterior: no manda la lista.
eq("servidor viejo, Picker: depósito como siempre", resolveAppArea(u({ profile: "PICKER" })), "picker");
eq("servidor viejo, Coordinador: Web como siempre", resolveAppArea(u({ profile: "COORDINADOR" })), "adminWeb");
eq("servidor viejo, Picker: puede todo lo del depósito", hasPermission(u({ profile: "picker" }), PERMISSION.BAUL_VER), true);

eq("permiso puntual: tiene uno de los pedidos", hasPermission(u({ permissions: [PERMISSION.DEPOSITO_VER] }), PERMISSION.RECIBIR, PERMISSION.DEPOSITO_VER), true);
eq("permiso puntual: no lo tiene", hasPermission(u({ profile: "PICKER", permissions: [PERMISSION.RECIBIR] }), PERMISSION.BAUL_OPERAR), false);
eq("un chofer nunca tiene permisos de depósito", hasPermission(u({ rol: "DRIVER" as User["rol"], permissions: [PERMISSION.RECIBIR] }), PERMISSION.RECIBIR), false);
eq("sin usuario", hasPermission(null, PERMISSION.RECIBIR), false);

eq("Baúl: solo consultarlo es solo consulta", baulSoloConsulta(u({ permissions: [PERMISSION.BAUL_VER, PERMISSION.RECIBIR] })), true);
eq("Baúl: con operarlo, opera", baulSoloConsulta(u({ permissions: [PERMISSION.BAUL_VER, PERMISSION.BAUL_OPERAR] })), false);
eq("Baúl: servidor viejo, Picker opera", baulSoloConsulta(u({ profile: "PICKER" })), false);

eq("mismo acceso aunque cambie el orden", sameAccess({ profile: "PICKER", permissions: ["a", "b"] }, { profile: "PICKER", permissions: ["b", "a"] }), true);
eq("cambió un permiso", sameAccess({ profile: "PICKER", permissions: ["a"] }, { profile: "PICKER", permissions: ["a", "b"] }), false);
eq("cambió el perfil", sameAccess({ profile: "PICKER", permissions: ["a"] }, { profile: null, permissions: ["a"] }), false);
eq("lo guardado no tenía lista y ahora sí", sameAccess({ profile: "PICKER" }, { profile: "PICKER", permissions: [] }), false);
eq("ninguno tiene lista (servidor viejo)", sameAccess({ profile: "PICKER" }, { profile: "PICKER", permissions: null }), true);

if (failed) { console.log(`\n${failed} fallaron`); process.exit(1); }
console.log("\ntodo ok");
