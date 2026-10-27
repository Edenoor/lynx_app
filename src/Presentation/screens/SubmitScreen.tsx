import React, { useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  SafeAreaView,
  StatusBar,
  ImageBackground,
  Platform,
} from "react-native";
import { UserContext } from "../context/UserContext";
import { useOnboarding } from "../onboarding/OnboardingContext";
import { uploadDriverDocuments } from "../onboarding/UploadDriverDocuments";
import { RoundedButton } from "../components/RoundedButton";
import { LynxLoader } from "../components/LynxLoader";
import { useThemedStyles } from "../theme/ThemeContext";
import type { Theme } from "../theme/createTheme";
import { ThemedStatusBar } from "../theme/ThemedStatusBar";
import { saveDriverOnboardingBackend } from "../onboarding/SaveDriverOnboardingBackend";

type SubmitStatus = "sending" | "success" | "error";

export function SubmitScreen() {
  const styles = useThemedStyles(makeStyles);
  const { state, dispatch, userKey } = useOnboarding();
  const { user } = useContext(UserContext);

  const [status, setStatus] = useState<SubmitStatus>("sending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submittedRef = useRef(false);

  const driverId = String(user?.id || userKey || user?.username || "").trim();

  useEffect(() => {
    if (submittedRef.current) return;

    submittedRef.current = true;
    submit();
  }, []);

  const submit = async () => {
    if (!driverId) {
      setStatus("error");
      setErrorMessage("No se pudo identificar el conductor autenticado.");
      return;
    }

    setStatus("sending");
    setErrorMessage(null);

    try {
      const res = await uploadDriverDocuments({
        driverId,
        acceptedTerms: state.acceptedTerms,
        files: state.files,
        mode: "real",
      });

      if (!res.ok) {
        throw new Error(res.error ?? "No se pudo enviar la documentación.");
      }

console.log("DRIVER DOCUMENTS UPLOADED:", res.documents);

await saveDriverOnboardingBackend({
  userId: user?.id || userKey || "",
  vehicle: state.vehicle,
  documents: res.documents,
});

dispatch({ type: "SET_COMPLETED_LOCAL", value: true });
setStatus("success");
    } catch (error: any) {
      setStatus("error");
      setErrorMessage(error?.message ?? "No se pudo enviar la solicitud.");
    }
  };

  const resetOnboarding = () => {
    Alert.alert(
      "Reiniciar onboarding",
      "Esto borrará el progreso local del alta. ¿Querés continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Reiniciar",
          style: "destructive",
          onPress: () => dispatch({ type: "RESET" }),
        },
      ]
    );
  };

  return (
    <ImageBackground
      source={require("../../../assets/background-1.png")}
      style={styles.background}
      resizeMode="cover"
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safe}>
        <ThemedStatusBar />

        <View style={styles.screen}>
          <View style={styles.card}>
            {status === "sending" && (
              <>
                <LynxLoader message="Enviando solicitud..." />

                <Text style={styles.title}>Estamos procesando tu alta</Text>

                <Text style={styles.subtitle}>
                  Esto puede demorar unos segundos. No cierres la app mientras
                  enviamos la documentación.
                </Text>
              </>
            )}

            {status === "success" && (
              <>
                <View style={styles.successCircle}>
                  <Text style={styles.successIcon}>✓</Text>
                </View>

                <Text style={styles.kicker}>SOLICITUD ENVIADA</Text>

                <Text style={styles.title}>Todo listo</Text>

                <Text style={styles.subtitle}>
                  Recibimos tu documentación. Nuestro equipo la revisará para
                  habilitar tu cuenta.
                </Text>

                <RoundedButton text="Finalizar" onPress={() => {}} />
              </>
            )}

            {status === "error" && (
              <>
                <View style={styles.errorCircle}>
                  <Text style={styles.errorIcon}>!</Text>
                </View>

                <Text style={styles.kicker}>ERROR</Text>

                <Text style={styles.title}>No pudimos enviar la solicitud</Text>

                <Text style={styles.subtitle}>
                  {errorMessage ??
                    "Revisá tu conexión e intentá nuevamente en unos segundos."}
                </Text>

                <RoundedButton text="Reintentar" onPress={submit} />

                <Text style={styles.resetText} onPress={resetOnboarding}>
                  Reiniciar onboarding
                </Text>
              </>
            )}
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  // Imagen de fondo como en las pantallas del chofer: tenue y solo en Classic.
  backgroundImage: {
    opacity: t.backdrop.imageOpacity,
  },
  background: {
    flex: 1,
    backgroundColor: t.surfaces.screen,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.overlays.background,
  },
  safe: {
    flex: 1,
  },
  screen: {
    flex: 1,
    paddingHorizontal: t.spacing.md,
    paddingTop:
      Platform.OS === "android"
        ? (StatusBar.currentHeight ?? 24) + 28
        : 32,
    paddingBottom: 24,
    justifyContent: "center",
  },
  card: {
    borderRadius: 26,
    backgroundColor: t.surfaces.cardStrong,
    borderWidth: 1,
    borderColor: t.borders.strong,
    padding: 22,
    gap: 14,
    alignItems: "center",
  },
  successCircle: {
    width: 74,
    height: 74,
    borderRadius: 999,
    backgroundColor: t.status.confirmed.background,
    borderWidth: 1,
    borderColor: t.status.confirmed.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  successIcon: {
    color: t.status.confirmed.text,
    fontSize: 36,
    fontWeight: "900",
  },
  errorCircle: {
    width: 74,
    height: 74,
    borderRadius: 999,
    backgroundColor: t.status.rejected.background,
    borderWidth: 1,
    borderColor: t.status.rejected.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  errorIcon: {
    color: t.status.rejected.text,
    fontSize: 32,
    fontWeight: "900",
  },
  kicker: {
    color: t.text.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },
  title: {
    color: t.text.primary,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -1,
    textAlign: "center",
  },
  subtitle: {
    color: t.text.secondary,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    textAlign: "center",
  },
  resetText: {
    color: t.text.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
});