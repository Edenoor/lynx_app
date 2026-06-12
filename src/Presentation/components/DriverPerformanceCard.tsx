// src/Presentation/components/DriverPerformanceCard.tsx

import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import AppTheme from "../theme/AppTheme";

type DriverPerformanceCardProps = {
  loading?: boolean;
  score: number;
  effectiveness: number;
  totalDeliveries: number;
  closedOk: number;
  delivered: number;
  pending: number;
  earnings: string;
  eliteDeliveries?: number;
  post21Delivered?: number;
  post21Nobody?: number;
  post21Rescheduled?: number;
  post23Delivered?: number;
  post23Nobody?: number;
  post23Rescheduled?: number;
  post23InTransit?: number;
  delayedTotal?: number;
};

const GAUGE_SIZE = 86;
const GAUGE_STROKE = 7;
const GAUGE_RADIUS = 33;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;
const GAUGE_VISIBLE_PERCENT = 0.74;

const GOLD = "#F5C451";
const GREEN = "#39D98A";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getPerformanceLabel = (effectiveness: number) => {
  if (effectiveness > 97) return "Excelente";
  if (effectiveness >= 95) return "Bueno";
  return "Atención";
};

const getPerformanceColor = (effectiveness: number) => {
  if (effectiveness > 97) return GOLD;
  if (effectiveness >= 95) return GREEN;
  return AppTheme.colors.danger;
};

const getStatusIcon = (effectiveness: number) => {
  if (effectiveness > 97) return "star-outline";
  if (effectiveness >= 95) return "checkmark-circle-outline";
  return "close-circle-outline";
};

