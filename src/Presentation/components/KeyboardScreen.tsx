// src/Presentation/components/KeyboardScreen.tsx
// Pantalla con formulario que no queda tapada por el teclado (Android e iOS).
//
// La app es edge-to-edge en Android (Expo 54 llama a enableEdgeToEdge al
// arrancar y la ventana deja de ajustarse a las barras del sistema): el
// `adjustResize` del manifest ya no achica nada, el teclado se dibuja encima
// del contenido y el campo con foco queda tapado, sin forma de desplazarse.
// Por eso el corrimiento se hace acá, igual en los dos sistemas: un
// KeyboardAvoidingView con «padding» deja el área útil en lo que queda sobre
// el teclado, y el ScrollView nativo, al achicarse, mantiene a la vista el
// campo con foco (comportamiento estándar de Android/iOS, el mismo que daba
// adjustResize). El `footer` (botón de enviar) queda fijo abajo, siempre
// sobre el teclado.
//
// El KeyboardAvoidingView mide su posición relativa al padre, no a la
// pantalla: debajo de un header nativo (o de cualquier cosa arriba) se queda
// corto justo por esa altura. Acá se mide dónde cae en la pantalla y se le
// pasa como `keyboardVerticalOffset`, así sirve con o sin header.
// Se mide con `measure` (pageY, desde el borde de arriba de la raíz) y no con
// `measureInWindow`: en Android este descuenta la barra de estado, que con
// edge-to-edge sí ocupa pantalla, y el corrimiento quedaba corto por esa
// altura (medido en el Moto: el `footer` quedaba 105 px debajo del teclado).

import React, { useCallback, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

type Props = React.PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  // Estilo del contenido desplazable (padding, gap; `flexGrow: 1` para centrar).
  contentContainerStyle?: StyleProp<ViewStyle>;
  // Fijo abajo, fuera del desplazamiento y encima del teclado.
  footer?: React.ReactNode;
  scrollProps?: Omit<ScrollViewProps, "contentContainerStyle" | "keyboardShouldPersistTaps">;
  // Para desplazar desde la pantalla (por ejemplo, al último mensaje de una charla).
  scrollRef?: React.Ref<ScrollView>;
}>;

export function KeyboardScreen({ children, style, contentContainerStyle, footer, scrollProps, scrollRef }: Props) {
  const outer = useRef<View>(null);
  const [offset, setOffset] = useState(0);
  const onLayout = useCallback(() => {
    outer.current?.measure((_x, _y, _w, _h, _pageX, pageY) => setOffset(Math.max(0, Math.round(pageY))));
  }, []);

  return (
    <View ref={outer} onLayout={onLayout} style={[styles.flex, style]}>
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={offset} style={styles.flex}>
        {/* «handled»: con el teclado abierto, el primer toque en un botón lo
            acciona (no solo cierra el teclado); tocar fuera de un campo lo cierra. */}
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          {...scrollProps}
          style={[styles.flex, scrollProps?.style]}
          contentContainerStyle={contentContainerStyle}
        >
          {children}
        </ScrollView>
        {footer}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
