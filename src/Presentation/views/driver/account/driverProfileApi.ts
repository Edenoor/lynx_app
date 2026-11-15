// src/Presentation/views/driver/account/driverProfileApi.ts
// Lee el perfil del alta (ver driverProfile.ts) y lo comparte entre Inicio y
// Mi cuenta: un solo pedido por sesión, y se vuelve a leer al entrar a Mi
// cuenta. Se vacía al cerrar sesión (resetDriverProfile).

import { getJson, putJson } from "../../../config/Api";
import { uploadDriverDocument } from "../../../../Infrastructure/firebase/uploadDriverDocument";
import { sharedValue, useSharedValue } from "../work/sharedValue";
import { DriverProfile, parseProfile, safeImageUrl, selfieFileError, selfieSaved } from "./driverProfile";

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

// Cambiar la selfie (Mi cuenta). Mismo camino que el alta: la foto va al
// Storage de la app (drivers/<usuario>/documents, un archivo nuevo: la
// anterior no se borra) y la URL a PUT /v2/drivers/:id/extra, solo «selfie»
// (al chofer el servidor no le borra lo que no manda, y solo le deja su
// ficha). Recién cuando la ficha releída trae la URL nueva se muestra en
// Mi cuenta e Inicio; si algo falla, queda la anterior y se lanza el error.
export async function updateSelfie(userId: number | string | null | undefined, uri: string): Promise<void> {
  if (userId === null || userId === undefined || userId === "") throw new Error("No se pudo identificar tu usuario.");
  if (!profile.get()) await loadDriverProfile(userId, { force: true });
  const current = profile.get();
  if (!current) throw new Error("No se pudo leer tu ficha de chofer. Revisá la conexión y probá de nuevo.");

  const file = await (await fetch(uri)).blob();
  const invalid = selfieFileError({ size: file.size, type: file.type, uri });
  if (invalid) throw new Error(invalid);
  const mimeType = /png/i.test(file.type || uri) ? "image/png" : "image/jpeg";

  let url: string;
  try {
    url = (await uploadDriverDocument({ driverId: String(userId), documentType: "selfie", uri, mimeType })).fileUrl;
  } catch {
    throw new Error("No se pudo subir la foto. Revisá la conexión y probá de nuevo.");
  }
  unwrap(await putJson(`/v2/drivers/${current.driverId}/extra`, { driver: { selfie: url } }));
  const extra = unwrap(await getJson(`/v2/drivers/${current.driverId}/extra`)).extra ?? null;
  if (!selfieSaved(extra, url)) throw new Error("El servidor no guardó la foto en tu ficha. Avisale a coordinación.");
  const latest = profile.get();
  profile.set({ ...(latest ?? current), selfie: safeImageUrl(extra.selfie) });
}
