// src/Presentation/components/driver/RouteMapModal.tsx
// El recorrido completo en un mapa: las paradas numeradas en su orden de
// visita (las cerradas, atenuadas). Solo muestra: no reordena ni cambia nada.
// Para ir a una parada está «Cómo llegar» en cada una.

import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme, useThemedStyles } from "../../theme/ThemeContext";
import type { Theme } from "../../theme/createTheme";
import type { Stop } from "../../views/driver/routes/routesApi";
import { routeMapPoints } from "../../views/driver/routes/stopView";

type Props = { visible: boolean; title: string; stops: Stop[]; onClose: () => void };

export function RouteMapModal({ visible, title, stops, onClose }: Props) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { points, missing } = useMemo(() => routeMapPoints(stops), [stops]);

  // Encuadre de todas las paradas, con un margen.
  const region = useMemo(() => {
    if (!points.length) return undefined;
    const lats = points.map((p) => p.latitude);
    const lngs = points.map((p) => p.longitude);
    const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.4),
      longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.4),
    };
  }, [points]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Recorrido completo</Text>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Cerrar mapa" hitSlop={8}>
            <Ionicons name="close" size={22} color={theme.text.primary} />
          </Pressable>
        </View>
        {region ? (
          <MapView style={styles.map} initialRegion={region}>
            {points.map((p) => (
              <Marker key={p.stopId} coordinate={{ latitude: p.latitude, longitude: p.longitude }} title={`${p.sequence}. ${p.title}`}>
                <View style={[styles.pin, p.closed && styles.pinClosed]}>
                  <Text style={[styles.pinText, p.closed && styles.pinTextClosed]}>{p.sequence}</Text>
                </View>
              </Marker>
            ))}
          </MapView>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="map-outline" size={32} color={theme.text.muted} />
            <Text style={styles.emptyText}>Ninguna parada tiene ubicación cargada.</Text>
          </View>
        )}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.footerText}>
            {points.length} {points.length === 1 ? "parada" : "paradas"} en el mapa, en orden de visita.
            {missing ? ` ${missing} sin ubicación: no se muestran.` : ""}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.surfaces.screen },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: t.layout.screenPadding, paddingBottom: 10 },
  kicker: { ...t.typography.kicker },
  title: { color: t.text.primary, fontSize: 18, fontWeight: "800" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  map: { flex: 1 },
  pin: { minWidth: 28, height: 28, paddingHorizontal: 6, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.primary, borderWidth: 2, borderColor: "#FFFFFF" },
  pinClosed: { backgroundColor: "#9E9E9E" },
  pinText: { color: t.text.onPrimary, fontSize: 13, fontWeight: "800" },
  pinTextClosed: { color: "#FFFFFF" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  emptyText: { color: t.text.secondary, textAlign: "center" },
  footer: { paddingHorizontal: t.layout.screenPadding, paddingTop: 12, borderTopWidth: t.separator.width, borderTopColor: t.separator.color },
  footerText: { color: t.text.secondary, fontSize: 13, lineHeight: 18 },
});

export default RouteMapModal;
