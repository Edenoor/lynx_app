import { User } from "../../Domain/entities/User";

// A qué parte de la app entra cada usuario, y qué puede hacer adentro del
// depósito. Sale de los PERMISOS que informa el servidor (GET
// /v2/auth/capabilities → permissions), no del nombre del perfil: un
// Coordinador con un rol que incluya «recibir y ubicar» opera el depósito sin
// ser Picker. La autoridad sigue siendo el servidor en cada pedido; esto solo
// evita mostrar algo que el servidor rechazaría.
export type AppArea = "auth" | "driver" | "picker" | "adminWeb" | "seller";

// Permisos del depósito que usa la app (claves del catálogo del servidor).
export const PERMISSION = {
  DEPOSITO_VER: "deposito.ver",
  RECIBIR: "deposito.recibir",
  BAUL_VER: "deposito.baul",
  BAUL_OPERAR: "deposito.baul_operar",
} as const;

// Con cualquiera de estos se entra al área de depósito.
const DEPOSITO_ENTRY = [PERMISSION.RECIBIR, PERMISSION.BAUL_OPERAR];

type WithAccess = Pick<User, "rol" | "profile" | "permissions"> | null | undefined;

// ¿Tiene alguno de estos permisos? Un servidor anterior a los permisos no
// manda la lista: ahí vale lo de siempre, el perfil Picker lo puede todo en
// el depósito y el resto nada.
export const hasPermission = (user: WithAccess, ...keys: string[]): boolean => {
  if (!user || user.rol?.toUpperCase() !== "ADMIN") return false;
  if (Array.isArray(user.permissions)) return keys.some((k) => user.permissions!.includes(k));
  return user.profile?.toUpperCase() === "PICKER";
};

export const resolveAppArea = (user: User | null): AppArea => {
  if (!user) return "auth";
  const rol = user.rol?.toUpperCase();
  if (rol === "DRIVER") return "driver";
  if (rol === "ADMIN") return hasPermission(user, ...DEPOSITO_ENTRY) ? "picker" : "adminWeb";
  return "seller";
};

// Para saber si lo guardado quedó viejo (misma lista, en cualquier orden).
export const sameAccess = (
  a: { profile?: string | null; permissions?: string[] | null },
  b: { profile?: string | null; permissions?: string[] | null },
): boolean => {
  if ((a.profile ?? null) !== (b.profile ?? null)) return false;
  const pa = Array.isArray(a.permissions) ? [...a.permissions].sort() : null;
  const pb = Array.isArray(b.permissions) ? [...b.permissions].sort() : null;
  if (pa === null || pb === null) return pa === pb;
  return pa.length === pb.length && pa.every((k, i) => k === pb[i]);
};
