// src/Presentation/views/driver/Envios/EnviosScreen.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import useEnviosViewModel from "./ViewModel";
import global from "../../../theme/global";
import AppTheme from "../../../theme/AppTheme";
import { LynxPulseLoader } from "../../../components/LynxPulseLoader";
import { DriverDeliveryStatCard } from "../../../components/driver/DriverDeliveryStatCard";
import { DriverDeliveryCard } from "../../../components/driver/DriverDeliveryCard";
import { DriverDeliveryDetailModal } from "../../../components/driver/DriverDeliveryDetailModal";
import {
  DriverBottomNavigation,
  DriverTabKey,
} from "../../../components/DriverBottomNavigation";

type Envio = {
  numero_tracking: string | null;
  fecha_colecta: string | null;
  nombre_fantasia: string | null;
  direccion: string | null;
  cp: string | null;
  estado: string | null;
  cadete: string | null;
  zona: string | null;
  metodo_envio?: string | null;
  localidad?: string | null;
  provincia?: string | null;
  precio_chofer?: string | null;
  porcentaje_chofer?: string | null;
};

const n = (v: any) => {
  const x = Number(v ?? 0);
  return Number.isNaN(x) ? 0 : x;
};

const fmtMoney = (v: any) => `$${n(v).toLocaleString("es-AR")}`;

const tryParseDate = (s?: string | null): Date | null => {
  if (!s) return null;

  const trimmed = String(s).trim();
  const iso = new Date(trimmed);
  if (!isNaN(iso.getTime())) return iso;

  const m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);

  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const y = Number(m[3]!.length === 2 ? `20${m[3]}` : m[3]);
    const dt = new Date(y, mo, d);
    if (!isNaN(dt.getTime())) return dt;
  }

  return null;
};

const fmtDate = (d?: Date | null) => {
  if (!d) return "—";

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();

  return `${dd}/${mm}/${yy}`;
};

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

const endOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const normalizeStatus = (estado?: string | null) =>
  String(estado || "").toLowerCase();

const isOnDemand = (m?: string | null) =>
  ["tradicional", "turbo"].includes(String(m || "").toLowerCase());

const isFinalizado = (estado?: string | null) => {
  const s = normalizeStatus(estado);

  return (
    s.includes("entregado") ||
    s.includes("finaliz") ||
    s.includes("cancel")
  );
};

const esAceptadoOEnCurso = (estado?: string | null) => {
  const s = normalizeStatus(estado);

  return (
    s.includes("acept") ||
    s.includes("asign") ||
    s.includes("retir") ||
    s.includes("en camino") ||
    s.includes("transit")
  );
};

const isAttention = (item: Envio) => {
  const s = normalizeStatus(item.estado);

  return (
    !item.cadete ||
    s.includes("cancel") ||
    s.includes("pendiente") ||
    s.includes("sin asignar")
  );
};

const netoChofer = (it?: Envio | null) => {
  if (!it) return 0;

  const precio = n(it.precio_chofer);
  const pRaw = n(it.porcentaje_chofer);
  const factor = pRaw > 1 ? 1 - pRaw / 100 : 1 - pRaw;

  return Math.round(precio * factor * 100) / 100;
};

