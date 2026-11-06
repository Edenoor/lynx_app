// src/Presentation/views/driver/account/driverProfileApi.ts
// Lee el perfil del alta (ver driverProfile.ts) y lo comparte entre Inicio y
// Mi cuenta: un solo pedido por sesión, y se vuelve a leer al entrar a Mi
// cuenta. Se vacía al cerrar sesión (resetDriverProfile).

import { getJson } from "../../../config/Api";
import { sharedValue, useSharedValue } from "../work/sharedValue";
import { DriverProfile, parseProfile } from "./driverProfile";

// undefined = todavía no se leyó (o falló); null = el usuario no tiene ficha de chofer.
const profile = sharedValue<DriverProfile | null | undefined>(undefined);
let inflight: Promise<void> | null = null;

const unwrap = (res: any) => {
  if (!res || res.ok === false) throw new Error(res?.error || res?.message || "Error del servidor");
  return res;
};

export function loadDriverProfile(userId: number | string | null | undefined, { force = false } = {}): Promise<void> {
  if (userId === null || userId === undefined || userId === "") return Promise.resolve();
  if (!force && profile.get() !== undefined) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const role = unwrap(await getJson(`/v2/users/${userId}/role`));
      const id = Number(role?.data?.id);
      const extra = Number.isInteger(id) && id > 0 ? unwrap(await getJson(`/v2/drivers/${id}/extra`)).extra ?? null : null;
      profile.set(parseProfile(role?.data, extra));
    } catch {
      // Sin red o sin respuesta: se queda lo que había (o el avatar genérico).
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export const useDriverProfile = () => useSharedValue(profile);
export const resetDriverProfile = () => { profile.set(undefined); inflight = null; };
