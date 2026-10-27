
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ImageBackground,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../../theme/AppTheme";
import DriverBottomNavigation, {
  DriverTabKey,
} from "../../../components/DriverBottomNavigation";
import type { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import {
  fetchMyRoutes,
  respondConfirmation,
  RouteSummary,
  todayIso,
} from "./routesApi";
import { pickupAnswer } from "./pickupConfirmation";
import {
  COLLECTION_STATUS_LABEL,
  collectionKindLabel,
  collectionName,
  plural,
} from "./collectionLabels";
import { errorMessage } from "../errorMessage";

type Props = NativeStackScreenProps<
  DriverStackParamList,
  "CollectionsScreen"
>;

type CollectionGroup = {
  title: string;
  routes: RouteSummary[];
};

const WEEKDAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const isoLocal = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const nextSevenDates = (): string[] => {
  const base = new Date();
  base.setHours(12, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    return isoLocal(date);
  });
};

const routeDate = (route: RouteSummary): Date =>
  new Date(`${route.scheduled_date.slice(0, 10)}T12:00:00`);

const dateLabel = (route: RouteSummary): string => {
  const date = routeDate(route);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
};

const isWeekday = (route: RouteSummary): boolean => {
  const day = routeDate(route).getDay();
  return day >= 1 && day <= 5;
};

const groupRoutes = (routes: RouteSummary[]): CollectionGroup[] => {
  const ordered = [...routes].sort((a, b) => {
    const dateCompare = a.scheduled_date.localeCompare(b.scheduled_date);
    if (dateCompare !== 0) return dateCompare;

    return (a.departure_time ?? "").localeCompare(b.departure_time ?? "");
  });

  const weekdays = ordered.filter(isWeekday);
  const weekends = ordered.filter((route) => !isWeekday(route));

  return [
    { title: "Lunes a viernes", routes: weekdays },
    { title: "Fin de semana", routes: weekends },
  ].filter((group) => group.routes.length > 0);
};

