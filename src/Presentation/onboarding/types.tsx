export type DocKey =
  | "dni_front"
  | "dni_back"
  | "registro_front"
  | "registro_back"
  | "cedula_front"
  | "cedula_back"
  | "selfie";

export type CapturedFile = {
  uri: string; // file://...
  fileName: string; // e.g. dni_front.jpg
  mimeType: string; // image/jpeg
  width?: number;
  height?: number;
};

export type VehicleType = "moto" | "auto" | "utilitario" | "furgon";

export type VehicleInfo = {
  type: VehicleType | null;
  brand: string | null;
  model: string | null;
    plate: string | null; 
};

export type OnboardingState = {
  acceptedTerms: boolean;
  files: Partial<Record<DocKey, CapturedFile>>;
  completedLocal: boolean; // mientras no exista backend

  // ✅ NUEVO
  vehicle: VehicleInfo;
};

export type OnboardingAction =
  | { type: "ACCEPT_TERMS"; value: boolean }
  | { type: "SET_FILE"; key: DocKey; file: CapturedFile }
  | { type: "RESET" }
  | { type: "SET_COMPLETED_LOCAL"; value: boolean }
  // ✅ NUEVO
  | { type: "SET_VEHICLE"; value: VehicleInfo };
