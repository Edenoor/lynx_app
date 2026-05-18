import type { VehicleType } from "./types";

export const VEHICLE_CATALOG: Record<
  VehicleType,
  Record<string, string[]>
> = {
  moto: {
    Honda: ["Wave", "CG Titan", "XR"],
    Yamaha: ["FZ", "YBR", "Crypton"],
    Zanella: ["ZB", "ZR", "Ceccato"],
    Gilera: ["Smash", "VC", "AC1"],
    Motomel: ["B110", "S2", "Skua"],
  },
  auto: {
    Ford: ["Fiesta", "Focus", "Ka", "Ranger"],
    Volkswagen: ["Gol", "Polo", "Vento", "Amarok"],
    Peugeot: ["208", "2008", "Partner"],
    Renault: ["Clio", "Sandero", "Kwid", "Duster"],
    Toyota: ["Etios", "Corolla", "Hilux"],
    Fiat: ["Cronos", "Argo", "Uno"],
  },
  utilitario: {
    Ford: ["Transit", "Ranger"],
    Renault: ["Kangoo", "Master"],
    Fiat: ["Fiorino", "Ducato"],
    Peugeot: ["Partner", "Boxer"],
    Volkswagen: ["Saveiro", "Amarok"],
  },
  furgon: {
    "Mercedes-Benz": ["Sprinter"],
    Ford: ["Transit"],
    Renault: ["Master"],
    Fiat: ["Ducato"],
    Iveco: ["Daily"],
  },
};
