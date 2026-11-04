// src/Presentation/views/driver/Envios/baulSource.ts
// Lo que el chofer tiene en el Baúl (cobranzas por rendir, paquetes y cambios
// para devolver). Hoy el servidor solo lo expone a ADMIN (/v2/baul/drivers/:id,
// con warehouse_access o db_access): con el token del chofer no hay lectura
// propia, y la app no usa rutas administrativas. Hasta que exista el contrato,
// la pestaña muestra que la función está pendiente; no se pide nada ni se
// deduce el Baúl de los estados de los envíos (un NOT_DELIVERED no es Baúl).
//
// Contrato pedido al backend (cuando exista, se implementa acá y la pantalla
// no cambia de estructura):
//   GET /v2/baul/me   (DRIVER; el chofer sale del token, sin id en la ruta)
//   200 { ok: true, start_at, totals, cash: [...], parcels: [...], items: [...] }
//       — lo mismo que driverDetail() para su propio driver_data.id, sin movimientos de otros.
//   403 sin ficha de chofer activa · 401 sesión vencida

export type BaulResult = { status: "unsupported" };

export async function fetchMyBaul(): Promise<BaulResult> {
  return { status: "unsupported" };
}
