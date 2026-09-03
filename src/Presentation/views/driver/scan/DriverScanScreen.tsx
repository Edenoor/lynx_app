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

import {
  API_URL,
  getJson,
} from "../../../config/Api";

type Props = StackScreenProps<
  DriverStackParamList,
  "DriverScanScreen"
>;

const TITLES: Record<
  NonNullable<Props["route"]["params"]>["mode"],
  string
> = {
  colecta: "Ingresar envío",
  planta: "Diagnóstico planta",
  asignarme: "Asignarme envío",
};

const HINTS: Record<
  NonNullable<Props["route"]["params"]>["mode"],
  string
> = {
  colecta: "Escaneá el QR del envío para ingresarlo",
  planta: "Escaneá un QR para inspeccionarlo",
  asignarme: "Escaneá el QR del envío para asignártelo",
};

type ScanPayload = {
  raw: string;
  id: string;
  senderId: string;
  hashCode?: string | null;
  securityDigit?: string | null;
};

type RoleResponse = {
  ok?: boolean;
  status?: number;
  rol?: string;
  message?: string;
  data?: {
    id?: number | string;
    user_id?: number | string;
    active?: boolean;
    vehiculo?: string | null;
    patente?: string | null;
    [key: string]: unknown;
  } | null;
};

type SelfAssignResponse = {
  ok?: boolean;
  status?: number;
  message?: string;
  error?: string;
  delivery?: unknown;
  [key: string]: unknown;
};

type ScanResponse = {
  success?: boolean;
  ok?: boolean;
  error?: string;
  message?: string;
  delivery?: number | string;
  status?: number | string;
  financials?: number | string;
  skipped?: boolean;
  reason?: string;
  [key: string]: unknown;
};

const parseScanPayload = (
  value: string
): ScanPayload => {
  const raw = String(
    value ?? ""
  ).trim();

  try {
    const parsed =
      JSON.parse(raw);

    return {
      raw,

      id: String(
        parsed?.id ??
          parsed?.shipping_id ??
          parsed?.shippingId ??
          parsed?.tracking ??
          ""
      ).trim(),

      senderId: String(
        parsed?.sender_id ??
          parsed?.senderId ??
          ""
      ).trim(),

      hashCode:
        parsed?.hash_code ??
        parsed?.hashCode ??
        null,

      securityDigit:
        parsed?.security_digit ??
        parsed?.securityDigit ??
        null,
    };
  } catch (_e) {
    const shippingMatch =
      raw.match(
        /(?:shipping_id|shippingId|shipment_id|tracking|order_id|orderId|id)=([^&\s]+)/i
      );

    const senderMatch =
      raw.match(
        /(?:sender_id|senderId)=([^&\s]+)/i
      );

    const longNumberMatch =
      raw.match(/\d{8,}/);

    return {
      raw,

      id:
        shippingMatch?.[1]?.trim() ||
        longNumberMatch?.[0] ||
        raw,

      senderId:
        senderMatch?.[1]?.trim() ||
        "",

      hashCode: null,
      securityDigit: null,
    };
  }
};

