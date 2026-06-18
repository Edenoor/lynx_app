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

function buildDriverDataPayload(vehicle: VehicleInfo) {
  return {
    driver: {
      tarifaId: null,
      vehiculo: vehicleLabel(vehicle),
      patente: vehicle.plate,
      DNI: vehicle.dni ? Number(vehicle.dni) : null,
      CUIL: vehicle.cuil ? Number(vehicle.cuil) : null,
      alias: null,
      CBU: null,
      comision: null,
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

  const dataResponse = await putJson(
    `/v2/drivers/${driverDataId}`,
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