import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardingStackParamList } from "../navigator/OnboardingStackNavigator";
import { CameraCaptureView } from "../ui/CameraCaptureView";
import { persistCapture } from "../onboarding/OnboardingStorage";
import { useOnboarding } from "../onboarding/OnboardingContext";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Selfie">;

export function CaptureSelfieScreen({ navigation }: Props) {
  const { dispatch } = useOnboarding();

  return (
    <CameraCaptureView
      title="Selfie"
      subtitle="Ubicate con buena luz, sin gorra ni lentes oscuros."
      facing="front"
      overlayMode="selfie"
      allowFlip={true} // 👈 permite cambiar a cámara trasera si el emulador rompe la frontal
      onCaptured={async (tmpUri, w, h) => {
        try {
          const fileName = "selfie.jpg";

          const { uri } = await persistCapture(tmpUri, fileName);

          dispatch({
            type: "SET_FILE",
            key: "selfie",
            file: {
              uri,
              fileName,
              mimeType: "image/jpeg",
              width: w,
              height: h,
            },
          });

          navigation.replace("Doc", { docKey: "dni_front" });

        } catch (error) {
          console.error("Error capturando selfie:", error);
        }
      }}
    />
  );
}
