// src/Presentation/components/driver/DriverDocumentsViewer.tsx
// La documentación del alta en un visor: un documento por página (se pasa
// deslizando, con Anterior / Siguiente o tocando su nombre arriba). Solo
// muestra lo que ya se envió: no valida ni descarga. Un documento que falta
// se dice en su página, sin romper el resto. Se monta al abrirlo (arranca
// en initialIndex cada vez).

import React, { useRef, useState } from "react";
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme, useThemedStyles } from "../../theme/ThemeContext";
import type { Theme } from "../../theme/createTheme";
import type { DriverDocument } from "../../views/driver/account/driverProfile";

type Props = {
  visible: boolean;
  documents: DriverDocument[];
  // Documento con el que abre (el primero enviado, si no se dice otro).
  initialIndex?: number;
  onClose: () => void;
};

export function DriverDocumentsViewer({ visible, documents, initialIndex = 0, onClose }: Props) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const list = useRef<FlatList<DriverDocument>>(null);
  const [index, setIndex] = useState(initialIndex);
  const current = documents[index];

  const go = (i: number) => {
    if (i < 0 || i >= documents.length) return;
    setIndex(i);
    list.current?.scrollToIndex({ index: i, animated: true });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Documentación</Text>
            <Text style={styles.title} numberOfLines={1}>{current?.label ?? ""}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cerrar documentación">
            <Ionicons name="close" size={24} color={theme.text.primary} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsBox} contentContainerStyle={styles.chips}>
          {documents.map((d, i) => (
            <Pressable key={d.key} onPress={() => go(i)} style={[styles.chip, i === index && styles.chipOn]} accessibilityRole="button"
              accessibilityLabel={`${d.label}: ${d.url ? "enviado" : "falta"}`} accessibilityState={{ selected: i === index }}>
              <Ionicons name={d.url ? "checkmark-circle" : "alert-circle-outline"} size={14} color={d.url ? theme.status.confirmed.text : theme.status.pending.text} />
              <Text style={[styles.chipText, i === index && styles.chipTextOn]}>{d.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <FlatList
          ref={list}
          data={documents}
          keyExtractor={(d) => d.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={styles.pages}
          renderItem={({ item }) => (
            <View style={[styles.page, { width }]}>
              {item.url ? (
                <Image source={{ uri: item.url }} style={styles.image} resizeMode="contain" accessibilityLabel={item.label} />
              ) : (
                <View style={styles.missing}>
                  <Ionicons name="document-outline" size={40} color={theme.text.muted} />
                  <Text style={styles.missingTitle}>{item.label}: no enviado</Text>
                  <Text style={styles.missingText}>Para cargarlo, hablá con tu coordinador.</Text>
                </View>
              )}
            </View>
          )}
        />

        <View style={styles.foot}>
          <Pressable onPress={() => go(index - 1)} disabled={index === 0} style={[styles.navBtn, index === 0 && styles.navOff]} accessibilityRole="button" accessibilityLabel="Documento anterior">
            <Ionicons name="chevron-back" size={18} color={theme.text.primary} />
            <Text style={styles.navText}>Anterior</Text>
          </Pressable>
          <Text style={styles.counter}>{documents.length ? `${index + 1} de ${documents.length}` : ""}</Text>
          <Pressable onPress={() => go(index + 1)} disabled={index >= documents.length - 1} style={[styles.navBtn, index >= documents.length - 1 && styles.navOff]} accessibilityRole="button" accessibilityLabel="Documento siguiente">
            <Text style={styles.navText}>Siguiente</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.text.primary} />
          </Pressable>
        </View>
        <Text style={styles.note}>Para corregir un documento, hablá con tu coordinador.</Text>
      </View>
    </Modal>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.surfaces.screen },
  head: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: t.layout.screenPadding, paddingBottom: 8 },
  kicker: { ...t.typography.kicker },
  title: { color: t.text.primary, fontSize: 18, fontWeight: t.font.weight.bold },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  chipsBox: { flexGrow: 0 },
  chips: { gap: 6, paddingHorizontal: t.layout.screenPadding, paddingBottom: t.spacing.sm },
  chip: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: t.borders.default, backgroundColor: t.surfaces.card },
  chipOn: { borderColor: t.colors.primary, backgroundColor: t.surfaces.cardStrong },
  chipText: { color: t.text.secondary, fontSize: 13, fontWeight: t.font.weight.medium },
  chipTextOn: { color: t.text.primary, fontWeight: t.font.weight.bold },
  pages: { flex: 1 },
  page: { flex: 1, paddingHorizontal: t.layout.screenPadding, paddingVertical: t.spacing.sm },
  image: { flex: 1, width: "100%" },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: t.spacing.xl },
  missingTitle: { color: t.text.primary, fontSize: 16, fontWeight: t.font.weight.bold, textAlign: "center" },
  missingText: { color: t.text.secondary, fontSize: 14, textAlign: "center" },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: t.layout.screenPadding, paddingTop: t.spacing.sm },
  navBtn: { minHeight: 44, minWidth: 104, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 12, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.borders.default },
  navOff: { opacity: 0.4 },
  navText: { color: t.text.primary, fontSize: 14, fontWeight: t.font.weight.bold },
  counter: { color: t.text.secondary, fontSize: 13 },
  note: { color: t.text.muted, fontSize: 12, textAlign: "center", paddingHorizontal: t.layout.screenPadding, paddingTop: t.spacing.sm },
});

export default DriverDocumentsViewer;
