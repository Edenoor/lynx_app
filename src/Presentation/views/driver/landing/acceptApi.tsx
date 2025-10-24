import { postJson } from '../../../config/Api';

export async function acceptShipment(tracking: string, driverUsername: string) {
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL || ''}/envios/${tracking}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driverUsername }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || 'Error al aceptar envío');
  }
}
