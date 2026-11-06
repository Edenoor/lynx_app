// src/Presentation/components/driver/ProviderBadge.tsx
// Logo del canal comercial de un envío (el `provider` que manda el servidor),
// con los mismos logos de Tiendas. Sin provider conocido no se muestra nada:
// el logo acompaña al tracking, no lo reemplaza.

import React from "react";
import { Image, ImageSourcePropType, StyleSheet } from "react-native";

const LOGO: Record<string, ImageSourcePropType> = {
  mercadolibre: require("../../../../assets/mercadolibre.png"),
  tiendanube: require("../../../../assets/tiendanube.png"),
  shopify: require("../../../../assets/shopify.png"),
  woocommerce: require("../../../../assets/woocommerce.png"),
};

export const PROVIDER_LABEL: Record<string, string> = {
  mercadolibre: "Mercado Libre",
  tiendanube: "Tienda Nube",
  shopify: "Shopify",
  woocommerce: "WooCommerce",
};

export default function ProviderBadge({ provider }: { provider?: string | null }) {
  const source = provider ? LOGO[provider] : undefined;
  if (!source) return null;
  return <Image source={source} style={styles.logo} resizeMode="contain" accessible accessibilityLabel={PROVIDER_LABEL[provider!]} />;
}

const styles = StyleSheet.create({
  logo: { width: 28, height: 16 },
});
