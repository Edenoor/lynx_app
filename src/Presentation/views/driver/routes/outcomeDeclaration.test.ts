// Pruebas de outcomeDeclaration.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/decl --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/routes/outcomeDeclaration.ts src/Presentation/views/driver/routes/outcomeDeclaration.test.ts
//   node /tmp/decl/outcomeDeclaration.test.js

import { buildDeclaration, cobranzaOf, emptyDraft, formatAmountAr, OutcomeDraft, parseAmountAr } from "./outcomeDeclaration";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};
const value = (raw: string) => { const r = parseAmountAr(raw); return r.ok ? r.value : "error"; };
const draft = (p: Partial<OutcomeDraft>): OutcomeDraft => ({ ...emptyDraft(), ...p });

// Importe es-AR
eq("vacío = sin importe", value(""), null);
eq("solo espacios", value("   "), null);
eq("1500", value("1500"), 1500);
eq("1.500", value("1.500"), 1500);
eq("1.234,56", value("1.234,56"), 1234.56);
eq("1234,5", value("1234,5"), 1234.5);
eq("$ 1.500", value("$ 1.500"), 1500);
eq("1.000.000", value("1.000.000"), 1000000);
eq("0", value("0"), 0);
eq("0,50", value("0,50"), 0.5);
eq("negativo", value("-100"), "error");
// Punto como separador decimal (teclados que solo ofrecen «.»): un punto
// seguido de 1 o 2 dígitos son centavos; de 3, miles.
eq("punto decimal 1500.50", value("1500.50"), 1500.5);
eq("punto decimal 1500.5", value("1500.5"), 1500.5);
eq("punto decimal 12.50", value("12.50"), 12.5);
eq("punto decimal 0.5", value("0.5"), 0.5);
eq("1.50 = 1,50", value("1.50"), 1.5);
eq("1.500 siguen siendo miles", value("1.500"), 1500);
eq("1.234,56 sigue igual", value("1.234,56"), 1234.56);
eq("miles y punto decimal mezclados", value("1.234.56"), "error");
eq("miles con punto decimal al final", value("1.500.5"), "error");
eq("punto con 4 dígitos", value("1.5000"), "error");
eq("grupo de 3 tras 4 dígitos", value("1500.505"), "error");
eq("formato de EE.UU.", value("1,500.50"), "error");
eq("punto y coma", value("1.5,00"), "error");
eq("punto suelto al final", value("1500."), "error");
eq("sin parte entera con punto", value(".5"), "error");
eq("dos puntos decimales", value("1.5.5"), "error");
eq("tres decimales", value("1,234"), "error");
eq("letras", value("abc"), "error");
eq("dos comas", value("1,2,3"), "error");
eq("coma suelta", value("1.500,"), "error");
eq("sin parte entera", value(",50"), "error");
eq("tope", value("100.000.001"), "error");
eq("en el tope", value("100.000.000"), 100000000);

// Formato
eq("formato 1500", formatAmountAr(1500), "1.500");
eq("formato 1234.5", formatAmountAr(1234.5), "1.234,50");
eq("formato 0", formatAmountAr(0), "0");
eq("ida y vuelta", value(formatAmountAr(98765.43)), 98765.43);

// Cobranza que manda el servidor
eq("cobranza texto", cobranzaOf("2500.00"), 2500);
eq("cobranza 0 = sin cobranza", cobranzaOf(0), null);
eq("cobranza null", cobranzaOf(null), null);
eq("cobranza basura", cobranzaOf("x"), null);

// Declaración
eq("entregado sin nada", buildDeclaration("DELIVERED", emptyDraft()), { ok: true, declaration: {} });
eq("no entregado sin nada", buildDeclaration("NOT_DELIVERED", emptyDraft()), { ok: true, declaration: {} });
eq("cobro completo", buildDeclaration("DELIVERED", draft({ paymentMethod: "CASH", amountText: "1.234,56" })),
  { ok: true, declaration: { payment_method: "CASH", collected_amount: 1234.56 } });
eq("solo medio", buildDeclaration("DELIVERED", draft({ paymentMethod: "TRANSFER" })), { ok: true, declaration: { payment_method: "TRANSFER" } });
eq("importe inválido frena", buildDeclaration("DELIVERED", draft({ paymentMethod: "CASH", amountText: "12.5000" })).ok, false);
eq("punto decimal viaja como número", buildDeclaration("DELIVERED", draft({ paymentMethod: "TRANSFER", amountText: "1500.50" })),
  { ok: true, declaration: { payment_method: "TRANSFER", collected_amount: 1500.5 } });
// Sin medio de pago no se declara cobro: la cobranza precargada no viaja sola.
eq("cobranza precargada sin medio no declara cobro", buildDeclaration("DELIVERED", draft({ amountText: "2.500" })), { ok: true, declaration: {} });
eq("importe escrito sin medio no viaja", buildDeclaration("DELIVERED", draft({ amountText: "1.234,56" })), { ok: true, declaration: {} });
eq("importe inválido sin medio no frena", buildDeclaration("DELIVERED", draft({ amountText: "basura" })), { ok: true, declaration: {} });
eq("medio con cobranza precargada", buildDeclaration("DELIVERED", draft({ paymentMethod: "CASH", amountText: "2.500" })),
  { ok: true, declaration: { payment_method: "CASH", collected_amount: 2500 } });
eq("cambio sin qué trae frena", buildDeclaration("DELIVERED", draft({ returnKind: "CAMBIO", returnItem: "  " })),
  { ok: false, error: "Contá qué traés de vuelta" });
eq("cambio con qué trae", buildDeclaration("DELIVERED", draft({ returnKind: "CAMBIO", returnItem: " zapatillas talle 40 " })),
  { ok: true, declaration: { closure: "CAMBIO", return_item: "zapatillas talle 40" } });
eq("texto sin tipo no viaja", buildDeclaration("DELIVERED", draft({ returnItem: "algo" })), { ok: true, declaration: {} });
eq("qué trae se corta en 500", (buildDeclaration("DELIVERED", draft({ returnKind: "RECUPERO", returnItem: "x".repeat(600) })) as any).declaration.return_item.length, 500);
eq("devolución", buildDeclaration("NOT_DELIVERED", draft({ destination: "DEVOLUCION" })), { ok: true, declaration: { closure: "DEVOLUCION" } });
eq("no entregado ignora cobro y vuelta",
  buildDeclaration("NOT_DELIVERED", draft({ paymentMethod: "CASH", amountText: "basura", returnKind: "CAMBIO", returnItem: "x", destination: "CANCELACION" })),
  { ok: true, declaration: { closure: "CANCELACION" } });
eq("entregado ignora destino", buildDeclaration("DELIVERED", draft({ destination: "DEVOLUCION" })), { ok: true, declaration: {} });

console.log(failed ? `\n${failed} pruebas fallaron` : "\nTodas las pruebas pasaron");
if (failed) throw new Error(`${failed} pruebas fallaron`);
