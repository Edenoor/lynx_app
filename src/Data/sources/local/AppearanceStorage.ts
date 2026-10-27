// Preferencias de apariencia del dispositivo, no de la cuenta: quedan al cerrar
// sesión. Van en AsyncStorage porque no son datos sensibles. El contenido lo
// valida quien lo lee (normalizeAppearance): acá solo se guarda y se lee JSON.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "lynx.appearance";

// null si no hay nada guardado, no se pudo leer o no es JSON válido.
export async function loadAppearance(): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveAppearance(value: object): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(value));
}
