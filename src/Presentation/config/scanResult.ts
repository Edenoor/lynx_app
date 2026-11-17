// src/Presentation/config/scanResult.ts
// Los tres resultados de una lectura, iguales en todos los escáneres
// (Planta, Asignarme, Colecta, recepción del Picker y Baúl):
// - success: el servidor hizo lo pedido. Verde, bip de éxito y vibración corta.
// - duplicate: ya estaba hecho. Amarillo, sin bip de error, no suma a los
//   contadores y no frena el escáner.
// - error: no se hizo, no se puede o no se sabe si se hizo. Rojo, bip de error.
// Cada operación decide su clase con su propio contrato (un campo concreto de
// la respuesta, nunca «todo 409»); acá solo está la señal que corresponde.
// Sin React Native: se prueba con node.

export type ScanKind = "success" | "duplicate" | "error";

export type ScanSignal = { sound: "success" | "error" | null; vibration: number[] };

const SIGNALS: Record<ScanKind, ScanSignal> = {
  success: { sound: "success", vibration: [0, 80, 60, 120] },
  duplicate: { sound: null, vibration: [0, 60, 80, 60] },
  error: { sound: "error", vibration: [0, 250, 100, 250] },
};

// Éxito con avisos (por ejemplo, otra estantería sugerida): vibra distinto
// para que se mire la pantalla, con el mismo bip de éxito.
const WARNED_VIBRATION = [0, 120, 80, 120];

export function scanSignal(kind: ScanKind, warned = false): ScanSignal {
  const signal = SIGNALS[kind];
  return kind === "success" && warned ? { ...signal, vibration: WARNED_VIBRATION } : signal;
}
