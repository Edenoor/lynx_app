import React, { createContext, useEffect, useState } from 'react';
import { User } from '../../Domain/entities/User';
import { GetUserLocalUseCase } from '../../Domain/useCases/userLocal/GetUserLocal';
import { SaveUserLocalUseCase } from '../../Domain/useCases/userLocal/SaveUserLocal';
import { RemoveUserLocalUseCase } from '../../Domain/useCases/userLocal/RemoveUserLocal';

// 👇 Centro de notificaciones (provider global)
import { NotificationsProvider } from './NotificationContext';

type Ctx = {
  user: User | null;
  saveUserSession: (u: User) => Promise<void>;
  getUserSession: () => Promise<User | null>;
  removeUserSession: () => Promise<void>;
};

export const UserContext = createContext<Ctx>({
  user: null,
  saveUserSession: async () => {},
  getUserSession: async () => null,
  removeUserSession: async () => {},
});

export const userInitialState: User = {
  id: '',
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  rol: '',
};

export const UserProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  // Rehidratación inicial de la sesión
  useEffect(() => {
    (async () => {
      try {
        const u = await GetUserLocalUseCase();
        if (u && typeof u === 'object' && (u as any).rol) setUser(u as User);
      } catch {}
    })();
  }, []);

  const saveUserSession = async (u: User) => {
    await SaveUserLocalUseCase(u);
    setUser(u);
  };

  const getUserSession = async () => {
    try {
      const u = await GetUserLocalUseCase();
      if (u && typeof u === 'object' && (u as any).rol) {
        setUser(u as User);
        return u as User;
      }
    } catch {}
    return null;
  };

  const removeUserSession = async () => {
    await RemoveUserLocalUseCase();
    setUser(null);
  };

  // 👇 Envolvemos con NotificationsProvider para que Bell/centro esté disponible en toda la app
  return (
    <UserContext.Provider value={{ user, saveUserSession, getUserSession, removeUserSession }}>
      <NotificationsProvider>
        {children}
      </NotificationsProvider>
    </UserContext.Provider>
  );
};
