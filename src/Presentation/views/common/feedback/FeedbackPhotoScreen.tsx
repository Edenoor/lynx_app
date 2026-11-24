// src/Presentation/views/common/feedback/FeedbackPhotoScreen.tsx
// Foto para un reporte de Sugerencias y errores: la cámara del alta
// (CameraCaptureView), pidiendo una foto liviana (lado mayor de 1600 px como
// en la WebApp). Sacada, vuelve al formulario con la foto; con «volver» del
// teléfono, vuelve sin foto. El formulario controla el peso antes de aceptarla.

import React from "react";
import { useNavigation } from "@react-navigation/native";

import { CameraCaptureView } from "../../../ui/CameraCaptureView";
import { PHOTO_MAX_SIDE, PHOTO_QUALITY } from "./feedbackContext";

export default function FeedbackPhotoScreen() {
  const navigation = useNavigation<any>();
  return (
    <CameraCaptureView
      title="Foto para el reporte"
      subtitle="Encuadrá lo que querés mostrar: una etiqueta, un paquete o la pantalla de otro equipo."
      kicker="SUGERENCIAS Y ERRORES"
      permissionText="Necesitamos acceso a la cámara para sacar la foto del reporte."
      facing="back"
      maxPictureSide={PHOTO_MAX_SIDE}
      quality={PHOTO_QUALITY}
      onCaptured={(uri) => navigation.popTo("FeedbackScreen", { photoUri: uri }, { merge: true })}
    />
  );
}
