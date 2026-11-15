// src/Presentation/views/driver/account/DriverAccountScreen.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
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
} from "../../../components/DriverBottomNavigation";
import { fetchMyHome } from "./homeApi";
import DriverAvatar from "../../../components/driver/DriverAvatar";
import { loadDriverProfile, useDriverProfile } from "./driverProfileApi";
import { documentsLabel, fullName, vehicleLabel } from "./driverProfile";
import { appUpdateLabel } from "../../../config/appUpdates";
import DriverDocumentsViewer from "../../../components/driver/DriverDocumentsViewer";

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

export default function DriverAccountScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { user, removeUserSession } = useViewModel();

  // Lo que cargó en el alta (vehículo, documentos, selfie): se relee al entrar.
  const profile = useDriverProfile();
  const [profileLoading, setProfileLoading] = useState(false);
  // Domicilio: se relee al volver de «Mi domicilio». undefined = cargando o sin red; null = sin domicilio.
  const [homeAddress, setHomeAddress] = useState<string | null | undefined>(undefined);
  const userId = (user as any)?.id;
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchMyHome()
        .then((h) => { if (alive) setHomeAddress(h.address); })
        .catch(() => { if (alive) setHomeAddress(undefined); });
      setProfileLoading(true);
      loadDriverProfile(userId, { force: true }).finally(() => { if (alive) setProfileLoading(false); });
      return () => { alive = false; };
    }, [userId])
  );
  // Qué sección está abierta y si se está viendo la documentación.
  const [open, setOpen] = useState<"personal" | "vehicle" | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const toggle = (section: "personal" | "vehicle") => setOpen(open === section ? null : section);

  const driverName = useMemo(() => getDriverDisplayName(user), [user]);
  const username = (user as any)?.username || user?.email || user?.name || "";

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Querés salir de tu cuenta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        // Sin navegar a mano: al quedar sin sesión, MainStackNavigator deja de
        // montar el stack de Driver y muestra el login. Un reset a "HomeScreen"
        // desde acá apunta a una pantalla que en ese momento no está registrada.
        onPress: removeUserSession,
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
          <DriverAvatar uri={profile?.selfie} size={50} fallback={<Image source={DEFAULT_AVATAR} style={styles.avatar} />} />

          <View style={styles.profileInfo}>
            <Text style={styles.name}>{driverName}</Text>
            <Text style={styles.email} numberOfLines={1}>
              {user?.email || username || "Sin email"}
            </Text>
            {/* La foto nueva reemplaza la selfie del alta; se confirma con el servidor (DriverSelfieScreen). */}
            {profile ? (
              <Pressable onPress={() => navigation.navigate("DriverSelfieScreen")} style={styles.changePhoto} hitSlop={6} accessibilityRole="button" accessibilityLabel="Cambiar foto">
                <Ionicons name="camera-outline" size={15} color={theme.text.accent} />
                <Text style={styles.changePhotoText}>Cambiar foto</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <AccountItem
            icon="person-outline"
            title="Datos personales"
            description={fullName(user as any)}
            expanded={open === "personal"}
            onPress={() => toggle("personal")}
          />
          {open === "personal" ? (
            <View style={styles.details}>
              <Detail label="Nombre y apellido" value={fullName(user as any)} />
              <Detail label="Usuario" value={username || "—"} />
              <Detail label="Correo electrónico" value={user?.email || "Sin cargar"} />
              <Detail label="Teléfono" value={(user as any)?.phone || "Sin cargar"} />
              <Detail label="DNI" value={profile?.dni ?? "Sin cargar"} />
              <Detail label="CUIL" value={profile?.cuil ?? "Sin cargar"} />
            </View>
          ) : null}

          <AccountItem
            icon="home-outline"
            title="Mi domicilio"
            description={homeAddress === undefined ? "Para el mapa y los recorridos" : homeAddress || "Sin cargar: tocá para cargarlo"}
            onPress={() => navigation.navigate("DriverHomeScreen")}
          />

          <AccountItem
            icon="car-outline"
            title="Vehículo"
            description={vehicleLabel(profile)}
            loading={profileLoading && profile === undefined}
            expanded={open === "vehicle"}
            onPress={profile ? () => toggle("vehicle") : undefined}
          />
          {open === "vehicle" && profile ? (
            <View style={styles.details}>
              <Detail label="Vehículo" value={profile.vehicle ?? "Sin cargar"} />
              <Detail label="Patente" value={profile.plate ?? "Sin cargar"} />
            </View>
          ) : null}

          <AccountItem
            icon="document-text-outline"
            title="Documentación"
            description={profileLoading && profile === undefined ? "Cargando documentación..." : documentsLabel(profile)}
            loading={profileLoading && profile === undefined}
            onPress={profile ? () => setDocsOpen(true) : undefined}
          />

          <AccountItem
            icon="analytics-outline"
            title="Performance"
            description="Próximamente: SLA y rendimiento semanal"
          />

          <AccountItem
            icon="download-outline"
            title="Descargas"
            description="Próximamente: detalle semanal"
          />

          <AccountItem
            icon="help-circle-outline"
            title="Ayuda"
            description="Preguntá cómo usar la app"
            onPress={() => navigation.navigate("DriverHelpScreen")}
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

        <Text style={styles.appVersion}>{appUpdateLabel()}</Text>
      </ScrollView>

      {/* Perfil se abre desde Inicio: la barra lo muestra como parte de Inicio. */}
      <DriverBottomNavigation activeTab="home" />

      {/* Los documentos se ven dentro de la app (la dirección viene del pedido autenticado). No hay validación: solo si se envió. */}
      {docsOpen && profile ? (
        <DriverDocumentsViewer
          visible
          documents={profile.documents}
          initialIndex={Math.max(0, profile.documents.findIndex((d) => d.url))}
          onClose={() => setDocsOpen(false)}
        />
      ) : null}
    </View>
  );
}

function AccountItem({
  icon,
  title,
  description,
  loading,
  onPress,
  expanded,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  loading?: boolean;
  onPress?: () => void;
  // Definido: la fila abre un detalle debajo (flecha hacia abajo / arriba).
  expanded?: boolean;
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
        name={expanded === undefined ? "chevron-forward" : expanded ? "chevron-up" : "chevron-down"}
        size={17}
        color={theme.text.muted}
      />
    </Pressable>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.detail}>
      <Text style={styles.itemDescription}>{label}</Text>
      <Text style={styles.detailValue} selectable>{value}</Text>
    </View>
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

  changePhoto: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: t.spacing.xs, minHeight: 28 },
  changePhotoText: { color: t.text.accent, fontSize: 13, fontWeight: t.font.weight.black },

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

  details: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    gap: t.spacing.sm,
    backgroundColor: t.surfaces.muted,
    borderBottomWidth: t.separator.width,
    borderBottomColor: t.separator.color,
  },

  detail: {
    gap: 1,
  },

  detailValue: {
    color: t.text.primary,
    fontSize: 14,
    fontWeight: t.font.weight.bold,
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
  appVersion: {
    marginTop: t.spacing.md,
    textAlign: "center",
    color: t.text.secondary,
    fontSize: 12,
  },
});