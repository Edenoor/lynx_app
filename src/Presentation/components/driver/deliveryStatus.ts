// src/Presentation/components/driver/deliveryStatus.ts
// Color de estado de un envío en Envíos: mismas reglas que tenía la tarjeta,
// expresadas como estado del tema (StatusChip). Sin React: se prueba con node.

import type { StatusKey } from "../../theme/createTheme";

const normalize = (value?: string | null) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

export function deliveryStatusKey(rawStatus?: string | null): StatusKey {
  const s = normalize(rawStatus);

  if (s.includes("entregado")) return "delivered";
  if (s.includes("retirado") || s.includes("en camino") || s.includes("transit")) return "inTransit";
  if (s.includes("solicitado") || s.includes("creado") || s.includes("pendiente")) return "pending";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("rechaz")) return "rejected";
  if (s.includes("nadie") || s.includes("reprogram")) return "incident";

  return "neutral";
}
