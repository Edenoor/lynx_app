// Pruebas de baulPicker.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/baul-picker --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/picker/baulPicker.test.ts
//   node /tmp/baul-picker/baulPicker.test.js

import { cashItem, confirmErrorText, Obligation, obligationsOf, parcelResultText, parseArs, receiveRequest, startAmount } from "./baulPicker";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};
type Cash = Extract<Obligation, { kind: "cash" }>;
const asCash = (o: Obligation | undefined) => o as Cash;

// Criterio de terminado: el chofer llega con tres paquetes, un cambio y efectivo.
const DETAIL = {
  parcels: [
    { delivery_id: 1, tracking: "T1", lynx_code: null, store: "A", rsd_id: 11, kind: "NOT_DELIVERED" as const, declared_closure: "REENTREGA", attempted: true },
    { delivery_id: 2, tracking: "T2", lynx_code: null, store: "A", rsd_id: 12, kind: "NOT_DELIVERED" as const, declared_closure: "DEVOLUCION", attempted: true },
    { delivery_id: 3, tracking: null, lynx_code: "LP3", store: "B", rsd_id: null, kind: "CANCELLED" as const, declared_closure: null },
  ],
  items: [{ delivery_id: 4, tracking: "T4", lynx_code: null, store: "C", rsd_id: 14, closure: "CAMBIO", return_item: "remera M" }],
  cash: [{ delivery_id: 5, tracking: "T5", lynx_code: null, store: "D", rsd_id: 15, expected_amount: 12000, declared_amount: 12000, declared_method: "CASH" as const }],
  to_verify: [],
};
const obs = obligationsOf(DETAIL, 7);
eq("cinco obligaciones, una por cosa, en orden de mostrador", obs.map((o) => [o.kind, o.key]),
  [["parcel", "p1"], ["parcel", "p2"], ["parcel", "p3"], ["item", "i14"], ["cash", "c15"]]);
eq("todas del chofer del detalle", obs.every((o) => o.driverId === 7), true);
eq("referencia con lynx_code si no hay tracking", obs[2].ref, "LP3");
eq("reentrega dice que vuelve a su estantería", /estantería para reentregar/.test(obs[0].detail), true);
eq("devolución dice que vuelve a la tienda", /vuelve a la tienda/.test(obs[1].detail), true);
eq("cancelado no se reentrega", [obs[2].label, /no se reentrega/.test(obs[2].detail)], ["Paquete cancelado", true]);

// El picker recibe dos paquetes, el cambio y el dinero: un POST por cosa.
eq("paquete: POST parcels con delivery_id (sin destino: vale lo declarado)",
  receiveRequest(obs[0] as Exclude<Obligation, { kind: "cash" }>), { path: "/v2/baul/drivers/7/parcels", body: { delivery_id: 1 } });
eq("cambio: POST items con rsd_id", receiveRequest(obs[3] as Exclude<Obligation, { kind: "cash" }>), { path: "/v2/baul/drivers/7/items", body: { rsd_id: 14 } });
const cash = asCash(obs[4]);
eq("efectivo: arranca con lo declarado", startAmount(cash, "CASH"), "12000");
eq("efectivo justo: sin motivo", cashItem(cash, "CASH", "12.000", ""), { ok: true, item: { rsd_id: 15, method: "CASH", received_amount: 12000 } });

// Búsqueda por etiqueta: cada fila trae su chofer.
const lookup = obligationsOf({ parcels: [], items: [], to_verify: [], cash: [{ ...DETAIL.cash[0], driver_id: 9 }] });
eq("lookup: el chofer sale de la fila", lookup[0].driverId, 9);

// Cobranzas: lo recibido es explícito y una diferencia lleva motivo.
const undeclared = asCash(obligationsOf({ parcels: [], items: [], cash: [{ delivery_id: 6, tracking: "T6", lynx_code: null, store: null, rsd_id: 16, expected_amount: 8000, declared_amount: null, declared_method: null, provider_closed: true, outcome_by: "mercadolibre" }] }, 7)[0]);
eq("sin declarar: arranca vacío (nunca el esperado)", startAmount(undeclared, "CASH"), "");
eq("sin declarar cerrada por ML: lo dice", /sin declarar \(la cerró Mercado Libre\)/.test(undeclared.detail), true);
eq("transferencia: arranca vacía aunque haya declarado", startAmount(cash, "TRANSFER"), "");
eq("vacío no se manda", cashItem(cash, "CASH", "", "").ok, false);
eq("ilegible no se manda", cashItem(cash, "CASH", "1500.50", "").ok, false);
eq("transferencia en 0: queda pendiente", cashItem(cash, "TRANSFER", "0", "").ok ? "manda" : "no", "no");
const short = cashItem(cash, "CASH", "11.500", "");
eq("diferencia sin motivo no se manda", short.ok ? "" : /motivo/.test(short.error), true);
eq("diferencia con motivo lleva notes", cashItem(cash, "CASH", "11.500", "  faltan 500 "),
  { ok: true, item: { rsd_id: 15, method: "CASH", received_amount: 11500, notes: "faltan 500" } });
eq("transferencia acreditada", cashItem(cash, "TRANSFER", "12.000", ""), { ok: true, item: { rsd_id: 15, method: "TRANSFER", received_amount: 12000 } });
eq("importes a la argentina", [parseArs("1.234,56"), parseArs("1500"), parseArs(" $ 2.000 "), parseArs("")], [1234.56, 1500, 2000, null]);

// Retorno a verificar: sin nota de coordinación, se dice qué es (como la Web).
const verify = obligationsOf({ parcels: [], items: [], cash: [], to_verify: [
  { delivery_id: 8, tracking: "T8", lynx_code: null, store: null, rsd_id: 18, reverse_kind: "OTRO", reverse_note: null },
  { delivery_id: 9, tracking: "T9", lynx_code: null, store: null, rsd_id: 19, reverse_kind: "CAMBIO", reverse_note: "buzo" },
] }, 7) as Exclude<Obligation, { kind: "cash" }>[];
eq("verificar sin nota manda description", receiveRequest(verify[0]).body, { rsd_id: 18, description: "Otro pedido por coordinación" });
eq("verificar con nota manda solo rsd_id", receiveRequest(verify[1]).body, { rsd_id: 19 });

// Errores al confirmar.
eq("sin respuesta: recarga para ver si quedó", confirmErrorText({ status: 0, message: "" }).reload, true);
eq("ya rendida (otro picker): «ya estaba registrado» y recarga",
  confirmErrorText({ status: 409, message: "ya rendida, no es de este chofer o es de otro depósito: 15" }),
  { text: "Ya estaba registrado: ya rendida, no es de este chofer o es de otro depósito: 15", reload: true });
eq("cambio ya recibido", confirmErrorText({ status: 409, message: "eso ya se recibió" }).text.startsWith("Ya estaba registrado"), true);
eq("paquete ya recibido", confirmErrorText({ status: 409, message: "El envío 1 no está en el Baúl de ningún chofer (estado SHELVED)." }).reload, true);
eq("otro depósito: sin permiso, no recarga", confirmErrorText({ status: 403, message: "No podés" }), { text: "Sin permiso: No podés", reload: false });
eq("validación del servidor se muestra tal cual", confirmErrorText({ status: 400, message: "escribí el motivo" }), { text: "escribí el motivo", reload: false });

eq("resultado: para la tienda", parcelResultText({ destination: "TIENDA", shelf: null }), "Recibido: separalo para devolver a la tienda.");
eq("resultado: a su estantería", parcelResultText({ destination: "REPARTO", shelf: { code: "C3" } }), "Recibido: va a la estantería C3.");

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
