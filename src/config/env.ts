// src/Config/env.ts
import Constants from "expo-constants";

type Extra = {
  EXPO_PUBLIC_API_URL?: string;
  EXPO_PUBLIC_GOOGLE_MAPS_KEY?: string;
};

const extra = (Constants.expoConfig?.extra ??
  (Constants as any).manifest?.extra ??
  {}) as Extra;

function pick(...values: Array<string | undefined | null>) {
  for (const v of values) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return "";
}

export const ENV = {
  API_BASE_URL: pick(process.env.EXPO_PUBLIC_API_URL, extra.EXPO_PUBLIC_API_URL),
  GOOGLE_MAPS_KEY: pick(
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY,
    extra.EXPO_PUBLIC_GOOGLE_MAPS_KEY
  ),
};

// Fail-fast en dev (te evita “anda en mi máquina”)
if (__DEV__) {
  if (!ENV.API_BASE_URL) {
    throw new Error(
      "[ENV] Falta EXPO_PUBLIC_API_URL. Definilo en .env o en app.config.ts (extra)."
    );
  }
}
