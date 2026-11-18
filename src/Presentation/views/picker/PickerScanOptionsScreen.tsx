// src/Presentation/views/picker/PickerScanOptionsScreen.tsx
// Qué operación de escaneo quiere hacer el Picker (misma pantalla que la del
// chofer, con sus propias acciones). Recepcionar, Recepcionar colecta, Baúl y
// Mover de estantería son reales; Consultar espera un endpoint de consulta y
// las otras dos son maquetas sin guardado.

import React, { useContext } from "react";
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../theme/AppTheme";
import { SafeScreen } from "../../components/SafeScreen";
import { QrActionGrid, QrAction } from "../../components/QrActionGrid";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { PickerBottomNavigation, usePickerBottomSpace } from "./PickerBottomNavigation";
import { UserContext } from "../../context/UserContext";
import { hasPermission, PERMISSION } from "../../navigator/appArea";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerScanOptionsScreen">;

export default function PickerScanOptionsScreen({ navigation, route }: Props) {
  const { warehouseId } = route.params;
  const bottomSpace = usePickerBottomSpace();
  const { user } = useContext(UserContext);
  // Recibir, recibir una colecta y mover piden «recibir y ubicar»; el baúl,
  // «operar baúl». Lo que no puede hacer no se le ofrece.
  const puedeRecibir = hasPermission(user, PERMISSION.RECIBIR);
  const puedeBaul = hasPermission(user, PERMISSION.BAUL_OPERAR);
  const needs: Record<string, boolean> = { receive: puedeRecibir, receiveColecta: puedeRecibir, move: puedeRecibir, baul: puedeBaul };

  return (
    <ImageBackground
      source={require("../../../../assets/background-1.png")}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <SafeScreen edges={["top", "left", "right"]} style={styles.safeArea}>
        <ScrollView contentContainerStyle={[styles.page, { paddingBottom: bottomSpace }]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back}>
            <Ionicons name="arrow-back" size={26} color={AppTheme.text.primary} />
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.eyebrow}>Escaneo QR</Text>
            <Text style={styles.title}>¿Qué querés hacer?</Text>
            <Text style={styles.subtitle}>Elegí el tipo de operación antes de abrir la cámara.</Text>
          </View>

          <QrActionGrid
            actions={([
              {
                key: "receive",
                icon: "file-tray-stacked-outline",
                label: "Recepcionar",
                onPress: () => navigation.navigate("PickerScanScreen", { warehouseId }),
              },
              {
                // Misma recepción, sumando cada paquete a la colecta elegida
                // (Control 3). Recepcionar sigue sin colecta.
                key: "receiveColecta",
                icon: "albums-outline",
                label: "Recepcionar colecta",
                onPress: () => navigation.navigate("PickerColectasScreen", { warehouseId }),
              },
              {
                // Etiqueta original de un envío que trae un chofer: paquete, cambio o cobranza.
                key: "baul",
                icon: "briefcase-outline",
                label: "Baúl del chofer",
                onPress: () => navigation.navigate("PickerBaulScanScreen", {}),
              },
              {
                // Se escanea la estantería de origen y se elige el paquete:
                // sin consulta por QR del paquete, no se recepciona para mover.
                key: "move",
                icon: "swap-horizontal-outline",
                label: "Mover de estantería",
                onPress: () => navigation.navigate("PickerShelfScanScreen", { warehouseId, purpose: "move" }),
              },
              {
                // Sin un endpoint de consulta de solo lectura daría falsos
                // "no encontrado": no se abre el escáner.
                key: "lookup",
                icon: "search-outline",
                label: "Consultar",
                note: "Próximamente",
                disabled: true,
                onPress: () => {},
              },
              {
                key: "bulky",
                icon: "barbell-outline",
                label: "Grande / Voluminoso",
                note: "Maqueta",
                onPress: () => navigation.navigate("PickerBulkyMockScreen", { warehouseId }),
              },
              {
                key: "report",
                icon: "alert-circle-outline",
                label: "Reportar problema",
                note: "Maqueta",
                onPress: () => navigation.navigate("PickerReportMockScreen", { warehouseId }),
              },
            ] as QrAction[]).filter((a) => needs[a.key] !== false)}
          />
        </ScrollView>

        <PickerBottomNavigation activeTab="scan" warehouseId={warehouseId} />
      </SafeScreen>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: AppTheme.colors.background },
  backgroundImage: { opacity: 0.18 },
  safeArea: { backgroundColor: "transparent" },
  page: { flexGrow: 1, paddingHorizontal: AppTheme.layout.screenPadding, paddingTop: AppTheme.spacing.md },
  back: { alignSelf: "flex-start", paddingVertical: AppTheme.spacing.xs },
  header: { gap: AppTheme.spacing.xs, marginBottom: AppTheme.spacing.xl, paddingTop: AppTheme.spacing.md },
  eyebrow: {
    color: AppTheme.text.accent,
    fontSize: AppTheme.font.size.sm,
    fontWeight: AppTheme.font.weight.black,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: { color: AppTheme.text.primary, fontSize: AppTheme.font.size.xxl, fontWeight: AppTheme.font.weight.black },
  subtitle: { color: AppTheme.text.secondary, fontSize: AppTheme.font.size.md, lineHeight: 22 },
});
