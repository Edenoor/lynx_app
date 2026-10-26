// src/Presentation/config/ScanSound.ts
// Sonido de resultado para todos los escáneres (Driver y Picker). Se llama
// con el resultado REAL de la operación, nunca al detectar un QR: éxito solo
// si el servidor la aceptó; error si la rechazó, si el QR no sirve o si no
// hubo respuesta. Las lecturas repetidas ya las filtra el escáner.

import { playTone } from "../../../modules/lynx-tones";

export const playScanSuccess = () => playTone("success");
export const playScanError = () => playTone("error");
