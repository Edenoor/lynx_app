// src/Presentation/components/driver/CollectInLightDataModal.tsx
// «Registro de colecta»: la colecta se registra en LightData durante este MVP
// (ver collectionMode.ts). Reemplaza el diálogo del sistema por uno de Lynx.

import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme, useThemedStyles } from "../../theme/ThemeContext";
import type { Theme } from "../../theme/createTheme";
import { COLLECT_IN_LIGHTDATA, hideCollectInLightData, useCollectInLightData } from "../../views/driver/collectionMode";

export function CollectInLightDataModal() {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const visible = useCollectInLightData();

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={hideCollectInLightData}>
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
          <View style={styles.icon}>
            <Ionicons name="cube-outline" size={24} color={theme.status.inTransit.icon} />
          </View>
          <Text style={styles.title} accessibilityRole="header">{COLLECT_IN_LIGHTDATA.title}</Text>
          <Text style={styles.body}>{COLLECT_IN_LIGHTDATA.body}</Text>
          <Pressable style={styles.button} onPress={hideCollectInLightData} accessibilityRole="button">
            <Text style={styles.buttonText}>Entendido</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: t.overlays.camera, justifyContent: "center", padding: t.spacing.lg },
  card: { maxWidth: 420, width: "100%", alignSelf: "center", borderRadius: t.radius.xl, backgroundColor: t.surfaces.screenAlt, borderWidth: 1, borderColor: t.borders.medium, padding: t.spacing.lg, gap: t.spacing.sm, ...t.shadows.card },
  icon: { width: 48, height: 48, borderRadius: t.radius.full, alignItems: "center", justifyContent: "center", backgroundColor: t.status.inTransit.background, borderWidth: 1, borderColor: t.status.inTransit.border },
  title: { color: t.text.primary, fontSize: 20, fontWeight: t.font.weight.black, marginTop: t.spacing.xs },
  body: { color: t.text.secondary, fontSize: 15, lineHeight: 21 },
  button: { marginTop: t.spacing.sm, minHeight: 48, borderRadius: t.radius.md, backgroundColor: t.colors.primary, alignItems: "center", justifyContent: "center" },
  buttonText: { color: t.text.onPrimary, fontSize: 15, fontWeight: t.font.weight.black },
});

export default CollectInLightDataModal;
