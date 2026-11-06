// src/Presentation/views/driver/offers/offerInbox.ts
// La bandeja de ofertas del chofer: Turbos sueltos, lotes de Turbos y
// recorridos que ofrece el coordinador, en una sola lista. Cada uno se
// contesta con su contrato de siempre (/v2/turbo/offers, /v2/turbo/offers/lote,
// /v2/offers): acá solo se arma qué se muestra y cuántas hay.
// Módulo puro (sin React Native) para probarlo con node.

import type { RouteOffer } from "../routes/routesApi";
import type { TurboOffer } from "../turbo/turboApi";
import { offerCards } from "../turbo/turboGroup";

// `expires_local`: el vencimiento anclado al reloj del servidor (withLocalExpiry, turboOffer.ts).
type Expiring = { expires_local: number };
type TurboLike = Pick<TurboOffer, "route_id" | "group_id"> & Expiring;
type RouteOfferLike = Pick<RouteOffer, "route_id"> & Expiring;

export type InboxItem<T extends TurboLike, R extends RouteOfferLike> =
  | { kind: "turbo"; key: string; offer: T }
  | { kind: "lote"; key: string; group_id: number; offers: T[] }
  | { kind: "recorrido"; key: string; offer: R };

// Lo que vence primero, arriba. Un lote vence con su primer Turbo.
export function buildInbox<T extends TurboLike, R extends RouteOfferLike>(turbos: T[], routeOffers: R[]): InboxItem<T, R>[] {
  const items: { at: number; item: InboxItem<T, R> }[] = [];
  for (const c of offerCards(turbos)) {
    if (c.kind === "lote") {
      items.push({ at: Math.min(...c.offers.map((o) => o.expires_local)), item: { kind: "lote", key: `lote-${c.group_id}`, group_id: c.group_id, offers: c.offers } });
    } else {
      items.push({ at: c.offer.expires_local, item: { kind: "turbo", key: `turbo-${c.offer.route_id}`, offer: c.offer } });
    }
  }
  for (const o of routeOffers) items.push({ at: o.expires_local, item: { kind: "recorrido", key: `route-${o.route_id}`, offer: o } });
  return items.sort((a, b) => (a.at === b.at ? 0 : a.at < b.at || Number.isNaN(b.at) ? -1 : 1)).map((x) => x.item);
}

// Ofertas pendientes como las ve el chofer: un lote cuenta una vez (se acepta entero).
export function pendingOffers(turbos: Pick<TurboOffer, "group_id">[], routeOffers: unknown[]): number {
  const lotes = new Set(turbos.filter((o) => o.group_id != null).map((o) => o.group_id));
  return turbos.filter((o) => o.group_id == null).length + lotes.size + routeOffers.length;
}

// «Recorrido #77 · 4 envíos».
export const routeOfferTitle = (o: RouteOffer) =>
  `Recorrido #${o.route_id} · ${o.deliveries} ${o.deliveries === 1 ? "envío" : "envíos"}`;

// Aviso no bloqueante cuando llega una oferta con la app abierta.
export function offerNoticeText(kind: "TURBO_OFFER" | "ROUTE_OFFER", raw?: { storeName?: unknown } | null) {
  if (kind === "ROUTE_OFFER") return { title: "Te ofrecieron un recorrido", body: "Contestá desde Ofertas antes de que venza." };
  const store = typeof raw?.storeName === "string" && raw.storeName.trim() ? `${raw.storeName.trim()}. ` : "";
  return { title: "Turbo disponible", body: `${store}El primero que acepta se lo queda.` };
}

// Sin habilitación Turbo (false) no se muestran ofertas Turbo: no las puede
// aceptar. null (no se sabe) no esconde nada. Es solo la vista: quien
// autoriza es el servidor.
export const visibleTurboOffers = <T,>(turbos: T[], turboEnabled: boolean | null): T[] => (turboEnabled === false ? [] : turbos);
