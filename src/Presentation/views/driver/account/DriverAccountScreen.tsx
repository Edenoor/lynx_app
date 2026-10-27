// src/Presentation/views/driver/account/DriverAccountScreen.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme, useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { ThemedStatusBar } from "../../../theme/ThemedStatusBar";
import { LynxPulseLoader } from "../../../components/LynxPulseLoader";
import useViewModel from "../landing/ViewModel";
import {
  DriverBottomNavigation,
  DriverTabKey,
} from "../../../components/DriverBottomNavigation";
import { fetchMyHome } from "./homeApi";

const DEFAULT_AVATAR = require("../../../../../assets/user.png");

const getFirstWord = (value?: string | null): string => {
  if (!value || typeof value !== "string") return "";
  return value.trim().split(/\s+/)[0] || "";
};

const getDriverDisplayName = (user: any): string => {
  const firstName =
    getFirstWord(user?.first_name) ||
    getFirstWord(user?.firstName) ||
    getFirstWord(user?.name) ||
    getFirstWord(user?.username) ||
    getFirstWord(user?.email);

  return firstName || "driver";
};

const getVehicleLabel = (user: any): string => {
  const raw =
    user?.vehicle ||
    user?.vehiculo ||
    user?.vehicleType ||
    user?.tipo_vehiculo ||
    user?.vehicle_type ||
    "";

  return raw ? String(raw) : "Sin vehículo cargado";
};

const getDriverSelfieSource = (user: any): ImageSourcePropType => {
  const selfie =
    user?.selfie_url ||
    user?.selfieUrl ||
    user?.photo_url ||
    user?.photoUrl ||
    user?.avatar_url ||
    user?.avatarUrl ||
    user?.profile_image ||
    user?.profileImage ||
    "";

  if (typeof selfie === "string" && selfie.trim()) {
    return { uri: selfie.trim() };
  }

  return DEFAULT_AVATAR;
};

export default function DriverAccountScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { user, removeUserSession } = useViewModel();

  const [documentsLoading] = useState(false);
  // Domicilio: se relee al volver de «Mi domicilio». undefined = cargando o sin red; null = sin domicilio.
  const [homeAddress, setHomeAddress] = useState<string | null | undefined>(undefined);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchMyHome()
        .then((h) => { if (alive) setHomeAddress(h.address); })
        .catch(() => { if (alive) setHomeAddress(undefined); });
      return () => { alive = false; };
    }, [])
  );

  const driverName = useMemo(() => getDriverDisplayName(user), [user]);
  const username = (user as any)?.username || user?.email || user?.name || "";

  const avatarSource = useMemo(() => getDriverSelfieSource(user), [user]);

  const handleTabPress = useCallback(
    (tab: DriverTabKey) => {
      if (tab === "home") {
        navigation.navigate("DriverScreen");
        return;
      }

      if (tab === "deliveries") {
        navigation.navigate("EnviosScreen");
        return;
      }

if (tab === "scan") {
  navigation.navigate("DriverScanOptionsScreen");
  return;
}

      if (tab === "activity") {
        navigation.navigate("NotificationsScreen");
      }
    },
    [navigation]
  );

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Querés salir de tu cuenta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: async () => {
          await removeUserSession();

          navigation.getParent()?.reset({
            index: 0,
            routes: [{ name: "HomeScreen" as never }],
          });
        },
      },
    ]);
  };

  if (!user) {
    return (
      <View style={styles.center}>
        <ThemedStatusBar />
        <LynxPulseLoader message="Cargando cuenta..." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ThemedStatusBar />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>LYNX DRIVER</Text>
          <Text style={styles.title}>Mi cuenta</Text>
          <Text style={styles.subtitle}>
            Perfil, documentación y configuración.
          </Text>
        </View>

        <View style={styles.profileCard}>
          <Image source={avatarSource} style={styles.avatar} />

          <View style={styles.profileInfo}>
            <Text style={styles.name}>{driverName}</Text>
            <Text style={styles.email} numberOfLines={1}>
              {user?.email || username || "Sin email"}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <AccountItem
            icon="person-outline"
            title="Datos personales"
            description={username || "Usuario no disponible"}
          />

          <AccountItem
            icon="home-outline"
            title="Mi domicilio"
            description={homeAddress === undefined ? "Para el mapa y los recorridos" : homeAddress || "Sin cargar: tocá para cargarlo"}
            onPress={() => navigation.navigate("DriverHomeScreen")}
          />

          <AccountItem
            icon="car-outline"
            title="Vehículo"
            description={getVehicleLabel(user)}
          />

          <AccountItem
            icon="document-text-outline"
            title="Documentación"
            description={
              documentsLoading
                ? "Cargando documentación..."
                : "DNI, registro y cédula"
            }
            loading={documentsLoading}
          />

          <AccountItem
            icon="analytics-outline"
            title="Performance"
            description="SLA y rendimiento semanal"
          />

          <AccountItem
            icon="download-outline"
            title="Descargas"
            description="Detalle semanal"
          />

          <AccountItem
            icon="settings-outline"
            title="Configuración"
            description="Apariencia: tema, estilo y bordes"
            onPress={() => navigation.navigate("AppearanceScreen")}
          />
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons
            name="log-out-outline"
            size={18}
            color={theme.status.rejected.icon}
          />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>

      {/* Perfil se abre desde Inicio: la barra lo muestra como parte de Inicio. */}
      <DriverBottomNavigation activeTab="home" onPress={handleTabPress} />
    </View>
  );
}

