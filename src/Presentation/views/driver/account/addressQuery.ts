// src/Presentation/views/driver/account/addressQuery.ts
// El buscador del domicilio usa la búsqueda estructurada de LocationIQ: la
// calle y la localidad van en campos separados. El chofer escribe todo junto
// («Calle y número, localidad»), así que se separa en la última coma.
// Solo si las dos partes tienen letras: «San Martín, 1250» no es una localidad
// y viaja entero, como antes. Si el servidor también separa, no pasa nada:
// la dirección ya llega sin la localidad y con `localidad` aparte.
// Módulo puro (sin React Native) para poder probarlo solo.

export type AddressQuery = { direccion: string; localidad?: string };

const HAS_LETTER = /[a-zñáéíóúü]/i;

export function splitAddressQuery(text: string): AddressQuery {
  const t = String(text ?? "").trim().replace(/\s+/g, " ").replace(/[\s,]+$/, "");
  const i = t.lastIndexOf(",");
  if (i < 0) return { direccion: t };
  const direccion = t.slice(0, i).replace(/[\s,]+$/, "").trim();
  const localidad = t.slice(i + 1).trim();
  if (!HAS_LETTER.test(direccion) || !HAS_LETTER.test(localidad)) return { direccion: t };
  return { direccion, localidad };
}
