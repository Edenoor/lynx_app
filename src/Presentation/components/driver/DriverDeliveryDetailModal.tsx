// src/Presentation/components/driver/DriverDeliveryDetailModal.tsx

import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppTheme from "../../theme/AppTheme";
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

const normalizeStatus = (estado?: string | null) =>
  String(estado || "").toLowerCase();

const statusLabel = (estado?: string | null, cadete?: string | null) => {
  if (!cadete) return "Sin asignar";

  const s = normalizeStatus(estado);

  if (s.includes("entregado")) return "Entregado";
  if (s.includes("retirado") || s.includes("en camino") || s.includes("transit"))
    return "En camino";
  if (s.includes("solicitado") || s.includes("creado") || s.includes("pendiente"))
    return "A retirar";

  return estado || "Estado";
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

  const precio = n(it.precio_chofer);
  const pRaw = n(it.porcentaje_chofer);
  const factor = pRaw > 1 ? 1 - pRaw / 100 : 1 - pRaw;

  return Math.round(precio * factor * 100) / 100;
};

export function DriverDeliveryDetailModal({
  visible,
  delivery,
  onClose,
}: Props) {
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
                <Ionicons name="close" size={18} color={AppTheme.text.primary} />
              </Pressable>
            </View>

            <View style={styles.summary}>
              <View style={styles.summaryMain}>
                <Text style={styles.client} numberOfLines={1}>
                  {delivery.nombre_fantasia?.trim() || "Cliente"}
                </Text>

                <Text style={styles.tracking} numberOfLines={1}>
                  {delivery.numero_tracking ?? "—"}
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
              <Row label="Estado" value={statusLabel(delivery.estado, delivery.cadete)} />
              <Row label="Método" value={metodoLabel(delivery.metodo_envio)} />
              <Row
                label="Dirección"
                value={`${delivery.direccion || "—"}${delivery.cp ? ` (${delivery.cp})` : ""}`}
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
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={3}>
        {value ?? "—"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: AppTheme.overlays.camera,
    padding: AppTheme.spacing.lg,
    justifyContent: "center",
  },

  card: {
    borderRadius: AppTheme.radius.xxl,
    backgroundColor: AppTheme.surfaces.screenAlt,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    padding: AppTheme.spacing.lg,
    ...AppTheme.shadows.card,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: AppTheme.spacing.md,
  },

  kicker: {
    ...AppTheme.typography.kicker,
  },

  title: {
    color: AppTheme.text.primary,
    fontSize: AppTheme.font.size.lg,
    fontWeight: AppTheme.font.weight.black,
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

  summary: {
    borderRadius: AppTheme.radius.xl,
    backgroundColor: AppTheme.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: AppTheme.borders.soft,
    padding: AppTheme.spacing.md,
    flexDirection: "row",
    gap: AppTheme.spacing.md,
    marginBottom: AppTheme.spacing.md,
  },

  summaryMain: {
    flex: 1,
  },

  client: {
    color: AppTheme.text.muted,
    fontSize: 12,
    fontWeight: AppTheme.font.weight.bold,
    marginBottom: 2,
  },

  tracking: {
    color: AppTheme.text.primary,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: AppTheme.font.weight.black,
    letterSpacing: -0.7,
  },

  amountBox: {
    alignItems: "flex-end",
    justifyContent: "center",
  },

  amountLabel: {
    color: AppTheme.text.muted,
    fontSize: 10,
    fontWeight: AppTheme.font.weight.bold,
  },

  amountValue: {
    color: AppTheme.text.primary,
    fontSize: 17,
    fontWeight: AppTheme.font.weight.black,
  },

  rows: {
    gap: AppTheme.spacing.sm,
    marginBottom: AppTheme.spacing.md,
  },

  row: {
    flexDirection: "row",
    gap: AppTheme.spacing.md,
    alignItems: "flex-start",
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
});

export default DriverDeliveryDetailModal;