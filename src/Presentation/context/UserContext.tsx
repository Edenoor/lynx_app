import React, { createContext, useEffect, useState } from "react";
import { User } from "../../Domain/entities/User";
import { GetUserLocalUseCase } from "../../Domain/useCases/userLocal/GetUserLocal";
import { SaveUserLocalUseCase } from "../../Domain/useCases/userLocal/SaveUserLocal";
import { RemoveUserLocalUseCase } from "../../Domain/useCases/userLocal/RemoveUserLocal";
import { setAuthToken } from "../../Data/sources/remote/api/ApiDelivery";

import { NotificationsProvider } from "./NotificationContext";

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
      candidate.rol
  );
};

export const UserProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

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
        }
      } catch (error) {
        setAuthToken(null);
        setUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    hydrateSession();
  }, []);

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

  const removeUserSession = async () => {
    await RemoveUserLocalUseCase();
    setAuthToken(null);
    setUser(null);
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