import React, { useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { DriverScreen } from "../views/driver/landing/Driver";
import { EnviosScreen } from "../views/driver/Envios/EnviosScreen";
import NotificationsScreen from "../views/common/NotificationScreen";
import DriverAccountScreen from "../views/driver/account/DriverAccountScreen";
import DriverHomeScreen from "../views/driver/account/DriverHomeScreen";
import AppearanceScreen from "../views/driver/account/AppearanceScreen";

import { OnboardingStackNavigator } from "../navigator/OnboardingStackNavigator";
import { useOnboarding } from "../onboarding/OnboardingContext";

import DriverScanScreen from "../views/driver/scan/DriverScanScreen";
import DriverScanOptionsScreen from "../views/driver/scan/DriverScanOptionsScreen";
import RoutesScreen from "../views/driver/routes/RoutesScreen";
import CollectionsScreen from "../views/driver/routes/CollectionsScreen";
import RouteDetailScreen from "../views/driver/routes/RouteDetailScreen";
import RouteOrganizeScreen from "../views/driver/routes/RouteOrganizeScreen";
import TurboGroupScreen from "../views/driver/turbo/TurboGroupScreen";
import TurboTomorrowScreen from "../views/driver/turbo/TurboTomorrowScreen";
import DriverHelpScreen from "../views/driver/help/DriverHelpScreen";
import OfferNoticeBanner from "../components/driver/OfferNoticeBanner";
import CollectInLightDataModal from "../components/driver/CollectInLightDataModal";
import { hideCollectInLightData } from "../views/driver/collectionMode";
import { resetDriverWork } from "../views/driver/work/workSource";
import { resetOfferStore } from "../views/driver/offers/offerStore";
import { resetDriverProfile } from "../views/driver/account/driverProfileApi";

export type DriverScanMode = "colecta" | "planta" | "asignarme";

export type DriverStackParamList = {
  Onboarding: undefined;
  DriverScreen: undefined;
  EnviosScreen: undefined;
  // tab: la pestaña que se abre («offers»: la bandeja de ofertas).
  NotificationsScreen: { tab?: "notifications" | "offers" } | undefined;
  DriverAccountScreen: undefined;
  DriverHomeScreen: undefined;
  AppearanceScreen: undefined;
  DriverScanOptionsScreen: undefined;
  DriverScanScreen: { mode: DriverScanMode };
  // Recorridos de reparto y Turbo por día (se entra desde Envíos).
  RoutesScreen: undefined;
  // Colectas (PICKUP): pestaña de la barra.
  CollectionsScreen: undefined;
  // name: el de la colecta, cuando se conoce (el detalle no lo trae).
  // fromGroup: se abrió desde su grupo Turbo (si no, un Turbo agrupado abre el grupo).
  RouteDetailScreen: { routeId: number; name?: string; fromGroup?: boolean };
  // Ruteador del chofer: inicio, fin y orden de las paradas de un reparto.
  RouteOrganizeScreen: { routeId: number };
  // Varios Turbos de una tienda con un solo retiro.
  TurboGroupScreen: { groupId: number };
  // Programados sin chofer que cualquiera puede tomar antes.
  TurboTomorrowScreen: undefined;
  // Asistente de ayuda: dudas de uso de la app.
  DriverHelpScreen: undefined;
};

const Stack = createNativeStackNavigator<DriverStackParamList>();

export const DriverStackNavigator = () => {
  const { state } = useOnboarding();

  const onboardingCompleted = state.completedLocal === true;

  // El stack se desmonta al cerrar sesión: lo leído no es del próximo chofer.
  useEffect(() => () => { resetDriverWork(); resetOfferStore(); resetDriverProfile(); hideCollectInLightData(); }, []);

  // El aviso de oferta va encima de cualquier pantalla y no la bloquea. El de
  // «Registro de colecta» (LightData) se pide desde Colectas y el QR.
  return (
    <>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!onboardingCompleted ? (
        <Stack.Screen name="Onboarding" component={OnboardingStackNavigator} />
      ) : (
        <>
          <Stack.Screen name="DriverScreen" component={DriverScreen} />
          <Stack.Screen name="EnviosScreen" component={EnviosScreen} />
          <Stack.Screen
            name="NotificationsScreen"
            component={NotificationsScreen}
          />
          <Stack.Screen
            name="DriverAccountScreen"
            component={DriverAccountScreen}
          />
          <Stack.Screen name="DriverHomeScreen" component={DriverHomeScreen} />
          <Stack.Screen name="AppearanceScreen" component={AppearanceScreen} />
          <Stack.Screen
            name="DriverScanOptionsScreen"
            component={DriverScanOptionsScreen}
          />
          <Stack.Screen name="DriverScanScreen" component={DriverScanScreen} />
          <Stack.Screen name="RoutesScreen" component={RoutesScreen} />
          <Stack.Screen name="CollectionsScreen" component={CollectionsScreen} />
          <Stack.Screen name="RouteDetailScreen" component={RouteDetailScreen} />
          <Stack.Screen name="RouteOrganizeScreen" component={RouteOrganizeScreen} />
          <Stack.Screen name="TurboGroupScreen" component={TurboGroupScreen} />
          <Stack.Screen name="TurboTomorrowScreen" component={TurboTomorrowScreen} />
          <Stack.Screen name="DriverHelpScreen" component={DriverHelpScreen} />
        </>
      )}
    </Stack.Navigator>
    {onboardingCompleted ? <OfferNoticeBanner /> : null}
    {onboardingCompleted ? <CollectInLightDataModal /> : null}
    </>
  );
};