// src/Presentation/views/driver/account/driverProfile.ts
// Lo que el chofer cargó en el alta, para verlo en Mi cuenta (y la selfie
// como avatar en Inicio). Módulo puro (sin React Native) para probarlo con node.
//
// Fuentes (las mismas que usa el panel, sin datos nuevos):
// - GET /v2/users/:id/role → data: la ficha del chofer (driver_data): vehículo,
//   patente, DNI, CUIL. Trae también datos de pago: acá no se leen.
// - GET /v2/drivers/:driverId/extra → la selfie y las fotos de DNI, registro
//   y cédula (driver_extra; Postgres devuelve las columnas en minúscula).
// No existe un estado de validación de los documentos: se dice si se envió.

export type DriverDocument = { key: string; label: string; url: string | null };
export type DriverProfile = {
  driverId: number;
  vehicle: string | null;
  plate: string | null;
  dni: string | null;
  cuil: string | null;
  selfie: string | null;
  documents: DriverDocument[];
};

export const DOCUMENTS: { key: string; label: string }[] = [
  { key: "dni_frente", label: "DNI · frente" },
  { key: "dni_dorso", label: "DNI · dorso" },
  { key: "registro_frente", label: "Registro · frente" },
  { key: "registro_dorso", label: "Registro · dorso" },
  { key: "cedula_frente", label: "Cédula · frente" },
  { key: "cedula_dorso", label: "Cédula · dorso" },
];

// Solo imágenes del Storage de la app (o en línea y chicas), como el panel
// (selfieSegura en la web): una URL de otro servidor no se pide desde el teléfono.
const FIREBASE = "https://firebasestorage.googleapis.com/v0/b/lynx-mobile-7d96b.firebasestorage.app/";
const DATA_MAX = 300_000;
export const safeImageUrl = (s: unknown): string | null => {
  if (typeof s !== "string") return null;
  const v = s.trim();
  return v.startsWith(FIREBASE) || (/^data:image\/(png|jpe?g|webp|gif);base64,/.test(v) && v.length <= DATA_MAX) ? v : null;
};

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
// Las columnas de driver_extra llegan en minúscula; el alta las manda como DNI_frente.
const pick = (o: any, key: string) => o?.[key] ?? o?.[key.replace(/^dni/, "DNI")];

export function parseProfile(roleData: any, extra: any): DriverProfile | null {
  const driverId = Number(roleData?.id);
  if (!Number.isInteger(driverId) || driverId <= 0) return null;
  return {
    driverId,
    vehicle: text(roleData?.vehiculo),
    plate: text(roleData?.patente),
    dni: text(roleData?.dni ?? roleData?.DNI),
    cuil: text(roleData?.cuil ?? roleData?.CUIL),
    selfie: safeImageUrl(extra?.selfie),
    documents: DOCUMENTS.map((d) => ({ ...d, url: safeImageUrl(pick(extra, d.key)) })),
  };
}

// «moto · Honda · Wave» (así lo guarda el alta) y la patente.
export function vehicleLabel(p: Pick<DriverProfile, "vehicle" | "plate"> | null | undefined): string {
  const parts = [p?.vehicle, p?.plate ? `Patente ${p.plate}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Sin vehículo cargado";
}

export function documentsLabel(p: Pick<DriverProfile, "documents"> | null | undefined): string {
  if (!p) return "DNI, registro y cédula";
  const sent = p.documents.filter((d) => d.url).length;
  return sent === p.documents.length ? "Todos enviados" : sent ? `${sent} de ${p.documents.length} enviados` : "Sin documentos enviados";
}

export function fullName(user: { first_name?: string | null; last_name?: string | null; name?: string | null; username?: string | null } | null | undefined): string {
  const n = [user?.first_name, user?.last_name].map((x) => (x ?? "").trim()).filter(Boolean).join(" ");
  return n || user?.name?.trim() || user?.username?.trim() || "Sin nombre cargado";
}
