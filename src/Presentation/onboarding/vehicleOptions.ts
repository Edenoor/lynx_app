// Opciones de la pantalla del vehículo (onboarding): las marcas y modelos del
// catálogo en orden alfabético, el buscador (sin acentos ni mayúsculas),
// «Otra marca» / «Otro modelo» escritos a mano y lo que se guarda. Sin React:
// se prueba con node (vehicleOptions.test.ts).
import type { VehicleType } from "./types";
import { VEHICLE_CATALOG } from "./VehicleCatalog";

// Con más opciones que esto, la lista lleva buscador.
export const BUSCADOR_DESDE = 8;
// El servidor guarda «tipo · marca · modelo» en hasta 60 caracteres.
export const MAX_MARCA = 20;
export const MAX_MODELO = 25;

// Sin String.normalize: no está garantizado en todos los motores de la app.
const SIN_ACENTO: Record<string, string> = { á: "a", à: "a", ä: "a", â: "a", é: "e", è: "e", ë: "e", ê: "e", í: "i", ì: "i", ï: "i", î: "i", ó: "o", ò: "o", ö: "o", ô: "o", ú: "u", ù: "u", ü: "u", û: "u", ñ: "n" };
export const normalizar = (s: string) => s.toLowerCase().replace(/[áàäâéèëêíìïîóòöôúùüûñ]/g, (c) => SIN_ACENTO[c] ?? c).trim();

const alfabetico = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base", numeric: true });

export function marcasDe(tipo: VehicleType | "" | null): string[] {
  return tipo ? Object.keys(VEHICLE_CATALOG[tipo]).sort(alfabetico) : [];
}

export function modelosDe(tipo: VehicleType | "" | null, marca: string | null): string[] {
  if (!tipo || !marca) return [];
  return [...(VEHICLE_CATALOG[tipo][marca] ?? [])].sort(alfabetico);
}

// Las opciones que contienen lo buscado (vacío = todas).
export function filtrar(opciones: string[], busqueda: string): string[] {
  const q = normalizar(busqueda);
  return q ? opciones.filter((o) => normalizar(o).includes(q)) : opciones;
}

// Lo escrito a mano: sin espacios de más, sin «·» (separa tipo, marca y
// modelo en lo que se guarda), sin < > ni caracteres de control, y hasta `max`.
export function limpiarTexto(s: string, max: number): string {
  return s.replace(/[\u0000-\u001f\u007f·<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max).trim();
}

// Al volver a la pantalla con lo ya cargado: ¿la marca o el modelo se
// escribieron a mano? (Una marca a mano no tiene modelos en el catálogo.)
export function aMano(tipo: VehicleType | "" | null, marca: string | null, modelo: string | null) {
  return {
    marca: !!marca && !marcasDe(tipo).includes(marca),
    modelo: !!modelo && !modelosDe(tipo, marca).includes(modelo),
  };
}

// Marca y modelo alcanzan para seguir (los de la lista o escritos a mano).
export const vehiculoCompleto = (marca: string, modelo: string) =>
  limpiarTexto(marca, MAX_MARCA).length >= 2 && limpiarTexto(modelo, MAX_MODELO).length >= 1;
