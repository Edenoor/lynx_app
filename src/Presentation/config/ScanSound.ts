// src/Presentation/config/ScanSound.ts
// Sonido y vibración de resultado para todos los escáneres (Driver y Picker).
// Se llama con el resultado REAL de la operación, nunca al detectar un QR:
// éxito solo si el servidor la aceptó; duplicado si ya estaba hecha (sin bip
// de error); error si la rechazó, si el QR no sirve o si no hubo respuesta.
// Las lecturas repetidas de la cámara ya las filtra el escáner.

import { Vibration } from "react-native";
import { playTone } from "../../../modules/lynx-tones";
import { ScanKind, scanSignal } from "./scanResult";

export const playScanSuccess = () => playTone("success");
export const playScanError = () => playTone("error");

export function signalScan(kind: ScanKind, warned = false) {
  const { sound, vibration } = scanSignal(kind, warned);
  Vibration.vibrate(vibration);
  if (sound) playTone(sound);
}
