export type DocKey =
  | "dni_front"
  | "dni_back"
  | "registro_front"
  | "registro_back"
  | "cedula_front"
  | "cedula_back"
  | "selfie";

export type CapturedFile = {
  uri: string;          // file://...
  fileName: string;     // e.g. dni_front.jpg
  mimeType: string;     // image/jpeg
  width?: number;
  height?: number;
};

export type OnboardingState = {
  acceptedTerms: boolean;
  files: Partial<Record<DocKey, CapturedFile>>;
  completedLocal: boolean; // mientras no exista backend
};

export type OnboardingAction =
  | { type: "ACCEPT_TERMS"; value: boolean }
  | { type: "SET_FILE"; key: DocKey; file: CapturedFile }
  | { type: "RESET" }
  | { type: "SET_COMPLETED_LOCAL"; value: boolean };
