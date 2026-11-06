// Pruebas de driverProfile.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/driver-profile --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/account/driverProfile.test.ts
//   node /tmp/driver-profile/driverProfile.test.js

import { documentsLabel, fullName, parseProfile, safeImageUrl, vehicleLabel } from "./driverProfile";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

const FB = "https://firebasestorage.googleapis.com/v0/b/lynx-mobile-7d96b.firebasestorage.app/o/drivers%2F38%2Fdocuments%2F";
const role = { id: 49, vehiculo: "moto · Honda · Wave", patente: "AB123CD", dni: "30111222", cuil: "20301112223", cbu: "000", alias: "x.y", comision: 10 };
const extra = { driver_id: 49, selfie: `${FB}selfie_1.jpg?alt=media&token=t`, dni_frente: `${FB}dni_front_1.jpg?alt=media&token=t`, dni_dorso: null, registro_frente: "", registro_dorso: `${FB}r.jpg`, cedula_frente: "https://otro.server/x.jpg", cedula_dorso: undefined };

const p = parseProfile(role, extra)!;
eq("ficha: vehículo, patente, DNI y CUIL; nada de pago", [p.driverId, p.vehicle, p.plate, p.dni, p.cuil, Object.keys(p).includes("cbu")], [49, "moto · Honda · Wave", "AB123CD", "30111222", "20301112223", false]);
eq("selfie del Storage de la app → avatar", p.selfie, extra.selfie);
eq("documentos: enviados solo los del Storage de la app", p.documents.map((d) => [d.key, !!d.url]),
  [["dni_frente", true], ["dni_dorso", false], ["registro_frente", false], ["registro_dorso", true], ["cedula_frente", false], ["cedula_dorso", false]]);
eq("columnas como las manda el alta (DNI_frente) también", parseProfile(role, { DNI_frente: `${FB}a.jpg` })!.documents[0].url, `${FB}a.jpg`);
eq("sin fila de documentos (chofer importado): sin selfie y todo «falta»", [parseProfile(role, null)!.selfie, parseProfile(role, undefined)!.documents.every((d) => d.url === null)], [null, true]);
eq("sin ficha de chofer: null", [parseProfile(null, extra), parseProfile({ id: "x" }, extra)], [null, null]);

eq("URL de otro servidor: no se pide desde el teléfono", [safeImageUrl("https://evil.example/selfie.jpg"), safeImageUrl("http://firebasestorage.googleapis.com/v0/b/otro/x")], [null, null]);
eq("imagen en línea chica: sí; grande o no imagen: no",
  [!!safeImageUrl("data:image/png;base64,AAAA"), safeImageUrl(`data:image/png;base64,${"A".repeat(300_001)}`), safeImageUrl("data:text/html;base64,AAAA")], [true, null, null]);

eq("vehículo con patente", vehicleLabel(p), "moto · Honda · Wave · Patente AB123CD");
eq("sin vehículo", [vehicleLabel(null), vehicleLabel({ vehicle: null, plate: null })], ["Sin vehículo cargado", "Sin vehículo cargado"]);
eq("documentos: cuántos se enviaron", [documentsLabel(p), documentsLabel(parseProfile(role, null)), documentsLabel(null)], ["2 de 6 enviados", "Sin documentos enviados", "DNI, registro y cédula"]);
eq("nombre y apellido", [fullName({ first_name: "Ana María", last_name: "Pérez" }), fullName({ username: "ana" }), fullName(null)], ["Ana María Pérez", "ana", "Sin nombre cargado"]);

console.log(failed ? `\n${failed} FALLAS` : "\nOK");
if (failed) process.exit(1);
