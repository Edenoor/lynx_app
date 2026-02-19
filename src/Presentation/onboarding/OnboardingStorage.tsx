import * as FileSystem from "expo-file-system/legacy";
import { CapturedFile } from "./types";

const BASE_DIR = `${FileSystem.documentDirectory}onboarding/`;

export async function ensureOnboardingDir() {
  const dirInfo = await FileSystem.getInfoAsync(BASE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(BASE_DIR, { intermediates: true });
  }
}

export async function persistCapture(
  sourceUri: string,
  fileName: string
): Promise<{ uri: string }> {
  await ensureOnboardingDir();

  const targetUri = `${BASE_DIR}${fileName}`;
  // sobreescribe si existe
  try {
    await FileSystem.deleteAsync(targetUri, { idempotent: true });
  } catch {}
  await FileSystem.copyAsync({ from: sourceUri, to: targetUri });

  return { uri: targetUri };
}

export async function clearOnboardingDir() {
  try {
    await FileSystem.deleteAsync(BASE_DIR, { idempotent: true });
  } catch {}
}
