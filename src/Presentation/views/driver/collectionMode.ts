// src/Presentation/views/driver/collectionMode.ts
// En este MVP la colecta efectiva de envíos se hace en LightData: Lynx no
// marca envíos como colectados desde una colecta (PICKUP) ni da de alta
// envíos desde el QR «Colectar». Las dos implementaciones quedan en el código
// para cuando se habilite; este es el único lugar que lo decide.
// Los Turbo no pasan por acá: su retiro se sigue registrando en Lynx.

import { sharedValue, useSharedValue } from "./work/sharedValue";

export const LYNX_COLLECT_ENABLED = false;

export const COLLECT_IN_LIGHTDATA = {
  title: "Registro de colecta",
  body: "Por ahora, registrá los paquetes retirados desde LightData. Próximamente vas a poder hacerlo directamente en Lynx.",
};

// El aviso es un modal de Lynx (CollectInLightDataModal), montado una vez en
// el stack del chofer: quien lo pide solo lo prende.
const visible = sharedValue(false);
export const showCollectInLightData = () => visible.set(true);
export const hideCollectInLightData = () => visible.set(false);
export const useCollectInLightData = () => useSharedValue(visible);
