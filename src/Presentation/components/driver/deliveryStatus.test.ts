// Pruebas de deliveryStatus.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/delivery-status --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/components/driver/deliveryStatus.test.ts
//   node /tmp/delivery-status/deliveryStatus.test.js

import { deliveryStatusKey } from "./deliveryStatus";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

// Mismas reglas que el color que tenía la tarjeta: verde, azul, amarillo, rojo o gris.
for (const [raw, want] of [
  ["Entregado", "delivered"],
  ["ENTREGADO", "delivered"],
  ["Retirado", "inTransit"],
  ["En camino", "inTransit"],
  ["in_transit", "inTransit"],
  ["Solicitado", "pending"],
  ["Creado", "pending"],
  ["Pendiente", "pending"],
  ["Cancelado", "cancelled"],
  ["cancelled", "cancelled"],
  ["Rechazado", "rejected"],
  ["Nadie en domicilio", "incident"],
  ["Reprogramado", "incident"],
  ["reprogramación", "incident"],
  // Antes en gris: siguen sin carga operativa
  ["accepted", "neutral"],
  ["rejected", "neutral"],
  ["Otro estado", "neutral"],
  ["", "neutral"],
] as const) {
  eq(`«${raw}» → ${want}`, deliveryStatusKey(raw), want);
}
eq("null → neutral", deliveryStatusKey(null), "neutral");
eq("undefined → neutral", deliveryStatusKey(undefined), "neutral");

// El orden de las reglas se conserva: «entregado» gana sobre «pendiente»
eq("entregado y pendiente → entregado", deliveryStatusKey("Entregado (pendiente de firma)"), "delivered");
eq("cancelado y reprogramado → cancelado", deliveryStatusKey("Cancelado / reprogramado"), "cancelled");

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
