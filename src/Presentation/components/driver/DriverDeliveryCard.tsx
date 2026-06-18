// src/Presentation/components/driver/DriverDeliveryCard.tsx

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppTheme from "../../theme/AppTheme";

export type DriverDeliveryCardItem = {
  id?: string | number | null;
  delivery_id?: string | number | null;

  numero_tracking: string | null;
  fecha_colecta?: string | null;

  nombre_fantasia: string | null;
  store_name?: string | null;
  storeName?: string | null;

  direccion: string | null;
  cp: string | null;

  estado: string | null;
  status?: string | null;
  status_ml?: string | null;
  delivery_status?: string | null;
  estado_actual?: string | null;
  assignment_response?: string | null;

  cadete: string | null;
  zona: string | null;

  metodo_envio?: string | null;
  localidad?: string | null;
  provincia?: string | null;

  precio_chofer?: string | null;
  porcentaje_chofer?: string | null;
  neto_chofer?: string | null;
};

type Props = {
  delivery: DriverDeliveryCardItem;
  onPress?: () => void;
};

const n = (v: any) => {
  const x = Number(v ?? 0);
  return Number.isNaN(x) ? 0 : x;
};

const fmtMoney = (v: any) => `$${n(v).toLocaleString("es-AR")}`;

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

const isOnDemand = (m?: string | null) =>
  ["tradicional", "turbo"].includes(String(m || "").toLowerCase());

const metodoLabel = (m?: string | null) => {
  const s = String(m || "").toLowerCase();

  if (s === "tradicional") return "Tradicional";
  if (s === "turbo") return "Turbo";
  if (!s) return "Flex";

  return s[0].toUpperCase() + s.slice(1);
};

const statusColor = (delivery?: DriverDeliveryCardItem | null) => {
  const s = normalizeStatus(getRawStatus(delivery));

  if (s.includes("entregado")) return AppTheme.colors.success;
  if (s.includes("retirado") || s.includes("en camino") || s.includes("transit"))
    return AppTheme.colors.primary;
  if (s.includes("solicitado") || s.includes("creado") || s.includes("pendiente"))
    return AppTheme.colors.warning;
  if (s.includes("cancel") || s.includes("rechaz")) return AppTheme.colors.danger;
  if (s.includes("nadie") || s.includes("reprogram")) return AppTheme.colors.warning;

  return AppTheme.text.muted;
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

export function DriverDeliveryCard({ delivery, onPress }: Props) {
  const color = statusColor(delivery);
  const status = statusLabel(delivery);
  const neto = netoChofer(delivery);
  const method = metodoLabel(delivery.metodo_envio);

  const mainText = delivery.direccion || "—";
  const secondaryText = delivery.nombre_fantasia || "—";

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.88}
      disabled={!onPress}
    >
      <View style={styles.topRow}>
        <View style={styles.typePill}>
          <Ionicons
            name={isOnDemand(delivery.metodo_envio) ? "flash" : "cube"}
            size={12}
            color={AppTheme.colors.primary}
          />
          <Text style={styles.typeText}>{method}</Text>
        </View>

        <View style={[styles.statusPill, { borderColor: color }]}>
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <Text style={[styles.statusText, { color }]}>{status}</Text>
        </View>
      </View>

      <View style={styles.middleRow}>
        <View style={styles.info}>
          <Text style={styles.mainAddress} numberOfLines={1}>
            {mainText}
          </Text>

          <View style={styles.secondaryRow}>
            <Ionicons
              name="storefront-outline"
              size={13}
              color={AppTheme.text.muted}
            />
            <Text style={styles.secondaryText} numberOfLines={1}>
              {secondaryText}
            </Text>
          </View>
        </View>

        <View style={styles.amount}>
          <Text style={styles.amountLabel}>Neto</Text>
          <Text style={styles.amountValue}>{fmtMoney(neto)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: AppTheme.radius.xl,
    backgroundColor: AppTheme.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: AppTheme.borders.soft,
    paddingVertical: AppTheme.spacing.sm,
    paddingHorizontal: AppTheme.spacing.md,
    marginBottom: AppTheme.spacing.sm,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: AppTheme.radius.full,
    backgroundColor: AppTheme.overlays.primary,
  },

  typeText: {
    color: AppTheme.colors.primary,
    fontSize: 10,
    fontWeight: AppTheme.font.weight.black,
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: AppTheme.radius.full,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: AppTheme.radius.full,
  },

  statusText: {
    fontSize: 10,
    fontWeight: AppTheme.font.weight.black,
  },

  middleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.sm,
  },

  info: {
    flex: 1,
  },

  mainAddress: {
    color: AppTheme.text.primary,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: AppTheme.font.weight.black,
    letterSpacing: -0.4,
    marginBottom: 5,
  },

  secondaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  secondaryText: {
    flex: 1,
    color: AppTheme.text.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: AppTheme.font.weight.medium,
  },

  amount: {
    minWidth: 76,
    alignItems: "flex-end",
  },

  amountLabel: {
    color: AppTheme.text.muted,
    fontSize: 9,
    fontWeight: AppTheme.font.weight.bold,
    marginBottom: 1,
  },

  amountValue: {
    color: AppTheme.text.primary,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: AppTheme.font.weight.black,
    letterSpacing: -0.4,
  },
});

export default DriverDeliveryCard;