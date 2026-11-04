// src/Presentation/views/driver/turbo/TurboTomorrowScreen.tsx
// Turbos de mañana: los programados (Mercado Libre los prometió para otro
// día) que todavía no tienen chofer. Cualquier chofer habilitado puede tomar
// uno antes: queda para ese día, con su franja, y no se retira antes.

import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, ImageBackground, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import type { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import { todayIso } from "../routes/routesApi";
import { errorMessage } from "../errorMessage";
import { claimScheduled, fetchScheduledAvailable, hhmm, ScheduledTurbo } from "./turboApi";
import { NO_RETIRAR_ANTES, programadoLabel } from "./turboOffer";

type Props = NativeStackScreenProps<DriverStackParamList, "TurboTomorrowScreen">;

export default function TurboTomorrowScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [turbos, setTurbos] = useState<ScheduledTurbo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTurbos(await fetchScheduledAvailable()); setError(null); }
    catch (e: any) { setError(errorMessage(e, "No se pudieron cargar los Turbos de mañana")); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const tomar = (t: ScheduledTurbo) =>
    Alert.alert("Tomar el Turbo", `${programadoLabel(t, todayIso(), hhmm) ?? "Para otro día"}. ${NO_RETIRAR_ANTES}`, [
      { text: "No", style: "cancel" },
      {
        text: "Lo tomo", onPress: async () => {
          setBusy(t.route_id); setError(null);
          try {
            const r = await claimScheduled(t.route_id);
            if (r.group_id) navigation.navigate("TurboGroupScreen", { groupId: r.group_id });
            else navigation.navigate("RouteDetailScreen", { routeId: t.route_id });
          } catch (e: any) { setError(errorMessage(e, "No se pudo tomar el Turbo")); await load(); }
          finally { setBusy(null); }
        },
      },
    ]);

  return (
    <ImageBackground source={require("../../../../../assets/background-1.png")} style={styles.background} imageStyle={styles.backgroundImage}>
      <ThemedStatusBar />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.page}>
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button" accessibilityLabel="Volver"><Ionicons name="arrow-back" size={22} color={theme.text.primary} /></Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Turbo</Text>
              <Text style={styles.title}>Turbos de mañana</Text>
              <Text style={styles.meta}>Los podés tomar antes: quedan para su día, con su franja. El primero que lo toma se lo queda.</Text>
            </View>
          </View>
          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
          <FlatList
            data={turbos}
            keyExtractor={(t) => String(t.route_id)}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.text.accent} />}
            ListEmptyComponent={loading ? <ActivityIndicator color={theme.text.accent} style={{ marginTop: 40 }} /> : (
              <View style={styles.empty}><Ionicons name="calendar-outline" size={36} color={theme.text.muted} /><Text style={styles.emptyText}>No hay Turbos para otro día sin chofer.</Text></View>
            )}
            renderItem={({ item }) => (
              <View style={[theme.card, styles.card]}>
                <Text style={styles.programado}>{programadoLabel(item, todayIso(), hhmm) ?? item.scheduled_date}</Text>
                <Text style={styles.line}><Text style={styles.label}>Retiro · </Text>{item.store_name ?? "tienda"}{item.store_address ? ` · ${item.store_address}` : ""}</Text>
                <Text style={styles.line}><Text style={styles.label}>Entrega · </Text>{item.receiver_name ?? "comprador"}{item.delivery_address ? ` · ${item.delivery_address}` : ""}{item.delivery_postal_code ? ` · CP ${item.delivery_postal_code}` : ""}</Text>
                {item.offered_to_me ? <Text style={styles.meta}>Te lo ofrecieron como chofer de la tienda.</Text> : null}
                <Pressable onPress={() => tomar(item)} disabled={busy !== null} style={[styles.btn, busy !== null && styles.btnDisabled]}>
                  {busy === item.route_id ? <ActivityIndicator color={theme.text.onPrimary} /> : <Text style={styles.btnText}>Lo tomo para ese día</Text>}
                </Pressable>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  background: { flex: 1, backgroundColor: t.colors.background },
  backgroundImage: { opacity: t.backdrop.imageOpacity },
  safeArea: { flex: 1 },
  page: { flex: 1, paddingHorizontal: t.layout.screenPadding, paddingTop: t.spacing.lg, paddingBottom: 24 },
  header: { flexDirection: "row", gap: 4, alignItems: "flex-start", marginBottom: t.spacing.lg, paddingTop: t.spacing.lg },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -11, marginTop: -8 },
  eyebrow: { ...t.typography.kicker },
  title: { color: t.text.primary, fontSize: 22, fontWeight: "700" },
  meta: { color: t.text.secondary, fontSize: 13, marginTop: 2 },
  card: { borderWidth: 1, borderColor: t.borders.primary, padding: t.spacing.md, marginBottom: t.spacing.sm, gap: 6 },
  programado: { color: t.status.pending.text, fontSize: 15, fontWeight: "700" },
  line: { color: t.text.primary, fontSize: 14 },
  label: { color: t.text.secondary, fontWeight: "600" },
  btn: { minHeight: 46, borderRadius: t.radius.md, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.primary, marginTop: 6 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: t.text.onPrimary, fontWeight: "700", fontSize: 15 },
  empty: { alignItems: "center", gap: 10, marginTop: 40 },
  emptyText: { color: t.text.secondary, textAlign: "center" },
  errorBox: { borderWidth: 1, borderColor: t.status.rejected.border, backgroundColor: t.status.rejected.background, borderRadius: t.radius.md, padding: 12, marginBottom: 12 },
  errorText: { color: t.text.primary },
});
