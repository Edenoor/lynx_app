// src/Presentation/components/driver/OfferNoticeBanner.tsx
// Aviso de oferta nueva arriba de cualquier pantalla del chofer. No es un
// diálogo: no tapa el escaneo ni la entrega, se toca para abrir la bandeja o
// se cierra solo (ver offerStore.ts).

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme, useThemedStyles } from "../../theme/ThemeContext";
import type { Theme } from "../../theme/createTheme";
import { dismissOfferNotice, useOfferNotice } from "../../views/driver/offers/offerStore";

export function OfferNoticeBanner() {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const notice = useOfferNotice();
  if (!notice) return null;
  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
      <View style={[theme.card, styles.card]} accessibilityRole="alert">
        <Pressable
          style={styles.main}
          onPress={() => { dismissOfferNotice(); notice.open(); }}
          accessibilityRole="button"
          accessibilityLabel={`${notice.title}. Ver ofertas`}
        >
          <Ionicons name="flash" size={20} color={theme.text.accent} />
          <View style={styles.flex}>
            <Text style={styles.title}>{notice.title}</Text>
            <Text style={styles.body} numberOfLines={2}>{notice.body}</Text>
          </View>
          <Text style={styles.cta}>Ver</Text>
        </Pressable>
        <Pressable style={styles.close} onPress={dismissOfferNotice} accessibilityRole="button" accessibilityLabel="Cerrar aviso">
          <Ionicons name="close" size={18} color={theme.text.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  wrap: { position: "absolute", left: t.spacing.md, right: t.spacing.md, zIndex: 50, elevation: 12 },
  card: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: t.text.accent, paddingLeft: t.spacing.md, paddingVertical: 6 },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 },
  flex: { flex: 1 },
  title: { color: t.text.primary, fontSize: 15, fontWeight: "800" },
  body: { color: t.text.secondary, fontSize: 13 },
  cta: { color: t.text.accent, fontSize: 14, fontWeight: "800" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});

export default OfferNoticeBanner;
