import React, { createContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { User } from "../../Domain/entities/User";
import { GetUserLocalUseCase } from "../../Domain/useCases/userLocal/GetUserLocal";
import { SaveUserLocalUseCase } from "../../Domain/useCases/userLocal/SaveUserLocal";
import { RemoveUserLocalUseCase } from "../../Domain/useCases/userLocal/RemoveUserLocal";
import {
  setAuthToken,
  setUnauthorizedHandler,
} from "../../Data/sources/remote/api/ApiDelivery";

import { NotificationsProvider } from "./NotificationContext";
import { clearDriverPositionsBuffer, stopDriverTracking } from "../config/DriverLocation";
import { onSessionRenewed, renewSessionIfNeeded } from "../config/SessionRenewal";
import {
  retryPendingPushUnregister,
  unregisterPushOnLogout,
} from "../config/PushUnregister";

// Cada cuánto se revisa, con la app abierta, si el token está por vencer.
const RENEW_CHECK_MS = 15 * 60_000;

type Ctx = {
  user: User | null;
  isAuthLoading: boolean;
  saveUserSession: (u: User) => Promise<void>;
  getUserSession: () => Promise<User | null>;
  removeUserSession: () => Promise<void>;
};

export const UserContext = createContext<Ctx>({
  user: null,
  isAuthLoading: true,
  saveUserSession: async () => {},
  getUserSession: async () => null,
  removeUserSession: async () => {},
});

export const userInitialState: User = {
  id: "",
  username: "",
  name: "",
  email: "",
  rol: "",
  token: "",
};

const isValidSession = (u: unknown): u is User => {
  const candidate = u as User | null;

  return Boolean(
    candidate &&
      typeof candidate === "object" &&
      candidate.token &&
      candidate.username &&
      candidate.rol,
  );
};

export const UserProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const isRemovingSessionRef = useRef(false);

  const clearSessionState = async () => {
    await RemoveUserLocalUseCase();
    setAuthToken(null);
    setUser(null);
  };

  // Fin de operación: apaga el seguimiento y sube lo pendiente mientras el
  // token todavía sirve. Solo el cierre manual da de baja el push: con la
  // sesión vencida (401) el teléfono sigue siendo del usuario.
  const endSession = async ({ unregisterPush }: { unregisterPush: boolean }) => {
    if (isRemovingSessionRef.current) return;

    isRemovingSessionRef.current = true;

    try {
      await stopDriverTracking({ available: false });
      // Lo que no se pudo subir (sin red, sesión vencida) se descarta: con el
      // token del próximo chofer quedaría a su nombre.
      const discarded = await clearDriverPositionsBuffer();
      if (discarded) console.log("[Lynx Location] Al cerrar sesión se descartaron", discarded, "posiciones sin subir");
      if (unregisterPush) await unregisterPushOnLogout();
      await clearSessionState();
    } finally {
      setTimeout(() => {
        isRemovingSessionRef.current = false;
      }, 500);
    }
  };

  const removeUserSession = () => endSession({ unregisterPush: true });
  const expireSession = () => endSession({ unregisterPush: false });

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      console.log("[Lynx Auth] Sesión expirada. Redirigiendo a login.");
      await expireSession();
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    const hydrateSession = async () => {
      try {
        const storedUser = await GetUserLocalUseCase();

        if (isValidSession(storedUser)) {
          setAuthToken(storedUser.token);
          setUser(storedUser);
        } else {
          setAuthToken(null);
          setUser(null);
          retryPendingPushUnregister();
        }
      } catch (error) {
        console.log("[Lynx Auth] Error hidratando sesión:", error);
        setAuthToken(null);
        setUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    hydrateSession();
  }, []);

  // Renovación de la sesión (C7): al abrir, al volver a primer plano y cada
  // RENEW_CHECK_MS mientras la app está abierta. Ver SessionRenewal.ts.
  const loggedIn = Boolean(user);
  useEffect(() => {
    if (!loggedIn) return;

    const unsubscribe = onSessionRenewed((token) => {
      setUser((prev) => (prev ? { ...prev, token } : prev));
    });
    renewSessionIfNeeded();
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") renewSessionIfNeeded();
    });
    const timer = setInterval(renewSessionIfNeeded, RENEW_CHECK_MS);

    return () => {
      unsubscribe();
      appStateSub.remove();
      clearInterval(timer);
    };
  }, [loggedIn]);

  const saveUserSession = async (u: User) => {
    await SaveUserLocalUseCase(u);
    setAuthToken(u.token);
    setUser(u);
  };

  const getUserSession = async () => {
    try {
      const storedUser = await GetUserLocalUseCase();

      if (isValidSession(storedUser)) {
        setAuthToken(storedUser.token);
        setUser(storedUser);
        return storedUser;
      }
    } catch (error) {
      console.log("GET USER SESSION ERROR:", error);
    }

    setAuthToken(null);
    setUser(null);
    return null;
  };

  return (
    <UserContext.Provider
      value={{
        user,
        isAuthLoading,
        saveUserSession,
        getUserSession,
        removeUserSession,
      }}
    >
      <NotificationsProvider>{children}</NotificationsProvider>
    </UserContext.Provider>
  );
};