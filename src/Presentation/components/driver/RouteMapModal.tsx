// src/Presentation/components/driver/RouteMapModal.tsx
// El recorrido completo en un mapa: las paradas numeradas en su orden de
// visita (las cerradas, atenuadas). Solo muestra: no reordena ni cambia nada.
// Para ir a una parada está «Cómo llegar» en cada una.
// Con `streets` (un reparto) pide el trazado por calles al abrirse, o si
// cambia el orden que se muestra, y lo dibuja; nunca por intervalo. Con
// `unsaved` (el organizador, antes de confirmar) lo pide para ESE orden
// (shape-preview); volver a abrirlo sin cambiar el orden ni las ubicaciones
// reusa ese trazado. El orden guardado se pide en cada apertura (lo puede
// haber cambiado el coordinador). Si no llega, llega tarde (otro orden)
// o no coincide con lo que se ve, quedan solo los marcadores.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme, useThemedStyles } from "../../theme/ThemeContext";
import type { Theme } from "../../theme/createTheme";
import { fetchRouteShape, fetchRouteShapePreview, Stop } from "../../views/driver/routes/routesApi";
import { routeMapPoints } from "../../views/driver/routes/stopView";
import { LatLng, shapeLines } from "../../views/driver/routes/routeShape";

type Props = {
  visible: boolean; title: string; stops: Stop[]; onClose: () => void;
  // Recorrido cuyo trazado por calles se pide (solo si `streets`).
  routeId?: number; streets?: boolean;
  // El orden que se muestra todavía no está guardado.
  unsaved?: boolean;
  // Aviso al pie (p. ej. que el trazado sigue el orden guardado).
  note?: string | null;
};

export function RouteMapModal({ visible, title, stops, onClose, routeId, streets = false, unsaved = false, note = null }: Props) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { points, missing } = useMemo(() => routeMapPoints(stops), [stops]);
  const order = stops.map((s) => s.id).join(",");
  const [lines, setLines] = useState<LatLng[][] | null>(null);
  const [streetNote, setStreetNote] = useState<string | null>(null);
  // El trazado depende del orden y de dónde está cada parada.
  const shapeKey = `${routeId}|${unsaved}|${order}|${points.map((p) => `${p.stopId}:${p.latitude},${p.longitude}`).join(";")}`;
  const last = useRef<{ key: string; lines: LatLng[][] } | null>(null);
  const map = useRef<MapView>(null);
  // La próxima a visitar (la primera sin cerrar), resaltada.
  const nextId = points.find((p) => !p.closed)?.stopId ?? null;

  // Con el trazado dibujado, el encuadre incluye toda la línea (puede salirse
  // del cuadro de las paradas), con margen para que no quede pegada al borde.
  useEffect(() => {
    if (!lines?.length) return;
    const coords = [...lines.flat(), ...points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))];
    map.current?.fitToCoordinates?.(coords, { edgePadding: { top: 48, right: 40, bottom: 48, left: 40 }, animated: true });
  }, [lines]);

  useEffect(() => {
    setLines(null);
    setStreetNote(null);
    if (!visible || !streets || !routeId) return undefined;
    if (unsaved && last.current?.key === shapeKey) {
      setLines(last.current.lines);
      return undefined;
    }
    let alive = true;
    const ids = order.split(",").map(Number);
    (unsaved ? fetchRouteShapePreview(routeId, ids) : fetchRouteShape(routeId))
      .then((shape) => {
        if (!alive) return;
        const drawn = shapeLines(shape, ids);
        setLines(drawn);
        if (drawn && unsaved) last.current = { key: shapeKey, lines: drawn };
        if (!drawn) setStreetNote("El trazado por calles no coincide con este orden: se ven solo las paradas.");
      })
      .catch((e) => {
        if (!alive) return;
        setStreetNote(e?.code === "ROUTE_CHANGED"
          ? "El recorrido cambió mientras lo organizabas: volvé a entrar para ver el orden nuevo."
          : "No pudimos dibujar el recorrido por calles: se ven solo las paradas.");
      });
    return () => { alive = false; };
    // shapeKey ya incluye routeId, unsaved y order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, streets, shapeKey]);

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
          <MapView ref={map} style={styles.map} initialRegion={region}>
            {(lines ?? []).map((line, i) => (
              <Polyline key={`l${i}`} coordinates={line} strokeColor={theme.colors.primary} strokeWidth={4} />
            ))}
            {points.map((p) => (
              <Marker key={p.stopId} coordinate={{ latitude: p.latitude, longitude: p.longitude }} title={`${p.sequence}. ${p.title}`}
                anchor={{ x: 0.5, y: 0.5 }} zIndex={p.stopId === nextId ? 2 : p.closed ? 0 : 1}>
                <View style={[styles.pin, p.closed && styles.pinClosed, p.stopId === nextId && styles.pinNext]}>
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
            {points.length} {points.length === 1 ? "parada" : "paradas"} en el mapa, en orden de visita{nextId !== null ? "; la próxima, en verde" : ""}.
            {missing ? ` ${missing} sin ubicación: no se muestran.` : ""}
            {lines?.length ? ` La línea sigue las calles en el orden ${unsaved ? "sin confirmar" : "guardado"}.` : ""}
          </Text>
          {streetNote || note ? <Text style={styles.footerText}>{streetNote ?? note}</Text> : null}
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
  // Gris oscuro: el número blanco se sigue leyendo (el #9E9E9E no llegaba al contraste mínimo).
  pinClosed: { backgroundColor: "#5F6670" },
  pinNext: { minWidth: 34, height: 34, borderRadius: 17, backgroundColor: t.colors.success, borderWidth: 3 },
  pinText: { color: t.text.onPrimary, fontSize: 13, fontWeight: "800" },
  pinTextClosed: { color: "#FFFFFF" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  emptyText: { color: t.text.secondary, textAlign: "center" },
  footer: { paddingHorizontal: t.layout.screenPadding, paddingTop: 12, borderTopWidth: t.separator.width, borderTopColor: t.separator.color },
  footerText: { color: t.text.secondary, fontSize: 13, lineHeight: 18 },
});

export default RouteMapModal;
