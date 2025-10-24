// src/Presentation/config/Heartbeat.ts
import * as Location from 'expo-location';
import { postJson } from './Api';

// ✅ Compatible con RN/Expo (evita NodeJS.Timer vs number)
let timer: ReturnType<typeof setInterval> | null = null;

export function startDriverHeartbeat(
  username: string,
  available: boolean,
  vehicleType?: string | null
) {
  stopDriverHeartbeat(); // por si ya estaba corriendo

  timer = setInterval(async () => {
    try {
      let lat: number | null = null;
      let lng: number | null = null;

      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        // silencioso: puede fallar si el usuario negó ubicación
      }

      await postJson('/drivers/heartbeat', {
        username,
        available,
        lat,
        lng,
        vehicleType: vehicleType ?? null,
      });
    } catch {
      // silencioso
    }
  }, 30_000); // cada 30s
}

export function stopDriverHeartbeat() {
  if (timer !== null) {
    clearInterval(timer); // ✅ ahora acepta el tipo sin quejarse
    timer = null;
  }
}
