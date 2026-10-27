// Pruebas de pickupConfirmation.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/pickup --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/routes/pickupConfirmation.ts src/Presentation/views/driver/routes/pickupConfirmation.test.ts
//   node /tmp/pickup/pickupConfirmation.test.js

import { awaitsPickupAnswer, canStartRoute, needsAnswer, PICKUP_ANSWER_LABEL, pickupAnswer, startsLater } from "./pickupConfirmation";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

type R = Parameters<typeof canStartRoute>[0];
const r = (p: Partial<R>): R => ({ type: "PICKUP", status: "ASSIGNED", driver_confirmation: null, template_id: null, confirmation_state: null, ...p });

// Estado de la colecta
eq("colecta manual sin respuesta → pendiente", pickupAnswer(r({})), "PENDING");
eq("colecta aceptada", pickupAnswer(r({ driver_confirmation: "ACCEPTED" })), "ACCEPTED");
eq("colecta rechazada", pickupAnswer(r({ driver_confirmation: "DECLINED" })), "DECLINED");
eq("colecta de ronda fija también se contesta", pickupAnswer(r({ template_id: 7 })), "PENDING");
eq("colecta en curso: ya no se contesta", pickupAnswer(r({ status: "IN_PROGRESS", driver_confirmation: "ACCEPTED" })), null);
eq("reparto asignado: no es colecta", pickupAnswer(r({ type: "DELIVERY" })), null);
eq("turbo asignado: no es colecta", awaitsPickupAnswer(r({ type: "TURBO" })), false);

// Salir a la calle
eq("colecta sin aceptar no sale", canStartRoute(r({})), false);
eq("colecta rechazada no sale", canStartRoute(r({ driver_confirmation: "DECLINED" })), false);
eq("colecta aceptada sale", canStartRoute(r({ driver_confirmation: "ACCEPTED" })), true);
eq("turbo asignado sale sin aceptar", canStartRoute(r({ type: "TURBO" })), true);
eq("reparto asignado no sale (falta la carga)", canStartRoute(r({ type: "DELIVERY" })), false);
eq("reparto cargado sale", canStartRoute(r({ type: "DELIVERY", status: "LOADED" })), true);
eq("en curso no vuelve a salir", canStartRoute(r({ status: "IN_PROGRESS", driver_confirmation: "ACCEPTED" })), false);

// Fecha: la de mañana se ve hoy pero se comienza ese día
eq("colecta de mañana: se comienza mañana", startsLater({ scheduled_date: "2026-10-27" }, "2026-10-26"), true);
eq("colecta de hoy", startsLater({ scheduled_date: "2026-10-26" }, "2026-10-26"), false);
eq("colecta de ayer (vencida): no se bloquea por fecha", startsLater({ scheduled_date: "2026-10-25" }, "2026-10-26"), false);
eq("sin fecha", startsLater({ scheduled_date: null }, "2026-10-26"), false);

// Estados que ve el chofer
eq("etiquetas", Object.values(PICKUP_ANSWER_LABEL), ["Pendiente de confirmación", "Aceptada", "Rechazada"]);

// Lo de mañana que pide respuesta
eq("ronda fija sin aceptar (como antes)", needsAnswer(r({ type: "DELIVERY", status: "ASSIGNED", template_id: 3, confirmation_state: "PENDING" })), true);
eq("ronda fija aceptada", needsAnswer(r({ template_id: 3, confirmation_state: "ACCEPTED", driver_confirmation: "ACCEPTED" })), false);
eq("colecta manual sin aceptar", needsAnswer(r({})), true);
eq("colecta manual rechazada (puede cambiar de idea)", needsAnswer(r({ driver_confirmation: "DECLINED" })), true);
eq("colecta manual aceptada", needsAnswer(r({ driver_confirmation: "ACCEPTED" })), false);
eq("reparto manual sin plantilla", needsAnswer(r({ type: "DELIVERY" })), false);

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
