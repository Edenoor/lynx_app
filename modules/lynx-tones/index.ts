// Bips nativos de Android (ToneGenerator). En un build sin el módulo, o fuera
// de Android, no hace nada.

import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

type NativeModule = { play(kind: "success" | "error"): boolean };

const native = Platform.OS === "android" ? requireOptionalNativeModule<NativeModule>("LynxTones") : null;

export const playTone = (kind: "success" | "error") => {
  try {
    native?.play(kind);
  } catch {
    // Un fallo de audio nunca interrumpe el escaneo.
  }
};
