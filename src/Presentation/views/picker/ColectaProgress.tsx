// src/Presentation/views/picker/ColectaProgress.tsx
// Encabezado del escáner cuando se recibe una colecta: declarados y
// atribuidos de la colecta y de cada tienda. Los números son del servidor (la
// lista del día y lo que confirma cada escaneo); acá no se cuenta nada.

import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import AppTheme from "../../theme/AppTheme";
import type { Colecta } from "./warehouseApi";
import { colectaReception, colectaTotals, progressText, stopIsClosed, stopName } from "./colecta";

type Props = { colecta: Colecta | null; error: string | null; loading: boolean; onRefresh: () => void };

export function ColectaProgress({ colecta, error, loading, onRefresh }: Props) {
  const totals = colecta ? colectaTotals(colecta) : null;
  const reception = colecta ? colectaReception(colecta) : null;
  return (
    <View style={styles.box}>
      <View style={styles.top}>
        <View style={styles.totals}>
          {totals ? (
            <Text style={styles.totalText}>
              Declarados {totals.declared} · Atribuidos {totals.attributed}
            </Text>
          ) : (
            <Text style={styles.muted}>{loading ? "Cargando la colecta…" : "Sin datos de la colecta"}</Text>
          )}
          {reception && reception.kind !== "open" ? <Text style={styles.warn}>{reception.label}</Text> : null}
          {error ? <Text style={styles.error}>No se pudo actualizar: {error}</Text> : null}
        </View>
        <Pressable
          style={styles.refresh}
          onPress={onRefresh}
          disabled={loading}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Actualizar contadores de la colecta"
        >
          <Ionicons name="refresh" size={18} color={AppTheme.text.accent} />
        </Pressable>
      </View>
      {colecta?.stops.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stops}>
          {colecta.stops.map((s) => (
            <View key={s.route_stop_id} style={[styles.stop, stopIsClosed(s) && styles.stopClosed]}>
              <Text style={styles.stopName} numberOfLines={1}>{stopName(s)}</Text>
              <Text style={styles.stopCount}>{progressText(s.recibido, s.declarado)}</Text>
              {stopIsClosed(s) ? <Text style={styles.stopTag}>Cerrada</Text> : null}
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { paddingHorizontal: AppTheme.spacing.md, paddingBottom: 10, gap: 8 },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  totals: { flex: 1, gap: 2 },
  totalText: { color: AppTheme.text.primary, fontSize: 15, fontWeight: "800" },
  muted: { color: AppTheme.text.secondary, fontSize: 13 },
  warn: { color: AppTheme.colors.warning, fontSize: 12, fontWeight: "700" },
  error: { color: AppTheme.colors.danger, fontSize: 12 },
  refresh: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.borders.primary,
  },
  stops: { gap: 8 },
  stop: {
    minWidth: 110,
    maxWidth: 180,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.borders.default,
    backgroundColor: AppTheme.surfaces.card,
  },
  stopClosed: { opacity: 0.7 },
  stopName: { color: AppTheme.text.primary, fontSize: 13, fontWeight: "700" },
  stopCount: { color: AppTheme.text.accent, fontSize: 13, fontWeight: "700" },
  stopTag: { color: AppTheme.colors.warning, fontSize: 11, fontWeight: "700" },
});
