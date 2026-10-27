// src/Presentation/components/driver/DriverDeliveryDetailModal.tsx

import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme, useThemedStyles } from "../../theme/ThemeContext";
import type { Theme } from "../../theme/createTheme";
import type { DriverDeliveryCardItem } from "./DriverDeliveryCard";

type Props = {
  visible: boolean;
  delivery: DriverDeliveryCardItem | null;
  onClose: () => void;
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

const normalizeStatus = (value?: string | null) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const getRawStatus = (delivery?: DriverDeliveryCardItem | null) => {
  if (!delivery) return "";

  return String(
    delivery.status_ml ||
      delivery.estado ||
      delivery.status ||
      delivery.delivery_status ||
      delivery.estado_actual ||
      delivery.assignment_response ||
      ""
  ).trim();
};

const statusLabel = (delivery?: DriverDeliveryCardItem | null) => {
  const raw = getRawStatus(delivery);
  const s = normalizeStatus(raw);

  if (s.includes("entregado")) return "Entregado";
  if (s.includes("retirado") || s.includes("en camino") || s.includes("transit"))
    return "En camino";
  if (s.includes("solicitado") || s.includes("creado") || s.includes("pendiente"))
    return "A retirar";
  if (s.includes("cancel")) return "Cancelado";
  if (s.includes("nadie")) return "Nadie";
  if (s.includes("reprogram")) return "Reprogramado";
  if (s.includes("accepted")) return "Aceptado";
  if (s.includes("rejected")) return "Rechazado";

  return raw || "Estado";
};

const metodoLabel = (m?: string | null) => {
  const s = String(m || "").toLowerCase();

  if (s === "tradicional") return "Tradicional";
  if (s === "turbo") return "Turbo";
  if (!s) return "Flex";

  return s[0].toUpperCase() + s.slice(1);
};

const zoneText = (it?: DriverDeliveryCardItem | null) => {
  if (!it) return "—";

  const loc = String(it.localidad || "").toLowerCase();

  const isCaba =
    loc.includes("ciudad autónoma") ||
    loc.includes("caba") ||
    loc.includes("cdad. autónoma");

  if (isCaba) return "CABA";
  if (it.localidad) return it.localidad;
  if (it.provincia) return it.provincia;

  return it.zona ? `Zona ${it.zona}` : "—";
};

const netoChofer = (it?: DriverDeliveryCardItem | null) => {
  if (!it) return 0;

  if (it.neto_chofer !== undefined && it.neto_chofer !== null) {
    return n(it.neto_chofer);
  }

  const precio = n(it.precio_chofer);
  const pRaw = n(it.porcentaje_chofer);
  const factor = pRaw > 1 ? 1 - pRaw / 100 : 1 - pRaw;

  return Math.round(precio * factor * 100) / 100;
};

const storeText = (delivery?: DriverDeliveryCardItem | null) => {
  if (!delivery) return "—";

  return (
    delivery.store_name ||
    delivery.storeName ||
    delivery.nombre_fantasia ||
    "—"
  );
};

const accountText = (delivery?: DriverDeliveryCardItem | null) => {
  if (!delivery) return "—";

  return delivery.nombre_fantasia || "—";
};

export function DriverDeliveryDetailModal({
  visible,
  delivery,
  onClose,
}: Props) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {delivery && (
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.header}>
              <View>
                <Text style={styles.kicker}>DETALLE</Text>
                <Text style={styles.title}>Envío</Text>
              </View>

              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={theme.text.primary} />
              </Pressable>
            </View>

            <View style={styles.summary}>
              <View style={styles.summaryMain}>
                <Text style={styles.client} numberOfLines={1}>
                  {accountText(delivery)}
                </Text>

                <Text style={styles.tracking} numberOfLines={2}>
                  {delivery.direccion || "—"}
                </Text>
              </View>

              <View style={styles.amountBox}>
                <Text style={styles.amountLabel}>Neto</Text>
                <Text style={styles.amountValue}>
                  {fmtMoney(netoChofer(delivery))}
                </Text>
              </View>
            </View>

            <View style={styles.rows}>
              <Row label="Estado" value={statusLabel(delivery)} />
              <Row label="Método" value={metodoLabel(delivery.metodo_envio)} />
              <Row label="Cuenta" value={accountText(delivery)} />
              <Row label="Store" value={storeText(delivery)} />
              <Row
                label="Dirección"
                value={`${delivery.direccion || "—"}${
                  delivery.cp ? ` (${delivery.cp})` : ""
                }`}
              />
              <Row label="Zona" value={zoneText(delivery)} />
              <Row label="Precio chofer" value={fmtMoney(delivery.precio_chofer)} />
              <Row
                label="Porcentaje"
                value={
                  delivery.porcentaje_chofer == null
                    ? "—"
                    : `${
                        n(delivery.porcentaje_chofer) > 1
                          ? n(delivery.porcentaje_chofer)
                          : n(delivery.porcentaje_chofer) * 100
                      }%`
                }
              />
              <Row label="Colecta" value={fmtDate(tryParseDate(delivery.fecha_colecta))} />
              <Row label="Tracking" value={delivery.numero_tracking || "—"} />
            </View>

            <Pressable style={styles.primaryBtn} onPress={onClose}>
              <Text style={styles.primaryBtnText}>Cerrar</Text>
            </Pressable>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={3}>
        {value ?? "—"}
      </Text>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: t.overlays.camera,
    padding: t.spacing.lg,
    justifyContent: "center",
  },

  card: {
    borderRadius: t.radius.xxl,
    backgroundColor: t.surfaces.screenAlt,
    borderWidth: 1,
    borderColor: t.borders.medium,
    padding: t.spacing.lg,
    ...t.shadows.card,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: t.spacing.md,
  },

  kicker: {
    ...t.typography.kicker,
  },

  title: {
    color: t.text.primary,
    fontSize: t.font.size.lg,
    fontWeight: t.font.weight.black,
  },

  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: t.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.surfaces.card,
    borderWidth: 1,
    borderColor: t.borders.soft,
  },

  summary: {
    borderRadius: t.radius.xl,
    backgroundColor: t.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: t.borders.soft,
    padding: t.spacing.md,
    flexDirection: "row",
    gap: t.spacing.md,
    marginBottom: t.spacing.md,
  },

  summaryMain: {
    flex: 1,
  },

  client: {
    color: t.text.muted,
    fontSize: 12,
    fontWeight: t.font.weight.bold,
    marginBottom: 2,
  },

  tracking: {
    color: t.text.primary,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: t.font.weight.black,
    letterSpacing: -0.7,
  },

  amountBox: {
    alignItems: "flex-end",
    justifyContent: "center",
  },

  amountLabel: {
    color: t.text.muted,
    fontSize: 10,
    fontWeight: t.font.weight.bold,
  },

  amountValue: {
    color: t.text.primary,
    fontSize: 17,
    fontWeight: t.font.weight.black,
  },

  rows: {
    gap: t.spacing.sm,
    marginBottom: t.spacing.md,
  },

  row: {
    flexDirection: "row",
    gap: t.spacing.md,
    alignItems: "flex-start",
  },

  rowLabel: {
    width: 112,
    color: t.text.muted,
    fontSize: 11,
    fontWeight: t.font.weight.black,
    textTransform: "uppercase",
  },

  rowValue: {
    flex: 1,
    color: t.text.primary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: t.font.weight.bold,
  },

  primaryBtn: {
    backgroundColor: t.colors.primary,
    borderRadius: t.radius.lg,
    paddingVertical: 14,
    alignItems: "center",
  },

  primaryBtnText: {
    color: t.text.onPrimary,
    fontWeight: t.font.weight.black,
  },
});

export default DriverDeliveryDetailModal;