export const EnviosScreen = ({ navigation }: any) => {
  const { list, loading, error, reload } = useEnviosViewModel();

  const rows = (list || []).filter(Boolean) as Envio[];

  const [refreshing, setRefreshing] = useState(false);

  const [quickToday, setQuickToday] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [picker, setPicker] = useState<null | "FROM" | "TO">(null);

  const [tab, setTab] = useState<"ondemand" | "flex">("ondemand");

  const [selected, setSelected] = useState<Envio | null>(null);
  const [showTotals, setShowTotals] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const handleTabPress = useCallback(
    (tabKey: DriverTabKey) => {
      if (tabKey === "deliveries") return;

      if (tabKey === "home") {
        navigation.navigate("DriverScreen");
        return;
      }

if (tabKey === "scan") {
  navigation.navigate("DriverScanOptionsScreen");
  return;
}

      if (tabKey === "activity") {
        navigation.navigate("NotificationsScreen");
        return;
      }

      if (tabKey === "profile") {
        navigation.navigate("DriverAccountScreen");
      }
    },
    [navigation]
  );

  const filtered = useMemo(() => {
    const base = rows.filter((r) => {
      const d = tryParseDate(r.fecha_colecta);

      if (from && to) {
        if (!d) return false;
        return d >= startOfDay(from) && d <= endOfDay(to);
      }

      if (quickToday) {
        if (!d) return false;
        const now = new Date();
        return d >= startOfDay(now) && d <= endOfDay(now);
      }

      return true;
    });

    if (tab === "ondemand") {
      return base.filter(
        (r) =>
          isOnDemand(r.metodo_envio) &&
          !isFinalizado(r.estado) &&
          esAceptadoOEnCurso(r.estado)
      );
    }

    return base.filter(
      (r) =>
        !isOnDemand(r.metodo_envio) ||
        isFinalizado(r.estado) ||
        !esAceptadoOEnCurso(r.estado)
    );
  }, [rows, quickToday, from, to, tab]);

  const visibleTotals = useMemo(() => {
    const totalEnvios = filtered.length;

    const entregados = filtered.filter((it) =>
      normalizeStatus(it.estado).includes("entregado")
    ).length;

    const pendientes = filtered.filter((it) => !isFinalizado(it.estado)).length;
    const atencion = filtered.filter(isAttention).length;

    const montoBruto = filtered.reduce(
      (acc, it) => acc + n(it.precio_chofer),
      0
    );

    const netoFinal = filtered.reduce((acc, it) => acc + netoChofer(it), 0);

    return {
      totalEnvios,
      entregados,
      pendientes,
      atencion,
      montoBruto,
      netoFinal,
    };
  }, [filtered]);

  if (loading && rows.length === 0) {
    return (
      <View style={styles.center}>
        <LynxPulseLoader message="Cargando envíos..." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.topLine}>
          <View>
            <Text style={styles.kicker}>DRIVER</Text>
            <Text style={styles.title}>Mis envíos</Text>
            <Text style={styles.subtitle}>
              {tab === "ondemand"
                ? "Seguimiento de envíos activos"
                : "Operación Flex asignada"}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable style={styles.iconButton} onPress={reload}>
              <Ionicons
                name="refresh"
                size={19}
                color={AppTheme.colors.white}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.segmented}>
          <Pressable
            onPress={() => setTab("ondemand")}
            style={[
              styles.segmentButton,
              tab === "ondemand" && styles.segmentButtonActive,
            ]}
          >
            <Ionicons
              name="flash-outline"
              size={15}
              color={
                tab === "ondemand"
                  ? AppTheme.colors.white
                  : AppTheme.text.muted
              }
            />
            <Text
              style={[
                styles.segmentText,
                tab === "ondemand" && styles.segmentTextActive,
              ]}
            >
              En curso
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setTab("flex")}
            style={[
              styles.segmentButton,
              tab === "flex" && styles.segmentButtonActive,
            ]}
          >
            <Ionicons
              name="cube-outline"
              size={15}
              color={
                tab === "flex" ? AppTheme.colors.white : AppTheme.text.muted
              }
            />
            <Text
              style={[
                styles.segmentText,
                tab === "flex" && styles.segmentTextActive,
              ]}
            >
              Flex
            </Text>
          </Pressable>
        </View>

        <View style={styles.statsGrid}>
          <DriverDeliveryStatCard
            neto={fmtMoney(visibleTotals.netoFinal)}
            entregados={visibleTotals.entregados}
            pendientes={visibleTotals.pendientes}
            atencion={visibleTotals.atencion}
            onPressNeto={() => setShowTotals(true)}
          />
        </View>

        <View style={styles.filtersBox}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContent}
          >
            <Pressable
              onPress={() => {
                setQuickToday(true);
                setFrom(null);
                setTo(null);
              }}
              style={[
                styles.filterChip,
                quickToday && !from && !to && styles.filterChipActive,
              ]}
            >
              <Ionicons
                name="today-outline"
                size={14}
                color={
                  quickToday && !from && !to
                    ? AppTheme.colors.white
                    : AppTheme.text.muted
                }
              />
              <Text
                style={[
                  styles.filterChipText,
                  quickToday && !from && !to && styles.filterChipTextActive,
                ]}
              >
                Hoy
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setCalendarOpen(true)}
              style={[styles.filterChip, from && to && styles.filterChipActive]}
            >
              <Ionicons
                name="calendar-outline"
                size={14}
                color={from && to ? AppTheme.colors.white : AppTheme.text.muted}
              />
              <Text
                style={[
                  styles.filterChipText,
                  from && to && styles.filterChipTextActive,
                ]}
              >
                {from && to ? `${fmtDate(from)} → ${fmtDate(to)}` : "Fecha"}
              </Text>
            </Pressable>

            {(quickToday || (from && to)) && (
              <Pressable
                onPress={() => {
                  setQuickToday(false);
                  setFrom(null);
                  setTo(null);
                }}
                style={styles.clearChip}
              >
                <Text style={styles.clearChipText}>Limpiar</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons
              name="warning-outline"
              size={16}
              color={AppTheme.colors.danger}
            />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item, i) => `${item?.numero_tracking ?? "nt"}-${i}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={AppTheme.colors.primary}
          />
        }
        renderItem={({ item }) => {
          if (!item) return null;

          return (
            <DriverDeliveryCard
              delivery={item}
              onPress={() => setSelected(item)}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons
              name="file-tray-outline"
              size={34}
              color={AppTheme.text.muted}
            />
            <Text style={styles.emptyTitle}>
              {tab === "ondemand"
                ? "No hay envíos en curso"
                : "No hay envíos Flex"}
            </Text>
            <Text style={styles.emptyText}>
              Probá cambiar el filtro de fecha o actualizar la pantalla.
            </Text>
          </View>
        }
      />

      <DriverBottomNavigation
        activeTab="deliveries"
        onPress={handleTabPress}
      />

      <DriverDeliveryDetailModal
        visible={!!selected}
        delivery={selected}
        onClose={() => setSelected(null)}
      />

      <Modal
        visible={showTotals}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTotals(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowTotals(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <ModalHeader
              title="Totales visibles"
              onClose={() => setShowTotals(false)}
            />

            <View style={styles.modalBody}>
              <Row label="Envíos" value={String(visibleTotals.totalEnvios)} />
              <Row
                label="Entregados"
                value={String(visibleTotals.entregados)}
              />
              <Row
                label="Pendientes"
                value={String(visibleTotals.pendientes)}
              />
              <Row label="Atención" value={String(visibleTotals.atencion)} />
              <Row
                label="Bruto chofer"
                value={fmtMoney(visibleTotals.montoBruto)}
              />
              <Row
                label="Neto chofer"
                value={fmtMoney(visibleTotals.netoFinal)}
              />
            </View>

            <Pressable
              style={styles.primaryBtn}
              onPress={() => setShowTotals(false)}
            >
              <Text style={styles.primaryBtnText}>Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={calendarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setCalendarOpen(false)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <ModalHeader
              title="Seleccionar rango"
              onClose={() => setCalendarOpen(false)}
            />

            <View style={styles.modalBody}>
              <Pressable
                style={styles.dateBtn}
                onPress={() => setPicker("FROM")}
              >
                <Text style={styles.dateBtnText}>Desde: {fmtDate(from)}</Text>
              </Pressable>

              {picker === "FROM" && (
                <DateTimePicker
                  value={from || new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  onChange={(e, d) => {
                    setPicker(null);
                    if (d) setFrom(d);
                  }}
                />
              )}

              <Pressable style={styles.dateBtn} onPress={() => setPicker("TO")}>
                <Text style={styles.dateBtnText}>Hasta: {fmtDate(to)}</Text>
              </Pressable>

              {picker === "TO" && (
                <DateTimePicker
                  value={to || new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  onChange={(e, d) => {
                    setPicker(null);
                    if (d) setTo(d);
                  }}
                />
              )}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.primaryBtn, styles.modalActionBtn]}
                onPress={() => {
                  setQuickToday(false);
                  setCalendarOpen(false);
                }}
              >
                <Text style={styles.primaryBtnText}>Aplicar</Text>
              </Pressable>

              <Pressable
                style={[styles.secondaryBtn, styles.modalActionBtn]}
                onPress={() => {
                  setFrom(null);
                  setTo(null);
                  setCalendarOpen(false);
                }}
              >
                <Text style={styles.secondaryBtnText}>Limpiar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const ModalHeader = ({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) => (
  <View style={styles.modalHeader}>
    <Text style={styles.modalTitle}>{title}</Text>

    <Pressable onPress={onClose} style={styles.closeBtn}>
      <Ionicons name="close" size={18} color={AppTheme.text.primary} />
    </Pressable>
  </View>
);

const Row = ({ label, value }: { label: string; value?: string | null }) => (
  <View style={styles.rowLine}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue} numberOfLines={3}>
      {value ?? "—"}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppTheme.surfaces.screen,
  },

  center: {
    flex: 1,
    backgroundColor: AppTheme.surfaces.screen,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  header: {
    paddingTop: global.SIZES.statusBarHeight + 14,
    paddingHorizontal: AppTheme.spacing.lg,
    paddingBottom: AppTheme.spacing.md,
  },

  topLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: AppTheme.spacing.lg,
  },

  kicker: {
    ...AppTheme.typography.kicker,
    marginBottom: 4,
  },

  title: {
    color: AppTheme.text.primary,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: AppTheme.font.weight.black,
    letterSpacing: -1,
  },

  subtitle: {
    marginTop: 4,
    color: AppTheme.text.muted,
    fontSize: 13,
    fontWeight: AppTheme.font.weight.semibold,
  },

  headerActions: {
    flexDirection: "row",
    gap: AppTheme.spacing.sm,
  },

  iconButton: {
    width: 42,
    height: 42,
    borderRadius: AppTheme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.surfaces.card,
    borderWidth: 1,
    borderColor: AppTheme.borders.default,
  },

  segmented: {
    flexDirection: "row",
    padding: 4,
    borderRadius: AppTheme.radius.full,
    backgroundColor: AppTheme.surfaces.muted,
    borderWidth: 1,
    borderColor: AppTheme.borders.soft,
    marginBottom: AppTheme.spacing.md,
  },

  segmentButton: {
    flex: 1,
    height: 38,
    borderRadius: AppTheme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },

  segmentButtonActive: {
    backgroundColor: AppTheme.colors.primary,
  },

  segmentText: {
    color: AppTheme.text.muted,
    fontSize: 13,
    fontWeight: AppTheme.font.weight.black,
  },

  segmentTextActive: {
    color: AppTheme.colors.white,
  },

  statsGrid: {
    marginBottom: AppTheme.spacing.md,
  },

  filtersBox: {
    marginTop: 2,
  },

  filtersContent: {
    gap: AppTheme.spacing.sm,
    paddingRight: AppTheme.spacing.lg,
  },

  filterChip: {
    height: 38,
    paddingHorizontal: 13,
    borderRadius: AppTheme.radius.full,
    backgroundColor: AppTheme.surfaces.muted,
    borderWidth: 1,
    borderColor: AppTheme.borders.soft,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  filterChipActive: {
    backgroundColor: AppTheme.colors.primary,
    borderColor: AppTheme.colors.primary,
  },

  filterChipText: {
    color: AppTheme.text.muted,
    fontSize: 12,
    fontWeight: AppTheme.font.weight.black,
  },

  filterChipTextActive: {
    color: AppTheme.colors.white,
  },

  clearChip: {
    height: 38,
    paddingHorizontal: 13,
    borderRadius: AppTheme.radius.full,
    backgroundColor: "rgba(239, 68, 68, 0.11)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.28)",
    alignItems: "center",
    justifyContent: "center",
  },

  clearChipText: {
    color: AppTheme.colors.danger,
    fontSize: 12,
    fontWeight: AppTheme.font.weight.black,
  },

  errorBox: {
    marginTop: AppTheme.spacing.md,
    padding: AppTheme.spacing.md,
    borderRadius: AppTheme.radius.lg,
    backgroundColor: "rgba(239, 68, 68, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.24)",
    flexDirection: "row",
    gap: AppTheme.spacing.sm,
  },

  errorText: {
    flex: 1,
    color: AppTheme.colors.danger,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: AppTheme.font.weight.bold,
  },

  listContent: {
    paddingHorizontal: AppTheme.spacing.lg,
    paddingBottom: 124,
  },

  emptyBox: {
    paddingTop: 52,
    alignItems: "center",
  },

  emptyTitle: {
    color: AppTheme.text.primary,
    fontSize: 16,
    fontWeight: AppTheme.font.weight.black,
    marginTop: AppTheme.spacing.md,
  },

  emptyText: {
    color: AppTheme.text.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 26,
  },

  backdrop: {
    flex: 1,
    backgroundColor: AppTheme.overlays.camera,
    padding: 20,
    justifyContent: "center",
  },

  modalCard: {
    borderRadius: AppTheme.radius.xxl,
    padding: AppTheme.spacing.lg,
    backgroundColor: AppTheme.surfaces.screenAlt,
    borderWidth: 1,
    borderColor: AppTheme.borders.default,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: AppTheme.spacing.md,
  },

  modalTitle: {
    color: AppTheme.text.primary,
    fontSize: 18,
    fontWeight: AppTheme.font.weight.black,
    letterSpacing: -0.4,
  },

  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: AppTheme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.surfaces.card,
    borderWidth: 1,
    borderColor: AppTheme.borders.soft,
  },

  modalBody: {
    gap: AppTheme.spacing.sm,
    marginBottom: AppTheme.spacing.md,
  },

  rowLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: AppTheme.spacing.md,
  },

  rowLabel: {
    width: 112,
    color: AppTheme.text.muted,
    fontSize: 11,
    fontWeight: AppTheme.font.weight.black,
    textTransform: "uppercase",
  },

  rowValue: {
    flex: 1,
    color: AppTheme.text.primary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: AppTheme.font.weight.bold,
  },

  primaryBtn: {
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radius.lg,
    paddingVertical: 14,
    alignItems: "center",
  },

  primaryBtnText: {
    color: AppTheme.colors.white,
    fontWeight: AppTheme.font.weight.black,
  },

  secondaryBtn: {
    borderRadius: AppTheme.radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: AppTheme.surfaces.muted,
    borderWidth: 1,
    borderColor: AppTheme.borders.default,
  },

  secondaryBtnText: {
    color: AppTheme.text.primary,
    fontWeight: AppTheme.font.weight.black,
  },

  dateBtn: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: AppTheme.surfaces.card,
    borderWidth: 1,
    borderColor: AppTheme.borders.default,
    borderRadius: AppTheme.radius.lg,
    alignItems: "center",
  },

  dateBtnText: {
    color: AppTheme.text.primary,
    fontWeight: AppTheme.font.weight.bold,
  },

  modalActions: {
    flexDirection: "row",
    gap: AppTheme.spacing.sm,
  },

  modalActionBtn: {
    flex: 1,
  },
});

export default EnviosScreen;