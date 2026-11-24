// src/Presentation/views/common/feedback/ViewModel.tsx
// Estado del formulario de Sugerencias y errores (Driver y Picker). Un envío a
// la vez; si falla, el texto y la foto quedan para probar de nuevo.

import { useEffect, useRef, useState } from "react";
import { Dimensions } from "react-native";
import * as Device from "expo-device";
import * as FileSystem from "expo-file-system/legacy";

import { appUpdateLabel } from "../../../config/appUpdates";
import { errorMessage } from "../../driver/errorMessage";
import { sendFeedback, SEND_TIMEOUT_MS } from "./feedbackApi";
import { buildPage, canSend, checkPhoto, FeedbackArea, FeedbackKind, originScreen, viewportOf } from "./feedbackContext";

export type FeedbackPhoto = { uri: string; dataUrl: string };

// Sin respuesta en el tiempo límite no se sabe si llegó: no decir «sin conexión».
const TIMEOUT = new RegExp(`^sin respuesta en ${SEND_TIMEOUT_MS} ms$`);
const TIMEOUT_MESSAGE = "No tuvimos respuesta del servidor. Puede que el reporte haya llegado: si lo mandás de nuevo, quizá quede repetido.";

export function technicalPage(area: FeedbackArea) {
  return buildPage({
    area,
    screen: originScreen(),
    app: appUpdateLabel(),
    os: Device.osVersion,
    model: [Device.manufacturer, Device.modelName].filter(Boolean).join(" "),
  });
}

export default function useFeedbackViewModel(area: FeedbackArea, photoUri?: string) {
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [message, setMessage] = useState("");
  const [photo, setPhoto] = useState<FeedbackPhoto | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendingRef = useRef(false);

  // La foto vuelve de la cámara como archivo: se lee en base64 y se controla
  // el peso antes de aceptarla.
  useEffect(() => {
    if (!photoUri) return;
    let alive = true;
    setPreparingPhoto(true);
    setPhotoError(null);
    FileSystem.readAsStringAsync(photoUri, { encoding: FileSystem.EncodingType.Base64 })
      .then((b64) => {
        if (!alive) return;
        const check = checkPhoto(b64);
        if (check.ok) setPhoto({ uri: photoUri, dataUrl: check.dataUrl });
        else {
          setPhoto(null);
          setPhotoError(check.reason);
        }
      })
      .catch(() => {
        if (alive) setPhotoError("No se pudo leer la foto. Probá sacarla de nuevo.");
      })
      .finally(() => {
        if (alive) setPreparingPhoto(false);
      });
    return () => {
      alive = false;
    };
  }, [photoUri]);

  const removePhoto = () => {
    setPhoto(null);
    setPhotoError(null);
  };

  const ready = canSend(kind, message) && !sending && !preparingPhoto;

  const send = async () => {
    if (!ready || !kind || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      const { width, height } = Dimensions.get("window");
      await sendFeedback({
        kind,
        message: message.trim(),
        page: technicalPage(area),
        viewport: viewportOf(width, height),
        ...(photo ? { screenshot: photo.dataUrl } : {}),
      });
      setSent(true);
    } catch (e) {
      const raw = (e as { message?: unknown })?.message;
      setError(typeof raw === "string" && TIMEOUT.test(raw) ? TIMEOUT_MESSAGE : errorMessage(e, "No se pudo enviar el reporte. Probá de nuevo."));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return { kind, setKind, message, setMessage, photo, photoError, preparingPhoto, removePhoto, sending, sent, error, ready, send };
}
