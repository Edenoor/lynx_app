// Pruebas de offerInbox.ts (bandeja de ofertas). Sin Jest: tsc + node.
//   npx tsc --outDir /tmp/offer-inbox --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/offers/offerInbox.test.ts
//   node /tmp/offer-inbox/offers/offerInbox.test.js

import { buildInbox, offerNoticeText, pendingOffers, routeOfferTitle, visibleTurboOffers } from "./offerInbox";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

const t = (route_id: number, expires_local: number, group_id: number | null = null) => ({ route_id, group_id, expires_local });
const r = (route_id: number, expires_local: number, deliveries = 4) =>
  ({ id: route_id, route_id, kind: "ADMIN", scheduled_date: null, expires_at: "", seconds_left: 0, deliveries, expires_local });

// 1) Una sola lista: Turbos, lotes y recorridos, lo que vence primero arriba.
{
  const items = buildInbox([t(90, 300), t(91, 50, 7), t(92, 400, 7), t(93, 100)], [r(77, 80), r(78, 1000)]);
  eq("orden por vencimiento; el lote vence con su primer Turbo", items.map((i) => i.key), ["lote-7", "route-77", "turbo-93", "turbo-90", "route-78"]);
  const lote = items[0];
  eq("el lote junta sus Turbos", lote.kind === "lote" ? lote.offers.map((o) => o.route_id) : null, [91, 92]);
}
eq("sin ofertas: vacía", buildInbox([], []), []);

// 2) Contador: un lote cuenta una vez (se acepta entero).
eq("contador: 2 sueltos + 1 lote + 2 recorridos", pendingOffers([{ group_id: null }, { group_id: null }, { group_id: 7 }, { group_id: 7 }], [{}, {}]), 5);
eq("contador en cero", pendingOffers([], []), 0);

// 3) Textos.
eq("título de recorrido ofrecido", [routeOfferTitle(r(77, 0) as any), routeOfferTitle(r(78, 0, 1) as any)], ["Recorrido #77 · 4 envíos", "Recorrido #78 · 1 envío"]);
eq("aviso Turbo con tienda", offerNoticeText("TURBO_OFFER", { storeName: " Tienda Uno " }), { title: "Turbo disponible", body: "Tienda Uno. El primero que acepta se lo queda." });
eq("aviso Turbo sin tienda", offerNoticeText("TURBO_OFFER", null).body, "El primero que acepta se lo queda.");
eq("aviso de recorrido ofrecido", offerNoticeText("ROUTE_OFFER").title, "Te ofrecieron un recorrido");

eq("sin habilitación Turbo no se muestran ofertas Turbo", visibleTurboOffers([{ route_id: 1 }], false), []);
eq("habilitado o sin dato: se muestran", [visibleTurboOffers([{ route_id: 1 }], true).length, visibleTurboOffers([{ route_id: 1 }], null).length], [1, 1]);

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
