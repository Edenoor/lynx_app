// Sesión del usuario (incluye el JWT) en SecureStore, cifrada con el Keystore
// de Android y excluida de los backups (secure_store_backup_rules.xml).
// Antes vivía en AsyncStorage, en claro y con backup habilitado.
//
// La lee también la tarea de GPS en segundo plano con la pantalla bloqueada:
// por eso AFTER_FIRST_UNLOCK (en iOS el default solo deja leer desbloqueado).

import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "user";
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

// Una sesión guardada por una versión anterior de la app sigue en AsyncStorage:
// se mueve a SecureStore la primera vez que se lee, así el chofer no tiene que
// volver a loguearse al actualizar.
//
// - Si SecureStore falla, se devuelve igual la sesión vieja (y queda en
//   AsyncStorage para reintentar la próxima vez): mejor seguir logueado sin
//   cifrar un rato que echar al chofer.
// - En el primer arranque leen la sesión a la vez la app y la tarea de GPS:
//   comparten una sola migración en curso, porque si no la segunda lectura
//   llega después de que la primera borró la copia vieja y desloguea.
let migrating: Promise<string | null> | null = null;

const migrateLegacySession = (): Promise<string | null> => {
  if (!migrating) {
    migrating = doMigrateLegacySession().finally(() => {
      migrating = null;
    });
  }
  return migrating;
};

const doMigrateLegacySession = async (): Promise<string | null> => {
  let legacy: string | null;
  try {
    legacy = await AsyncStorage.getItem(KEY);
  } catch (error) {
    if (__DEV__) console.log("[Lynx Auth] No se pudo leer la sesión guardada:", error);
    return null;
  }
  if (!legacy) return null;

  try {
    await SecureStore.setItemAsync(KEY, legacy, OPTIONS);
  } catch (error) {
    if (__DEV__) console.log("[Lynx Auth] No se pudo migrar la sesión guardada:", error);
    return legacy;
  }

  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Queda una copia vieja; removeSession la borra igual al cerrar sesión.
  }
  return legacy;
};

export const readSession = async (): Promise<string | null> => {
  try {
    const stored = await SecureStore.getItemAsync(KEY, OPTIONS);
    if (stored) return stored;
  } catch (error) {
    if (__DEV__) console.log("[Lynx Auth] No se pudo leer la sesión:", error);
    return null;
  }
  return migrateLegacySession();
};

export const saveSession = async (value: string) => {
  try {
    await SecureStore.setItemAsync(KEY, value, OPTIONS);
  } catch (error) {
    if (__DEV__) console.log("[Lynx Auth] No se pudo guardar la sesión:", error);
  }
};

export const removeSession = async () => {
  try {
    await SecureStore.deleteItemAsync(KEY, OPTIONS);
  } catch (error) {
    if (__DEV__) console.log("[Lynx Auth] No se pudo borrar la sesión:", error);
  }
  // Por si quedó una copia de una versión anterior.
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // nada que hacer
  }
};
