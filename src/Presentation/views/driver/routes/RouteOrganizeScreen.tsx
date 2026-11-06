// src/Presentation/views/driver/routes/RouteOrganizeScreen.tsx
// Organizador opcional: optimización por Valhalla, ajuste manual y confirmación.

import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ImageBackground, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import ThemedCard from "../../../components/ThemedCard";
import { KeyboardScreen } from "../../../components/KeyboardScreen";
import DriverBottomNavigation, { DriverTabKey } from "../../../components/DriverBottomNavigation";
import RouteMapModal from "../../../components/driver/RouteMapModal";
import type { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import { readCurrentPosition } from "../../../config/DriverLocation";
import { errorMessage } from "../errorMessage";
import { HomeCandidate, searchHomeAddress, shortAddress } from "../account/homeApi";
import {
  fetchPlanPlaces, fetchRoute, PlanPlaces, PlanPointKind, PlanPointSpec, PlanPreview,
  previewPlan, RouteDetail, saveDriverOrder, STOP_STATUS_LABEL, TYPE_LABEL,
} from "./routesApi";
import {
  canOrganize, defaultPoints, END_KINDS, homeNotice, isFixed, metricsLabel,
  moveStop, orderedStops, pointAvailability, pointLabel, sameOrder, START_KINDS,
} from "./routePlan";
import { stopAddress } from "./stopView";

type Props = NativeStackScreenProps<DriverStackParamList, "RouteOrganizeScreen">;
type Chooser = "start" | "end" | "first" | "last";

export default function RouteOrganizeScreen({ navigation, route: nav }: Props) {
  const { routeId } = nav.params;
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [places, setPlaces] = useState<PlanPlaces | null>(null);
  const [points, setPoints] = useState<{ start: PlanPointSpec; end: PlanPointSpec } | null>(null);
  const [pins, setPins] = useState<{ first: number | null; last: number | null }>({ first: null, last: null });
  const [order, setOrder] = useState<number[]>([]);
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chooser, setChooser] = useState<Chooser | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [unreachable, setUnreachable] = useState<number[]>([]);

  const handleTabPress = (tab: DriverTabKey) => {
    switch (tab) {
      case "home": navigation.navigate("DriverScreen"); break;
      case "deliveries": navigation.navigate("EnviosScreen"); break;
      case "scan": navigation.navigate("DriverScanOptionsScreen"); break;
      case "activity": navigation.navigate("NotificationsScreen"); break;
      default: break; // Colectas lo resuelve DriverBottomNavigation.
    }
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const [r, p] = await Promise.all([fetchRoute(routeId), fetchPlanPlaces(routeId)]);
      setRoute(r);
      setPlaces(p);
      setPoints(cur => cur ?? defaultPoints(p));
      setOrder(r.stops.map(s => s.id));
      setPreview(null);
    } catch (e) {
      setError(errorMessage(e, "No se pudo cargar el recorrido"));
    }
  }, [routeId]);
  useEffect(() => { load(); }, [load]);

  if (!route || !places || !points) {
    return (
      <ImageBackground source={require("../../../../../assets/background-1.png")} style={styles.background} imageStyle={styles.backgroundImage}>
        <ThemedStatusBar />
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.contentArea, styles.center]}>
            {error ? <Text style={styles.errorText}>{error}</Text> : <ActivityIndicator color={theme.text.accent} />}
            <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
              <Text style={styles.link}>Volver</Text>
            </Pressable>
          </View>
          <DriverBottomNavigation activeTab="deliveries" onPress={handleTabPress} />
        </SafeAreaView>
      </ImageBackground>
    );
  }

  const base = route.stops.map(s => s.id);
  const fixed = new Set(route.stops.filter(isFixed).map(s => s.id));
  const stops = orderedStops(route.stops, order);
  const pending = route.stops.filter(s => !isFixed(s));
  const changed = !sameOrder(order, base);
  const editable = canOrganize(route);
  const notice = points.end.kind === "HOME" || !places.home?.valid ? homeNotice(places) : null;
  const pinLabel = (id: number | null) => {
    const s = id === null ? null : route.stops.find(x => x.id === id);
    return s ? stopAddress(s) : "Automática";
  };
  const setPoint = (which: "start" | "end", spec: PlanPointSpec) => {
    setPoints({ ...points, [which]: spec }); setPreview(null); setChooser(null);
  };
  const setPin = (which: "first" | "last", id: number | null) => {
    setPins({
      first: which === "first" ? id : pins.first === id ? null : pins.first,
      last: which === "last" ? id : pins.last === id ? null : pins.last,
    });
    setPreview(null); setChooser(null);
  };
  const withGps = async (spec: PlanPointSpec): Promise<PlanPointSpec> => {
    if (spec.kind !== "GPS") return spec;
    const pos = await readCurrentPosition();
    if (!pos) throw new Error("No pudimos leer tu ubicación. Activá la ubicación del teléfono o elegí otro punto.");
    return { kind: "GPS", latitude: pos.latitude, longitude: pos.longitude };
  };
  const optimize = async () => {
    setBusy(true); setError(null); setUnreachable([]);
    try {
      const [start, end] = await Promise.all([withGps(points.start), withGps(points.end)]);
      const p = await previewPlan(routeId, { start, end, first_stop_id: pins.first, last_stop_id: pins.last });
      if (!sameOrder(p.current_stop_ids, base)) {
        await load();
        throw new Error("El recorrido cambió mientras lo organizabas: lo actualizamos, volvé a optimizar.");
      }
      setPreview(p);
      setOrder(p.stop_ids);
    } catch (e: any) {
      setPreview(null);
      if (Array.isArray(e?.stopIds)) setUnreachable(e.stopIds);
      setError(errorMessage(e, "No se pudo calcular el recorrido por calles. Tu orden no cambió."));
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true); setError(null);
    try {
      await saveDriverOrder(routeId, order, base);
      navigation.goBack();
    } catch (e: any) {
      if (e?.code === "ROUTE_CHANGED") await load();
      setError(errorMessage(e, "No se pudo guardar el orden"));
    } finally {
      setBusy(false);
    }
  };
  const move = (id: number, dir: -1 | 1) => setOrder(moveStop(order, fixed, id, dir));

  return (
    <ImageBackground source={require("../../../../../assets/background-1.png")} style={styles.background} imageStyle={styles.backgroundImage}>
      <ThemedStatusBar />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.contentArea}>
          <KeyboardScreen contentContainerStyle={styles.page}>
            <View style={styles.header}>
              <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Volver">
                <Ionicons name="arrow-back" size={22} color={theme.text.primary} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>{TYPE_LABEL[route.type]} #{route.id}</Text>
                <Text style={styles.title}>Organizar recorrido</Text>
                <Text style={styles.meta}>{route.stops.length} paradas · {pending.length} pendientes</Text>
              </View>
            </View>
            {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
            {!editable ? <View style={styles.errorBox}><Text style={styles.errorText}>Este recorrido ya no se puede organizar.</Text></View> : null}

            <ThemedCard style={styles.panel}>
              <Option label="Salir desde" value={pointLabel(points.start, places)} onPress={() => setChooser("start")} disabled={busy} />
              <Option label="Terminar en" value={pointLabel(points.end, places)} onPress={() => setChooser("end")} disabled={busy} />
              {notice ? <Text style={styles.warn}>{notice}</Text> : null}
              <Option label="Primera parada" value={pinLabel(pins.first)} onPress={() => setChooser("first")} disabled={busy || !pending.length} />
              <Option label="Última parada" value={pinLabel(pins.last)} onPress={() => setChooser("last")} disabled={busy || !pending.length} />
              <Pressable onPress={optimize} disabled={busy || !editable || !pending.length} style={[styles.btn, (busy || !editable || !pending.length) && styles.btnDisabled]} accessibilityRole="button">
                {busy ? <ActivityIndicator color={theme.text.onPrimary} /> : <Ionicons name="sparkles-outline" size={18} color={theme.text.onPrimary} />}
                <Text style={styles.btnText}>Optimizar</Text>
              </Pressable>
            </ThemedCard>

            {preview ? (
              <ThemedCard style={styles.panel}>
                <Text style={styles.panelTitle}>Orden propuesto</Text>
                <Text style={styles.panelText}>Ahora: {metricsLabel(preview.current)}</Text>
                <Text style={[styles.panelText, styles.good]}>Propuesto: {metricsLabel(preview.proposed)}</Text>
                <Text style={styles.panelText}>Por calles, sin tráfico: el tiempo real puede ser mayor.</Text>
                {preview.missing_stop_ids.length ? (
                  <Text style={styles.warn}>
                    Sin ubicación, quedan al final y no entran en el cálculo: {preview.missing_stop_ids.map(id => {
                      const s = route.stops.find(x => x.id === id);
                      return s ? stopAddress(s) : `#${id}`;
                    }).join(" · ")}
                  </Text>
                ) : null}
                {!sameOrder(order, preview.stop_ids) ? <Text style={styles.panelText}>Cambiaste el orden a mano.</Text> : null}
              </ThemedCard>
            ) : null}

            <View style={styles.listHead}>
              <Text style={styles.panelTitle}>Paradas</Text>
              <Pressable onPress={() => setMapOpen(true)} style={styles.mapLink} accessibilityRole="button" hitSlop={6}>
                <Ionicons name="map-outline" size={15} color={theme.text.accent} />
                <Text style={styles.link}>Ver en el mapa</Text>
              </Pressable>
            </View>
            {stops.map((s, i) => {
              const locked = fixed.has(s.id);
              return (
                <ThemedCard key={s.id} variant="row" style={[styles.stop, locked && styles.stopFixed]}>
                  <View style={styles.seq}><Text style={styles.seqText}>{i + 1}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stopAddress} numberOfLines={2}>{stopAddress(s)}</Text>
                    <Text style={styles.stopMeta}>
                      {locked ? `${STOP_STATUS_LABEL[s.status]} · no se mueve` : `${s.deliveries.length} ${s.deliveries.length === 1 ? "paquete" : "paquetes"}`}
                      {preview?.missing_stop_ids.includes(s.id) ? " · sin ubicación" : ""}
                      {unreachable.includes(s.id) ? " · sin camino por calle: revisá la dirección" : ""}
                    </Text>
                  </View>
                  {locked ? <Ionicons name="lock-closed-outline" size={18} color={theme.text.muted} /> : (
                    <View style={styles.arrows}>
                      <Pressable onPress={() => move(s.id, -1)} disabled={busy} style={styles.arrow} accessibilityRole="button" accessibilityLabel={`Subir parada ${i + 1}`} hitSlop={4}>
                        <Ionicons name="chevron-up" size={20} color={theme.text.primary} />
                      </Pressable>
                      <Pressable onPress={() => move(s.id, 1)} disabled={busy} style={styles.arrow} accessibilityRole="button" accessibilityLabel={`Bajar parada ${i + 1}`} hitSlop={4}>
                        <Ionicons name="chevron-down" size={20} color={theme.text.primary} />
                      </Pressable>
                    </View>
                  )}
                </ThemedCard>
              );
            })}
            <Pressable onPress={confirm} disabled={busy || !changed || !editable} style={[styles.btn, styles.btnBig, (busy || !changed || !editable) && styles.btnDisabled]} accessibilityRole="button">
              <Ionicons name="checkmark" size={18} color={theme.text.onPrimary} />
              <Text style={styles.btnText}>Confirmar orden</Text>
            </Pressable>
            {changed ? (
              <Pressable onPress={() => { setOrder(base); setPreview(null); }} disabled={busy} style={[styles.btn, styles.btnGhost]} accessibilityRole="button">
                <Text style={styles.btnGhostText}>Descartar cambios</Text>
              </Pressable>
            ) : null}
          </KeyboardScreen>
        </View>
        <DriverBottomNavigation activeTab="deliveries" onPress={handleTabPress} />
      </SafeAreaView>

      <RouteMapModal visible={mapOpen} title={`${TYPE_LABEL[route.type]} #${route.id}${changed ? " · sin confirmar" : ""}`} stops={stops} onClose={() => setMapOpen(false)} />
      {chooser === "start" || chooser === "end" ? (
        <PointChooser which={chooser} kinds={chooser === "start" ? START_KINDS : END_KINDS} places={places} current={points[chooser]}
          onPick={spec => setPoint(chooser, spec)} onClose={() => setChooser(null)} />
      ) : null}
      {chooser === "first" || chooser === "last" ? (
        <Sheet title={chooser === "first" ? "Primera parada" : "Última parada"} onClose={() => setChooser(null)}>
          <Choice label="Automática" selected={pins[chooser] === null} onPress={() => setPin(chooser, null)} />
          {pending.map(s => <Choice key={s.id} label={stopAddress(s)} selected={pins[chooser] === s.id} onPress={() => setPin(chooser, s.id)} />)}
        </Sheet>
      ) : null}
    </ImageBackground>
  );
}

