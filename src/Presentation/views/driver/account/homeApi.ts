// src/Presentation/views/driver/account/homeApi.ts
// Cliente de /v2/driver-home para el chofer: su domicilio. El servidor lo
// identifica por el token; acá no viaja ningún id. El domicilio se ve en el
// mapa de operación y se puede usar como inicio o fin de un recorrido.

import { getJson, putJson } from "../../../config/Api";

export type DriverHome = {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  updated_at?: string | null;
};

export type HomeCandidate = {
  latitude: number;
  longitude: number;
  displayName: string | null;
  address: string | null;
  locality: string | null;
};

const unwrap = <T,>(res: any): T => {
  if (!res || res.ok === false) throw new Error(res?.error || res?.message || "Error del servidor");
  return res as T;
};

export const fetchMyHome = async () => unwrap<{ home: DriverHome }>(await getJson("/v2/driver-home/me")).home;

export const searchHomeAddress = async (text: string) =>
  unwrap<{ candidates: HomeCandidate[] }>(
    await getJson(`/v2/driver-home/geo/search?direccion=${encodeURIComponent(text.trim())}`)
  ).candidates;

export const saveMyHome = async (home: { address: string; latitude: number; longitude: number }) =>
  unwrap<{ home: DriverHome }>(await putJson("/v2/driver-home/me", home)).home;

export const clearMyHome = async () => unwrap<{ home: DriverHome }>(await putJson("/v2/driver-home/me", { address: null })).home;

// «Calle 123, Localidad» para guardar (no el nombre largo del buscador).
export const shortAddress = (c: HomeCandidate, typed: string) =>
  ([c.address, c.locality].filter(Boolean).join(", ") || c.displayName || typed).slice(0, 255);
