import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { firebaseStorage } from "./firebase";

export type DriverDocumentType =
  | "selfie"
  | "dni_front"
  | "dni_back"
  | "registro_front"
  | "registro_back"
  | "cedula_front"
  | "cedula_back";

type UploadDriverDocumentInput = {
  driverId: string;
  documentType: DriverDocumentType;
  uri: string;
  mimeType?: string;
};

export type UploadedDriverDocument = {
  documentType: DriverDocumentType;
  storagePath: string;
  fileUrl: string;
  mimeType: string;
};

export async function uploadDriverDocument({
  driverId,
  documentType,
  uri,
  mimeType = "image/jpeg",
}: UploadDriverDocumentInput): Promise<UploadedDriverDocument> {
  if (!driverId) {
    throw new Error("No se pudo identificar el driver.");
  }

  if (!uri) {
    throw new Error(`No se encontró el archivo para ${documentType}.`);
  }

  const response = await fetch(uri);
  const blob = await response.blob();

  const extension = mimeType.includes("png") ? "png" : "jpg";
  const fileName = `${documentType}_${Date.now()}.${extension}`;
  const storagePath = `drivers/${driverId}/documents/${fileName}`;
  const fileRef = ref(firebaseStorage, storagePath);

  await uploadBytes(fileRef, blob, {
    contentType: mimeType,
  });

  const fileUrl = await getDownloadURL(fileRef);

  return {
    documentType,
    storagePath,
    fileUrl,
    mimeType,
  };
}
