
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

import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import ThemedCard from "../../../components/ThemedCard";
import StatusChip from "../../../components/StatusChip";
import DriverBottomNavigation, {
  DriverTabKey,
} from "../../../components/DriverBottomNavigation";
import ContinueBar, { CONTINUE_BAR_SPACE } from "../../../components/driver/ContinueBar";
import { useDriverWork } from "../work/workSource";
import type { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import {
  fetchMyRoutes,
  respondConfirmation,
  RouteSummary,
  todayIso,
} from "./routesApi";
import { pickupAnswer } from "./pickupConfirmation";
import { collectionCards, HabitualCard, tomorrowPrompt } from "./collectionCards";
import {
  COLLECTION_STATUS_LABEL,
  collectionKindLabel,
  collectionName,
  collectionStatusKey,
  plural,
} from "./collectionLabels";
import { errorMessage } from "../errorMessage";

type Props = NativeStackScreenProps<
  DriverStackParamList,
  "CollectionsScreen"
>;

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

export default function CollectionsScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [routes, setRoutes] = useState<RouteSummary[] | null>(null);
  const [today, setToday] = useState(todayIso());
  const [tomorrow, setTomorrow] = useState(nextSevenDates()[1]);
  const [loading, setLoading] = useState(true);
  const [respondiendo, setRespondiendo] = useState<number | null>(null);
  // Recorridos en la calle: la barra «Continuar» vuelve al que está en curso.
  const missions = useDriverWork().work?.missions ?? [];
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
      setTomorrow(dates[1]);
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

  // Una tarjeta por horario de colecta habitual; las extraordinarias, una por recorrido.
  const cards = collectionCards(routes ?? [], today, tomorrow);
  const habituales = cards.filter((c): c is HabitualCard => c.kind === "habitual");
  const extraordinarias = cards.flatMap((c) => (c.kind === "eventual" ? [c.route] : []));

  return (
    <ImageBackground
      source={require("../../../../../assets/background-1.png")}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <ThemedStatusBar />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={[styles.page, missions.length ? { paddingBottom: 132 + CONTINUE_BAR_SPACE } : null]}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              tintColor={theme.text.accent}
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
                color={theme.text.secondary}
              />
              <Text style={styles.emptyTitle}>
                No tenés colectas asignadas
              </Text>
              <Text style={styles.emptyText}>
                Todavía no hay colectas programadas para los próximos días.
              </Text>
            </View>
          ) : null}

          {habituales.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Habituales</Text>
              {habituales.map((card) => (
                <HabitualCollectionCard
                  key={card.key}
                  card={card}
                  busy={respondiendo !== null}
                  onOpen={(route) =>
                    navigation.navigate("RouteDetailScreen", {
                      routeId: route.id,
                      name: collectionName(route),
                    })
                  }
                  onAccept={(route) => responder(route, "ACCEPTED")}
                  onReject={(route) => confirmarRechazo(route)}
                />
              ))}
            </View>
          ) : null}

          {extraordinarias.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Extraordinarias</Text>
              {extraordinarias.map((route) => (
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
          ) : null}
        </ScrollView>

        <ContinueBar
          missions={missions}
          onOpen={(m) => (navigation as any).navigate(m.target.screen, m.target.params)}
          onSeeAll={() => navigation.navigate("DriverScreen")}
        />

        <DriverBottomNavigation
          activeTab="collections"
          onPress={handleTabPress}
        />
      </SafeAreaView>
    </ImageBackground>
  );
}

