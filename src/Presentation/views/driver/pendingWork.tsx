// src/Presentation/views/driver/pendingWork.tsx
// Lo cargado y todavía sin confirmar (un envío a medio cerrar, una cantidad,
// una observación, un orden de paradas) no se pierde por salir de la
// pantalla: Atrás, el gesto de iOS y la barra (driverTabs.ts, que hace un
// reset) pasan por el mismo aviso y el chofer elige quedarse o salir.
//
// Cada formulario llama a usePendingWork(pendiente). Es usePreventRemove de
// React Navigation: vale desde cualquier componente de la pantalla, y la
// salida que el chofer confirma ya no se vuelve a frenar en esa pantalla.

import { Alert } from "react-native";
import { useNavigation, usePreventRemove } from "@react-navigation/native";

// Dos formularios pendientes en la misma pantalla frenan la misma salida a la
// vez: un solo aviso.
let asking = false;

export function confirmLeave(leave: () => void) {
  if (asking) return;
  asking = true;
  setTimeout(() => { asking = false; }, 0);
  Alert.alert(
    "Tenés algo sin confirmar",
    "Si salís ahora, se pierde lo que cargaste y todavía no confirmaste.",
    [
      { text: "Seguir acá", style: "cancel" },
      { text: "Salir igual", style: "destructive", onPress: leave },
    ]
  );
}

export function usePendingWork(pending: boolean) {
  const navigation = useNavigation<any>();
  usePreventRemove(pending, ({ data }) => confirmLeave(() => navigation.dispatch(data.action)));
}
