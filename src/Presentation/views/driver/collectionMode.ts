// src/Presentation/views/driver/collectionMode.ts
// En este MVP la colecta efectiva de envíos se hace en LightData: Lynx no
// marca envíos como colectados desde una colecta (PICKUP) ni da de alta
// envíos desde el QR «Colectar». Las dos implementaciones quedan en el código
// para cuando se habilite; este es el único lugar que lo decide.
// Los Turbo no pasan por acá: su retiro se sigue registrando en Lynx.

import { Alert } from "react-native";

export const LYNX_COLLECT_ENABLED = false;

export const showCollectInLightData = () =>
  Alert.alert(
    "Colectar desde LightData",
    "Por ahora, realizá la colecta de los envíos desde LightData. Próximamente vas a poder registrar los paquetes retirados directamente en Lynx.",
    [{ text: "Entendido" }],
  );
