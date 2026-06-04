import {
  DriverDocumentType,
  UploadedDriverDocument,
  uploadDriverDocument,
} from "../../Infrastructure/firebase/uploadDriverDocument";
import { CapturedFile, DocKey } from "./types";

type Input = {
  driverId: string;
  acceptedTerms: boolean;
  files: Partial<Record<DocKey, CapturedFile>>;
  mode: "mock" | "real";
};

type Result =
  | { ok: true; documents: UploadedDriverDocument[] }
  | { ok: false; error: string };

const REQUIRED_DOCS: DocKey[] = [
  "selfie",
  "dni_front",
  "dni_back",
  "registro_front",
  "registro_back",
  "cedula_front",
  "cedula_back",
];

async function mockUpload(): Promise<Result> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  return { ok: true, documents: [] };
}

function validateInput(input: Input): string | null {
  if (!input.acceptedTerms) {
    return "Falta aceptar términos y condiciones.";
  }

  if (!input.driverId) {
    return "No se pudo identificar el driver.";
  }

  const missing = REQUIRED_DOCS.filter((key) => !input.files[key]);

  if (missing.length > 0) {
    return `Faltan documentos: ${missing.join(", ")}`;
  }

  return null;
}

async function firebaseUpload(input: Input): Promise<Result> {
  const validationError = validateInput(input);

  if (validationError) {
    return { ok: false, error: validationError };
  }

  const documents: UploadedDriverDocument[] = [];

  for (const documentType of REQUIRED_DOCS) {
    const file = input.files[documentType];

    if (!file) continue;

    const uploaded = await uploadDriverDocument({
      driverId: input.driverId,
      documentType: documentType as DriverDocumentType,
      uri: file.uri,
      mimeType: file.mimeType || "image/jpeg",
    });

    documents.push(uploaded);
  }

  return {
    ok: true,
    documents,
  };
}

export async function uploadDriverDocuments(input: Input): Promise<Result> {
  if (input.mode === "mock") return mockUpload();

  return firebaseUpload(input);
}
