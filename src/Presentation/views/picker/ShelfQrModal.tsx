// src/Presentation/views/picker/ShelfQrModal.tsx
// QR de una estantería en grande, el mismo que está impreso en ella. Solo se
// muestra: no registra nada en el servidor.

import React from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";

import AppTheme from "../../theme/AppTheme";
import { Shelf, shelfQrPayload } from "./warehouseApi";

export function ShelfQrModal({ shelf, onClose }: { shelf: Shelf | null; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const payload = shelf ? shelfQrPayload(shelf) : null;
  const size = Math.min(width - 96, 320);

  return (
    <Modal visible={!!payload} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {shelf && payload ? (
          // El toque sobre la tarjeta no cierra: solo el fondo y el botón.
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.header}>
              <View style={styles.titles}>
                <Text style={styles.name} numberOfLines={2}>{shelf.name || shelf.code}</Text>
                <Text style={styles.code}>{shelf.code}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar">
                <Ionicons name="close" size={28} color={AppTheme.text.primary} />
              </Pressable>
            </View>
            <View style={styles.qr}>
              <QRCode value={payload} size={size} quietZone={16} backgroundColor="#FFFFFF" color="#000000" />
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>Cerrar</Text>
            </Pressable>
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 16,
    padding: 20,
    borderRadius: AppTheme.radius.lg,
    backgroundColor: AppTheme.surfaces.cardElevated,
  },
  header: { alignSelf: "stretch", flexDirection: "row", alignItems: "flex-start", gap: 12 },
  titles: { flex: 1, gap: 2 },
  name: { color: AppTheme.text.primary, fontSize: 20, fontWeight: "800" },
  code: { color: AppTheme.text.secondary, fontSize: 15, fontWeight: "700" },
  qr: { borderRadius: 8, overflow: "hidden" },
  closeButton: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.borders.primary,
  },
  closeText: { color: AppTheme.text.accent, fontWeight: "700", fontSize: 16 },
});
