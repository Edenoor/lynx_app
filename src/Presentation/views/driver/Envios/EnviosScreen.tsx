// src/Presentation/views/driver/Envios/EnviosScreen.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
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
import { File, Paths } from "expo-file-system/next";

import useEnviosViewModel from "./ViewModel";
import { ApiDelivery } from "../../../../Data/sources/remote/api/ApiDelivery";
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

type TabKey = "current" | "finished" | "flex";

type Envio = {
  id?: string | number | null;
  delivery_id?: string | number | null;
  numero_tracking: string | null;
  tracking?: string | null;
  tracking_number?: string | null;
  fecha_colecta: string | null;
  fecha_wynflex?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  status_updated_at?: string | null;
  assigned_at?: string | null;
  nombre_fantasia: string | null;
  store_name?: string | null;
  seller_name?: string | null;
  direccion: string | null;
  address?: string | null;
  cp: string | null;
  estado: string | null;
  status?: string | null;
  status_ml?: string | null;
  assignment_response?: string | null;
  cadete: string | null;
  zona: string | null;
  metodo_envio?: string | null;
  localidad?: string | null;
  provincia?: string | null;
precio_chofer?: string | null;
porcentaje_chofer?: string | null;
neto_chofer?: string | null;
  [key: string]: any;
};

const n = (v: any) => {
  const x = Number(v ?? 0);
  return Number.isNaN(x) ? 0 : x;
};

const fmtMoney = (v: any) => `$${n(v).toLocaleString("es-AR")}`;

const buildExcelFileName = (username?: string | null) => {
  const cleanName = String(username || "driver")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `envios_${cleanName || "driver"}.xlsx`;
};

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

const normalizeText = (value?: unknown) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const getStatus = (item: Envio) =>
  normalizeText(
    item.estado ||
      item.status_ml ||
      item.status ||
      item.assignment_response ||
      ""
  );

const isFinalizado = (item: Envio) => {
  const s = getStatus(item);

  return (
    s.includes("entregado") ||
    s.includes("finaliz") ||
    s.includes("cancel") ||
    s.includes("rechaz")
  );
};

const isAttention = (item: Envio) => {
  const s = getStatus(item);

  return (
    !item.cadete ||
    s.includes("cancel") ||
    s.includes("pendiente") ||
    s.includes("sin asignar") ||
    s.includes("rechaz")
  );
};

const getDateValue = (item: Envio): string | null => {
  return (
    item.fecha_colecta ||
    item.fecha_wynflex ||
    item.status_updated_at ||
    item.updated_at ||
    item.assigned_at ||
    item.created_at ||
    null
  );
};

const netoChofer = (it?: Envio | null) => {
  if (!it) return 0;

  if (it.neto_chofer !== undefined && it.neto_chofer !== null) {
    return n(it.neto_chofer);
  }

  const precio = n(it.precio_chofer);
  const pRaw = n(it.porcentaje_chofer);
  const factor = pRaw > 1 ? 1 - pRaw / 100 : 1 - pRaw;

  return Math.round(precio * factor * 100) / 100;
};

const normalizeCurrentDelivery = (item: any): Envio => {
  const tracking =
    item?.numero_tracking ||
    item?.tracking ||
    item?.tracking_number ||
    item?.trackingNumber ||
    item?.shipment_id ||
    item?.shipmentId ||
    null;

  const estado =
    item?.estado ||
    item?.status_ml ||
    item?.status ||
    item?.assignment_response ||
    null;

  const nombreFantasia =
    item?.nombre_fantasia ||
    item?.store_name ||
    item?.storeName ||
    item?.seller_name ||
    item?.sellerName ||
    item?.tienda ||
    null;

  const direccion =
    item?.direccion ||
    item?.address ||
    item?.domicilio ||
    item?.receiver_address ||
    null;

  return {
    ...item,
    numero_tracking: tracking,
    tracking,
    fecha_colecta: getDateValue(item),
    nombre_fantasia: nombreFantasia,
    direccion,
    cp: item?.cp || item?.postal_code || item?.zip_code || null,
    estado,
    cadete: item?.cadete || item?.driver_name || item?.driver || null,
    zona: item?.zona || item?.zone || item?.localidad || item?.provincia || null,
    localidad: item?.localidad || item?.provincia || item?.zona || null,
    metodo_envio: item?.metodo_envio || item?.delivery_type || item?.type || "turbo",
    precio_chofer:
  item?.precio_chofer !== undefined && item?.precio_chofer !== null
    ? String(item.precio_chofer)
    : item?.driver_price !== undefined && item?.driver_price !== null
    ? String(item.driver_price)
    : null,

porcentaje_chofer:
  item?.porcentaje_chofer !== undefined && item?.porcentaje_chofer !== null
    ? String(item.porcentaje_chofer)
    : item?.driver_percentage !== undefined && item?.driver_percentage !== null
    ? String(item.driver_percentage)
    : null,

neto_chofer:
  item?.neto_chofer !== undefined && item?.neto_chofer !== null
    ? String(item.neto_chofer)
    : null,
  };
};

