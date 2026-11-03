import type { VehicleType } from "./types";

// Marcas y modelos que se venden en Argentina, por tipo (3-nov-2026: se amplió
// la lista corta del onboarding; los de antes siguen, con el nombre completo).
// Lo que no figura se carga como «Otra marca» / «Otro modelo» (ver vehicleOptions.ts).
// El chofer guarda «tipo · marca · modelo»: el tipo va primero porque de ahí
// salen la tarifa y si es moto o auto para Turbo.
export const VEHICLE_CATALOG: Record<
  VehicleType,
  Record<string, string[]>
> = {
  moto: {
    Bajaj: ["Boxer 150", "Rouser NS 125", "Rouser NS 160", "Rouser NS 200", "Dominar 250", "Dominar 400"],
    Benelli: ["TNT 15", "180S", "TRK 251", "Leoncino 250"],
    Corven: ["Energy 110", "Mirage 110", "Hunter 150", "Triax 150", "Triax 200", "TXR 250"],
    Gilera: ["Smash 110", "VC 150", "AC1", "Sahel 150", "SMX 200"],
    Honda: ["Wave 110", "Biz 125", "CB 125F", "CG 150 Titan", "CB 190R", "XR 150L", "XR 190L", "XRE 300", "CB 250 Twister", "Elite 125", "Navi 110", "PCX 160"],
    Keller: ["Stratus 110", "Miracle 150"],
    Mondial: ["LD 110", "RD 150"],
    Motomel: ["B110", "Blitz 110", "Max 110", "S2 150", "Strato 150", "Skua 150", "Skua 250", "Sirius 190", "Victory 150"],
    Suzuki: ["AX 100", "GN 125", "Gixxer 150"],
    TVS: ["Ntorq 125", "Apache RTR 160", "Apache RTR 200"],
    Yamaha: ["Crypton 110", "YBR 125", "Fascino 125", "Ray ZR", "XTZ 125", "XTZ 150", "FZ-S FI", "FZ 25", "XTZ 250", "NMAX 160"],
    Zanella: ["ZB 110", "Due 110", "Ceccato", "ZR 150", "RX 150", "Styler 150"],
  },
  auto: {
    Chery: ["QQ", "Tiggo 2", "Tiggo 3"],
    Chevrolet: ["Onix", "Prisma", "Corsa", "Classic", "Celta", "Agile", "Aveo", "Spin", "Cruze", "Tracker"],
    "Citroën": ["C3", "C4", "C4 Cactus", "C-Elysée", "C4 Lounge"],
    Fiat: ["Cronos", "Argo", "Uno", "Mobi", "Palio", "Siena", "Grand Siena", "Punto", "Pulse"],
    Ford: ["Fiesta", "Focus", "Ka", "Ranger", "EcoSport", "Escort"],
    Honda: ["Fit", "City", "Civic", "WR-V", "HR-V"],
    Hyundai: ["i10", "HB20", "Accent", "Creta", "Tucson"],
    Jeep: ["Renegade", "Compass"],
    Kia: ["Picanto", "Rio", "Cerato", "Sportage"],
    Nissan: ["March", "Note", "Versa", "Sentra", "Kicks", "Frontier"],
    Peugeot: ["208", "2008", "Partner", "206", "207", "301", "307", "308", "408", "3008"],
    Renault: ["Clio", "Sandero", "Kwid", "Duster", "Logan", "Stepway", "Symbol", "Fluence", "Megane", "Captur"],
    Suzuki: ["Fun", "Celerio", "Swift"],
    Toyota: ["Etios", "Corolla", "Hilux", "Yaris", "Corolla Cross", "SW4"],
    Volkswagen: ["Gol", "Polo", "Vento", "Amarok", "Gol Trend", "Voyage", "Fox", "Up!", "Suran", "Virtus", "Bora", "T-Cross", "Taos"],
  },
  utilitario: {
    Chevrolet: ["Montana", "Combo", "N300", "S10"],
    "Citroën": ["Berlingo", "Jumpy"],
    Fiat: ["Fiorino", "Ducato", "Strada", "Qubo", "Doblò", "Toro"],
    Ford: ["Transit", "Ranger", "Courier", "Transit Connect", "Maverick"],
    "Mercedes-Benz": ["Vito"],
    Nissan: ["Frontier", "NV200"],
    Peugeot: ["Partner", "Boxer", "Rifter", "Expert"],
    Renault: ["Kangoo", "Master", "Oroch", "Alaskan"],
    Toyota: ["Hilux", "Hiace"],
    Volkswagen: ["Saveiro", "Amarok", "Caddy"],
  },
  furgon: {
    "Citroën": ["Jumper"],
    Fiat: ["Ducato"],
    Ford: ["Transit"],
    Hyundai: ["H-1"],
    Iveco: ["Daily"],
    "Mercedes-Benz": ["Sprinter", "Accelo"],
    Peugeot: ["Boxer"],
    Renault: ["Master", "Trafic"],
    Toyota: ["Hiace"],
    Volkswagen: ["Crafter", "Delivery"],
  },
};
