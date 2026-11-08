// Pruebas de chatView.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/chat-view --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/driver/chat/chatView.test.ts
//   node /tmp/chat-view/chatView.test.js

import { chatRows, countLabel, listTime, mergeMessages, messageTime, newestId, previewOf, showAuthor } from "./chatView";
import type { ChatConversation, ChatMessage } from "./chatApi";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

const conv = (id: number, kind: "direct" | "news", last?: string): ChatConversation => ({
  id,
  channel: { id: id * 10, name: `Canal ${id}`, kind, assistant_line: false },
  role: kind === "news" ? "audience" : "subject",
  title: `Canal ${id}`,
  can_write: kind !== "news",
  last_message: last ? { id: 1, body: last, author_name: "Ana", created_at: "2026-11-07T12:00:00Z" } : null,
  unread: 0,
});

const msg = (id: number, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id, kind: "text", body: `m${id}`, created_at: "2026-11-07T12:00:00Z", author: { id: 5, name: "Ana" }, mine: false, from_team: true, ...extra,
});

// Lista: asistente, charlas propias, canales para iniciar, novedades
eq("sin datos: solo el asistente", chatRows(null).map((r) => r.key), ["assistant"]);
eq(
  "orden de la lista",
  chatRows({
    conversations: [conv(1, "news", "hola"), conv(2, "direct", "che"), conv(3, "direct")],
    startable: [{ id: 7, name: "Administración" }],
    unread_total: 0,
  }).map((r) => r.key),
  ["assistant", "c2", "c3", "s7", "c1"],
);
eq("vista previa", [previewOf(conv(1, "direct", "che")), previewOf(conv(2, "direct")), previewOf(conv(3, "news"))], ["che", "Sin mensajes todavía", "Sin novedades todavía"]);
eq("contador", [countLabel(3), countLabel(99), countLabel(150)], ["3", "99", "99+"]);

// Horas, con fechas locales (no dependen de la zona del equipo que corre la prueba)
const now = new Date(2026, 10, 7, 15, 30);
const at = (d: number, h: number, m: number, y = 2026, mo = 10) => new Date(y, mo, d, h, m).toISOString();
eq("lista: hoy, ayer, este año, otro año", [listTime(at(7, 9, 5), now), listTime(at(6, 23, 59), now), listTime(at(1, 8, 0), now), listTime(at(30, 8, 0, 2025, 11), now)], ["9:05", "ayer", "01/11", "30/12/25"]);
eq("lista: primero de mes, ayer es fin del anterior", listTime(at(31, 22, 0, 2026, 9), new Date(2026, 10, 1, 8, 0)), "ayer");
eq("mensaje: hoy, ayer, otro día", [messageTime(at(7, 14, 2), now), messageTime(at(6, 10, 0), now), messageTime(at(3, 8, 45), now)], ["14:02", "ayer 10:00", "03/11 8:45"]);
eq("fecha inválida", [listTime("x", now), messageTime("", now)], ["", ""]);

// Mensajes: sin repetir, en orden; lo nuevo pisa lo viejo
eq("merge", mergeMessages([msg(1), msg(3)], [msg(3, { body: "nuevo" }), msg(2), msg(4)]).map((m) => [m.id, m.body]), [[1, "m1"], [2, "m2"], [3, "nuevo"], [4, "m4"]]);
eq("newestId", [newestId([msg(1), msg(9)]), newestId([])], [9, null]);

// Autor visible
eq("autor: del equipo en charla de a uno", showAuthor(msg(1), "direct"), true);
eq("autor: lo propio no", showAuthor(msg(1, { mine: true }), "news"), false);
eq("autor: novedades, cualquiera", showAuthor(msg(1, { from_team: false }), "news"), true);
eq("autor: sin autor (sistema)", showAuthor(msg(1, { author: null }), "direct"), false);

if (failed) { console.log(`\n${failed} pruebas fallaron`); process.exit(1); }
console.log("\nTodas las pruebas pasaron");
