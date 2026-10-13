import { User } from "../../Domain/entities/User";

// A qué parte de la app entra cada usuario. Un ADMIN se decide por su perfil
// (admin_data.profile): PICKER opera el depósito; el resto, por ahora, en la
// Web. Cualquier otro rol sigue entrando como vendedor, como antes.
export type AppArea = "auth" | "driver" | "picker" | "adminWeb" | "seller";

export const resolveAppArea = (user: User | null): AppArea => {
  if (!user) return "auth";
  const rol = user.rol?.toUpperCase();
  if (rol === "DRIVER") return "driver";
  if (rol === "ADMIN") return user.profile?.toUpperCase() === "PICKER" ? "picker" : "adminWeb";
  return "seller";
};
