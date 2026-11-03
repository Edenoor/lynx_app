// Pruebas de turboOffer.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/turbo-offer --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/turbo/turboOffer.ts src/Presentation/views/driver/turbo/turboOffer.test.ts
//   node /tmp/turbo-offer/turboOffer.test.js

import { acceptWithConfirm, esProgramado, isDefinitive, NO_RETIRAR_ANTES, plazoParaResponder, programadoLabel, secondsLeft, withLocalExpiry } from "./turboOffer";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

// Como TurboApiError (turboApi.ts): un 4xx o 5xx con JSON trae status; sin
// red, sin respuesta a tiempo o una respuesta sin JSON es un Error común.
class HttpError extends Error {
  constructor(message: string, public status: number, public code: string | null = null) { super(message); }
}

(async () => {
  // Reloj del servidor y del teléfono: el teléfono va 60 s adelantado.
  const server = Date.UTC(2026, 9, 31, 15, 0, 0);
  const phone = server + 60_000;
  const offer = { route_id: 90, expires_at: new Date(server + 30_000).toISOString(), seconds_left: 30 };

  const [o] = withLocalExpiry([offer], phone);
  eq("teléfono 60 s adelantado y seconds_left 30: quedan 30 s", secondsLeft(o, phone), 30);
  eq("(con expires_at y el reloj del teléfono daba 0: «vencida»)", Math.max(0, Math.round((new Date(offer.expires_at).getTime() - phone) / 1000)), 0);
  eq("la respuesta llegó 2 s después del pedido: se cuenta desde el pedido", secondsLeft(withLocalExpiry([offer], phone)[0], phone + 2_000), 28);
  eq("sin seconds_left (servidor viejo): usa expires_at", secondsLeft(withLocalExpiry([{ route_id: 1, expires_at: new Date(server + 45_000).toISOString() }], server)[0], server), 45);
  eq("no baja de 0", secondsLeft(o, phone + 120_000), 0);
  eq("conserva los datos de la oferta", withLocalExpiry([offer], phone)[0].route_id, 90);

  eq("respuestas finales: 409, 404, 403, 401", [409, 404, 403, 401].map((s) => isDefinitive(new HttpError("x", s))), [true, true, true, true]);
  eq("no se sabe: sin red, 5xx, 408, 429, sin JSON", [new Error("sin red"), new HttpError("x", 502), new HttpError("x", 408), new HttpError("x", 429), new Error("Respuesta inesperada del servidor (200)"), null].map(isDefinitive), [false, false, false, false, false, false]);

  const run = async (answers: (unknown | Error)[]) => {
    const calls: number[] = [];
    const sleeps: number[] = [];
    const r = await acceptWithConfirm(90, async (id) => {
      calls.push(id);
      const a = answers[calls.length - 1];
      if (a instanceof Error) throw a;
      return a;
    }, { sleep: async (ms) => { sleeps.push(ms); } });
    return { kind: r.kind, error: r.kind === "assigned" ? null : (r.error as Error | null)?.message ?? null, calls: calls.length, sleeps: sleeps.length };
  };

  eq("sin respuesta a tiempo y después «ya es tuyo»: asignado", await run([new Error("sin respuesta en 15000 ms"), { ok: true, already: true }]), { kind: "assigned", error: null, calls: 2, sleeps: 1 });
  eq("409 TAKEN: ya no está, sin reintentar", await run([new HttpError("ya lo tomó otro chofer", 409, "TAKEN")]), { kind: "gone", error: "ya lo tomó otro chofer", calls: 1, sleeps: 0 });
  eq("sin red y después 409 EXPIRED: ya no está", await run([new Error("sin red"), new HttpError("la oferta venció", 409, "EXPIRED")]), { kind: "gone", error: "la oferta venció", calls: 2, sleeps: 1 });
  const html = new Error("Respuesta inesperada del servidor (200)");
  eq("HTML con 200 en los tres intentos: no se sabe", await run([html, html, html]), { kind: "unknown", error: "Respuesta inesperada del servidor (200)", calls: 3, sleeps: 2 });
  eq("502 y después asignado", await run([new HttpError("Bad Gateway", 502), { ok: true }]), { kind: "assigned", error: null, calls: 2, sleeps: 1 });
  eq("un solo intento (el del sondeo): sin red queda en «no se sabe»", (await acceptWithConfirm(90, async () => { throw new Error("sin red"); }, { tries: 1, sleep: async () => {} })).kind, "unknown");

  // Programados (promesa de ML para otro día): día, franja y que no se retire antes.
  const hora = (iso: string) => iso.slice(11, 16);
  const prog = { scheduled_date: "2026-11-04", window_start_at: "2026-11-04T11:00:00", deadline_at: "2026-11-04T13:00:00" };
  eq("programado para mañana: día y franja", programadoLabel(prog, "2026-11-03", hora), "Para mañana, miércoles 04/11, de 11:00 a 13:00");
  eq("programado para dentro de dos días: el día de la semana", programadoLabel(prog, "2026-11-02", hora), "Para miércoles 04/11, de 11:00 a 13:00");
  eq("sin inicio de franja: antes de la hora límite", programadoLabel({ ...prog, window_start_at: null }, "2026-11-03", hora), "Para mañana, miércoles 04/11, antes de las 13:00");
  eq("el día prometido ya no es programado", [programadoLabel(prog, "2026-11-04", hora), esProgramado(prog, "2026-11-04")], [null, false]);
  eq("una oferta de hoy (o sin fecha) no es programada", [programadoLabel({ scheduled_date: null }, "2026-11-03", hora), esProgramado({}, "2026-11-03")], [null, false]);
  eq("el cartel dice por qué no retirarlo", /app de Flex/.test(NO_RETIRAR_ANTES) && /entregarlo hoy/.test(NO_RETIRAR_ANTES), true);
  eq("plazo en segundos, minutos u horas", [plazoParaResponder(45), plazoParaResponder(119), plazoParaResponder(720), plazoParaResponder(48000), plazoParaResponder(7200), plazoParaResponder(0)],
    ["45 s para responder", "119 s para responder", "12 min para responder", "13 h 20 min para responder", "2 h para responder", "vencida"]);

  if (failed) { console.log(`\n${failed} prueba(s) fallaron`); process.exit(1); }
  console.log("\nTodas las pruebas pasaron");
})();
