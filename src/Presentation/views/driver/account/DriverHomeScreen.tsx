// src/Presentation/views/driver/account/DriverHomeScreen.tsx
// «Mi domicilio»: el chofer carga dónde vive. Dos caminos: escribir la
// dirección y elegir el resultado, o, estando en casa, usar la ubicación del
// teléfono. La operación lo ve en el mapa y lo puede usar como inicio de una
// colecta o fin de un reparto.

import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

import AppTheme from "../../../theme/AppTheme";
import { SafeScreen } from "../../../components/SafeScreen";
import { DriverHome, HomeCandidate, clearMyHome, fetchMyHome, saveMyHome, searchHomeAddress, shortAddress } from "./homeApi";
import { errorMessage } from "../errorMessage";

type Pending = { address: string; latitude: number; longitude: number; source: "search" | "gps" };

// Dirección legible a partir de la ubicación del teléfono (geocoder del sistema).
const fromPlace = (p: Location.LocationGeocodedAddress | undefined) =>
  p ? [[p.street, p.streetNumber].filter(Boolean).join(" "), p.city || p.subregion || p.district].filter(Boolean).join(", ") : "";

// Adentro de una casa el GPS puede no fijar nunca: se corta a los 15 s y se
// usa la última ubicación conocida, si es reciente y razonablemente precisa.
const GPS_TIMEOUT_MS = 15000;
const LAST_KNOWN = { maxAge: 10 * 60 * 1000, requiredAccuracy: 150 };
const NO_FIX = "No se pudo obtener la ubicación. Probá de nuevo o escribí la dirección.";
const SERVICES_OFF = "La ubicación del teléfono está apagada. Activala o escribí la dirección.";

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), ms); });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
};
const servicesOff = (e: any) => e?.code === "E_LOCATION_SERVICES_DISABLED" || /location services/i.test(String(e?.message ?? ""));

