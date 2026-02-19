import { CapturedFile, DocKey } from "./types";

type Input = {
  driverId: string;
  acceptedTerms: boolean;
  files: Partial<Record<DocKey, CapturedFile>>;
  mode: "mock" | "real";
};

type Result = { ok: true } | { ok: false; error: string };

function buildFormData(input: Input) {
  const form = new FormData();
  form.append("driverId", input.driverId);
  form.append("acceptedTerms", String(input.acceptedTerms));

  for (const [key, file] of Object.entries(input.files)) {
    if (!file) continue;
    form.append(key, {
      uri: file.uri,
      name: file.fileName,
      type: file.mimeType,
    } as any);
  }
  return form;
}

async function mockUpload(_form: FormData): Promise<Result> {
  await new Promise((r) => setTimeout(r, 800));
  return { ok: true };
}

async function realUpload(form: FormData): Promise<Result> {
  // TODO: ajustar cuando exista endpoint real
  // Ejemplo:
  // const url = `${process.env.EXPO_PUBLIC_API_URL}/v1/drivers/onboarding/documents`;
  // const res = await fetch(url, { method: "POST", body: form });
  // if (!res.ok) return { ok: false, error: await res.text() };
  // return { ok: true };

  return { ok: false, error: "Endpoint real no configurado" };
}

export async function uploadDriverDocuments(input: Input): Promise<Result> {
  const form = buildFormData(input);
  if (input.mode === "mock") return mockUpload(form);
  return realUpload(form);
}