export function DriverPerformanceCard({
  loading = false,
  score,
  effectiveness,
  totalDeliveries,
  closedOk,
  eliteDeliveries,
  post21Delivered,
  post21Nobody,
  post21Rescheduled,
  post23Delivered,
  post23Nobody,
  post23Rescheduled,
  post23InTransit,
  delayedTotal,
}: DriverPerformanceCardProps) {
  const [detailVisible, setDetailVisible] = useState(false);

  const safeScore = clamp(score, 0, 10);
  const safeEffectiveness = clamp(effectiveness, 0, 100);
  const averageRating = clamp(safeScore / 2, 0, 5);

  const statusColor = getPerformanceColor(safeEffectiveness);
  const statusIcon = getStatusIcon(safeEffectiveness);

  const visibleDash = GAUGE_CIRCUMFERENCE * GAUGE_VISIBLE_PERCENT;
  const progressDash = visibleDash * (safeEffectiveness / 100);
  const hiddenDash = GAUGE_CIRCUMFERENCE - visibleDash;

  const eliteTotal = eliteDeliveries ?? 0;

  const post21Total =
    (post21Delivered ?? 0) + (post21Nobody ?? 0) + (post21Rescheduled ?? 0);

  const post23Total =
    (post23Delivered ?? 0) +
    (post23Nobody ?? 0) +
    (post23Rescheduled ?? 0) +
    (post23InTransit ?? 0);

  const calculatedDelayed = Math.max(
    totalDeliveries - eliteTotal - post21Total,
    0
  );

  const delayed = delayedTotal ?? Math.max(calculatedDelayed, post23Total);

  return (
    <>
      <View style={styles.card}>
        <View style={styles.mainRow}>
          <View style={styles.gaugeBlock}>
            <Svg width={GAUGE_SIZE} height={GAUGE_SIZE} style={styles.gaugeSvg}>
              <Circle
                cx={GAUGE_SIZE / 2}
                cy={GAUGE_SIZE / 2}
                r={GAUGE_RADIUS}
                stroke={AppTheme.surfaces.cardStrong}
                strokeWidth={GAUGE_STROKE}
                fill="transparent"
                strokeLinecap="round"
                strokeDasharray={`${visibleDash} ${hiddenDash}`}
                rotation={138}
                originX={GAUGE_SIZE / 2}
                originY={GAUGE_SIZE / 2}
              />

              <Circle
                cx={GAUGE_SIZE / 2}
                cy={GAUGE_SIZE / 2}
                r={GAUGE_RADIUS}
                stroke={statusColor}
                strokeWidth={GAUGE_STROKE}
                fill="transparent"
                strokeLinecap="round"
                strokeDasharray={`${loading ? 16 : progressDash} ${
                  GAUGE_CIRCUMFERENCE
                }`}
                rotation={138}
                originX={GAUGE_SIZE / 2}
                originY={GAUGE_SIZE / 2}
              />
            </Svg>

            <View style={styles.scoreContent}>
              <Text style={styles.scoreValue}>
                {loading ? "…" : safeScore.toFixed(1)}
              </Text>
              <Text style={styles.scoreText}>Score</Text>
            </View>

            <View style={styles.statusRow}>
              <Ionicons name={statusIcon} size={10} color={statusColor} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {loading ? "Cargando" : getPerformanceLabel(safeEffectiveness)}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.metricsRow}>
            <Metric
              icon="time-outline"
              value={loading ? "…" : `${safeEffectiveness}%`}
              label="A tiempo"
              color={statusColor}
            />

            <Metric
              icon="cube-outline"
              value={loading ? "…" : String(totalDeliveries)}
              label="Envíos"
            />

            <Metric
              icon="star-outline"
              value={loading ? "…" : averageRating.toFixed(1)}
              label="Rating"
              color={GOLD}
            />
          </View>
        </View>

        <View style={styles.footerDivider} />

<View style={styles.footer}>
  <InlineFooterBlock
    icon="flash-outline"
    value={loading ? "…" : String(eliteTotal)}
    color={GOLD}
  />

<TouchableOpacity
  activeOpacity={0.8}
  style={styles.detailButton}
  onPress={() => setDetailVisible(true)}
>
  <Ionicons
    name="eye-outline"
    size={20}
    color={AppTheme.text.secondary}
  />
</TouchableOpacity>

  <InlineFooterBlock
    icon="shield-checkmark-outline"
    value={loading ? "…" : `${closedOk}/${totalDeliveries}`}
    color={GREEN}
  />
</View>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={detailVisible}
        onRequestClose={() => setDetailVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDetailVisible(false)}
        >
          <Pressable style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalKicker}>DETALLE SLA</Text>
                <Text style={styles.modalTitle}>Composición semanal</Text>
              </View>

              <TouchableOpacity onPress={() => setDetailVisible(false)}>
                <Ionicons
                  name="close-outline"
                  size={24}
                  color={AppTheme.text.primary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.summaryGrid}>
              <SummaryItem label="Elite" value={eliteTotal} color={GOLD} />
              <SummaryItem
                label="Post 21 válido"
                value={post21Total}
                color={GREEN}
              />
              <SummaryItem
                label="Demorados"
                value={delayed}
                color={AppTheme.colors.danger}
              />
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Post 21</Text>

              <DetailRow label="Entregados" value={post21Delivered ?? 0} />
              <DetailRow label="Nadie en domicilio" value={post21Nobody ?? 0} />
              <DetailRow label="Reprogramados" value={post21Rescheduled ?? 0} />
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Demorados</Text>

              <DetailRow label="En camino post 23" value={post23InTransit ?? 0} />
              <DetailRow label="Entregados post 23" value={post23Delivered ?? 0} />
              <DetailRow label="Nadie post 23" value={post23Nobody ?? 0} />
              <DetailRow
                label="Reprogramados post 23"
                value={post23Rescheduled ?? 0}
              />

              <View style={styles.detailTotalRowDanger}>
                <Text style={styles.detailTotalLabel}>Total demorados</Text>
                <Text style={styles.detailTotalValueDanger}>{delayed}</Text>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Metric({
  icon,
  value,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={17} color={color ?? AppTheme.text.secondary} />
      <Text style={[styles.metricValue, color ? { color } : null]}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function InlineFooterBlock({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.inlineFooterItem}>
      <Ionicons name={icon} size={14} color={color ?? AppTheme.text.secondary} />

      {label ? (
        <Text style={styles.inlineFooterLabel}>{label}</Text>
      ) : null}

      <Text style={styles.inlineFooterValue}>{value}</Text>
    </View>
  );
}

function SummaryItem({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={[styles.summaryLabel, { color }]}>{label}</Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: AppTheme.radius.xxl,
    backgroundColor: AppTheme.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    paddingVertical: AppTheme.spacing.xs,
    paddingHorizontal: AppTheme.spacing.md,
    gap: AppTheme.spacing.xs,
    ...AppTheme.shadows.card,
  },

  mainRow: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.md,
  },

  gaugeBlock: {
    width: 98,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
  },

  gaugeSvg: {
    position: "absolute",
    top: 0,
  },

  scoreContent: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -9,
  },

  scoreValue: {
    color: AppTheme.text.primary,
    fontSize: 26,
    fontWeight: AppTheme.font.weight.black,
    letterSpacing: -1.2,
    lineHeight: 29,
  },

  scoreText: {
    color: AppTheme.text.muted,
    fontSize: 10,
    fontWeight: AppTheme.font.weight.medium,
    marginTop: -2,
  },

  statusRow: {
    position: "absolute",
    bottom: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  statusText: {
    fontSize: 10,
    fontWeight: AppTheme.font.weight.bold,
  },

  divider: {
    width: 1,
    height: 62,
    backgroundColor: AppTheme.borders.soft,
  },

  metricsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: AppTheme.spacing.sm,
  },

  metric: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },

  metricValue: {
    color: AppTheme.text.primary,
    fontSize: 22,
    fontWeight: AppTheme.font.weight.bold,
    letterSpacing: -0.7,
    lineHeight: 25,
  },

  metricLabel: {
    color: AppTheme.text.secondary,
    fontSize: 10,
    fontWeight: AppTheme.font.weight.medium,
    textAlign: "center",
    lineHeight: 13,
  },

  footerDivider: {
    height: 1,
    backgroundColor: AppTheme.borders.soft,
  },

  footer: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

