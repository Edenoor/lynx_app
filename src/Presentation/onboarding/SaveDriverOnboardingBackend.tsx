import { getJson, putJson } from "../config/Api";
import type { UploadedDriverDocument } from "../../Infrastructure/firebase/uploadDriverDocument";
import { VehicleInfo } from "./types";

type SaveInput = {
  userId: string | number;
  vehicle: VehicleInfo;
  documents: UploadedDriverDocument[];
};

function findDocumentUrl(
  documents: UploadedDriverDocument[],
  documentType: UploadedDriverDocument["documentType"]
) {
  return documents.find((doc) => doc.documentType === documentType)?.fileUrl ?? null;
}

function vehicleLabel(vehicle: VehicleInfo) {
  return [vehicle.type, vehicle.brand, vehicle.model].filter(Boolean).join(" · ");
}

// Solo datos personales: tarifa, alias, CBU y comisión los carga el admin y el
// chofer no los manda (antes iban en null y le borraban los datos de cobro).
function buildDriverDataPayload(vehicle: VehicleInfo) {
  return {
    driver: {
      vehiculo: vehicleLabel(vehicle),
      patente: vehicle.plate,
      DNI: vehicle.dni ? Number(vehicle.dni) : null,
      CUIL: vehicle.cuil ? Number(vehicle.cuil) : null,
    },
  };
}

function buildDriverExtraPayload(documents: UploadedDriverDocument[]) {
  return {
    driver: {
      DNI_frente: findDocumentUrl(documents, "dni_front"),
      DNI_dorso: findDocumentUrl(documents, "dni_back"),
      cedula_frente: findDocumentUrl(documents, "cedula_front"),
      cedula_dorso: findDocumentUrl(documents, "cedula_back"),
      registro_frente: findDocumentUrl(documents, "registro_front"),
      registro_dorso: findDocumentUrl(documents, "registro_back"),
      selfie: findDocumentUrl(documents, "selfie"),
    },
  };
}

export async function saveDriverOnboardingBackend({
  userId,
  vehicle,
  documents,
}: SaveInput) {
  if (!userId) {
    throw new Error("No se pudo identificar el usuario.");
  }

  const roleResponse = await getJson(`/v2/users/${userId}/role`);

  if (!roleResponse?.ok || !roleResponse?.data?.id) {
    throw new Error(
      roleResponse?.error || "No se pudo obtener el driver asociado al usuario."
    );
  }

  const driverDataId = roleResponse.data.id;

  // Ruta propia del chofer: el servidor toma la ficha del token, no del id.
  const dataResponse = await putJson(
    "/v2/drivers/me/onboarding",
    buildDriverDataPayload(vehicle)
  );

  if (!dataResponse?.ok) {
    throw new Error(
      dataResponse?.error || "No se pudieron guardar los datos del driver."
    );
  }

  const extraResponse = await putJson(
    `/v2/drivers/${driverDataId}/extra`,
    buildDriverExtraPayload(documents)
  );

  if (!extraResponse?.ok) {
    throw new Error(
      extraResponse?.error || "No se pudo guardar la documentación del driver."
    );
  }

  return {
    ok: true,
    driverDataId,
  };
}