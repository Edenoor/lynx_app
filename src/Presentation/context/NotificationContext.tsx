import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid/non-secure';

export type NotiKind = 'NEW_TRAD' | 'TRAD_ACCEPTED' | 'INFO' | 'ALERT';

export type Noti = {
  id: string;
  kind: NotiKind;
  title: string;
  body?: string;
  data?: any;
  createdAt: number;   // Date.now()
  read: boolean;
};

type Ctx = {
  items: Noti[];
  unreadCount: number;
  add: (n: { kind: NotiKind; title: string; body?: string; data?: any }) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clear: () => void;
};

const NotificationsContext = createContext<Ctx>({
  items: [],
  unreadCount: 0,
  add: () => {},
  markRead: () => {},
  markAllRead: () => {},
  remove: () => {},
  clear: () => {},
});

export const NotificationsProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [items, setItems] = useState<Noti[]>([]);
  const idGen = useRef(() => nanoid(12));

  const add = useCallback((n: { kind: NotiKind; title: string; body?: string; data?: any }) => {
    setItems((prev) => [
      {
        id: idGen.current(),
        kind: n.kind,
        title: n.title || 'Notificación',
        body: n.body,
        data: n.data,
        createdAt: Date.now(),
        read: false,
      },
      ...prev,
    ]);
  }, []);

  const markRead = useCallback((id: string) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x)));
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((x) => (x.read ? x : { ...x, read: true })));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const unreadCount = useMemo(() => items.filter((x) => !x.read).length, [items]);

  const value = useMemo(
    () => ({ items, unreadCount, add, markRead, markAllRead, remove, clear }),
    [items, unreadCount, add, markRead, markAllRead, remove, clear]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export const useNotifications = () => useContext(NotificationsContext);
