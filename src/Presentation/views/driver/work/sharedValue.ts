// src/Presentation/views/driver/work/sharedValue.ts
// Un valor compartido entre pantallas (Inicio, Envíos, Colectas): se lee el
// mismo dato sin repetir el pedido en cada una. Las pantallas se suscriben y
// se vuelven a dibujar cuando cambia.

import { useEffect, useState } from "react";

export type SharedValue<T> = {
  get: () => T;
  set: (next: T) => void;
  subscribe: (fn: () => void) => () => void;
};

export function sharedValue<T>(initial: T): SharedValue<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      value = next;
      listeners.forEach((fn) => fn());
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
  };
}

export function useSharedValue<T>(shared: SharedValue<T>): T {
  const [value, setValue] = useState(shared.get());
  useEffect(() => {
    setValue(shared.get());
    return shared.subscribe(() => setValue(shared.get()));
  }, [shared]);
  return value;
}
