// src/Presentation/views/picker/pickerUi.tsx
// Piezas comunes de las pantallas del Picker: encabezado, carga de una
// consulta al entrar o volver a la pantalla, y los mensajes de una lista.

import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import AppTheme from "../../theme/AppTheme";
import { loadErrorMessage } from "./warehouseApi";

// "Warehouse #12" o, si no se pudo ver el ID, el asignado (el servidor opera
// igual sobre ese).
export const warehouseLabel = (id: number | null | undefined) =>
  id ? `Warehouse #${id}` : "Warehouse asignado a tu usuario";

export const shortDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;

type HeaderProps = {
  title: string;
  subtitle?: string | null;
  onBack: () => void;
  onScan?: () => void;
};

export function PickerHeader({ title, subtitle, onBack, onScan }: HeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Ionicons name="arrow-back" size={26} color={AppTheme.text.primary} />
      </Pressable>
      <View style={styles.titles}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {onScan ? (
        <Pressable style={styles.scan} onPress={onScan} hitSlop={8}>
          <Ionicons name="scan-outline" size={18} color={AppTheme.colors.white} />
          <Text style={styles.scanText}>Escanear</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Consulta que se hace al entrar a la pantalla y cada vez que se vuelve a
// ella (por ejemplo, después de reubicar un paquete en el escáner); nunca
// por intervalo. `fetcher` tiene que ser estable (useCallback).
export function useFocusQuery<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (manual: boolean) => {
      if (manual) setRefreshing(true);
      try {
        setData(await fetcher());
        setError(null);
      } catch (e) {
        setError(loadErrorMessage(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetcher],
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  return { data, error, loading, refreshing, refresh: () => load(true) };
}

// Lo que va en una lista sin filas: cargando, error o vacío.
export function ListMessage({ loading, error, empty }: { loading: boolean; error: string | null; empty: string }) {
  if (loading) return <ActivityIndicator style={styles.message} color={AppTheme.text.accent} />;
  return (
    <View style={styles.message}>
      <Text style={[styles.messageText, error ? { color: AppTheme.colors.danger } : null]}>{error ?? empty}</Text>
      {error ? <Text style={styles.retry}>Deslizá hacia abajo para reintentar.</Text> : null}
    </View>
  );
}

// Aviso arriba de una lista que ya tiene datos y no se pudo actualizar.
export function StaleBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return <Text style={styles.stale}>No se pudo actualizar: {error}</Text>;
}

export const listStyles = StyleSheet.create({
  row: {
    marginHorizontal: AppTheme.spacing.md,
    marginBottom: 10,
    padding: AppTheme.spacing.md,
    gap: 4,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.borders.default,
    backgroundColor: AppTheme.surfaces.card,
  },
  rowTitle: { color: AppTheme.text.primary, fontSize: 16, fontWeight: "700" },
  rowMeta: { color: AppTheme.text.secondary, fontSize: 13 },
});

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: AppTheme.spacing.md, paddingVertical: 12 },
  titles: { flex: 1 },
  title: { color: AppTheme.text.primary, fontSize: 18, fontWeight: "700" },
  subtitle: { color: AppTheme.text.accent, fontSize: 13, fontWeight: "600" },
  scan: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: AppTheme.colors.primary },
  scanText: { color: AppTheme.colors.white, fontWeight: "700", fontSize: 13 },
  message: { marginTop: 48, paddingHorizontal: 32, alignItems: "center", gap: 6 },
  messageText: { color: AppTheme.text.secondary, fontSize: 15, textAlign: "center" },
  retry: { color: AppTheme.text.muted, fontSize: 13 },
  stale: { color: AppTheme.colors.warning, fontSize: 13, paddingHorizontal: AppTheme.spacing.md, paddingBottom: 8 },
});
