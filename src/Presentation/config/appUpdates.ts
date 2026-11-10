// Actualizaciones OTA (EAS Update). La app no decide nada en JS: el módulo
// nativo de expo-updates busca al abrir (checkOnLaunch ALWAYS), arranca sin
// esperar con lo que ya tiene (LAUNCH_WAIT_MS 0), descarga en segundo plano y
// aplica la actualización recién en el próximo arranque en frío. Nunca se llama
// a reloadAsync: una entrega, colecta o escaneo en curso no se interrumpe.
// Ver docs/EAS_UPDATES.md.

import Constants from "expo-constants";
import * as Updates from "expo-updates";

// Qué está corriendo, para soporte: versión nativa, canal, actualización y
// runtime (el fingerprint de la APK; una OTA solo llega si coincide).
export function appUpdateLabel(): string {
  const version = Constants.expoConfig?.version ?? "?";
  if (!Updates.isEnabled) return `Lynx ${version} · desarrollo`;
  const running = Updates.isEmbeddedLaunch ? "versión instalada" : `actualización ${(Updates.updateId ?? "").slice(0, 8)}`;
  const recovery = Updates.isEmergencyLaunch ? " · recuperada" : "";
  const runtime = (Updates.runtimeVersion ?? "?").slice(0, 8);
  return `Lynx ${version} · ${Updates.channel ?? "sin canal"} · ${running}${recovery} · runtime ${runtime}`;
}