export const EnviosScreen = ({ navigation }: any) => {
  const {
    list,
    currentDeliveries,
    loading,
    error,
    currentError,
    reload,
    username,
  } = useEnviosViewModel();

  const legacyRows = useMemo(
    () => ((list || []).filter(Boolean) as Envio[]),
    [list]
  );

  const currentRows = useMemo(
    () =>
      ((currentDeliveries || []).filter(Boolean) as any[]).map(
        normalizeCurrentDelivery
      ),
    [currentDeliveries]
  );

  const [refreshing, setRefreshing] = useState(false);

  const [quickToday, setQuickToday] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [picker, setPicker] = useState<null | "FROM" | "TO">(null);

  const [tab, setTab] = useState<TabKey>("current");

  const [selected, setSelected] = useState<Envio | null>(null);
  const [showTotals, setShowTotals] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const handleDownloadWeeklyExcel = useCallback(async () => {
    if (!username) {
      Alert.alert(
        "No se puede descargar",
        "No encontramos el nombre legacy del chofer en la sesión."
      );
      return;
    }

    if (downloadingExcel) return;

    try {
      setDownloadingExcel(true);

      const Sharing = await import("expo-sharing");

      const response = await ApiDelivery.post(
        "/v1/data/driver/print",
        { username },
        {
          responseType: "arraybuffer",
          headers: {
            Accept:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        }
      );

      const fileName = buildExcelFileName(username);
      const file = new File(Paths.cache, fileName);
      const bytes = new Uint8Array(response.data);

      await file.write(bytes);

      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        Alert.alert(
          "Excel generado",
          "El archivo se generó correctamente, pero este dispositivo no permite compartirlo desde la app."
        );
        return;
      }

      await Sharing.shareAsync(file.uri, {
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Descargar Excel semanal",
        UTI: "com.microsoft.excel.xlsx",
      });
    } catch (e: any) {
      const message =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "No se pudo descargar el Excel semanal.";

      Alert.alert("Error descargando Excel", message);
    } finally {
      setDownloadingExcel(false);
    }
  }, [downloadingExcel, username]);

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

  const sourceRows = useMemo(() => {
    if (tab === "flex") return legacyRows;
    if (tab === "finished") return currentRows.filter(isFinalizado);
    return currentRows.filter((item) => !isFinalizado(item));
  }, [currentRows, legacyRows, tab]);

  const filtered = useMemo(() => {
    return sourceRows.filter((r) => {
      const d = tryParseDate(getDateValue(r));

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
  }, [sourceRows, quickToday, from, to]);

  const activeError = tab === "flex" ? error : currentError;

  const visibleTotals = useMemo(() => {
    const totalEnvios = filtered.length;

    const entregados = filtered.filter((it) =>
      getStatus(it).includes("entregado")
    ).length;

    const pendientes = filtered.filter((it) => !isFinalizado(it)).length;
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

  const subtitle = useMemo(() => {
    if (tab === "current") return "Asignados y activos";
    if (tab === "finished") return "Historial de envíos cerrados";
    return "Operación Flex legacy";
  }, [tab]);

  const emptyTitle = useMemo(() => {
    if (tab === "current") return "No hay envíos en curso";
    if (tab === "finished") return "No hay envíos finalizados";
    return "No hay envíos Flex";
  }, [tab]);

  if (loading && legacyRows.length === 0 && currentRows.length === 0) {
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
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <View style={styles.headerActions}>
            {tab === "flex" && (
              <Pressable
                style={[
                  styles.iconButton,
                  styles.downloadButton,
                  downloadingExcel && styles.iconButtonDisabled,
                ]}
                onPress={handleDownloadWeeklyExcel}
                disabled={downloadingExcel}
              >
                <Ionicons
                  name={
                    downloadingExcel ? "hourglass-outline" : "download-outline"
                  }
                  size={19}
                  color={AppTheme.colors.white}
                />
              </Pressable>
            )}

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
          <SegmentButton
            active={tab === "current"}
            icon="flash-outline"
            label="En curso"
            onPress={() => setTab("current")}
          />

          <SegmentButton
            active={tab === "finished"}
            icon="checkmark-circle-outline"
            label="Finalizados"
            onPress={() => setTab("finished")}
          />

          <SegmentButton
            active={tab === "flex"}
            icon="cube-outline"
            label="Flex"
            onPress={() => setTab("flex")}
          />
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

        {!!activeError && (
          <View style={styles.errorBox}>
            <Ionicons
              name="warning-outline"
              size={16}
              color={AppTheme.colors.danger}
            />
            <Text style={styles.errorText}>{activeError}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item, i) =>
          `${item?.id ?? item?.delivery_id ?? item?.numero_tracking ?? "nt"}-${i}`
        }
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
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
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
                  onChange={(_, d) => {
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
                  onChange={(_, d) => {
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

const SegmentButton = ({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={[styles.segmentButton, active && styles.segmentButtonActive]}
  >
    <Ionicons
      name={icon}
      size={14}
      color={active ? AppTheme.colors.white : AppTheme.text.muted}
    />
    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
      {label}
    </Text>
  </Pressable>
);

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

  downloadButton: {
    backgroundColor: AppTheme.colors.primary,
    borderColor: AppTheme.colors.primary,
  },

  iconButtonDisabled: {
    opacity: 0.58,
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
    minHeight: 38,
    borderRadius: AppTheme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 4,
  },

  segmentButtonActive: {
    backgroundColor: AppTheme.colors.primary,
  },

  segmentText: {
    color: AppTheme.text.muted,
    fontSize: 11,
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
    backgroundColor: `${AppTheme.colors.danger}22`,
    borderWidth: 1,
    borderColor: `${AppTheme.colors.danger}44`,
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
    backgroundColor: `${AppTheme.colors.danger}22`,
    borderWidth: 1,
    borderColor: `${AppTheme.colors.danger}44`,
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