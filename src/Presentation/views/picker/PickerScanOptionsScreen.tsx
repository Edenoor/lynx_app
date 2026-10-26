// src/Presentation/views/picker/PickerScanOptionsScreen.tsx
// Qué operación de escaneo quiere hacer el Picker (misma pantalla que la del
// chofer, con sus propias acciones). Recepcionar y Mover de estantería son
// reales; Consultar espera un endpoint de consulta y las otras dos son
// maquetas sin guardado.
// Colectar se agrega cuando exista su contrato en el servidor.

import React from "react";
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../theme/AppTheme";
import { SafeScreen } from "../../components/SafeScreen";
import { QrActionGrid } from "../../components/QrActionGrid";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { PickerBottomNavigation, usePickerBottomSpace } from "./PickerBottomNavigation";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerScanOptionsScreen">;

export default function PickerScanOptionsScreen({ navigation, route }: Props) {
  const { warehouseId } = route.params;
  const bottomSpace = usePickerBottomSpace();

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
            actions={[
              {
                key: "receive",
                icon: "file-tray-stacked-outline",
                label: "Recepcionar",
                onPress: () => navigation.navigate("PickerScanScreen", { warehouseId }),
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
            ]}
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
