import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardingStackParamList } from "../navigator/OnboardingStackNavigator";
import { CameraCaptureView } from "../ui/CameraCaptureView";
import { persistCapture } from "../onboarding/OnboardingStorage";
import { useOnboarding } from "../onboarding/OnboardingContext";
import { DocKey } from "../onboarding/types";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Doc">;

const LABELS: Record<
  DocKey,
  {
    title: string;
    subtitle: string;
    next?: DocKey;
  }
> = {
  selfie: {
    title: "Selfie",
    subtitle: "",
  },

  dni_front: {
    title: "DNI (frente)",
    subtitle: "Asegurate que se lea completo y esté centrado.",
    next: "dni_back",
  },

  dni_back: {
    title: "DNI (dorso)",
    subtitle: "Que se vea claramente el código y los datos.",
    next: "registro_front",
  },

  registro_front: {
    title: "Registro (frente)",
    subtitle: "Colocalo horizontal dentro del rectángulo.",
    next: "registro_back",
  },

  registro_back: {
    title: "Registro (dorso)",
    subtitle: "Que se vea completo y sin reflejos.",
    next: "cedula_front",
  },

  cedula_front: {
    title: "Cédula (frente)",
    subtitle: "Alineá la tarjeta dentro del rectángulo.",
    next: "cedula_back",
  },

  cedula_back: {
    title: "Cédula (dorso)",
    subtitle: "Asegurate que todo sea legible.",
  },
};

export function CaptureDocumentScreen({ route, navigation }: Props) {
  const { docKey } = route.params;

  const { dispatch } = useOnboarding();

  const meta = LABELS[docKey];

  return (
    <CameraCaptureView
      title={meta.title}
      subtitle={meta.subtitle}
      facing="back"
      overlayMode="document"
      allowFlip={false}
      onCaptured={async (tmpUri, w, h) => {
        try {
          const fileName = `${docKey}.jpg`;

          const { uri } = await persistCapture(tmpUri, fileName);

          dispatch({
            type: "SET_FILE",
            key: docKey,
            file: {
              uri,
              fileName,
              mimeType: "image/jpeg",
              width: w,
              height: h,
            },
          });

          if (meta.next) {
            navigation.replace("Doc", { docKey: meta.next });
          } else {
            navigation.replace("Review");
          }

        } catch (error) {
          console.error("Error capturando documento:", error);
        }
      }}
    />
  );
}