export default function DriverHomeScreen() {
  const navigation = useNavigation<any>();
  const [home, setHome] = useState<DriverHome | null>(null);
  const [text, setText] = useState("");
  const [candidates, setCandidates] = useState<HomeCandidate[] | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState<"load" | "search" | "gps" | "save" | null>("load");
  const [error, setError] = useState("");
  // Sin red no se sabe si hay domicilio: no se dice «Todavía no cargaste» ni se esconde «Borrar».
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  // Permiso negado para siempre: el sistema ya no lo pregunta, solo desde Ajustes.
  const [needsSettings, setNeedsSettings] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setBusy("load");
      fetchMyHome()
        .then((h) => { if (alive) { setHome(h); setLoadError(""); } })
        .catch((e) => { if (alive) setLoadError(errorMessage(e, "No se pudo cargar tu domicilio.")); })
        .finally(() => { if (alive) setBusy(null); });
      return () => { alive = false; };
    }, [reloadKey])
  );

  const search = async () => {
    if (text.trim().length < 3) { setError("Escribí la calle, el número y la localidad."); return; }
    setBusy("search"); setError(""); setPending(null);
    try {
      const found = await searchHomeAddress(text);
      setCandidates(found);
      if (found.length === 1) setPending({ address: shortAddress(found[0], text), latitude: found[0].latitude, longitude: found[0].longitude, source: "search" });
    } catch (e: any) {
      setCandidates(null); setError(errorMessage(e, "No se pudo buscar la dirección."));
    } finally { setBusy(null); }
  };

  const useMyLocation = async () => {
    setBusy("gps"); setError(""); setNeedsSettings(false); setCandidates(null); setPending(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setNeedsSettings(!perm.canAskAgain);
        throw new Error(perm.canAskAgain
          ? "Sin permiso de ubicación. Podés escribir la dirección."
          : "La app no tiene permiso de ubicación. Habilitalo en Ajustes o escribí la dirección.");
      }
      if (!(await Location.hasServicesEnabledAsync())) throw new Error(SERVICES_OFF);
      let pos: Location.LocationObject | null = null;
      try {
        pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), GPS_TIMEOUT_MS);
      } catch (e) {
        if (servicesOff(e)) throw new Error(SERVICES_OFF);
        /* sin señal: se prueba con la última conocida */
      }
      if (!pos) pos = await Location.getLastKnownPositionAsync(LAST_KNOWN).catch(() => null);
      if (!pos) throw new Error(NO_FIX);
      const { latitude, longitude } = pos.coords;
      let address = "";
      try { address = fromPlace((await Location.reverseGeocodeAsync({ latitude, longitude }))[0]); } catch { /* sin geocoder: la escribe el chofer */ }
      setPending({ address, latitude, longitude, source: "gps" });
      setText(address);
    } catch (e: any) {
      setError(servicesOff(e) ? SERVICES_OFF : e?.code ? NO_FIX : e?.message || NO_FIX);
    } finally { setBusy(null); }
  };

  const save = async () => {
    if (!pending) return;
    // Con GPS se guarda lo que dice el campo (el chofer pudo corregirlo). Si el
    // teléfono no devolvió dirección, la tiene que escribir: no se guarda un punto sin dirección.
    if (pending.source === "gps" && text.trim().length < 3) { setError("Escribí la dirección de tu casa para guardarla."); return; }
    setBusy("save"); setError("");
    try {
      const address = pending.source === "gps" ? text.trim() : pending.address;
      setHome(await saveMyHome({ address, latitude: pending.latitude, longitude: pending.longitude }));
      setLoadError(""); setPending(null); setCandidates(null); setText("");
      Alert.alert("Domicilio guardado", "Ya lo ve la operación.");
    } catch (e: any) { setError(errorMessage(e, "No se pudo guardar el domicilio.")); } finally { setBusy(null); }
  };

  const remove = () =>
    Alert.alert("Borrar domicilio", "¿Querés borrar tu domicilio?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar", style: "destructive",
        onPress: async () => {
          setBusy("save"); setError("");
          try { setHome(await clearMyHome()); setLoadError(""); } catch (e: any) { setError(errorMessage(e, "No se pudo borrar el domicilio.")); } finally { setBusy(null); }
        },
      },
    ]);

  return (
    <SafeScreen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.back} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={AppTheme.text.secondary} />
          <Text style={styles.backText}>Mi cuenta</Text>
        </Pressable>

        <Text style={styles.title}>Mi domicilio</Text>
        <Text style={styles.subtitle}>
          La operación lo ve en el mapa y lo puede usar para que una colecta arranque en tu casa o un reparto termine ahí.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Domicilio cargado</Text>
          {busy === "load" ? (
            <ActivityIndicator color={AppTheme.colors.primary} style={{ marginTop: 8 }} />
          ) : loadError ? (
            <>
              <Text style={styles.hint}>{loadError}</Text>
              <Pressable onPress={() => setReloadKey((k) => k + 1)} disabled={!!busy} accessibilityRole="button">
                <Text style={styles.retry}>Reintentar</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.value}>{home?.address || "Todavía no cargaste tu domicilio"}</Text>
          )}
          {home?.address && !loadError ? (
            <Pressable onPress={remove} disabled={!!busy}>
              <Text style={styles.link}>Borrar</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{home?.address ? "Cambiarlo" : "Cargarlo"}</Text>

          <Pressable style={[styles.button, styles.buttonSecondary]} onPress={useMyLocation} disabled={!!busy}>
            {busy === "gps" ? <ActivityIndicator color={AppTheme.colors.primary} /> : <Ionicons name="locate-outline" size={18} color={AppTheme.colors.primary} />}
            <Text style={styles.buttonSecondaryText}>Estoy en mi casa: usar mi ubicación</Text>
          </Pressable>

          <Text style={styles.or}>o escribí la dirección</Text>
          <View style={styles.row}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Calle y número, localidad"
              placeholderTextColor={AppTheme.text.muted}
              style={styles.input}
              // Con un punto del GPS sin guardar, «Enter» solo cierra el teclado: buscar lo descartaría.
              returnKeyType={pending?.source === "gps" ? "done" : "search"}
              onSubmitEditing={() => { if (pending?.source !== "gps") search(); }}
              editable={!busy}
            />
            <Pressable style={[styles.button, styles.searchButton]} onPress={search} disabled={!!busy}
              accessibilityRole="button" accessibilityLabel="Buscar dirección" accessibilityState={{ disabled: !!busy, busy: busy === "search" }}>
              {busy === "search" ? <ActivityIndicator color={AppTheme.colors.white} /> : <Ionicons name="search" size={18} color={AppTheme.colors.white} />}
            </Pressable>
          </View>

          {candidates ? (
            candidates.length ? (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.hint}>Elegí la que corresponde:</Text>
                {candidates.map((c, i) => {
                  const chosen = pending?.source === "search" && pending.latitude === c.latitude && pending.longitude === c.longitude;
                  return (
                    <Pressable key={i} style={[styles.candidate, chosen && styles.candidateOn]} accessibilityRole="button" accessibilityState={{ selected: chosen }}
                      onPress={() => setPending({ address: shortAddress(c, text), latitude: c.latitude, longitude: c.longitude, source: "search" })}>
                      <Text style={styles.candidateText}>{c.displayName || shortAddress(c, text)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : <Text style={styles.hint}>No se encontró esa dirección. Probá agregando la localidad.</Text>
          ) : null}

          {pending ? (
            <View style={styles.confirm}>
              <Text style={styles.hint}>
                {pending.source === "gps"
                  ? pending.address
                    ? "Se guarda el punto donde estás ahora. Si la dirección de arriba no es exacta, corregila antes de guardar."
                    : "Se guarda el punto donde estás ahora, pero el teléfono no encontró la dirección: escribila arriba y tocá «Guardar domicilio»."
                  : `Se guarda: ${pending.address}`}
              </Text>
              <Pressable style={styles.button} onPress={save} disabled={!!busy}>
                {busy === "save" ? <ActivityIndicator color={AppTheme.colors.white} /> : <Text style={styles.buttonText}>Guardar domicilio</Text>}
              </Pressable>
            </View>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {needsSettings ? (
          <Pressable style={[styles.button, styles.buttonSecondary]} onPress={() => Linking.openSettings()}>
            <Ionicons name="settings-outline" size={18} color={AppTheme.colors.primary} />
            <Text style={styles.buttonSecondaryText}>Abrir configuración</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: AppTheme.spacing.md,
    paddingHorizontal: AppTheme.layout.screenPadding,
    paddingBottom: 48,
    gap: AppTheme.spacing.md,
  },
  back: { flexDirection: "row", alignItems: "center", gap: 2 },
  backText: { color: AppTheme.text.secondary, fontSize: 14, fontWeight: AppTheme.font.weight.bold },
  title: {
    color: AppTheme.text.primary,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: AppTheme.font.weight.black,
    letterSpacing: -1,
  },
  subtitle: { color: AppTheme.text.secondary, fontSize: 14, lineHeight: 20, fontWeight: AppTheme.font.weight.bold },
  card: {
    borderRadius: AppTheme.radius.xxl,
    backgroundColor: AppTheme.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    padding: AppTheme.spacing.md,
    gap: AppTheme.spacing.sm,
  },
  label: { color: AppTheme.text.muted, fontSize: 12, fontWeight: AppTheme.font.weight.black, textTransform: "uppercase", letterSpacing: 0.6 },
  value: { color: AppTheme.text.primary, fontSize: 17, fontWeight: AppTheme.font.weight.black },
  link: { color: AppTheme.colors.danger, fontSize: 14, fontWeight: AppTheme.font.weight.bold },
  retry: { color: AppTheme.colors.primary, fontSize: 14, fontWeight: AppTheme.font.weight.bold },
  or: { color: AppTheme.text.muted, fontSize: 12, fontWeight: AppTheme.font.weight.bold, textAlign: "center" },
  row: { flexDirection: "row", gap: AppTheme.spacing.sm, alignItems: "center" },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: AppTheme.radius.xl,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    backgroundColor: AppTheme.surfaces.cardStrong,
    color: AppTheme.text.primary,
    paddingHorizontal: AppTheme.spacing.md,
    fontSize: 15,
  },
  button: {
    minHeight: 48,
    borderRadius: AppTheme.radius.xl,
    backgroundColor: AppTheme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: AppTheme.spacing.sm,
    paddingHorizontal: AppTheme.spacing.md,
  },
  searchButton: { width: 52, paddingHorizontal: 0 },
  buttonText: { color: AppTheme.colors.white, fontSize: 15, fontWeight: AppTheme.font.weight.black },
  buttonSecondary: { backgroundColor: AppTheme.overlays.primary, borderWidth: 1, borderColor: AppTheme.borders.medium },
  buttonSecondaryText: { color: AppTheme.colors.primary, fontSize: 15, fontWeight: AppTheme.font.weight.black },
  hint: { color: AppTheme.text.secondary, fontSize: 13, lineHeight: 18, fontWeight: AppTheme.font.weight.bold },
  candidate: {
    marginTop: 6,
    borderRadius: AppTheme.radius.xl,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    padding: AppTheme.spacing.sm,
  },
  candidateOn: { borderColor: AppTheme.colors.primary, backgroundColor: AppTheme.overlays.primary },
  candidateText: { color: AppTheme.text.primary, fontSize: 14, fontWeight: AppTheme.font.weight.bold },
  confirm: { marginTop: AppTheme.spacing.sm, gap: AppTheme.spacing.sm },
  error: { color: AppTheme.colors.danger, fontSize: 14, fontWeight: AppTheme.font.weight.bold },
});
