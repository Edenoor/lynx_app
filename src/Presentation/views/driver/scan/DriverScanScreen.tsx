// src/Presentation/views/driver/scan/DriverScanScreen.tsx
// Escaneo continuo del chofer (Asignarme, Colecta, Planta): cada lectura deja
// su resultado en una tarjeta verde o roja y la cámara queda lista para la
// siguiente, sin diálogos que cerrar. Solo frena una sesión vencida o la
// falta de permiso de cámara. La cámara es la del Picker (QrScanner): no lee
// otra etiqueta mientras hay un pedido en curso y no repite la misma mientras
// siga a la vista. Las escrituras no se reintentan solas.

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, Alert, Vibration } from "react-native";
import { useCameraPermissions } from "expo-camera";
import { StackScreenProps } from "@react-navigation/stack";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import { UserContext } from "../../../context/UserContext";
import AppTheme from "../../../theme/AppTheme";
import { useThemedStyles } from "../../../theme/ThemeContext";
import type { Theme } from "../../../theme/createTheme";
import { DEFAULT_THEME, FixedTheme } from "../../../theme/FixedTheme";
import { LynxPulseLoader } from "../../../components/LynxPulseLoader";
import { QrScanner } from "../../../components/QrScanner";
import { DriverBottomNavigation, DriverTabKey } from "../../../components/DriverBottomNavigation";
import { getJsonWithTimeout, postJsonWithTimeout, putJsonWithTimeout } from "../../../config/Api";
import { playScanError, playScanSuccess } from "../../../config/ScanSound";
import { PendingPackage, processScan } from "../../picker/pickerScan";
import { presentOutcome } from "../../picker/pickerOutcome";
import {
  assignFeedback,
  collectFeedback,
  DriverScanMode,
  EMPTY_SESSION,
  NO_CONNECTION,
  noResponseFeedback,
  parseScanPayload,
  payloadProblem,
  plantaFeedback,
  recordScan,
  roleProblem,
  ScanFeedback,
  ScanPayload,
  ScanSession,
  ScanTone,
  scanBody,
  scanLabel,
  SESSION_EXPIRED,
  sessionSummary,
} from "./driverScan";

type Props = StackScreenProps<DriverStackParamList, "DriverScanScreen">;

const TITLES: Record<DriverScanMode, string> = {
  colecta: "Ingresar envío",
  planta: "Recepción en planta",
  asignarme: "Asignarme envío",
};

const HINTS: Record<DriverScanMode, string> = {
  colecta: "Escaneá el QR del envío para ingresarlo",
  planta: "Escaneá el bulto. Si lo movés, escaneá después la estantería",
  asignarme: "Escaneá el QR del envío para asignártelo",
};

const PROCESSING: Record<DriverScanMode, string> = {
  colecta: "Ingresando envío...",
  planta: "Procesando...",
  asignarme: "Asignando envío...",
};

// Asignar e ingresar pueden traer el envío desde Mercado Libre: mismo límite
// que la recepción en planta.
const SCAN_TIMEOUT_MS = 20_000;
// El verde se va solo; el rojo queda hasta la próxima lectura.
const SUCCESS_VISIBLE_MS = 2_500;
const ERRORS_SHOWN = 5;

const VIBRATION: Record<ScanTone | "warned", number[]> = {
  success: [0, 80, 60, 120],
  warned: [0, 120, 80, 120],
  warning: [0, 120, 80, 120],
  error: [0, 250, 100, 250],
};

const TONE: Record<ScanTone, { text: string; border: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { text: AppTheme.status.delivered.text, border: AppTheme.status.delivered.text, icon: "checkmark-circle" },
  warning: { text: AppTheme.status.pending.text, border: AppTheme.status.pending.text, icon: "help-circle" },
  error: { text: AppTheme.status.rejected.text, border: AppTheme.status.rejected.text, icon: "close-circle" },
};