// Colecta habitual: una sola tarjeta para todas sus fechas. Tocarla abre la
// ejecución de hoy (ahí se confirma y se comienza) o, si hoy no hay, la
// próxima. Abajo, solo la asistencia de mañana.
function HabitualCollectionCard({
  card,
  busy,
  onOpen,
  onAccept,
  onReject,
}: {
  card: HabitualCard;
  busy: boolean;
  onOpen: (route: RouteSummary) => void;
  onAccept: (route: RouteSummary) => void;
  onReject: (route: RouteSummary) => void;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const prompt = tomorrowPrompt(card);
  const todayAnswer = card.today ? pickupAnswer(card.today) : null;
  const todayLabel = card.today
    ? todayAnswer === "PENDING"
      ? "pendiente de confirmar: abrila para confirmarla y comenzar"
      : todayAnswer === "DECLINED"
        ? "avisaste que no podés"
        : (COLLECTION_STATUS_LABEL[card.today.status] ?? card.today.status).toLowerCase()
    : null;

  return (
    <ThemedCard variant="row" style={styles.card}>
      <Pressable
        onPress={() => onOpen(card.open)}
        accessibilityRole="button"
        accessibilityLabel={`Ver colecta ${card.name}`}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardIdentity}>
            <Text style={styles.cardName} numberOfLines={2}>
              {card.name}
            </Text>
            <Text style={styles.kindLabel}>Habitual</Text>
          </View>
          {card.today ? (
            <StatusChip
              status={collectionStatusKey(card.today.status, todayAnswer)}
              label="Hoy"
            />
          ) : null}
        </View>

        <View style={styles.cardDetails}>
          {card.days ? (
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color={theme.text.secondary} />
              <Text style={styles.cardMeta}>{card.days}</Text>
            </View>
          ) : null}
          {card.time ? (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={theme.text.secondary} />
              <Text style={styles.cardMeta}>Comienza a las {card.time}</Text>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <Ionicons name="storefront-outline" size={14} color={theme.text.secondary} />
            <Text style={styles.cardMeta}>{plural(card.stores, "tienda", "tiendas")}</Text>
          </View>
        </View>

        {todayLabel ? <Text style={styles.cardHint}>Hoy: {todayLabel}</Text> : null}
      </Pressable>

      {prompt ? (
        prompt.canAccept ? (
          <View style={styles.cardActions}>
            <Text style={styles.actionHint}>{prompt.text}</Text>
            <View style={styles.actionButtons}>
              {prompt.canDecline ? (
                <Pressable
                  style={[styles.iconButton, styles.rejectButton]}
                  onPress={() => card.tomorrow && onReject(card.tomorrow)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="No puedo mañana"
                >
                  <Ionicons name="close" size={22} color={theme.status.rejected.icon} />
                </Pressable>
              ) : null}
              <Pressable
                style={[styles.iconButton, styles.acceptButton]}
                onPress={() => card.tomorrow && onAccept(card.tomorrow)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Confirmar asistencia para mañana"
              >
                <Ionicons name="checkmark" size={23} color={theme.status.confirmed.icon} />
              </Pressable>
            </View>
          </View>
        ) : (
          <Text style={styles.cardConfirmed}>{prompt.text}</Text>
        )
      ) : null}
    </ThemedCard>
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
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
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

  const statusKey = collectionStatusKey(route.status, answer);

  const canAnswer =
    answer === "PENDING" || answer === "DECLINED";

  const canReject = answer === "PENDING";

  return (
    <ThemedCard variant="row" style={styles.card}>
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

          <StatusChip status={statusKey} label={statusLabel} />
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.metaItem}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={theme.text.secondary}
            />
            <Text style={styles.cardMeta}>{dateLabel(route)}</Text>
          </View>

          {route.departure_time ? (
            <View style={styles.metaItem}>
              <Ionicons
                name="time-outline"
                size={14}
                color={theme.text.secondary}
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
              color={theme.text.secondary}
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
                  color={theme.status.rejected.icon}
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
                color={theme.status.confirmed.icon}
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
    </ThemedCard>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  backgroundImage: {
    opacity: t.backdrop.imageOpacity,
  },
  safeArea: {
    flex: 1,
  },
  page: {
    paddingHorizontal: t.layout.screenPadding,
    paddingTop: t.spacing.lg,
    paddingBottom: 132,
  },
  header: {
    marginTop: t.spacing.lg,
    marginBottom: 22,
  },
  title: {
    color: t.text.primary,
    fontSize: 25,
    fontWeight: "700",
  },
  section: {
    marginBottom: 22,
    gap: t.list.gap,
  },
  sectionTitle: {
    color: t.text.primary,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  // Fondo, borde, radio y sombra los pone ThemedCard (fila de lista).
  card: {
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
    color: t.text.primary,
    fontSize: 16,
    fontWeight: "700",
  },
  kindLabel: {
    color: t.text.secondary,
    fontSize: 11,
    fontWeight: "500",
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
    color: t.text.secondary,
    fontSize: 12,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: t.separator.width,
    borderTopColor: t.separator.color,
    paddingTop: 10,
  },
  actionHint: {
    color: t.text.secondary,
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
    borderRadius: t.radius.full,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptButton: {
    borderColor: t.status.confirmed.border,
    backgroundColor: t.status.confirmed.background,
  },
  rejectButton: {
    borderColor: t.status.rejected.border,
    backgroundColor: t.status.rejected.background,
  },
  cardHint: {
    color: t.text.accent,
    fontSize: 11,
  },
  cardWarn: {
    color: t.status.pending.text,
    fontSize: 11,
  },
  cardConfirmed: {
    color: t.status.confirmed.text,
    fontSize: 12,
    fontWeight: "600",
    borderTopWidth: t.separator.width,
    borderTopColor: t.separator.color,
    paddingTop: 10,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 45,
    gap: 12,
  },
  emptyTitle: {
    color: t.text.primary,
    fontSize: 15,
    fontWeight: "600",
  },
  emptyText: {
    color: t.text.secondary,
    fontSize: 12,
    textAlign: "center",
  },
  errorBox: {
    borderWidth: 1,
    borderColor: t.status.rejected.border,
    borderRadius: t.radius.md,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: t.text.primary,
  },
});