export default function DriverScanScreen({
  navigation,
  route,
}: Props) {
  const mode =
    route.params.mode;

  const title = useMemo(
    () => TITLES[mode],
    [mode]
  );

  const hint = useMemo(
    () => HINTS[mode],
    [mode]
  );

  const {
    user,
    getUserSession,
  } = useContext(
    UserContext
  );

  const [
    permission,
    requestPermission,
  ] =
    useCameraPermissions();

  const [
    open,
    setOpen,
  ] = useState(true);

  const [
    processing,
    setProcessing,
  ] = useState(false);

  const scanLockedRef =
    useRef(false);

  const close =
    useCallback(() => {
      scanLockedRef.current =
        true;

      setOpen(false);

      navigation.goBack();
    }, [navigation]);

  const resetScanner =
    useCallback(() => {
      scanLockedRef.current =
        false;

      setProcessing(false);
    }, []);

  const handleTabPress =
    useCallback(
      (
        tab: DriverTabKey
      ) => {
        if (
          tab === "scan"
        ) {
          return;
        }

        scanLockedRef.current =
          true;

        setOpen(false);

        if (
          tab === "home"
        ) {
          navigation.navigate(
            "DriverScreen"
          );

          return;
        }

        if (
          tab ===
            "deliveries" ||
          tab === "activity"
        ) {
          navigation.navigate(
            "EnviosScreen"
          );

          return;
        }

        if (
          tab === "profile"
        ) {
          navigation.navigate(
            "DriverAccountScreen"
          );
        }
      },
      [navigation]
    );

  const ensurePermission =
    useCallback(
      async () => {
        if (
          !permission?.granted
        ) {
          const res =
            await requestPermission();

          if (
            !res.granted
          ) {
            Alert.alert(
              "Permiso requerido",
              "Necesitamos acceso a la cámara para escanear."
            );

            close();

            return false;
          }
        }

        return true;
      },
      [
        permission?.granted,
        requestPermission,
        close,
      ]
    );

  const getSession =
    useCallback(async () => {
      if (user?.token) {
        return user;
      }

      return await getUserSession();
    }, [
      user,
      getUserSession,
    ]);

  /**
   * ====================================================
   * RESOLVER DRIVER CURRENT
   * ====================================================
   *
   * user.id
   *   ↓
   * GET /v2/users/:userId/role
   *   ↓
   * driver_data.id
   */

  const inspectCurrentDriver =
    useCallback(
      async (
        sessionUser: any
      ) => {
        const userId =
          sessionUser?.id;

        if (!userId) {
          throw new Error(
            "La sesión no contiene user.id."
          );
        }

        console.log(
          "======================================"
        );

        console.log(
          "[QR ASSIGN] RESOLVIENDO DRIVER CURRENT"
        );

        console.log(
          "[QR ASSIGN] API:",
          API_URL
        );

        console.log(
          "[QR ASSIGN] SESSION USER ID:",
          userId
        );

        console.log(
          "[QR ASSIGN] SESSION ROLE:",
          sessionUser?.rol ??
            "(sin rol)"
        );

        console.log(
          "[QR ASSIGN] REQUEST:"
        );

        console.log(
          `GET /v2/users/${userId}/role`
        );

        const data =
          (await getJson(
            `/v2/users/${userId}/role`
          )) as RoleResponse;

        console.log(
          "[QR ASSIGN] ROLE RESPONSE:"
        );

        console.log(data);

        if (
          !data?.ok
        ) {
          throw new Error(
            data?.message ||
              "No se pudo resolver el rol del usuario."
          );
        }

        if (
          String(
            data?.rol ?? ""
          ).toUpperCase() !==
          "DRIVER"
        ) {
          throw new Error(
            `El usuario no tiene rol DRIVER. Rol recibido: ${
              data?.rol ??
              "(sin rol)"
            }`
          );
        }

        const driverId =
          data?.data?.id;

        if (!driverId) {
          throw new Error(
            "El backend no devolvió driver_data.id."
          );
        }

        if (
          data?.data
            ?.active === false
        ) {
          throw new Error(
            "El conductor está inactivo."
          );
        }

        console.log(
          "[QR ASSIGN] DRIVER DATA ID:",
          driverId
        );

        console.log(
          "======================================"
        );

        return {
          userId,
          driverId,
          roleData:
            data.data,
          data,
        };
      },
      []
    );

  /**
   * ====================================================
   * ASIGNARME - CURRENT
   * ====================================================
   *
   * Ya probado.
   *
   * QR
   * ↓
   * resolver driver_data.id
   * ↓
   * PUT /v2/deliveries/self-assign
   */

  const handleAsignarme =
    useCallback(
      async (
        payload: ScanPayload
      ) => {
        const sessionUser =
          await getSession();

        if (
          !sessionUser
        ) {
          throw new Error(
            "No hay sesión activa."
          );
        }

        if (
          !sessionUser.token
        ) {
          throw new Error(
            "La sesión no contiene token."
          );
        }

        const driverResult =
          await inspectCurrentDriver(
            sessionUser
          );

        const driverId =
          driverResult.driverId;

        console.log(
          "======================================"
        );

        console.log(
          "[QR ASSIGN] INICIANDO SELF-ASSIGN"
        );

        console.log(
          "[QR ASSIGN] shippingId:",
          payload.id
        );

        console.log(
          "[QR ASSIGN] senderId:",
          payload.senderId ||
            "(vacío)"
        );

        console.log(
          "[QR ASSIGN] driverId:",
          driverId
        );

        console.log(
          "[QR ASSIGN] REQUEST:"
        );

        console.log(
          "PUT /v2/deliveries/self-assign"
        );

        const requestBody = {
          driverId,
          shippingId:
            payload.id,
          senderId:
            payload.senderId ||
            null,
        };

        console.log(
          "[QR ASSIGN] BODY:",
          requestBody
        );

        const response =
          await fetch(
            `${API_URL}/v2/deliveries/self-assign`,
            {
              method:
                "PUT",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${sessionUser.token}`,
              },

              body:
                JSON.stringify(
                  requestBody
                ),
            }
          );

        const responseData =
          (await response
            .json()
            .catch(
              () => ({})
            )) as SelfAssignResponse;

        console.log(
          "[QR ASSIGN] HTTP STATUS:",
          response.status
        );

        console.log(
          "[QR ASSIGN] RESPONSE:"
        );

        console.log(
          responseData
        );

        console.log(
          "======================================"
        );

        if (
          !response.ok
        ) {
          const message =
            responseData?.error ||
            responseData?.message ||
            `La asignación falló con status ${response.status}.`;

          throw new Error(
            message
          );
        }

        Vibration.vibrate([
          0,
          80,
          60,
          120,
        ]);

        Alert.alert(
          "Envío asignado ✅",
          [
            "La asignación se realizó correctamente.",
            "",
            `shipping_id: ${payload.id}`,
            `driver_data.id: ${driverId}`,
            `user.id: ${driverResult.userId}`,
            "",
            driverResult
              .roleData
              ?.vehiculo
              ? `Vehículo: ${driverResult.roleData.vehiculo}`
              : "",
            driverResult
              .roleData
              ?.patente
              ? `Patente: ${driverResult.roleData.patente}`
              : "",
            "",
            responseData?.message
              ? `Backend: ${responseData.message}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
          [
            {
              text:
                "Escanear otro",
              onPress:
                resetScanner,
            },
            {
              text:
                "Cerrar",
              onPress:
                close,
            },
          ]
        );
      },
      [
        getSession,
        inspectCurrentDriver,
        resetScanner,
        close,
      ]
    );

  /**
   * ====================================================
   * COLECTA - CURRENT
   * ====================================================
   *
   * PRUEBA REAL CONTRA PRODUCCIÓN.
   *
   * QR
   * ↓
   * sender_id + shipping_id
   * ↓
   * POST /v2/deliveries/scan
   * ↓
   * saveDelivery()
   *
   * Si el delivery no existe debería crearlo
   * en current.
   *
   * NO asigna conductor.
   */

  const handleColecta =
    useCallback(
      async (
        payload: ScanPayload
      ) => {
        if (
          !payload.id
        ) {
          throw new Error(
            "El QR no contiene shipping_id."
          );
        }

        if (
          !payload.senderId
        ) {
          throw new Error(
            "El QR no contiene sender_id. No podemos identificar la cuenta de MercadoLibre."
          );
        }

        const sessionUser =
          await getSession();

        if (
          !sessionUser
        ) {
          throw new Error(
            "No hay sesión activa."
          );
        }

        if (
          !sessionUser.token
        ) {
          throw new Error(
            "La sesión no contiene token."
          );
        }

        const requestBody = {
          sender_id:
            payload.senderId,
          shipping_id:
            payload.id,
        };

        console.log(
          "======================================"
        );

        console.log(
          "[QR COLECTA] INICIANDO SCAN CURRENT"
        );

        console.log(
          "[QR COLECTA] API:",
          API_URL
        );

        console.log(
          "[QR COLECTA] SESSION USER ID:",
          sessionUser?.id
        );

        console.log(
          "[QR COLECTA] SESSION ROLE:",
          sessionUser?.rol ??
            "(sin rol)"
        );

        console.log(
          "[QR COLECTA] shippingId:",
          payload.id
        );

        console.log(
          "[QR COLECTA] senderId:",
          payload.senderId
        );

        console.log(
          "[QR COLECTA] REQUEST:"
        );

        console.log(
          "POST /v2/deliveries/scan"
        );

        console.log(
          "[QR COLECTA] BODY:",
          requestBody
        );

        const response =
          await fetch(
            `${API_URL}/v2/deliveries/scan`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${sessionUser.token}`,
              },

              body:
                JSON.stringify(
                  requestBody
                ),
            }
          );

        const responseData =
          (await response
            .json()
            .catch(
              () => ({})
            )) as ScanResponse;

        console.log(
          "[QR COLECTA] HTTP STATUS:",
          response.status
        );

        console.log(
          "[QR COLECTA] RESPONSE:"
        );

        console.log(
          responseData
        );

        console.log(
          "======================================"
        );

        if (
          !response.ok
        ) {
          const message =
            responseData?.error ||
            responseData?.message ||
            `El ingreso falló con status ${response.status}.`;

          throw new Error(
            message
          );
        }

        if (
          responseData?.success ===
          false
        ) {
          throw new Error(
            responseData?.error ||
              responseData?.message ||
              "El backend informó que no pudo ingresar el envío."
          );
        }

        Vibration.vibrate([
          0,
          80,
          60,
          120,
        ]);

        Alert.alert(
          "Colecta procesada ✅",
          [
            "El backend procesó correctamente el QR.",
            "",
            `shipping_id: ${payload.id}`,
            `sender_id: ${payload.senderId}`,
            "",
            "Ahora verificá en el frontend si el envío apareció en current.",
          ].join("\n"),
          [
            {
              text:
                "Escanear otro",
              onPress:
                resetScanner,
            },
            {
              text:
                "Cerrar",
              onPress:
                close,
            },
          ]
        );
      },
      [
        getSession,
        resetScanner,
        close,
      ]
    );

  /**
   * ====================================================
   * PLANTA
   * ====================================================
   *
   * Por ahora sigue siendo SOLO LECTURA.
   */

  const handlePlantaReadOnly =
    useCallback(
      (
        payload: ScanPayload
      ) => {
        Alert.alert(
          "QR leído ✅",
          [
            "PRUEBA SEGURA — NO SE MODIFICÓ NADA",
            "",
            "Modo: planta",
            "",
            `shipping_id: ${
              payload.id ||
              "(vacío)"
            }`,
            `sender_id: ${
              payload.senderId ||
              "(vacío)"
            }`,
            "",
            `security_digit: ${
              payload.securityDigit ??
              "(vacío)"
            }`,
            "",
            "Planta sigue en modo diagnóstico.",
            "No se cambió ningún estado.",
          ].join("\n"),
          [
            {
              text:
                "Escanear otro",
              onPress:
                resetScanner,
            },
            {
              text:
                "Cerrar",
              onPress:
                close,
            },
          ]
        );
      },
      [
        resetScanner,
        close,
      ]
    );

  const onBarcodeScanned =
    useCallback(
      async (
        result: BarcodeScanningResult
      ) => {
        if (
          scanLockedRef.current
        ) {
          return;
        }

        scanLockedRef.current =
          true;

        setProcessing(true);

        Vibration.vibrate(
          45
        );

        const rawData =
          String(
            result.data ??
              ""
          );

        const scanPayload =
          parseScanPayload(
            rawData
          );

        console.log(
          "--------------------------------------"
        );

        console.log(
          "[QR] RAW:"
        );

        console.log(
          rawData
        );

        console.log(
          "[QR] PARSED:"
        );

        console.log(
          scanPayload
        );

        console.log(
          "--------------------------------------"
        );

        try {
          if (
            !scanPayload.raw
          ) {
            throw new Error(
              "La cámara detectó un QR sin contenido."
            );
          }

          if (
            !scanPayload.id
          ) {
            throw new Error(
              "No pudimos identificar el shipping_id."
            );
          }

          if (
            mode ===
            "asignarme"
          ) {
            await handleAsignarme(
              scanPayload
            );

            return;
          }

          if (
            mode ===
            "colecta"
          ) {
            await handleColecta(
              scanPayload
            );

            return;
          }

          handlePlantaReadOnly(
            scanPayload
          );
        } catch (
          e: any
        ) {
          console.log(
            "[QR] ERROR:"
          );

          console.log(e);

          const errorMessage =
            e?.message ||
            "Error inesperado";

          let alertTitle =
            "No se pudo procesar el QR";

          if (
            mode ===
            "asignarme"
          ) {
            alertTitle =
              "No se pudo asignar el envío";
          }

          if (
            mode ===
            "colecta"
          ) {
            alertTitle =
              "No se pudo ingresar el envío";
          }

          Alert.alert(
            alertTitle,
            [
              errorMessage,
              "",
              `shipping_id: ${
                scanPayload.id ||
                "(vacío)"
              }`,
              `sender_id: ${
                scanPayload.senderId ||
                "(vacío)"
              }`,
              "",
              mode ===
              "colecta"
                ? "Revisá la consola para ver la respuesta de /v2/deliveries/scan."
                : mode ===
                    "asignarme"
                  ? "Revisá la consola para ver la respuesta del backend."
                  : "No se realizó ninguna modificación.",
            ].join("\n"),
            [
              {
                text:
                  "Reintentar",
                onPress:
                  resetScanner,
              },
              {
                text:
                  "Cerrar",
                onPress:
                  close,
              },
            ]
          );
        } finally {
          setProcessing(
            false
          );
        }
      },
      [
        mode,
        handleAsignarme,
        handleColecta,
        handlePlantaReadOnly,
        resetScanner,
        close,
      ]
    );

  useEffect(() => {
    ensurePermission();
  }, [
    ensurePermission,
  ]);

  const isAssignMode =
    mode === "asignarme";

  const isCollectMode =
    mode === "colecta";

  const isWriteMode =
    isAssignMode ||
    isCollectMode;

  const processingMessage =
    isAssignMode
      ? "Asignando envío..."
      : isCollectMode
        ? "Ingresando envío..."
        : "Consultando...";

  const processingHint =
    isAssignMode
      ? "Asignando..."
      : isCollectMode
        ? "Ingresando..."
        : "Analizando...";

  const environmentLabel =
    isAssignMode
      ? "ASIGNACIÓN CURRENT · PRODUCCIÓN"
      : isCollectMode
        ? "INGRESO CURRENT · PRODUCCIÓN"
        : "SOLO LECTURA · PRODUCCIÓN";

  return (
    <Modal
      visible={open}
      animationType="slide"
      onRequestClose={
        close
      }
    >
      <View
        style={
          styles.container
        }
      >
        {!permission ? (
          <View
            style={
              styles.loadingBox
            }
          >
            <LynxPulseLoader message="Preparando cámara..." />
          </View>
        ) : !permission.granted ? (
          <View
            style={
              styles.loadingBox
            }
          >
            <LynxPulseLoader message="Solicitando permiso..." />
          </View>
        ) : (
          <View
            style={
              styles.cameraWrap
            }
          >
            <CameraView
              style={
                StyleSheet.absoluteFill
              }
              facing="back"
              onBarcodeScanned={
                processing
                  ? undefined
                  : onBarcodeScanned
              }
              barcodeScannerSettings={{
                barcodeTypes:
                  ["qr"],
              }}
            />

            <View
              pointerEvents="box-none"
              style={
                styles.backLayer
              }
            >
              <Pressable
                onPress={
                  close
                }
                style={
                  styles.backButton
                }
              >
                <Ionicons
                  name="arrow-back"
                  size={30}
                  color={
                    AppTheme
                      .colors
                      .white
                  }
                />
              </Pressable>
            </View>

            <View
              pointerEvents="none"
              style={
                styles.scanLayer
              }
            >
              <View
                style={
                  styles.scanGuide
                }
              >
                <View
                  style={[
                    styles.corner,
                    styles.topLeft,
                  ]}
                />

                <View
                  style={[
                    styles.corner,
                    styles.topRight,
                  ]}
                />

                <View
                  style={[
                    styles.corner,
                    styles.bottomLeft,
                  ]}
                />

                <View
                  style={[
                    styles.corner,
                    styles.bottomRight,
                  ]}
                />
              </View>

              <View
                style={
                  styles.scanTextPill
                }
              >
                <Text
                  style={
                    styles.scanText
                  }
                >
                  {processing
                    ? processingHint
                    : hint}
                </Text>
              </View>

              {processing && (
                <View
                  style={
                    styles.processingCard
                  }
                >
                  <LynxPulseLoader
                    compact
                    showLogo={
                      false
                    }
                    message={
                      processingMessage
                    }
                  />
                </View>
              )}
            </View>

            <View
              pointerEvents="none"
              style={
                styles.bottomInfo
              }
            >
              <Text
                style={
                  styles.modeText
                }
              >
                {title}
              </Text>

              <Text
                style={
                  styles.safeText
                }
              >
                {environmentLabel}
              </Text>
            </View>

            <DriverBottomNavigation
              activeTab="scan"
              onPress={
                handleTabPress
              }
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,

      backgroundColor:
        AppTheme.colors
          .black,
    },

    cameraWrap: {
      flex: 1,

      backgroundColor:
        AppTheme.colors
          .black,
    },

    backLayer: {
      position:
        "absolute",

      top:
        AppTheme.layout
          .headerTopPadding,

      left:
        AppTheme.spacing
          .lg,

      zIndex: 20,
    },

    backButton: {
      width: 44,
      height: 44,

      borderRadius:
        AppTheme.radius
          .full,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    scanLayer: {
      ...StyleSheet.absoluteFillObject,

      alignItems:
        "center",

      justifyContent:
        "center",

      paddingHorizontal:
        AppTheme.spacing
          .lg,
    },

    scanGuide: {
      width: 270,
      height: 270,

      position:
        "relative",
    },

    corner: {
      position:
        "absolute",

      width: 58,
      height: 58,

      borderColor:
        AppTheme.colors
          .white,
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
      borderRightWidth:
        5,
    },

    bottomLeft: {
      bottom: 0,
      left: 0,

      borderBottomWidth:
        5,

      borderLeftWidth: 5,
    },

    bottomRight: {
      bottom: 0,
      right: 0,

      borderBottomWidth:
        5,

      borderRightWidth:
        5,
    },

    scanTextPill: {
      marginTop: 92,

      minHeight: 48,

      borderRadius:
        AppTheme.radius
          .full,

      backgroundColor:
        "rgba(0, 0, 0, 0.78)",

      paddingHorizontal:
        AppTheme.spacing
          .lg,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    scanText: {
      color:
        AppTheme.colors
          .white,

      fontSize: 16,

      fontWeight:
        AppTheme.font
          .weight.black,

      textAlign:
        "center",
    },

    processingCard: {
      position:
        "absolute",

      bottom: 148,

      minWidth: 190,

      borderRadius:
        AppTheme.radius
          .xxl,

      backgroundColor:
        "rgba(5, 8, 14, 0.82)",

      borderWidth: 1,

      borderColor:
        AppTheme.borders
          .medium,

      paddingVertical:
        AppTheme.spacing
          .md,

      paddingHorizontal:
        AppTheme.spacing
          .md,
    },

    bottomInfo: {
      position:
        "absolute",

      left:
        AppTheme.spacing
          .lg,

      right:
        AppTheme.spacing
          .lg,

      bottom: 104,

      alignItems:
        "center",
    },

    modeText: {
      color:
        "rgba(255,255,255,0.78)",

      fontSize: 12,

      fontWeight:
        AppTheme.font
          .weight.bold,
    },

    safeText: {
      marginTop: 5,

      color:
        "rgba(255,255,255,0.48)",

      fontSize: 9,

      fontWeight:
        AppTheme.font
          .weight.bold,

      letterSpacing:
        0.7,
    },

    loadingBox: {
      flex: 1,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        AppTheme.surfaces
          .screen,

      paddingHorizontal:
        AppTheme.spacing
          .lg,
    },
  });