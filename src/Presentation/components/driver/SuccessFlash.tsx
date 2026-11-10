// src/Presentation/components/driver/SuccessFlash.tsx
// Confirmación breve de algo que el servidor ya aceptó (una entrega
// registrada, una parada cerrada, un recorrido completado): un check verde que
// aparece y se va solo. No reemplaza a nada de la pantalla (lo resuelto queda
// a la vista) y no toca nada. Con «reducir movimiento» del teléfono aparece y
// se va sin animación. Siempre se anuncia al lector de pantalla.

import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme, useThemedStyles } from "../../theme/ThemeContext";
import type { Theme } from "../../theme/createTheme";

// `key` distinto = una confirmación nueva (aunque el texto se repita).
export type FlashMessage = { text: string; key: number };

const VISIBLE_MS = 1800;
const FADE_MS = 180;

// Una confirmación para la pantalla a la que se vuelve (p. ej. «Orden
// guardado» al volver del organizador al recorrido): la deja quien la causó y
// la toma la otra al recuperar el foco.
let pending: string | null = null;
export const queueFlash = (text: string) => { pending = text; };
export const takeFlash = () => { const text = pending; pending = null; return text; };

export function SuccessFlash({ message, bottom = 112 }: { message: FlashMessage | null; bottom?: number }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const opacity = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return undefined;
    let alive = true;
    let reduce = false;
    setShown(message.text);
    AccessibilityInfo.announceForAccessibility?.(message.text);
    const fade = (to: number, done?: () => void) => {
      if (reduce) { opacity.setValue(to); done?.(); return; }
      Animated.timing(opacity, { toValue: to, duration: FADE_MS, useNativeDriver: true }).start(() => done?.());
    };
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.())
      .catch(() => false)
      .then((r) => { if (!alive) return; reduce = !!r; fade(1); });
    const timer = setTimeout(() => fade(0, () => { if (alive) setShown(null); }), VISIBLE_MS);
    return () => { alive = false; clearTimeout(timer); };
  }, [message?.key]);

  if (!shown) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { bottom, opacity }]}>
      <View style={styles.pill} accessibilityLiveRegion="polite" accessibilityLabel={shown}>
        <Ionicons name="checkmark-circle" size={22} color={theme.text.onPrimary} />
        <Text style={styles.text}>{shown}</Text>
      </View>
    </Animated.View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 50 },
  // Relleno verde con texto blanco (colors.success, como los botones).
  pill: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: t.colors.success, ...t.shadows.card },
  text: { color: t.text.onPrimary, fontSize: 15, fontWeight: t.font.weight.bold },
});

export default SuccessFlash;
