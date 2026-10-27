// src/Presentation/views/driver/routes/routeStatus.ts
// Color de estado de un recorrido de reparto o Turbo en la lista. El texto
// sigue saliendo de STATUS_LABEL. Sin React: se prueba con node.

import type { StatusKey } from "../../../theme/createTheme";
import type { RouteStatus } from "./routesApi";

export function routeStatusKey(status: RouteStatus): StatusKey {
  if (status === "IN_PROGRESS") return "inTransit";
  if (status === "COMPLETED") return "delivered";
  if (status === "CANCELLED") return "cancelled";
  return "neutral";
}
