import React, { useCallback, useContext, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from "expo-camera";
import { StackScreenProps } from "@react-navigation/stack";
import { DriverStackParamList } from "../../../navigator/DriverStackNavigator";
import { UserContext } from "../../../context/UserContext";

type Props = StackScreenProps<DriverStackParamList, "DriverScanScreen">;

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5000";

const TITLES: Record<NonNullable<Props["route"]["params"]>["mode"], string> = {
  colecta: "Escaneo de Colecta",
  planta: "Escaneo En Planta",
  asignarme: "Escaneo para Asignarme",
};

const HINTS: Record<NonNullable<Props["route"]["params"]>["mode"], string> = {
  colecta:
    "Escaneá el QR del envío. Si pertenece a un cliente vinculado, se ingresa y se marca como colectado.",
  planta: "Función reservada para depósito.",
  asignarme:
    "Escaneá el QR del envío para asignártelo como chofer.",
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
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    navigation.goBack();
  }, [navigation]);

  const resetScanner = useCallback(() => {
    setScanned(false);
    setProcessing(false);
  }, []);

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
          `Cliente ML: ${scanPayload.senderId}`,
          deliveryId ? `Delivery ID: ${deliveryId}` : null,
          statusResult?.skipped ? statusResult.message : "Estado: colectado",
          "El seguimiento de estado ML queda a cargo del poller/backend.",
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
      if (scanned || processing) return;

      setScanned(true);
      setProcessing(true);

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
    [
      scanned,
      processing,
      mode,
      handleColecta,
      handleAsignarme,
      resetScanner,
      close,
    ]
  );

  React.useEffect(() => {
    ensurePermission();
  }, [ensurePermission]);

  return (
    <Modal visible={open} animationType="slide" onRequestClose={close}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{hint}</Text>
          </View>

          <Pressable onPress={close} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Cerrar</Text>
          </Pressable>
        </View>

        {!permission ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Cargando permisos…</Text>
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              onBarcodeScanned={processing ? undefined : onBarcodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            />

            <View pointerEvents="none" style={styles.overlay}>
              <View style={styles.frame} />

              <Text style={styles.overlayText}>
                {processing
                  ? "Procesando envío…"
                  : "Alineá el QR dentro del recuadro"}
              </Text>

              {processing && <ActivityIndicator color="#fff" />}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#111",
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  subtitle: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    marginTop: 4,
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#222",
  },
  closeBtnText: {
    color: "#fff",
    fontWeight: "800",
  },
  cameraWrap: {
    flex: 1,
    position: "relative",
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  frame: {
    width: 260,
    height: 260,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  overlayText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: "#fff",
  },
});