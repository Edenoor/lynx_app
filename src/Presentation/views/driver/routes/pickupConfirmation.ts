// src/Presentation/views/driver/routes/pickupConfirmation.ts
// Confirmación de colectas. El servidor no deja iniciar una colecta (PICKUP)
// asignada hasta que el chofer la acepta (409 «la colecta todavía no fue
// confirmada por el chofer»), sea manual o de una ronda fija. Acá solo se
// decide qué mostrar; la regla la sigue aplicando el servidor.

type RouteLike = {
  type: "PICKUP" | "DELIVERY" | "TURBO";
  status: string;
  driver_confirmation?: "ACCEPTED" | "DECLINED" | null;
  template_id?: number | null;
  confirmation_state?: string | null;
};

export type PickupAnswer = "PENDING" | "ACCEPTED" | "DECLINED";

export const PICKUP_ANSWER_LABEL: Record<PickupAnswer, string> = {
  PENDING: "Pendiente de confirmar",
  ACCEPTED: "Aceptada",
  DECLINED: "Rechazada",
};

// Colecta asignada que todavía no salió: es la que se acepta o se rechaza.
export const awaitsPickupAnswer = (r: RouteLike) => r.type === "PICKUP" && r.status === "ASSIGNED";

export const pickupAnswer = (r: RouteLike): PickupAnswer | null =>
  awaitsPickupAnswer(r) ? r.driver_confirmation ?? "PENDING" : null;

// «Salir a la calle»: un reparto sale cargado; una colecta, aceptada; un Turbo
// asignado sale directo.
export const canStartRoute = (r: RouteLike) =>
  r.status === "LOADED" ||
  (r.type !== "DELIVERY" && r.status === "ASSIGNED" && (r.type !== "PICKUP" || r.driver_confirmation === "ACCEPTED"));

// Recorridos de mañana que piden respuesta: las rondas fijas sin aceptar (como
// hasta ahora) y cualquier colecta asignada sin aceptar.
export const needsAnswer = (r: RouteLike) =>
  (!!r.template_id && !!r.confirmation_state && r.confirmation_state !== "ACCEPTED") ||
  (awaitsPickupAnswer(r) && r.driver_confirmation !== "ACCEPTED");
