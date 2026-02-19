import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "lynx_onboarding_completed:";

function keyFor(userKey: string) {
  return `${KEY_PREFIX}${userKey}`;
}

export async function saveOnboardingCompleted(
  userKey: string,
  value: boolean
): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userKey), value ? "true" : "false");
  } catch (e) {
    console.warn("Error saving onboarding state", e);
  }
}

export async function loadOnboardingCompleted(userKey: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(keyFor(userKey));
    return v === "true";
  } catch (e) {
    console.warn("Error loading onboarding state", e);
    return false;
  }
}

export async function clearOnboardingCompleted(userKey: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userKey));
  } catch (e) {
    console.warn("Error clearing onboarding state", e);
  }
}

/** Opcional: útil para testing */
export async function clearAllOnboardingCompleted(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(KEY_PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch (e) {
    console.warn("Error clearing all onboarding states", e);
  }
}
