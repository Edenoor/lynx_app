// src/Presentation/components/driver/DriverDeliveryCard.tsx

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppTheme from "../../theme/AppTheme";

export type DriverDeliveryCardItem = {
  numero_tracking: string | null;
  fecha_colecta?: string | null;

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

type Props = {
  delivery: DriverDeliveryCardItem;
  onPress?: () => void;
};

const n = (v: any) => {
  const x = Number(v ?? 0);
  return Number.isNaN(x) ? 0 : x;
};

const fmtMoney = (v: any) => `$${n(v).toLocaleString("es-AR")}`;

const normalizeStatus = (estado?: string | null) =>
  String(estado || "").toLowerCase();

const isOnDemand = (m?: string | null) =>
  ["tradicional", "turbo"].includes(String(m || "").toLowerCase());

const metodoLabel = (m?: string | null) => {
  const s = String(m || "").toLowerCase();

  if (s === "tradicional") return "Tradicional";
  if (s === "turbo") return "Turbo";
  if (!s) return "Flex";

  return s[0].toUpperCase() + s.slice(1);
};

const statusColor = (estado?: string | null, cadete?: string | null) => {
  if (!cadete) return AppTheme.colors.danger;

  const s = normalizeStatus(estado);

  if (s.includes("entregado")) return AppTheme.colors.success;
  if (s.includes("retirado") || s.includes("en camino") || s.includes("transit"))
    return AppTheme.colors.primary;
  if (s.includes("solicitado") || s.includes("creado") || s.includes("pendiente"))
    return AppTheme.colors.warning;
  if (s.includes("cancel")) return AppTheme.colors.danger;

  return AppTheme.text.muted;
};

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

export function DriverDeliveryCard({ delivery, onPress }: Props) {
  const color = statusColor(delivery.estado, delivery.cadete);
  const status = statusLabel(delivery.estado, delivery.cadete);
  const neto = netoChofer(delivery);
  const method = metodoLabel(delivery.metodo_envio);

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
        <Text style={styles.tracking} numberOfLines={1}>
          {delivery.numero_tracking ?? "—"}
        </Text>

        <View style={styles.addressRow}>
          <Ionicons
            name="location-outline"
            size={13}
            color={AppTheme.text.muted}
          />
          <Text style={styles.address} numberOfLines={1}>
            {delivery.direccion || "—"}
            {delivery.cp ? ` (${delivery.cp})` : ""}
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

  tracking: {
    color: AppTheme.text.primary,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: AppTheme.font.weight.black,
    letterSpacing: -0.4,
    marginBottom: 5,
  },

  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  address: {
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