inlineFooterItem: {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  paddingHorizontal: 2,
},

  inlineFooterLabel: {
    color: AppTheme.text.muted,
    fontSize: 11,
    fontWeight: AppTheme.font.weight.bold,
  },

inlineFooterValue: {
  color: AppTheme.text.primary,
  fontSize: 13,
  fontWeight: AppTheme.font.weight.black,
  letterSpacing: -0.2,
},

  detailButton: {
    flex: 1,
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  detailButtonText: {
    color: AppTheme.text.secondary,
    fontSize: 11,
    fontWeight: AppTheme.font.weight.bold,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(5, 8, 14, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: AppTheme.spacing.lg,
  },

  modalCard: {
    width: "100%",
    borderRadius: AppTheme.radius.xxl,
    backgroundColor: AppTheme.surfaces.screen,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    padding: AppTheme.spacing.lg,
    gap: AppTheme.spacing.md,
    ...AppTheme.shadows.card,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  modalKicker: {
    ...AppTheme.typography.kicker,
  },

  modalTitle: {
    color: AppTheme.text.primary,
    fontSize: AppTheme.font.size.lg,
    fontWeight: AppTheme.font.weight.black,
  },

  summaryGrid: {
    flexDirection: "row",
    gap: AppTheme.spacing.sm,
  },

  summaryItem: {
    flex: 1,
    borderRadius: AppTheme.radius.lg,
    backgroundColor: AppTheme.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: AppTheme.borders.soft,
    padding: AppTheme.spacing.sm,
    alignItems: "center",
    gap: 2,
  },

  summaryValue: {
    color: AppTheme.text.primary,
    fontSize: AppTheme.font.size.lg,
    fontWeight: AppTheme.font.weight.black,
  },

  summaryLabel: {
    fontSize: 10,
    fontWeight: AppTheme.font.weight.bold,
    textAlign: "center",
  },

  detailSection: {
    borderRadius: AppTheme.radius.lg,
    backgroundColor: AppTheme.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: AppTheme.borders.soft,
    padding: AppTheme.spacing.md,
    gap: AppTheme.spacing.sm,
  },

  detailSectionTitle: {
    color: AppTheme.text.secondary,
    fontSize: AppTheme.font.size.sm,
    fontWeight: AppTheme.font.weight.bold,
    marginBottom: AppTheme.spacing.xs,
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  detailLabel: {
    color: AppTheme.text.muted,
    fontSize: AppTheme.font.size.sm,
    fontWeight: AppTheme.font.weight.medium,
  },

  detailValue: {
    color: AppTheme.text.primary,
    fontSize: AppTheme.font.size.md,
    fontWeight: AppTheme.font.weight.bold,
  },

  detailTotalRowDanger: {
    borderTopWidth: 1,
    borderTopColor: AppTheme.borders.soft,
    paddingTop: AppTheme.spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  detailTotalLabel: {
    color: AppTheme.text.secondary,
    fontSize: AppTheme.font.size.sm,
    fontWeight: AppTheme.font.weight.bold,
  },

  detailTotalValueDanger: {
    color: AppTheme.colors.danger,
    fontSize: AppTheme.font.size.md,
    fontWeight: AppTheme.font.weight.black,
  },
});

export default DriverPerformanceCard;