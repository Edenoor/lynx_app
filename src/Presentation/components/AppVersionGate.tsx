// src/Presentation/components/AppVersionGate.tsx
//
// Versión mínima. El servidor informa en GET /v2/utils/app-version la versión
// más vieja que acepta (APP_MIN_VERSION); si la de esta app es menor, se
// bloquea con un aviso para actualizar. Se consulta al abrir y al volver a
// primer plano. Si el servidor no responde o no tiene la ruta, la app sigue:
// este control no puede dejar a nadie afuera por un problema de red.
//
// La versión es la de app.json (`expo.version`): hay que subirla en cada APK.

import React, { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";

import { API_URL } from "../config/Api";
import { AppTheme } from "../theme/AppTheme";

const CHECK_TIMEOUT_MS = 8_000;

const parts = (version: string) => version.split(".").map((n) => parseInt(n, 10) || 0);

export const isOlderVersion = (version: string, min: string) => {
  const a = parts(version);
  const b = parts(min);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff < 0;
  }
  return false;
};

type Required = { min: string; updateUrl: string | null };

const fetchRequired = async (current: string): Promise<Required | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/v2/utils/app-version`, { signal: controller.signal });
    if (!res.ok) return null;
    const json = await res.json();
    const min = typeof json?.min === "string" && json.min ? json.min : null;
    if (!min || !isOlderVersion(current, min)) return null;
    return { min, updateUrl: typeof json?.updateUrl === "string" && json.updateUrl ? json.updateUrl : null };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

export const AppVersionGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  const current = Constants.expoConfig?.version ?? null;
  const [required, setRequired] = useState<Required | null>(null);

  const check = useCallback(async () => {
    if (!current) return;
    setRequired(await fetchRequired(current));
  }, [current]);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => sub.remove();
  }, [check]);

  if (!required) return <>{children}</>;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Actualizá Lynx</Text>
      <Text style={styles.body}>
        Esta versión de la app ({current}) ya no se puede usar. Instalá la {required.min} o una más nueva para seguir.
      </Text>
      {required.updateUrl ? (
        <Pressable style={styles.button} onPress={() => Linking.openURL(required.updateUrl!)}>
          <Text style={styles.buttonText}>Descargar la nueva versión</Text>
        </Pressable>
      ) : (
        <Text style={styles.body}>Pedile el link de descarga a tu coordinador.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: 32,
    gap: 16,
    backgroundColor: AppTheme.surfaces.screen,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: AppTheme.text.primary,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    color: AppTheme.text.secondary,
  },
  button: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: AppTheme.colors.primary,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