function Option({ label, value, onPress, disabled }: { label: string; value: string; onPress: () => void; disabled?: boolean }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.option, disabled && styles.btnDisabled]} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>
      <View style={{ flex: 1 }}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Text style={styles.optionValue} numberOfLines={2}>{value}</Text>
      </View>
      <Text style={styles.link}>Cambiar</Text>
      <Ionicons name="chevron-forward" size={16} color={theme.text.accent} />
    </Pressable>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <Text style={styles.panelTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cerrar">
            <Ionicons name="close" size={22} color={theme.text.primary} />
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

function Choice({ label, detail, selected, disabled, onPress }: { label: string; detail?: string; selected?: boolean; disabled?: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.choice, disabled && styles.btnDisabled]} accessibilityRole="button" accessibilityState={{ selected: !!selected, disabled: !!disabled }}>
      <View style={{ flex: 1 }}>
        <Text style={styles.optionValue}>{label}</Text>
        {detail ? <Text style={styles.stopMeta}>{detail}</Text> : null}
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={20} color={theme.status.confirmed.text} /> : null}
    </Pressable>
  );
}

function PointChooser({ which, kinds, places, current, onPick, onClose }: {
  which: "start" | "end"; kinds: PlanPointKind[]; places: PlanPlaces; current: PlanPointSpec;
  onPick: (spec: PlanPointSpec) => void; onClose: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useAppTheme();
  const [searching, setSearching] = useState(false);
  const [text, setText] = useState("");
  const [candidates, setCandidates] = useState<HomeCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (text.trim().length < 4) { setError("Escribí calle, número y localidad"); return; }
    setBusy(true); setError(null);
    try { setCandidates(await searchHomeAddress(text.trim())); }
    catch (e) { setError(errorMessage(e, "No se pudo buscar la dirección")); }
    finally { setBusy(false); }
  };
  return (
    <Sheet title={which === "start" ? "Salir desde" : "Terminar en"} onClose={onClose}>
      {!searching ? kinds.map(kind => {
        const av = pointAvailability(kind, places);
        const spec: PlanPointSpec = { kind };
        return (
          <Choice key={kind} label={kind === "CUSTOM" ? "Otra dirección" : pointLabel(spec, places)}
            detail={av.ok ? undefined : av.reason} selected={current.kind === kind} disabled={!av.ok}
            onPress={() => (kind === "CUSTOM" ? setSearching(true) : onPick(spec))} />
        );
      }) : (
        <>
          <Text style={styles.panelText}>Solo para este recorrido: no cambia tu domicilio.</Text>
          <View style={styles.row}>
            <TextInput value={text} onChangeText={setText} placeholder="Calle 123, Localidad" placeholderTextColor={theme.text.muted}
              style={styles.input} autoFocus returnKeyType="search" onSubmitEditing={search} />
            <Pressable onPress={search} disabled={busy} style={[styles.btn, busy && styles.btnDisabled]} accessibilityRole="button">
              <Text style={styles.btnText}>Buscar</Text>
            </Pressable>
          </View>
          {error ? <Text style={styles.warn}>{error}</Text> : null}
          {candidates && !candidates.length ? <Text style={styles.panelText}>No encontramos esa dirección. Probá con la localidad.</Text> : null}
          {candidates?.map((c, i) => (
            <Choice key={`${c.latitude},${c.longitude},${i}`} label={shortAddress(c, text)} detail={c.displayName ?? undefined}
              onPress={() => onPick({ kind: "CUSTOM", latitude: c.latitude, longitude: c.longitude, label: shortAddress(c, text) })} />
          ))}
          <Pressable onPress={() => setSearching(false)} style={[styles.btn, styles.btnGhost]} accessibilityRole="button">
            <Text style={styles.btnGhostText}>Volver</Text>
          </Pressable>
        </>
      )}
    </Sheet>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  background: { flex: 1, backgroundColor: t.colors.background },
  backgroundImage: { opacity: t.backdrop.imageOpacity },
  safeArea: { flex: 1 },
  contentArea: { flex: 1, minHeight: 0 },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  page: { paddingHorizontal: t.layout.screenPadding, paddingTop: t.spacing.lg, paddingBottom: 120, gap: t.spacing.sm },
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: t.spacing.md, paddingTop: t.spacing.lg },
  back: { padding: 6, marginTop: 2 },
  eyebrow: { ...t.typography.kicker },
  title: { color: t.text.primary, fontSize: 22, fontWeight: "700" },
  meta: { color: t.text.secondary, fontSize: 13, marginTop: 2 },
  link: { color: t.text.accent },
  mapLink: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 28 },
  panel: { borderColor: t.borders.primary, padding: t.spacing.md, gap: 10 },
  panelTitle: { color: t.text.primary, fontWeight: "700", fontSize: 15 },
  panelText: { color: t.text.secondary, fontSize: 13, lineHeight: 18 },
  good: { color: t.status.confirmed.text, fontWeight: "700" },
  warn: { color: t.status.pending.text, fontSize: 13 },
  option: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 48, borderBottomWidth: t.separator.width, borderBottomColor: t.separator.color, paddingVertical: 6 },
  optionLabel: { color: t.text.secondary, fontSize: 12 },
  optionValue: { color: t.text.primary, fontSize: 15, fontWeight: "600" },
  listHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: t.spacing.sm },
  stop: { flexDirection: "row", alignItems: "center", gap: 12, padding: t.spacing.md },
  stopFixed: { opacity: 0.65 },
  seq: { width: 30, height: 30, borderRadius: t.radius.full, backgroundColor: t.surfaces.muted, alignItems: "center", justifyContent: "center" },
  seqText: { color: t.text.primary, fontWeight: "700" },
  stopAddress: { color: t.text.primary, fontWeight: "700", fontSize: 15, lineHeight: 20 },
  stopMeta: { color: t.text.secondary, fontSize: 12, marginTop: 2 },
  arrows: { flexDirection: "row", gap: 4 },
  arrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: t.radius.md, borderWidth: 1, borderColor: t.borders.default },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { flex: 1, minHeight: 44, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.borders.default, backgroundColor: t.surfaces.input, color: t.text.primary, paddingHorizontal: 12 },
  btn: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.primary, borderRadius: t.radius.md, paddingHorizontal: 16, minHeight: 44 },
  btnBig: { minHeight: 52, marginVertical: 4 },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: t.borders.default },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: t.text.onPrimary, fontWeight: "700" },
  btnGhostText: { color: t.text.primary, fontWeight: "600" },
  backdrop: { flex: 1, backgroundColor: t.overlays.background },
  sheet: { maxHeight: "75%", backgroundColor: t.colors.background, borderTopLeftRadius: t.radius.lg, borderTopRightRadius: t.radius.lg, paddingBottom: 24 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: t.spacing.md, borderBottomWidth: t.separator.width, borderBottomColor: t.separator.color },
  sheetBody: { padding: t.spacing.md, gap: 8 },
  choice: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingVertical: 8, borderBottomWidth: t.separator.width, borderBottomColor: t.separator.color },
  errorBox: { borderWidth: 1, borderColor: t.status.rejected.border, borderRadius: t.radius.md, padding: 12 },
  errorText: { color: t.text.primary },
});