export default function DriverScanScreen({ navigation, route }: Props) {
  const loadingStyles = useThemedStyles(makeLoadingStyles);
  const mode = route.params.mode;
  const title = TITLES[mode];
  const hint = HINTS[mode];

  const { user, getUserSession } = useContext(UserContext);
  const [permission, requestPermission] = useCameraPermissions();
  const focused = useIsFocused();

  const [open, setOpen] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [session, setSession] = useState<ScanSession>(EMPTY_SESSION);
  const [showErrors, setShowErrors] = useState(false);

  // Cada modo (y cada montaje) es una sesión de escaneo: lo que responde
  // después de cerrar la pantalla o de cambiar de modo se descarta.
  const generation = useRef(0);
  const driverIdRef = useRef<string | number | null>(null);
  // Planta: el último bulto recibido, para moverlo si se escanea una estantería.
  const lastReceivedRef = useRef<PendingPackage | null>(null);

  useEffect(() => {
    generation.current += 1;
    lastReceivedRef.current = null;
    setProcessing(false);
    setFeedback(null);
    setSession(EMPTY_SESSION);
    setShowErrors(false);
    return () => {
      generation.current += 1;
    };
  }, [mode]);

  useEffect(() => {
    if (feedback?.tone !== "success") return;
    const timer = setTimeout(() => setFeedback((current) => (current === feedback ? null : current)), SUCCESS_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  const close = useCallback(() => {
    setBlocked(true);
    setOpen(false);
    navigation.goBack();
  }, [navigation]);

  const handleTabPress = useCallback(
    (tab: DriverTabKey) => {
      if (tab === "scan") return;
      setBlocked(true);
      setOpen(false);
      if (tab === "home") navigation.navigate("DriverScreen");
      else if (tab === "deliveries") navigation.navigate("EnviosScreen");
      else if (tab === "activity") navigation.navigate("NotificationsScreen");
    },
    [navigation]
  );

  const ensurePermission = useCallback(async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert("Permiso requerido", "Necesitamos acceso a la cámara para escanear.");
        close();
        return false;
      }
    }
    return true;
  }, [permission?.granted, requestPermission, close]);

  useEffect(() => {
    ensurePermission();
  }, [ensurePermission]);

  // El chofer de la sesión (driver_data.id), una vez por pantalla: no cambia
  // entre lecturas.
  const resolveDriver = useCallback(async (): Promise<ScanFeedback | null> => {
    if (driverIdRef.current) return null;
    const sessionUser = user?.id ? user : await getUserSession();
    if (!sessionUser?.id) return SESSION_EXPIRED;
    let res: any;
    try {
      res = await getJsonWithTimeout(`/v2/users/${sessionUser.id}/role`, SCAN_TIMEOUT_MS);
    } catch {
      return NO_CONNECTION;
    }
    const problem = roleProblem(res);
    if (!problem) driverIdRef.current = res.data.id;
    return problem;
  }, [user, getUserSession]);

  const runScan = useCallback(
    async (payload: ScanPayload, gen: number): Promise<ScanFeedback> => {
      const problem = payloadProblem(payload);
      if (problem) return problem;
      const label = scanLabel(payload);

      if (mode === "planta") {
        const r = await processScan(payload.raw, lastReceivedRef.current);
        if (generation.current === gen) lastReceivedRef.current = r.pending;
        const status = r.outcome.kind === "error" ? r.outcome.status : null;
        return plantaFeedback(presentOutcome(r.outcome, ""), status);
      }

      if (mode === "asignarme") {
        const roleIssue = await resolveDriver();
        if (roleIssue) return roleIssue;
        // El chofer lo saca el servidor del token; la etiqueta va completa.
        try {
          return assignFeedback(await putJsonWithTimeout("/v2/deliveries/self-assign", scanBody(payload), SCAN_TIMEOUT_MS), label);
        } catch {
          return noResponseFeedback(mode);
        }
      }

      try {
        return collectFeedback(await postJsonWithTimeout("/v2/deliveries/scan", scanBody(payload), SCAN_TIMEOUT_MS), label);
      } catch {
        return noResponseFeedback(mode);
      }
    },
    [mode, resolveDriver]
  );

  const onScan = useCallback(
    async (raw: string) => {
      if (blocked) return;
      const gen = generation.current;
      const payload = parseScanPayload(raw);
      setProcessing(true);
      setShowErrors(false);
      Vibration.vibrate(45);

      let result: ScanFeedback;
      try {
        result = await runScan(payload, gen);
      } catch {
        result = noResponseFeedback(mode);
      }
      if (generation.current !== gen) return;

      setProcessing(false);
      setFeedback(result);
      if (!result.sessionExpired) setSession((s) => recordScan(s, result, scanLabel(payload)));
      Vibration.vibrate(VIBRATION[result.tone === "success" && result.warned ? "warned" : result.tone]);
      if (result.tone === "success") playScanSuccess();
      else playScanError();

      if (result.sessionExpired) {
        setBlocked(true);
        Alert.alert(result.title, result.detail ?? "", [{ text: "Entendido", onPress: close }]);
      }
    },
    [blocked, mode, runScan, close]
  );

  const summary = useMemo(() => sessionSummary(session), [session]);
  const scanned = session.ok + session.failed > 0;

  return (
    <Modal visible={open} animationType="slide" onRequestClose={close}>
      <View style={styles.container}>
        {!permission ? (
          <View style={loadingStyles.loadingBox}>
            <LynxPulseLoader message="Preparando cámara..." />
          </View>
        ) : !permission.granted ? (
          <View style={loadingStyles.loadingBox}>
            <LynxPulseLoader message="Solicitando permiso..." />
          </View>
        ) : (
          // Visor oscuro fijo en cualquier apariencia: va sobre la imagen de la
          // cámara. El cargador y la barra de abajo se ven con el oscuro de siempre.
          <FixedTheme theme={DEFAULT_THEME}>
            <View style={styles.cameraWrap}>
              <QrScanner active={focused && open && !blocked} onScan={onScan} />

              <View pointerEvents="box-none" style={styles.topLayer}>
                <Pressable onPress={close} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Volver">
                  <Ionicons name="arrow-back" size={30} color={AppTheme.colors.white} />
                </Pressable>

                {scanned ? (
                  <View style={styles.summaryBox}>
                    <Pressable
                      onPress={() => setShowErrors((v) => !v)}
                      disabled={!session.failed}
                      style={styles.summaryPill}
                      accessibilityRole="button"
                      accessibilityLabel={session.failed ? `${summary}. Ver errores` : summary}
                    >
                      <Text style={styles.summaryOk}>✓ {session.ok}</Text>
                      {session.failed ? <Text style={styles.summaryFailed}>✕ {session.failed}</Text> : null}
                    </Pressable>
                    {showErrors && session.errors.length ? (
                      <View style={styles.errorList}>
                        <Text style={styles.errorListTitle}>Errores de esta sesión</Text>
                        {session.errors.slice(0, ERRORS_SHOWN).map((e, i) => (
                          <Text key={`e${i}`} style={styles.errorListItem} numberOfLines={2}>
                            {e.code} · {e.title}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>

              {!feedback && !processing ? (
                <View pointerEvents="none" style={styles.scanLayer}>
                  <View style={styles.scanGuide} />
                  <View style={styles.scanTextPill}>
                    <Text style={styles.scanText}>{hint}</Text>
                  </View>
                </View>
              ) : null}

              <View pointerEvents="none" style={styles.feedbackLayer} accessibilityLiveRegion="polite">
                {processing ? (
                  <View style={styles.processingCard}>
                    <LynxPulseLoader compact showLogo={false} message={PROCESSING[mode]} />
                  </View>
                ) : feedback ? (
                  <FeedbackCard feedback={feedback} />
                ) : null}
              </View>

              <View pointerEvents="none" style={styles.bottomInfo}>
                <Text style={styles.modeText}>{title}</Text>
              </View>

              <DriverBottomNavigation activeTab="scan" onPress={handleTabPress} />
            </View>
          </FixedTheme>
        )}
      </View>
    </Modal>
  );
}

function FeedbackCard({ feedback }: { feedback: ScanFeedback }) {
  const tone = TONE[feedback.tone];
  return (
    <View
      style={[styles.feedbackCard, { borderColor: tone.border }]}
      accessibilityRole="alert"
      accessibilityLabel={[feedback.shelf ? `Estantería ${feedback.shelf}` : null, feedback.title, feedback.detail].filter(Boolean).join(". ")}
    >
      <View style={styles.feedbackHeader}>
        <Ionicons name={tone.icon} size={26} color={tone.text} />
        <Text style={[styles.feedbackTitle, { color: tone.text }]}>{feedback.title}</Text>
      </View>
      {feedback.shelf ? <Text style={[styles.feedbackShelf, { color: tone.text }]}>→ {feedback.shelf}</Text> : null}
      {feedback.detail ? <Text style={styles.feedbackDetail}>{feedback.detail}</Text> : null}
    </View>
  );
}

const CARD_BACKGROUND = "rgba(5, 8, 14, 0.92)";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppTheme.colors.black },
  cameraWrap: { flex: 1, backgroundColor: AppTheme.colors.black },
  topLayer: {
    position: "absolute",
    top: AppTheme.layout.headerTopPadding,
    left: AppTheme.spacing.lg,
    right: AppTheme.spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    zIndex: 20,
  },
  backButton: { width: 44, height: 44, borderRadius: AppTheme.radius.full, alignItems: "center", justifyContent: "center" },
  summaryBox: { alignItems: "flex-end", gap: AppTheme.spacing.sm, maxWidth: "75%" },
  summaryPill: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.md,
    paddingHorizontal: AppTheme.spacing.md,
    borderRadius: AppTheme.radius.full,
    backgroundColor: CARD_BACKGROUND,
  },
  summaryOk: { color: AppTheme.status.delivered.text, fontSize: 16, fontWeight: AppTheme.font.weight.black },
  summaryFailed: { color: AppTheme.status.rejected.text, fontSize: 16, fontWeight: AppTheme.font.weight.black },
  errorList: { borderRadius: AppTheme.radius.lg, backgroundColor: CARD_BACKGROUND, padding: AppTheme.spacing.md, gap: 4 },
  errorListTitle: { color: AppTheme.colors.white, fontSize: 12, fontWeight: AppTheme.font.weight.black },
  errorListItem: { color: AppTheme.colors.white, fontSize: 12 },
  scanLayer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingHorizontal: AppTheme.spacing.lg },
  // Lugar del recuadro del QrScanner: la indicación queda debajo.
  scanGuide: { width: 270, height: 270 },
  scanTextPill: {
    marginTop: 92,
    minHeight: 48,
    borderRadius: AppTheme.radius.full,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    paddingHorizontal: AppTheme.spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  scanText: { color: AppTheme.colors.white, fontSize: 16, fontWeight: AppTheme.font.weight.black, textAlign: "center" },
  feedbackLayer: { position: "absolute", left: AppTheme.spacing.lg, right: AppTheme.spacing.lg, bottom: 148, alignItems: "center" },
  processingCard: {
    minWidth: 190,
    borderRadius: AppTheme.radius.xxl,
    backgroundColor: "rgba(5, 8, 14, 0.82)",
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    paddingVertical: AppTheme.spacing.md,
    paddingHorizontal: AppTheme.spacing.md,
  },
  feedbackCard: {
    alignSelf: "stretch",
    borderWidth: 2,
    borderRadius: AppTheme.radius.xl,
    backgroundColor: CARD_BACKGROUND,
    padding: AppTheme.spacing.md,
    gap: 6,
  },
  feedbackHeader: { flexDirection: "row", alignItems: "center", gap: AppTheme.spacing.sm },
  feedbackTitle: { flex: 1, fontSize: 18, fontWeight: AppTheme.font.weight.black },
  feedbackShelf: { fontSize: 30, fontWeight: AppTheme.font.weight.black },
  feedbackDetail: { color: AppTheme.colors.white, fontSize: 14, lineHeight: 19 },
  bottomInfo: { position: "absolute", left: AppTheme.spacing.lg, right: AppTheme.spacing.lg, bottom: 104, alignItems: "center" },
  modeText: { color: "rgba(255,255,255,0.78)", fontSize: 12, fontWeight: AppTheme.font.weight.bold },
});

// Permiso y preparación de la cámara: pantalla con la apariencia elegida.
const makeLoadingStyles = (t: Theme) =>
  StyleSheet.create({
    loadingBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.surfaces.screen,
      paddingHorizontal: t.spacing.lg,
    },
  });
