// Pruebas de collectionLabels.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/labels --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/routes/collectionLabels.ts src/Presentation/views/driver/routes/collectionLabels.test.ts
//   node /tmp/labels/collectionLabels.test.js

import { collectionKindLabel, collectionName, confirmationNoticeText, directionsUrl, executionDayLabel } from "./collectionLabels";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

// Día de la colecta, contra la fecha del teléfono al mostrarlo
eq("hoy", executionDayLabel("2026-10-26", "2026-10-26"), "hoy, lunes 26/10");
eq("mañana", executionDayLabel("2026-10-27", "2026-10-26"), "mañana, martes 27/10");
eq("otro día", executionDayLabel("2026-10-29", "2026-10-26"), "jueves 29/10");
eq("ayer: sin «hoy» ni «mañana»", executionDayLabel("2026-10-25", "2026-10-26"), "domingo 25/10");
eq("cambio de mes", executionDayLabel("2026-11-01", "2026-10-31"), "mañana, domingo 01/11");
eq("fecha con hora (se toma el día)", executionDayLabel("2026-10-27T00:00:00.000Z", "2026-10-26"), "mañana, martes 27/10");
eq("fecha inválida", executionDayLabel("x", "2026-10-26"), "");

// Nombre y tipo
eq("habitual con nombre", [collectionName({ id: 4, template_name: "MAÑANERO 02" }), collectionKindLabel({ template_id: 2 })], ["MAÑANERO 02", "Habitual"]);
eq("extraordinaria sin nombre", [collectionName({ id: 9, template_name: null }), collectionKindLabel({ template_id: null })], ["Colecta #9", "Extraordinaria"]);

// Aviso de confirmación: sin «Ronda», con la fecha exacta y recalculado al verlo
const data = { routeId: 4, scheduled_date: "2026-10-27", departure_time: "09:00:00", template_name: "MAÑANERO 02", stops_count: 3 };
eq("aviso la noche anterior", confirmationNoticeText(data, "2026-10-26"), {
  title: "Confirmá tu colecta MAÑANERO 02",
  body: "Mañana, martes 27/10 · sale 09:00 · 3 tiendas. Confirmá desde Colectas si podés hacerla.",
});
eq("el mismo aviso visto al otro día dice hoy", confirmationNoticeText(data, "2026-10-27").body.startsWith("Hoy, martes 27/10"), true);
eq("una tienda", confirmationNoticeText({ ...data, stops_count: 1 }, "2026-10-26").body.includes("1 tienda."), true);
eq("sin datos", confirmationNoticeText({}, "2026-10-26"), { title: "Confirmá tu colecta", body: "Confirmá desde Colectas si podés hacerla." });
eq("nunca dice ronda", /ronda/i.test(JSON.stringify(confirmationNoticeText(data, "2026-10-26"))), false);

// Cómo llegar
eq("por coordenadas (pg las manda como texto)", directionsUrl({ latitude: "-31.4201", longitude: "-64.1888", address: "Arcadini 4464" }), "https://www.google.com/maps/dir/?api=1&destination=-31.4201,-64.1888");
eq("sin coordenadas: por dirección", directionsUrl({ latitude: null, longitude: null, address: "Arcadini 4464, Córdoba" }), "https://www.google.com/maps/dir/?api=1&destination=Arcadini%204464%2C%20C%C3%B3rdoba");
eq("coordenadas 0,0: por dirección", directionsUrl({ latitude: 0, longitude: 0, address: "Arcadini 4464" }), "https://www.google.com/maps/dir/?api=1&destination=Arcadini%204464");
eq("sin nada", directionsUrl({ latitude: null, longitude: null, address: "  " }), null);

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
