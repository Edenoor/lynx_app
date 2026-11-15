import React, { useEffect } from "react";
import { createNativeStackNavigator, type NativeStackScreenProps } from "@react-navigation/native-stack";
import { createBottomTabNavigator, type BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps, NavigatorScreenParams } from "@react-navigation/native";

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
import ChatScreen from "../views/driver/chat/ChatScreen";
import OfferNoticeBanner from "../components/driver/OfferNoticeBanner";
import CollectInLightDataModal from "../components/driver/CollectInLightDataModal";
import { hideCollectInLightData } from "../views/driver/collectionMode";
import { resetDriverWork } from "../views/driver/work/workSource";
import { resetOfferStore } from "../views/driver/offers/offerStore";
import { resetChatStore } from "../views/driver/chat/chatStore";
import { resetDriverProfile } from "../views/driver/account/driverProfileApi";

export type DriverScanMode = "colecta" | "planta" | "asignarme";

// Las cinco pestañas de la barra inferior. Cada una queda montada y recuerda
// su estado; para ir a una desde cualquier pantalla: goToDriverTab (tabNavigation).
export type DriverTabParamList = {
  DriverScreen: undefined;
  EnviosScreen: undefined;
  DriverScanOptionsScreen: undefined;
  // Colectas (PICKUP).
  CollectionsScreen: undefined;
  // tab: la pestaña que se abre («offers»: la bandeja de ofertas; «messages»: los chats).
  NotificationsScreen: { tab?: "notifications" | "offers" | "messages" } | undefined;
};

export type DriverStackParamList = {
  Onboarding: undefined;
  // El navegador de pestañas; lo demás se apila encima.
  DriverTabs: NavigatorScreenParams<DriverTabParamList> | undefined;
  DriverAccountScreen: undefined;
  DriverHomeScreen: undefined;
  AppearanceScreen: undefined;
  DriverScanScreen: { mode: DriverScanMode };
  // Recorridos de reparto y Turbo por día (se entra desde Envíos).
  RoutesScreen: undefined;
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
  // Una charla del chat interno. title: el de la lista, mientras carga.
  ChatScreen: { conversationId: number; title?: string };
};

// Props de una pantalla-pestaña: navega entre pestañas y también apila
// pantallas del stack (un detalle, el escáner).
export type DriverTabScreenProps<K extends keyof DriverTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<DriverTabParamList, K>,
  NativeStackScreenProps<DriverStackParamList>
>;

const Stack = createNativeStackNavigator<DriverStackParamList>();
const Tab = createBottomTabNavigator<DriverTabParamList>();

// La barra la dibuja cada pantalla (DriverBottomNavigation), también las de
// detalle: acá no hay otra. Atrás desde una pestaña vuelve a Inicio y desde
// Inicio sale de la app.
const noTabBar = () => null;
const DriverTabs = () => (
  <Tab.Navigator initialRouteName="DriverScreen" backBehavior="firstRoute" tabBar={noTabBar} screenOptions={{ headerShown: false }}>
    <Tab.Screen name="DriverScreen" component={DriverScreen} />
    <Tab.Screen name="EnviosScreen" component={EnviosScreen} />
    <Tab.Screen name="DriverScanOptionsScreen" component={DriverScanOptionsScreen} />
    <Tab.Screen name="CollectionsScreen" component={CollectionsScreen} />
    <Tab.Screen name="NotificationsScreen" component={NotificationsScreen} />
  </Tab.Navigator>
);

export const DriverStackNavigator = () => {
  const { state } = useOnboarding();

  const onboardingCompleted = state.completedLocal === true;

  // El stack se desmonta al cerrar sesión: lo leído no es del próximo chofer.
  useEffect(() => () => { resetDriverWork(); resetOfferStore(); resetChatStore(); resetDriverProfile(); hideCollectInLightData(); }, []);

  // El aviso de oferta va encima de cualquier pantalla y no la bloquea. El de
  // «Registro de colecta» (LightData) se pide desde Colectas y el QR.
  return (
    <>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!onboardingCompleted ? (
        <Stack.Screen name="Onboarding" component={OnboardingStackNavigator} />
      ) : (
        <>
          <Stack.Screen name="DriverTabs" component={DriverTabs} />
          <Stack.Screen
            name="DriverAccountScreen"
            component={DriverAccountScreen}
          />
          <Stack.Screen name="DriverHomeScreen" component={DriverHomeScreen} />
          <Stack.Screen name="AppearanceScreen" component={AppearanceScreen} />
          <Stack.Screen name="DriverScanScreen" component={DriverScanScreen} />
          <Stack.Screen name="RoutesScreen" component={RoutesScreen} />
          <Stack.Screen name="RouteDetailScreen" component={RouteDetailScreen} />
          <Stack.Screen name="RouteOrganizeScreen" component={RouteOrganizeScreen} />
          <Stack.Screen name="TurboGroupScreen" component={TurboGroupScreen} />
          <Stack.Screen name="TurboTomorrowScreen" component={TurboTomorrowScreen} />
          <Stack.Screen name="DriverHelpScreen" component={DriverHelpScreen} />
          {/* Una pantalla por charla: abrir otra (un push, una derivación) no le cambia los datos a la que está abierta. */}
          <Stack.Screen name="ChatScreen" component={ChatScreen} getId={({ params }) => String(params.conversationId)} />
        </>
      )}
    </Stack.Navigator>
    {onboardingCompleted ? <OfferNoticeBanner /> : null}
    {onboardingCompleted ? <CollectInLightDataModal /> : null}
    </>
  );
};