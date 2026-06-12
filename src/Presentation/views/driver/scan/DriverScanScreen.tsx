// src/Presentation/views/driver/scan/DriverScanScreen.tsx

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Alert,
  Vibration,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from "expo-camera";
import { StackScreenProps } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";

import { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import { UserContext } from "../../../context/UserContext";
import AppTheme from "../../../theme/AppTheme";
import { LynxPulseLoader } from "../../../components/LynxPulseLoader";
import {
  DriverBottomNavigation,
  DriverTabKey,
} from "../../../components/DriverBottomNavigation";

type Props = StackScreenProps<DriverStackParamList, "DriverScanScreen">;

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5000";

const TITLES: Record<NonNullable<Props["route"]["params"]>["mode"], string> = {
  colecta: "Escanear colecta",
  planta: "Escanear en planta",
  asignarme: "Asignarme envío",
};

const HINTS: Record<NonNullable<Props["route"]["params"]>["mode"], string> = {
  colecta: "Escaneá el código",
  planta: "Escaneá el código",
  asignarme: "Escaneá el código",
};

type ScanPayload = {
  raw: string;
  id: string;
  senderId: string;
  hashCode?: string | null;
  securityDigit?: string | null;
};

const parseScanPayload = (value: string): ScanPayload => {
  const raw = String(value ?? "").trim();

  try {
    const parsed = JSON.parse(raw);

    return {
      raw,
      id: String(parsed?.id ?? "").trim(),
      senderId: String(parsed?.sender_id ?? parsed?.senderId ?? "").trim(),
      hashCode: parsed?.hash_code ?? null,
      securityDigit: parsed?.security_digit ?? null,
    };
  } catch (_e) {
    const urlMatch = raw.match(
      /(?:order_id|orderId|id|tracking|shipment_id)=([^&\s]+)/i
    );

    const longNumberMatch = raw.match(/\d{8,}/);

    return {
      raw,
      id: urlMatch?.[1]?.trim() || longNumberMatch?.[0] || raw,
      senderId: "",
      hashCode: null,
      securityDigit: null,
    };
  }
};

const extractDriverId = (user: any) => {
  return (
    user?.driver_id ||
    user?.driverId ||
    user?.driverDataId ||
    user?.driver_data_id ||
    user?.id
  );
};

const getBackendMessage = (data: any, fallback: string) => {
  return data?.message || data?.error || data?.details || fallback;
};

const isClientNotLinkedError = (data: any, status: number) => {
  const message = JSON.stringify(data ?? "").toLowerCase();

  return (
    status === 404 ||
    message.includes("user not authenticated") ||
    message.includes("not authenticated") ||
    message.includes("token") ||
    message.includes("mercado_token") ||
    message.includes("account") ||
    message.includes("seller")
  );
};

const isAlreadyInSystemError = (data: any) => {
  const message = JSON.stringify(data ?? "").toLowerCase();

  return (
    message.includes("already in system") ||
    message.includes("ya existe") ||
    message.includes("duplicado") ||
    message.includes("duplicate")
  );
};

export default function DriverScanScreen({ navigation, route }: Props) {
  const mode = route.params.mode;

  const title = useMemo(() => TITLES[mode], [mode]);
  const hint = useMemo(() => HINTS[mode], [mode]);

  const { user, getUserSession } = useContext(UserContext);

  const [permission, requestPermission] = useCameraPermissions();
  const [open, setOpen] = useState(true);
  const [processing, setProcessing] = useState(false);

  const scanLockedRef = useRef(false);

  const close = useCallback(() => {
    scanLockedRef.current = true;
    setOpen(false);
    navigation.goBack();
  }, [navigation]);

  const resetScanner = useCallback(() => {
    scanLockedRef.current = false;
    setProcessing(false);
  }, []);

  const handleTabPress = useCallback(
    (tab: DriverTabKey) => {
      if (tab === "scan") return;

      scanLockedRef.current = true;
      setOpen(false);

      if (tab === "home") {
        navigation.navigate("DriverScreen");
        return;
      }

      if (tab === "deliveries" || tab === "activity") {
        navigation.navigate("EnviosScreen");
        return;
      }

      if (tab === "profile") {
        navigation.navigate("DriverAccountScreen");
      }
    },
    [navigation]
  );

  const ensurePermission = useCallback(async () => {
    if (!permission?.granted) {
      const res = await requestPermission();

      if (!res.granted) {
        Alert.alert(
          "Permiso requerido",
          "Necesitamos acceso a la cámara para escanear."
        );
        close();
        return false;
      }
    }

    return true;
  }, [permission?.granted, requestPermission, close]);

  const getSession = useCallback(async () => {
    if (user?.token) return user;
    return await getUserSession();
  }, [user, getUserSession]);

  const importMercadoLibreDelivery = useCallback(
    async (payload: ScanPayload) => {
      if (!payload.id) {
        throw new Error("El QR no contiene ID de envío.");
      }

      if (!payload.senderId) {
        throw new Error(
          "El QR no contiene sender_id. No puedo validar el cliente vinculado."
        );
      }

      const res = await fetch(
        `${API_BASE}/auth/mercadolibre/deliveries/${payload.senderId}/${payload.id}`,
        { method: "GET" }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (isClientNotLinkedError(data, res.status)) {
          throw new Error("No existe el cliente vinculado para este envío.");
        }

        if (isAlreadyInSystemError(data)) {
          return {
            ok: true,
            alreadyExists: true,
            message: "El envío ya existe en sistema.",
            raw: data,
          };
        }

        throw new Error(
          getBackendMessage(
            data,
            `No se pudo ingresar el envío ML ${payload.id}`
          )
        );
      }

      return data;
    },
    []
  );

  const markDeliveryAsColectado = useCallback(
    async (deliveryId: string | number, sessionUser: any) => {
      const token = sessionUser?.token;

      if (!deliveryId) {
        return {
          ok: false,
          skipped: true,
          message:
            "No se recibió deliveryId para marcar colectado. El backend debe devolverlo.",
        };
      }

      if (!token) {
        throw new Error("No hay token disponible en sesión.");
      }

      const res = await fetch(`${API_BASE}/v2/deliveries/${deliveryId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: "colectado",
          pickup_at: new Date().toISOString(),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          getBackendMessage(
            data,
            "El envío ingresó, pero no se pudo marcar como colectado."
          )
        );
      }

      return data;
    },
    []
  );

  const assignCurrentDeliveryToDriver = useCallback(
    async (deliveryId: string | number, sessionUser: any) => {
      const token = sessionUser?.token;
      const driverId = extractDriverId(sessionUser);

      if (!deliveryId) {
        throw new Error("No hay ID de delivery para asignar.");
      }

      if (!token) {
        throw new Error("No hay token disponible en sesión.");
      }

      if (!driverId) {
        throw new Error("No hay driverId disponible en sesión.");
      }

      const res = await fetch(`${API_BASE}/v2/deliveries/${deliveryId}/driver`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ driverId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          getBackendMessage(
            data,
            "No se pudo asignar el envío. Puede ser un permiso del backend."
          )
        );
      }

      return data;
    },
    []
  );

  const getDeliveryIdFromImportResponse = (data: any) => {
    return (
      data?.delivery ||
      data?.deliveryID ||
      data?.deliveryId ||
      data?.id ||
      data?.data?.delivery ||
      data?.data?.deliveryID ||
      data?.data?.deliveryId ||
      null
    );
  };

  const handleColecta = useCallback(
    async (scanPayload: ScanPayload) => {
      const sessionUser = await getSession();

      if (!sessionUser) {
        throw new Error("No hay sesión activa.");
      }

      const importResult = await importMercadoLibreDelivery(scanPayload);
      const deliveryId = getDeliveryIdFromImportResponse(importResult);

      if (importResult?.alreadyExists && !deliveryId) {
        Alert.alert(
          "Envío ya existente",
          "El envío ya existe en sistema, pero el backend actual no devuelve su deliveryId para marcarlo como colectado desde mobile.",
          [
            { text: "Escanear otro", onPress: resetScanner },
            { text: "Cerrar", onPress: close },
          ]
        );
        return;
      }

      const statusResult = await markDeliveryAsColectado(
        deliveryId,
        sessionUser
      );

      Alert.alert(
        "Colecta registrada ✅",
        [
          `Envío ML: ${scanPayload.id}`,
          deliveryId ? `Delivery ID: ${deliveryId}` : null,
          statusResult?.skipped ? statusResult.message : "Estado: colectado",
        ]
          .filter(Boolean)
          .join("\n"),
        [
          { text: "Escanear otro", onPress: resetScanner },
          { text: "Cerrar", onPress: close },
        ]
      );
    },
    [
      getSession,
      importMercadoLibreDelivery,
      markDeliveryAsColectado,
      resetScanner,
      close,
    ]
  );

  const handleAsignarme = useCallback(
    async (scanPayload: ScanPayload) => {
      const sessionUser = await getSession();

      if (!sessionUser) {
        throw new Error("No hay sesión activa.");
      }

      let deliveryId: string | number | null = scanPayload.id;

      if (scanPayload.senderId) {
        const importResult = await importMercadoLibreDelivery(scanPayload);
        deliveryId = getDeliveryIdFromImportResponse(importResult);

        if (importResult?.alreadyExists && !deliveryId) {
          throw new Error(
            "El envío ya existe, pero el backend no devolvió deliveryId para asignarlo."
          );
        }
      }

      if (!deliveryId) {
        throw new Error("No hay ID de delivery para asignar.");
      }

      const assignResult = await assignCurrentDeliveryToDriver(
        deliveryId,
        sessionUser
      );

      Alert.alert(
        "Envío asignado ✅",
        assignResult?.message || `Te asignaste el envío ${deliveryId}.`,
        [
          { text: "Escanear otro", onPress: resetScanner },
          { text: "Cerrar", onPress: close },
        ]
      );
    },
    [
      getSession,
      importMercadoLibreDelivery,
      assignCurrentDeliveryToDriver,
      resetScanner,
      close,
    ]
  );

  const onBarcodeScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (scanLockedRef.current) return;

      scanLockedRef.current = true;
      setProcessing(true);
      Vibration.vibrate(45);

      const rawData = String(result.data ?? "");
      const scanPayload = parseScanPayload(rawData);

      try {
        if (!scanPayload.id) {
          throw new Error("El QR no contiene un valor válido.");
        }

        if (mode === "colecta") {
          await handleColecta(scanPayload);
          return;
        }

        if (mode === "asignarme") {
          await handleAsignarme(scanPayload);
          return;
        }

        Alert.alert(
          "Función no disponible",
          "El modo En Planta queda reservado para depósito.",
          [{ text: "Aceptar", onPress: close }]
        );
      } catch (e: any) {
        Alert.alert(
          "No se pudo procesar",
          `${e?.message || "Error inesperado"}\n\nValor leído:\n${
            scanPayload.raw || scanPayload.id
          }`,
          [
            { text: "Reintentar", onPress: resetScanner },
            { text: "Cerrar", onPress: close },
          ]
        );
      } finally {
        setProcessing(false);
      }
    },
    [mode, handleColecta, handleAsignarme, resetScanner, close]
  );

  useEffect(() => {
    ensurePermission();
  }, [ensurePermission]);

  return (
    <Modal visible={open} animationType="slide" onRequestClose={close}>
      <View style={styles.container}>
        {!permission ? (
          <View style={styles.loadingBox}>
            <LynxPulseLoader message="Preparando cámara..." />
          </View>
        ) : !permission.granted ? (
          <View style={styles.loadingBox}>
            <LynxPulseLoader message="Solicitando permiso..." />
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              onBarcodeScanned={processing ? undefined : onBarcodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            />

            <View pointerEvents="box-none" style={styles.backLayer}>
              <Pressable onPress={close} style={styles.backButton}>
                <Ionicons
                  name="arrow-back"
                  size={30}
                  color={AppTheme.colors.white}
                />
              </Pressable>
            </View>

            <View pointerEvents="none" style={styles.scanLayer}>
              <View style={styles.scanGuide}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>

              <View style={styles.scanTextPill}>
                <Text style={styles.scanText}>
                  {processing ? "Procesando envío..." : hint}
                </Text>
              </View>

              {processing && (
                <View style={styles.processingCard}>
                  <LynxPulseLoader
                    compact
                    showLogo={false}
                    message="Procesando..."
                  />
                </View>
              )}
            </View>

            <View pointerEvents="none" style={styles.bottomInfo}>
              <Text style={styles.modeText}>{title}</Text>
            </View>

            <DriverBottomNavigation activeTab="scan" onPress={handleTabPress} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.colors.black,
  },

  cameraWrap: {
    flex: 1,
    backgroundColor: AppTheme.colors.black,
  },

  backLayer: {
    position: "absolute",
    top: AppTheme.layout.headerTopPadding,
    left: AppTheme.spacing.lg,
    zIndex: 20,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: AppTheme.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },

  scanLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: AppTheme.spacing.lg,
  },

  scanGuide: {
    width: 270,
    height: 270,
    position: "relative",
  },

  corner: {
    position: "absolute",
    width: 58,
    height: 58,
    borderColor: AppTheme.colors.white,
  },

  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 5,
    borderLeftWidth: 5,
  },

  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 5,
    borderRightWidth: 5,
  },

  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
  },

  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 5,
    borderRightWidth: 5,
  },

  scanTextPill: {
    marginTop: 92,
    minHeight: 48,
    borderRadius: AppTheme.radius.full,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    paddingHorizontal: AppTheme.spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },

  scanText: {
    color: AppTheme.colors.white,
    fontSize: 16,
    fontWeight: AppTheme.font.weight.black,
    textAlign: "center",
  },

  processingCard: {
    position: "absolute",
    bottom: 148,
    minWidth: 190,
    borderRadius: AppTheme.radius.xxl,
    backgroundColor: "rgba(5, 8, 14, 0.82)",
    borderWidth: 1,
    borderColor: AppTheme.borders.medium,
    paddingVertical: AppTheme.spacing.md,
    paddingHorizontal: AppTheme.spacing.md,
  },

  bottomInfo: {
    position: "absolute",
    left: AppTheme.spacing.lg,
    right: AppTheme.spacing.lg,
    bottom: 104,
    alignItems: "center",
  },

  modeText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: AppTheme.font.weight.bold,
  },

  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.surfaces.screen,
    paddingHorizontal: AppTheme.spacing.lg,
  },
});