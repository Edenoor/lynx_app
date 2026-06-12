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
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import AppTheme from "../../../theme/AppTheme";
import { LynxPulseLoader } from "../../../components/LynxPulseLoader";
import useViewModel from "../landing/ViewModel";
import {
  DriverBottomNavigation,
  DriverTabKey,
} from "../../../components/DriverBottomNavigation";

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
  const { user, removeUserSession } = useViewModel();

  const [documentsLoading] = useState(false);

  const driverName = useMemo(() => getDriverDisplayName(user), [user]);
  const username = (user as any)?.username || user?.email || user?.name || "";

  const avatarSource = useMemo(() => getDriverSelfieSource(user), [user]);

  const handleTabPress = useCallback(
    (tab: DriverTabKey) => {
      if (tab === "profile") return;

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
        <LynxPulseLoader message="Cargando cuenta..." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
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
            description="Preferencias"
          />
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons
            name="log-out-outline"
            size={18}
            color={AppTheme.colors.danger}
          />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>

      <DriverBottomNavigation activeTab="profile" onPress={handleTabPress} />
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
          <Ionicons name={icon} size={18} color={AppTheme.colors.primary} />
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
        color={AppTheme.text.muted}
      />
    </Pressable>
  );
}

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
  },

  content: {
    paddingTop: AppTheme.layout.headerTopPadding,
    paddingHorizontal: AppTheme.layout.screenPadding,
    paddingBottom: 132,
  },

  header: {
    marginBottom: AppTheme.spacing.md,
  },

  kicker: {
    ...AppTheme.typography.kicker,
  },

  title: {
    color: AppTheme.text.primary,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: AppTheme.font.weight.black,
    letterSpacing: -1.2,
    marginTop: AppTheme.spacing.xs,
  },

  subtitle: {
    color: AppTheme.text.secondary,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: AppTheme.font.weight.bold,
    marginTop: AppTheme.spacing.xs,
  },

  profileCard: {
    borderRadius: AppTheme.radius.xxl,
    backgroundColor: AppTheme.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    paddingVertical: AppTheme.spacing.sm,
    paddingHorizontal: AppTheme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.md,
    marginBottom: AppTheme.spacing.md,
    ...AppTheme.shadows.card,
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: AppTheme.radius.full,
    backgroundColor: AppTheme.surfaces.cardStrong,
  },

  profileInfo: {
    flex: 1,
  },

  name: {
    color: AppTheme.text.primary,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: AppTheme.font.weight.black,
    letterSpacing: -0.6,
  },

  email: {
    color: AppTheme.text.muted,
    fontSize: 13,
    fontWeight: AppTheme.font.weight.bold,
    marginTop: 2,
  },

  section: {
    borderRadius: AppTheme.radius.xxl,
    backgroundColor: AppTheme.surfaces.cardElevated,
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    overflow: "hidden",
  },

  item: {
    minHeight: 56,
    paddingHorizontal: AppTheme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.borders.soft,
  },

  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: AppTheme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.overlays.primary,
  },

  itemText: {
    flex: 1,
  },

  itemTitle: {
    color: AppTheme.text.primary,
    fontSize: 15,
    fontWeight: AppTheme.font.weight.black,
  },

  itemDescription: {
    color: AppTheme.text.muted,
    fontSize: 12,
    fontWeight: AppTheme.font.weight.bold,
    marginTop: 1,
  },

  logoutButton: {
    marginTop: AppTheme.spacing.md,
    minHeight: 48,
    borderRadius: AppTheme.radius.xl,
    backgroundColor: "rgba(239, 68, 68, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.28)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: AppTheme.spacing.sm,
  },

  logoutText: {
    color: AppTheme.colors.danger,
    fontSize: 15,
    fontWeight: AppTheme.font.weight.black,
  },
});