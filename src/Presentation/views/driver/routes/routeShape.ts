// src/Presentation/views/driver/routes/routeShape.ts
// El trazado por calles del recorrido (GET /v2/routes/:id/plan/shape, 10-nov):
// cada tramo es una polyline codificada (algoritmo de Google) con precisión 6,
// la de Valhalla. El servidor lo arma con el orden GUARDADO; si el orden que
// se ve en el mapa es otro (uno sin confirmar, o el coordinador lo cambió),
// el trazado no se dibuja. Sin React: se prueba con node.

export type LatLng = { latitude: number; longitude: number };

export function decodePolyline(encoded: string, precision = 6): LatLng[] {
  const factor = 10 ** precision;
  const out: LatLng[] = [];
  let index = 0, lat = 0, lng = 0;
  const next = () => {
    let result = 0, shift = 0, b: number;
    do {
      if (index >= encoded.length) throw new Error("polyline incompleta");
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    lng += next();
    out.push({ latitude: lat / factor, longitude: lng / factor });
  }
  return out;
}

// Los tramos decodificados, o null si no corresponden a lo que se ve: las
// paradas del trazado tienen que aparecer en el mapa en el mismo orden.
export function shapeLines(
  shape: { stop_ids: number[]; shapes: string[]; precision?: number },
  shownStopIds: number[],
): LatLng[][] | null {
  const traced = new Set(shape.stop_ids);
  if (!shape.stop_ids.every((id) => shownStopIds.includes(id))) return null;
  const shownOrder = shownStopIds.filter((id) => traced.has(id));
  if (shownOrder.join(",") !== shape.stop_ids.join(",")) return null;
  try {
    return shape.shapes.map((s) => decodePolyline(s, shape.precision ?? 6)).filter((line) => line.length >= 2);
  } catch {
    return null;
  }
}