function AccountItem({
  icon,
  title,
  description,
  loading,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  loading?: boolean;
  onPress?: () => void;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={styles.item}
      onPress={onPress}
      disabled={!onPress || loading}
    >
      <View style={styles.itemIcon}>
        {loading ? (
          <LynxPulseLoader compact showLogo={false} message="" />
        ) : (
          <Ionicons name={icon} size={18} color={theme.text.accent} />
        )}
      </View>

      <View style={styles.itemText}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemDescription} numberOfLines={1}>
          {description}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={17}
        color={theme.text.muted}
      />
    </Pressable>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.surfaces.screen,
  },

  center: {
    flex: 1,
    backgroundColor: t.surfaces.screen,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    paddingTop: t.layout.headerTopPadding,
    paddingHorizontal: t.layout.screenPadding,
    paddingBottom: 132,
  },

  header: {
    marginBottom: t.spacing.md,
  },

  kicker: {
    ...t.typography.kicker,
  },

  title: {
    color: t.text.primary,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: t.font.weight.black,
    letterSpacing: -1.2,
    marginTop: t.spacing.xs,
  },

  subtitle: {
    color: t.text.secondary,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: t.font.weight.bold,
    marginTop: t.spacing.xs,
  },

  profileCard: {
    borderRadius: t.radius.xxl,
    backgroundColor: t.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: t.borders.medium,
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.md,
    marginBottom: t.spacing.md,
    ...t.shadows.card,
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: t.radius.full,
    backgroundColor: t.surfaces.cardStrong,
  },

  profileInfo: {
    flex: 1,
  },

  name: {
    color: t.text.primary,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: t.font.weight.black,
    letterSpacing: -0.6,
  },

  email: {
    color: t.text.muted,
    fontSize: 13,
    fontWeight: t.font.weight.bold,
    marginTop: 2,
  },

  section: {
    borderRadius: t.radius.xxl,
    backgroundColor: t.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: t.borders.medium,
    overflow: "hidden",
  },

  item: {
    minHeight: 56,
    paddingHorizontal: t.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.md,
    borderBottomWidth: t.separator.width,
    borderBottomColor: t.separator.color,
  },

  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: t.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.overlays.primary,
  },

  itemText: {
    flex: 1,
  },

  itemTitle: {
    color: t.text.primary,
    fontSize: 15,
    fontWeight: t.font.weight.black,
  },

  itemDescription: {
    color: t.text.muted,
    fontSize: 12,
    fontWeight: t.font.weight.bold,
    marginTop: 1,
  },

  logoutButton: {
    marginTop: t.spacing.md,
    minHeight: 48,
    borderRadius: t.radius.xl,
    backgroundColor: t.status.rejected.background,
    borderWidth: 1,
    borderColor: t.status.rejected.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: t.spacing.sm,
  },

  logoutText: {
    color: t.status.rejected.text,
    fontSize: 15,
    fontWeight: t.font.weight.black,
  },
});