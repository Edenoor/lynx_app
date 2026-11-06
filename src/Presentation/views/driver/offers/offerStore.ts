// src/Presentation/views/driver/offers/offerStore.ts
// Ofertas pendientes del chofer, compartidas entre Inicio, Envíos y la bandeja:
// el contador se pide una vez y se reutiliza unos segundos. Y el aviso que
// aparece arriba cuando llega una oferta con la app abierta: no frena lo que
// el chofer está haciendo (un escaneo, una entrega); se toca para abrir la
// bandeja o se va solo.

import { fetchRouteOffers } from "../routes/routesApi";
import { fetchMyOffers } from "../turbo/turboApi";
import { sharedValue, useSharedValue } from "../work/sharedValue";
import { pendingOffers, visibleTurboOffers } from "./offerInbox";

const COUNT_TTL_MS = 30_000;

// null: todavía no se sabe (o no se pudo leer nunca).
const count = sharedValue<number | null>(null);
let countAt = 0;
let inflight: Promise<void> | null = null;
// Sube al cerrar sesión: lo que estaba en vuelo ya no se publica.
let generation = 0;
// Habilitación Turbo conocida (la informan Inicio y la bandeja): sin ella no
// se cuentan ofertas Turbo, que no se le muestran.
let turboEnabled: boolean | null = null;
export function setOfferTurboEnabled(enabled: boolean | null) {
  if (enabled === turboEnabled) return;
  turboEnabled = enabled;
  countAt = 0;
}

export function publishOfferCount(n: number) {
  countAt = Date.now();
  count.set(n);
}

// Si el pedido falla queda el último número conocido: el error real lo
// muestra la bandeja, que es donde se contesta.
export function refreshOfferCount(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && count.get() !== null && Date.now() - countAt < COUNT_TTL_MS) return Promise.resolve();
  const gen = generation;
  inflight = Promise.all([fetchMyOffers(), fetchRouteOffers()])
    .then(([turbos, routes]) => { if (gen === generation) publishOfferCount(pendingOffers(visibleTurboOffers(turbos, turboEnabled), routes)); })
    .catch(() => {})
    .finally(() => { if (gen === generation) inflight = null; });
  return inflight;
}

export const useOfferCount = () => useSharedValue(count);

// ---------- Aviso no bloqueante ----------

export type OfferNotice = { id: number; title: string; body: string; open: () => void };
const notice = sharedValue<OfferNotice | null>(null);
let noticeSeq = 0;
export const NOTICE_VISIBLE_MS = 8_000;

export function showOfferNotice(n: Omit<OfferNotice, "id">) {
  const id = ++noticeSeq;
  notice.set({ ...n, id });
  // Llegó una oferta: el contador de la bandeja ya no vale.
  void refreshOfferCount(true);
  setTimeout(() => { if (notice.get()?.id === id) notice.set(null); }, NOTICE_VISIBLE_MS);
}

export const dismissOfferNotice = () => notice.set(null);
export const useOfferNotice = () => useSharedValue(notice);

// Al cerrar sesión: nada de esto es del próximo chofer.
export function resetOfferStore() {
  generation++;
  inflight = null;
  countAt = 0;
  turboEnabled = null;
  count.set(null);
  notice.set(null);
}

// La bandeja es la pestaña «Ofertas» de Alertas: todos los accesos (aviso,
// push, Envíos, Recorridos) llegan por acá.
export const openOfferInbox = (navigation: { navigate: (...args: any[]) => void }) =>
  navigation.navigate("NotificationsScreen", { tab: "offers" });