export default function CollectionsScreen({ navigation }: Props) {
  const [routes, setRoutes] = useState<RouteSummary[] | null>(null);
  const [today, setToday] = useState(todayIso());
  const [loading, setLoading] = useState(true);
  const [respondiendo, setRespondiendo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const dates = nextSevenDates();
      const results = await Promise.all(
        dates.map((date) => fetchMyRoutes(date))
      );

      const all = results.flatMap((result) =>
        result.filter((route) => route.type === "PICKUP")
      );

      const unique = Array.from(
        new Map(all.map((route) => [route.id, route])).values()
      );

      setToday(dates[0]);
      setRoutes(unique);
    } catch (e: any) {
      setError(errorMessage(e, "No se pudieron cargar las colectas"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", load);
    return unsubscribe;
  }, [navigation, load]);

  const responder = async (
    route: RouteSummary,
    response: "ACCEPTED" | "DECLINED"
  ) => {
    if (respondiendo !== null) return;

    setRespondiendo(route.id);

    try {
      await respondConfirmation(route.id, response);
      await load();
    } catch (e: any) {
      setError(errorMessage(e, "No se pudo enviar la respuesta"));
    } finally {
      setRespondiendo(null);
    }
  };

  const confirmarRechazo = (route: RouteSummary) => {
    Alert.alert(
      "Rechazar colecta",
      `¿Confirmás que no podés realizar ${collectionName(route)}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Rechazar",
          style: "destructive",
          onPress: () => responder(route, "DECLINED"),
        },
      ]
    );
  };

  const handleTabPress = (tab: DriverTabKey) => {
    switch (tab) {
      case "home":
        navigation.navigate("DriverScreen");
        break;
      case "deliveries":
        navigation.navigate("EnviosScreen");
        break;
      case "scan":
        navigation.navigate("DriverScanOptionsScreen");
        break;
      case "activity":
        navigation.navigate("NotificationsScreen");
        break;
      default:
        break;
    }
  };

  const groups = groupRoutes(routes ?? []);

  return (
    <ImageBackground
      source={require("../../../../../assets/background-1.png")}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.page}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              tintColor={AppTheme.text.accent}
            />
          }
        >
          <View style={styles.header}>
            <Text style={styles.title}>Mis colectas</Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!loading && routes?.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="cube-outline"
                size={32}
                color={AppTheme.text.secondary}
              />
              <Text style={styles.emptyTitle}>
                No tenés colectas asignadas
              </Text>
              <Text style={styles.emptyText}>
                Todavía no hay colectas programadas para los próximos días.
              </Text>
            </View>
          ) : null}

          {groups.map((group) => (
            <View key={group.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{group.title}</Text>

              {group.routes.map((route) => (
                <CollectionCard
                  key={route.id}
                  route={route}
                  today={today}
                  busy={respondiendo !== null}
                  onOpen={() =>
                    navigation.navigate("RouteDetailScreen", {
                      routeId: route.id,
                      name: collectionName(route),
                    })
                  }
                  onAccept={() => responder(route, "ACCEPTED")}
                  onReject={() => confirmarRechazo(route)}
                />
              ))}
            </View>
          ))}
        </ScrollView>

        <DriverBottomNavigation
          activeTab="collections"
          onPress={handleTabPress}
        />
      </SafeAreaView>
    </ImageBackground>
  );
}

function CollectionCard({
  route,
  today,
  busy,
  onOpen,
  onAccept,
  onReject,
}: {
  route: RouteSummary;
  today: string;
  busy: boolean;
  onOpen: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const answer = pickupAnswer(route);
  const habitual = !!route.template_id;

  const statusLabel =
    answer === "PENDING"
      ? "Pendiente"
      : answer === "ACCEPTED"
        ? "Aceptada"
        : answer === "DECLINED"
          ? "Rechazada"
          : COLLECTION_STATUS_LABEL[route.status] ?? route.status;

  const statusColor =
    answer === "PENDING"
      ? AppTheme.colors.warning
      : answer === "DECLINED" || route.status === "CANCELLED"
        ? AppTheme.colors.danger
        : AppTheme.colors.success;

  const canAnswer =
    answer === "PENDING" || answer === "DECLINED";

  const canReject = answer === "PENDING";

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Ver colecta ${collectionName(route)}`}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardIdentity}>
            <Text style={styles.cardName} numberOfLines={2}>
              {collectionName(route)}
            </Text>

            <Text style={styles.kindLabel}>
              {collectionKindLabel(route)}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              { borderColor: statusColor },
            ]}
          >
            <Text
              style={[styles.statusText, { color: statusColor }]}
            >
              {statusLabel}
            </Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.metaItem}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={AppTheme.text.secondary}
            />
            <Text style={styles.cardMeta}>{dateLabel(route)}</Text>
          </View>

          {route.departure_time ? (
            <View style={styles.metaItem}>
              <Ionicons
                name="time-outline"
                size={14}
                color={AppTheme.text.secondary}
              />
              <Text style={styles.cardMeta}>
                {route.departure_time.slice(0, 5)}
              </Text>
            </View>
          ) : null}

          <View style={styles.metaItem}>
            <Ionicons
              name="location-outline"
              size={14}
              color={AppTheme.text.secondary}
            />
            <Text style={styles.cardMeta}>
              {plural(route.stops_count, "parada", "paradas")}
            </Text>
          </View>
        </View>
      </Pressable>

      {canAnswer ? (
        <View style={styles.cardActions}>
          <Text style={styles.actionHint}>
            {answer === "DECLINED"
              ? "Podés volver a aceptar"
              : "¿Podés realizarla?"}
          </Text>

          <View style={styles.actionButtons}>
            {canReject ? (
              <Pressable
                style={[styles.iconButton, styles.rejectButton]}
                onPress={onReject}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Rechazar colecta"
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={AppTheme.colors.danger}
                />
              </Pressable>
            ) : null}

            <Pressable
              style={[styles.iconButton, styles.acceptButton]}
              onPress={onAccept}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Aceptar colecta"
            >
              <Ionicons
                name="checkmark"
                size={23}
                color={AppTheme.colors.success}
              />
            </Pressable>
          </View>
        </View>
      ) : null}

      {answer === "PENDING" &&
      route.confirmation_state === "OVERDUE" ? (
        <Text style={styles.cardWarn}>
          Venció el plazo de confirmación.
        </Text>
      ) : null}

      {answer === "ACCEPTED" &&
      route.scheduled_date > today ? (
        <Text style={styles.cardHint}>
          Podés comenzarla el día programado.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
  },
  backgroundImage: {
    opacity: 0.18,
  },
  safeArea: {
    flex: 1,
  },
  page: {
    paddingHorizontal: AppTheme.layout.screenPadding,
    paddingTop: AppTheme.spacing.lg,
    paddingBottom: 132,
  },
  header: {
    marginTop: AppTheme.spacing.lg,
    marginBottom: 22,
  },
  title: {
    color: AppTheme.text.primary,
    fontSize: 25,
    fontWeight: "700",
  },
  section: {
    marginBottom: 22,
    gap: 10,
  },
  sectionTitle: {
    color: AppTheme.text.primary,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  card: {
    backgroundColor: AppTheme.surfaces.card,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: AppTheme.borders.default,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  cardIdentity: {
    flex: 1,
    gap: 4,
  },
  cardName: {
    color: AppTheme.text.primary,
    fontSize: 16,
    fontWeight: "700",
  },
  kindLabel: {
    color: AppTheme.text.secondary,
    fontSize: 11,
    fontWeight: "500",
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  cardMeta: {
    color: AppTheme.text.secondary,
    fontSize: 12,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: AppTheme.borders.soft,
    paddingTop: 10,
  },
  actionHint: {
    color: AppTheme.text.secondary,
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptButton: {
    borderColor: AppTheme.colors.success,
    backgroundColor: `${AppTheme.colors.success}16`,
  },
  rejectButton: {
    borderColor: AppTheme.colors.danger,
    backgroundColor: `${AppTheme.colors.danger}16`,
  },
  cardHint: {
    color: AppTheme.text.accent,
    fontSize: 11,
  },
  cardWarn: {
    color: AppTheme.colors.warning,
    fontSize: 11,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 45,
    gap: 12,
  },
  emptyTitle: {
    color: AppTheme.text.primary,
    fontSize: 15,
    fontWeight: "600",
  },
  emptyText: {
    color: AppTheme.text.secondary,
    fontSize: 12,
    textAlign: "center",
  },
  errorBox: {
    borderWidth: 1,
    borderColor: AppTheme.colors.danger,
    borderRadius: AppTheme.radius.md,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: AppTheme.text.primary,
  },
});
