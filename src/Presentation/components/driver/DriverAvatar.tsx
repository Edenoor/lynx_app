// src/Presentation/components/driver/DriverAvatar.tsx
// La selfie del alta como avatar circular. Sin selfie (o si no carga) se
// muestra lo de siempre (`fallback`).

import React, { useEffect, useState } from "react";
import { Image } from "react-native";

export default function DriverAvatar({ uri, size, fallback }: { uri: string | null | undefined; size: number; fallback: React.ReactElement }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [uri]);
  if (!uri || failed) return fallback;
  return (
    <Image source={{ uri }} onError={() => setFailed(true)} accessibilityLabel="Tu foto"
      style={{ width: size, height: size, borderRadius: size / 2 }} />
  );
}
