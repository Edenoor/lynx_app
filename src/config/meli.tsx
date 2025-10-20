import Constants from 'expo-constants';

/**
 * Tomamos valores desde `extra` del app.json/app.config.(ts)
 * Así no quedan hardcodeados en código.
 */
const extra = (Constants.expoConfig?.extra ??
               // fallback para builds antiguas
               (Constants as any).manifest?.extra) || {};

export const MLI = {
  APP_ID: String(extra.MLI_APP_ID || ''),  // ← ponelo en extra (abajo te muestro)
  REDIRECT_URI: String(extra.MLI_REDIRECT_URI || ''), // debe existir en tu app de ML
  AUTH_BASE: 'https://auth.mercadolibre.com.ar/authorization',
};

export function buildMeliAuthUrl(state?: string) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: MLI.APP_ID,
    redirect_uri: MLI.REDIRECT_URI,
    ...(state ? { state } : {}),
  });
  return `${MLI.AUTH_BASE}?${params.toString()}`;
}
