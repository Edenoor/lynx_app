// Pruebas de feedbackContext.ts y ui/pictureSize.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/feedback --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/views/common/feedback/feedbackContext.test.ts
//   node /tmp/feedback/views/common/feedback/feedbackContext.test.js

import {
  base64Bytes, buildPage, canSend, checkPhoto, MAX_MESSAGE, MAX_PHOTO_BYTES, originScreen, rememberScreen, viewportOf,
} from "./feedbackContext";
import { pickPictureSize } from "../../../ui/pictureSize";

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (esperaba ${JSON.stringify(want)})`}`);
};

// Contrato: tipo obligatorio y mensaje de 3 a 2000 caracteres (sin contar espacios de los bordes).
eq("sin tipo no se manda", canSend(null, "Se cortó la cámara"), false);
eq("menos de 3 caracteres no se manda", canSend("ERROR", "  ab  "), false);
eq("3 caracteres alcanzan", canSend("SUGERENCIA", "abc"), true);
eq("2000 caracteres alcanzan", canSend("ERROR", "x".repeat(MAX_MESSAGE)), true);
eq("más de 2000 no", canSend("ERROR", "x".repeat(MAX_MESSAGE + 1)), false);

// page: origen, área, pantalla, versión y teléfono; sin datos personales.
const app = "Lynx 1.1.1 · production · versión instalada · runtime aae3475b";
eq(
  "page completo del chofer",
  buildPage({ area: "driver", screen: "DriverScanScreen", app, os: "14", model: "samsung SM-A155M" }),
  "Mobile · Driver · pantalla DriverScanScreen · Lynx 1.1.1 · production · versión instalada · runtime aae3475b · Android 14 · samsung SM-A155M",
);
eq("page del Picker sin pantalla ni teléfono conocidos", buildPage({ area: "picker", screen: null, app, os: null, model: "" }), `Mobile · Picker · ${app}`);
eq("page no pasa de 500 caracteres", buildPage({ area: "driver", screen: "S".repeat(600), app }).length, 500);
const page = buildPage({ area: "driver", screen: "RouteDetailScreen", app, os: "13", model: "motorola moto g54" });
eq("page sin token ni email", /eyJ|@|token|Bearer/i.test(page), false);

eq("viewport redondeado", viewportOf(411.43, 914.29), "411x914");
eq("viewport no pasa de 20", viewportOf(1e12, 1e12).length <= 20, true);

// Foto: el servidor mide la imagen decodificada (2 MB).
eq("bytes de base64 sin relleno", base64Bytes("QUJD"), 3);
eq("bytes con un =", base64Bytes("QUI="), 2);
eq("bytes con ==", base64Bytes("QQ=="), 1);
eq("bytes ignora saltos de línea", base64Bytes("QU\nJD"), 3);
const exact = "A".repeat((MAX_PHOTO_BYTES / 3) * 4 + 4); // un poco más de 2 MB
eq("foto de más de 2 MB se rechaza", checkPhoto(exact).ok, false);
const fits = "A".repeat(Math.floor(MAX_PHOTO_BYTES / 3) * 4);
eq("foto justo debajo de 2 MB se acepta", checkPhoto(fits).ok, true);
const small = checkPhoto("/9j/4AAQ");
eq("foto aceptada como data URL JPEG", small.ok && small.dataUrl.startsWith("data:image/jpeg;base64,/9j/"), true);
eq("foto vacía se rechaza", checkPhoto("").ok, false);

// Resolución pedida a la cámara.
eq("la más grande que entra en 1600", pickPictureSize(["4000x3000", "1920x1080", "1600x1200", "1280x720", "640x480"], 1600), "1600x1200");
eq("lado mayor vertical también cuenta", pickPictureSize(["1200x1600", "1080x1920"], 1600), "1200x1600");
eq("si ninguna entra, la más chica", pickPictureSize(["4000x3000", "1920x1080"], 1600), "1920x1080");
eq("sin datos, la de la cámara", pickPictureSize([], 1600), null);
eq("ignora valores raros", pickPictureSize(["High", "1280x720"], 1600), "1280x720");

// Pantalla de origen: la última de trabajo; no cuentan el formulario ni desde dónde se abre.
const driver = (...names: string[]) => ({ index: 0, routes: [{ name: "DriverStack", state: { index: names.length - 1, routes: names.map((name) => ({ name })) } }] });
rememberScreen(driver("DriverScreen", "DriverScanScreen"));
eq("anota la pantalla con foco", originScreen(), "DriverScanScreen");
rememberScreen(driver("DriverAccountScreen"));
rememberScreen(driver("DriverAccountScreen", "FeedbackScreen"));
rememberScreen(driver("DriverAccountScreen", "FeedbackScreen", "FeedbackPhotoScreen"));
eq("Mi cuenta, el formulario y la foto no la pisan", originScreen(), "DriverScanScreen");
rememberScreen({ index: 0, routes: [{ name: "PickerStack", state: { index: 0, routes: [{ name: "PickerHomeScreen" }] } }] });
eq("otra área (otra sesión) la olvida", originScreen(), null);

if (failed) {
  console.log(`\n${failed} pruebas fallaron`);
  process.exit(1);
}
console.log("\nTodas las pruebas pasaron");
