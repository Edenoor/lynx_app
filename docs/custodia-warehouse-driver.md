# Transferencia de custodia Warehouse → Driver

Estado: **propuesta para validar**. No hay nada implementado ni migrado.
Base: auditoría de solo lectura de `WEBAPP MVP/server` (octubre 2026). Las referencias `archivo:línea` son de ese repositorio.

## 1. Problema

Lynx registra la recepción y el estanteado de cada paquete, pero no registra cuándo cada paquete sale físicamente del depósito hacia un Driver:

- `PUT /v2/routes/:id/confirm-load` solo compara dos números (`routeService.js:411-431`).
- `PUT /v2/routes/:id/start` pasa en bloque todos los envíos del recorrido a `OUT_FOR_DELIVERY` y, por eso, limpia `shelf_id` (`opsService.js:108-110`). Esa es la única "salida" que existe hoy, y la dispara el Driver sin escanear.
- Legacy y LightData no tocan Current. El chofer es un texto (`legacy.envios.cadete`). Un paquete recibido por el Picker y repartido por un chofer Legacy no deja rastro de salida: lo único que llega después es el cierre de Mercado Libre, que no limpia `shelf_id` (`opsService.js:144-174`).
- No hay custodia de Driver en ningún lado. La custodia de Warehouse se deduce (`currentCustodyWarehouseId`, `opsService.js:204-217`).

## 2. Principios del diseño

- **La custodia no es un estado operativo.** La transferencia no cambia `ops_status` y es ortogonal a la máquina de estados.
- **No se agregan eventos a `delivery_ops_events`.** Varios lectores asumen que cada fila es una transición: el embudo de `dayService`, `detachDelivery`, `lastReceivedWarehouseId`, el reporte de tarifa Dropoff y los bloqueos de borrado de Warehouse. Ya hoy el `SHELVED→SHELVED` de `moveToShelf` infla "estanteados hoy".
- **Una sola tabla nueva**, que funciona como libro de períodos de custodia del Driver. No hay segundo motor, ni tabla de sesiones, ni estados nuevos.
- **`shelf_id` sigue siendo la verdad de "está físicamente en la estantería".** Hoy hay salidas que no lo limpian, y esto lo corrige: toda salida física lo limpia, y ningún cierre administrativo lo limpia a ciegas.

## 3. Respuestas a las diez cuestiones

### 3.1 Cómo identificar al Driver receptor

- **No usar `username`:** no es UNIQUE (`users.js:34` inserta sin verificar).
- **No usar `cadete`:** es texto libre.
- **Identificar por `driver_data.id`, con presencia física.** La app del Driver muestra un **QR de entrega** de vida corta, y el Picker lo escanea.
  - **Formato:** `LYNX:DRIVER:<driver_data_id>.<exp_epoch>.<hmac>`.
  - **Firma:** HMAC-SHA256 con una clave derivada de `JWT_SECRET` (`HMAC(JWT_SECRET, "driver-handover")`).
  - **Por qué no un JWT:** `verifyToken` (`auth/middleware.js:17`) acepta cualquier JWT firmado con `JWT_SECRET`. Un token de entrega con formato JWT serviría como credencial de API. El formato propio no lo es.
  - **Sin estado:** no requiere tabla ni variable de entorno nueva. Vence a los 30 minutos y se puede regenerar.
- **Al escanearlo, el Picker ve** nombre, vehículo, patente y foto (`driver_extra`) para confirmar visualmente que es esa persona. Esto mitiga que alguien reenvíe una captura de pantalla.
- **Current y Legacy se identifican igual.** El chofer Legacy necesita una cuenta Lynx (`users` + `driver_data`), que ya es el vínculo de las liquidaciones (`lightdata_username` / `driver_legacy_alias`).
  - Un chofer sin cuenta **no puede recibir custodia**: es una condición operativa a confirmar.
  - Descarto la "selección manual de chofer desde una lista" porque no prueba presencia.

### 3.2 Quién entrega, quién recibe, cuándo y desde dónde

Cada fila de la tabla nueva registra:

- **Quién entrega (Picker):** `handed_by_user_id`, tomado del JWT.
- **Quién recibe (Driver):** `to_driver_id`, tomado del QR verificado.
- **Cuándo:** `handed_at`.
- **Desde dónde:** `from_warehouse_id` y `from_shelf_id`. Se leen de `delivery_status` antes de limpiar la estantería, y quedan nulos si el paquete estaba en `ARRIVED_WAREHOUSE` sin estantear.

### 3.3 `route_id` opcional sin perder trazabilidad

- **Con `route_id`, el servidor valida:**
  - que el envío está en una parada DELIVERY de ese recorrido con `outcome IS NULL`;
  - que `routes.driver_id` es el Driver del QR;
  - que el recorrido está `ASSIGNED` o `LOADED`.
- **Sin `route_id` (Legacy/LightData):** la fila queda completa igual (Driver, Picker, Warehouse, estantería y hora). El recorrido es contexto, no identidad.
  - Si existe `legacy.envios` con el mismo tracking (`numero_tracking = tracking::text`) y su `cadete` no coincide con el `lightdata_username` o los alias del Driver, la respuesta trae la alerta `LEGACY_DRIVER_MISMATCH`. **No bloquea**, porque LightData puede reasignar después.

### 3.4 Separar custodia de `OUT_FOR_DELIVERY`

- **La entrega no cambia `ops_status`.** Un envío `ASSIGNED_TO_ROUTE` sigue así hasta que el Driver inicia el recorrido. Uno Legacy en `SHELVED` sigue `SHELVED`. No hace falta tocar `NEXT` ni los CHECK.
- **Lo que sí hace:**
  - limpia `shelf_id` y `shelved_at`: sale del inventario físico;
  - abre un período de custodia del Driver.
- **`currentCustodyWarehouseId` es el único punto de verdad de la custodia de Warehouse.** Si hay custodia de Driver abierta, devuelve `null`. Así, `receive`, `moveToShelf`, `assertCollectible` y `pendingAtWarehouse` respetan la custodia del Driver sin cambios propios.
- **Quién tiene el paquete:**
  - custodia abierta → el Driver;
  - `shelf_id` → la estantería;
  - `ARRIVED_WAREHOUSE` → el Warehouse.

### 3.5 Recorrido con paquetes sin entregar al Driver

Se introduce por fases, con una bandera por Warehouse:

- **Fase 1, informativa.**
  - `start` funciona igual que hoy.
  - La respuesta suma `pending_handover: [{ delivery_id, tracking }]`, igual que `flexNotShipped`.
  - El evento `OUT_FOR_DELIVERY` de esos envíos lleva la nota "salida sin entrega registrada", para medir la adopción.
- **Fase 2, estricta (opcional).**
  - `start` responde 409 `PENDING_HANDOVER` con la lista.
  - Se activa solo cuando los depósitos ya escanean siempre.
- **`confirm-load`:** no cambia. El conteo sigue siendo la confirmación del Driver. La entrega escaneada es la del depósito, y las dos se complementan.

### 3.6 Idempotencia y duplicados

- **Índice único parcial:** `UNIQUE (delivery_id) WHERE ended_at IS NULL`. Es imposible tener dos custodias abiertas del mismo paquete.
- **Dentro de la transacción:** `SELECT … FOR UPDATE` sobre `delivery_status` y la custodia abierta.
  - Abierta con **el mismo Driver** (y el mismo `route_id`): `200 { already_handed_over: true }`, sin escribir nada. Un reintento con mala señal no duplica.
  - Abierta con **otro Driver**: 409 `HELD_BY_OTHER_DRIVER`, informando a quién.
- **Clave natural:** el par (paquete, custodia abierta). No hace falta un `client_request_id`.

### 3.7 Entrega equivocada y reversión

- **Endpoint:** `POST /v2/warehouse/handovers/:id/reverse { qr, reason }`.
  - Lo usa un Picker del mismo Warehouse, que escanea el paquete devuelto (prueba de presencia).
  - Solo se puede revertir si la custodia está abierta y el envío todavía no salió a reparto (`ops_status` distinto de `OUT_FOR_DELIVERY`).
- **Efecto:**
  - `ended_at = NOW()`, `ended_reason = 'REVERSED'`, `ended_by_user_id` y `ended_notes = reason`;
  - restaura `shelf_id = from_shelf_id` si esa estantería sigue activa;
  - si no, queda sin estantería en custodia del Warehouse, para reubicarlo con el flujo actual.
- **Nunca se borran filas.** La entrega equivocada y su reversión quedan en el historial.
- **Después de un `start`**, devolver el paquete es una **recepción** normal (3.10).

### 3.8 Cancelados que siguen físicamente en el depósito

- **`CANCELLED`** (siempre por ML, `reconcileFromProvider`) **conserva `shelf_id`**: el paquete sigue físicamente ahí. Es inventario a retener, no basura.
  - El inventario lo muestra marcado ("Cancelado · retener").
  - No se puede entregar a un Driver: 409 `CANCELLED_HOLD`.
  - La devolución al vendedor sería en el futuro otro tipo de salida. Fuera de alcance (YAGNI).
- **`DELIVERED` informado por ML** sí implica que el paquete salió. En `reconcileFromProvider`:
  - si hay custodia abierta, cerrarla con `ended_reason = 'DELIVERED'`;
  - si no la hay y tiene `shelf_id`, limpiarlo y anotar en el evento de cierre "salida no registrada · estantería X" con `warehouse_id`. Eso permite medir cuántas salidas se escapan.
- **También:** `reconcileFromProvider` debe correr en transacción. Hoy hace autocommit y se traga los errores.

### 3.9 Historial unificado

No se mezcla en una sola tabla: se une **al leer**, en `historyService`. La línea de tiempo combina:

- **`delivery_ops_events`:** transiciones y reubicaciones (sin cambios).
- **`delivery_custody_transfers`:** dos entradas por fila, "Entregado a Driver X por Picker Y desde estantería Z" (`handed_at`) y su cierre (`ended_at`, con el motivo).
- **`legacy.envios_estado_historial`:** de solo lectura, unido por tracking y marcado `source: legacy`. Es "mejor esfuerzo", porque hoy no existe un vínculo formal entre `public.deliveries` y `legacy.envios`.

Además, `moveToShelf` debería guardar `warehouse_id` en su evento (hoy no lo hace). Es un arreglo menor en el mismo cambio.

### 3.10 Compatibilidad con lo existente

| Pieza | Impacto |
|---|---|
| `confirm-load` | Ninguno. |
| `start` | Fase 1: solo suma `pending_handover` a la respuesta. `transition` → `OUT_FOR_DELIVERY` sigue igual; limpiar `shelf_id` ya nulo no cambia nada. |
| Cancelar recorrido | Igual que hoy: `ops` vuelve a `ARRIVED_WAREHOUSE`. La custodia del Driver sigue abierta hasta que el Picker lo reciba, y `currentCustodyWarehouseId` lo refleja. |
| `detachDelivery` | 409 si hay custodia abierta en ese recorrido: primero hay que revertir. Si no, quedaría `SHELVED` sin estantería y en poder del Driver. |
| `recordOutcome` `DELIVERED` | `transition` cierra la custodia (`ended_reason = 'DELIVERED'`), en un único punto de `opsService`. |
| `NOT_DELIVERED` | La custodia sigue abierta: el Driver todavía tiene el paquete. |
| `receive` (Recepción) | Si hay custodia abierta, se cierra con `RECEIVED_BACK` y sigue el flujo normal. Hay que contemplar el caso `SHELVED` sin `shelf_id` (Legacy entregado y devuelto). **Es el cambio más sensible.** |
| `moveToShelf` | Con custodia de Driver, la custodia es nula y la operación se rechaza como hoy ("custodia distinta"). |
| Liquidaciones de chofer y tienda | Ninguno: leen solo tablas Legacy. |
| Snapshots (`driver_daily_snapshot`, `settlement_period_snapshot`) | Ninguno: son Legacy. |
| `dayService` (embudo y stock) | Ninguno: no se agregan eventos. Contar entregas al Driver puede venir después. |
| Tarifa Dropoff | Ninguno: no se generan eventos `ARRIVED_WAREHOUSE`. |
| Borrado de Warehouse (`deleteBlockers`) | Sumar las custodias con `from_warehouse_id`. La FK ya lo impediría, pero con un error menos claro. |
| Colecta Dropoff (`COLLECTED`) | Sin cambios. Unificarla como custodia de Driver queda para después. |

## 4. Contrato mínimo

Todas las respuestas usan el formato actual `{ ok, ... }` / `{ ok: false, error }`.

### 4.1 `POST /v2/drivers/me/handover-qr`

- **Auth:** `DRIVER` con ficha activa (`driverOf`).
- **Body:** vacío.
- **200:** `{ qr: "LYNX:DRIVER:…", expires_at }`.
- **Errores:** 401 (sesión) y 403 (sin ficha de Driver activa).

### 4.2 `POST /v2/warehouse/handovers/driver`

Identifica al Driver antes de empezar a escanear paquetes. Solo lectura.

- **Auth:** Picker (`requirePickerWarehouse`).
- **Body:** `{ driver_qr }`.
- **200:**

  ```json
  { "driver": { "id", "name", "vehiculo", "patente", "photo_url" },
    "routes": [{ "id", "scheduled_date", "status", "deliveries_count", "pending_handover_count" }] }
  ```

  `routes` contiene los recorridos DELIVERY de hoy del Driver, en estado `ASSIGNED` o `LOADED`.
- **Errores:**
  - 400 `DRIVER_QR_INVALID` o `DRIVER_QR_EXPIRED`;
  - 404: el Driver no existe o está inactivo;
  - 401 y 403.

### 4.3 `POST /v2/warehouse/handovers`

- **Auth:** Picker.
- **Body:** `{ driver_qr, qr, route_id? }`. `qr` es la etiqueta del paquete, con la misma interpretación que `receive`.
- **201:**

  ```json
  { "handover": { "id", "delivery_id", "driver_id", "route_id", "from_shelf": { "id", "code" } | null, "handed_at" },
    "delivery": { "id", "tracking", "receiver", "direccion", "postal_code" },
    "already_handed_over": false,
    "alerts": [{ "code", "text" }] }
  ```

- **200:** el mismo cuerpo con `already_handed_over: true`.
- **Errores:**
  - 400: QR de paquete inválido, `DRIVER_QR_INVALID` o `DRIVER_QR_EXPIRED`;
  - 403: no es Picker, o el paquete está bajo custodia de otro Warehouse;
  - 404: el envío no existe;
  - 409, con `code`:
    - `NOT_IN_WAREHOUSE`: no está en custodia de este Warehouse;
    - `HELD_BY_OTHER_DRIVER`;
    - `NOT_IN_ROUTE`;
    - `ROUTE_DRIVER_MISMATCH`;
    - `ROUTE_NOT_LOADABLE`;
    - `CANCELLED_HOLD`;
    - `CLOSED`: `DELIVERED`.
- **Alertas (no bloquean):** `LEGACY_DRIVER_MISMATCH`, `FLEX_NOT_SHIPPED`.

### 4.4 `POST /v2/warehouse/handovers/:id/reverse`

- **Auth:** Picker del mismo Warehouse.
- **Body:** `{ qr, reason }`. `reason` es obligatorio y tiene un máximo de 500 caracteres.
- **200:** `{ handover: { id, ended_at, ended_reason: "REVERSED" }, shelf: { id, code } | null }`.
- **Errores:**
  - 404;
  - 409: `ALREADY_ENDED`, `QR_MISMATCH` (el paquete escaneado no es el de la custodia) u `OUT_FOR_DELIVERY`.

### 4.5 Cambios en respuestas existentes (aditivos)

- **`PUT /v2/routes/:id/start`:** suma `pending_handover` (fase 1).
- **`GET /v2/routes/:id` y `/by-qr/:token`:** suman `handed_over_at` por envío, para que el Driver vea qué recibió.

## 5. Tabla nueva

Es un bloque idempotente al final de `server/migration`. Hay que reflejarlo también en `server/sql`, que hoy está desactualizado.

```sql
CREATE TABLE IF NOT EXISTS public.delivery_custody_transfers (
    id                BIGSERIAL PRIMARY KEY,
    delivery_id       INTEGER NOT NULL REFERENCES public.deliveries(id),
    from_warehouse_id INTEGER NOT NULL REFERENCES public.warehouses(id),
    from_shelf_id     INTEGER NULL REFERENCES public.warehouse_shelves(id),
    to_driver_id      BIGINT  NOT NULL REFERENCES public.driver_data(id),
    route_id          BIGINT  NULL REFERENCES public.routes(id),
    handed_by_user_id BIGINT  NOT NULL REFERENCES public.users(id),
    handed_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at          TIMESTAMP NULL,
    ended_reason      VARCHAR(16) NULL CHECK (ended_reason IN ('DELIVERED','RECEIVED_BACK','REVERSED')),
    ended_by_user_id  BIGINT  NULL REFERENCES public.users(id),
    ended_notes       TEXT    NULL,
    CHECK ((ended_at IS NULL) = (ended_reason IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_custody_open_delivery
    ON public.delivery_custody_transfers (delivery_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_custody_open_driver
    ON public.delivery_custody_transfers (to_driver_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_custody_route
    ON public.delivery_custody_transfers (route_id) WHERE route_id IS NOT NULL;
```

- **Tipos de las FK:** `deliveries.id` y `warehouses.id` son `SERIAL`. Hay que verificar `users.id` y `driver_data.id` al implementar.
- **`TIMESTAMP` sin zona:** se mantiene por consistencia con el resto del esquema. Arrastra la misma ambigüedad de zona horaria ya conocida.
- **No se agrega ninguna columna** a `delivery_status`, `routes` ni `delivery_ops_events`.

## 6. Responsabilidades por capa

### Backend (fuera de este repositorio)

| Archivo | Cambio |
|---|---|
| `current/warehouse/custodyService.js` (nuevo) | `handover`, `reverse`, `openCustody(client, deliveryId)`, `endCustody(client, deliveryId, reason, by)`. Es la única puerta de escritura de la tabla. |
| `current/warehouse/driverHandoverQr.js` (nuevo, chico) | Firmar y verificar el QR del Driver (HMAC, vencimiento). |
| `current/warehouse/warehouse.js` | Rutas 4.2 a 4.4, con `requirePickerWarehouse` y `withTx`. |
| `current/driver/drivers.js` | Ruta 4.1. |
| `current/ops/opsService.js` | `currentCustodyWarehouseId` consulta la custodia abierta. `transition` cierra la custodia al pasar a `DELIVERED`. `reconcileFromProvider`: transacción, cierre de custodia o limpieza anotada para `DELIVERED`, conservar `shelf_id` en `CANCELLED`. |
| `current/warehouse/receiveService.js` | `receive` cierra `RECEIVED_BACK` y contempla `SHELVED` sin estantería. `moveToShelf` guarda `warehouse_id` en su evento. |
| `current/routes/routeService.js` | `pending_handover` en `start`; 409 en `detachDelivery` con custodia abierta; `handed_over_at` en el detalle. |
| `current/ops/historyService.js` | Unión de eventos, custodias e historial Legacy. |
| `current/warehouse/shelfService.js` | Contenido y conteo con la regla de inventario de la sección 8. |
| `warehouses.js` (`deleteBlockers`) | Contar custodias. |
| `migration`, `sql` | Tabla e índices. |

### Mobile (futuro, este repositorio)

- **Picker, `views/picker/handoverApi.ts`:** cliente sobre `Api.tsx` con `postJsonWithTimeout`, porque es una operación no idempotente en el lado del cliente y no debe quedar colgada. Sin cliente HTTP nuevo.
- **Picker, `views/picker/handover/`** (pantalla + `ViewModel.tsx`): flujo «Entregar a Driver».
  1. Escanear el QR del Driver y confirmar identidad con la foto.
  2. Elegir un recorrido o "sin recorrido".
  3. Escanear paquetes uno por uno, con el contador de pendientes del recorrido.
  4. Deshacer el último con motivo.

  Reutiliza `QrScanner` y los patrones de `PickerScanScreen` y `pickerScan.ts`.
- **Picker, tarjeta en `PickerScanOptionsScreen`:** «Entregar a Driver».
- **Driver, pantalla «Mi código de entrega»:** muestra el QR con `react-native-qrcode-svg`, que ya es una dependencia, y lo renueva al vencer.
  - Es un cambio en Driver: requiere autorización explícita cuando toque.
  - No es un cambio nativo, así que se puede entregar por OTA.

## 7. Pruebas

### Backend (servicio + integración con base de prueba)

- **Entregas:**
  - con recorrido y sin recorrido;
  - repetición con el mismo Driver: `already_handed_over`, sin filas nuevas;
  - con otro Driver: 409.
- **Validaciones de recorrido:** envío fuera del recorrido, Driver distinto y recorrido `IN_PROGRESS`, todos 409.
- **Estados que no se entregan:** `CANCELLED_HOLD` y `CLOSED`.
- **QR del Driver:**
  - vencido;
  - alterado (HMAC inválido);
  - un **JWT de login usado como QR**, que debe rechazarse;
  - un **QR de Driver usado como Bearer**, que el middleware debe rechazar.
- **Reversión:**
  - restaura la estantería;
  - se puede volver a entregar después (índice parcial);
  - rechaza un paquete escaneado distinto.
- **`start`:** informa los pendientes en fase 1 y bloquea en fase 2.
- **Cierres de custodia:**
  - `DELIVERED` por la app y por ML cierra la custodia;
  - `NOT_DELIVERED` la deja abierta;
  - `receive` la cierra con `RECEIVED_BACK`.
- **Otros flujos de recorrido:** `detachDelivery` con custodia abierta da 409. Al cancelar un recorrido, la custodia sigue abierta y `currentCustodyWarehouseId` es nulo.
- **Concurrencia:** dos entregas simultáneas del mismo paquete producen exactamente una fila.
- **Regresión:**
  - siguen pasando `test/dropoffCustodyInvariants.test.js` y `tests/history-db.integration.test.js` (+1 evento);
  - `dayService` no cambia sus conteos;
  - el reporte de tarifa Dropoff no cambia.

### Mobile

- **Harness con el TS real** (como `picker-checks`):
  - parseo del QR del Driver;
  - manejo de cada `code` 409;
  - un timeout no se reintenta solo;
  - `already_handed_over` se muestra como éxito sin duplicar el contador.
- **`npx tsc --noEmit`** sin errores nuevos.
- **Dispositivo:** escaneo real del QR desde otro teléfono, brillo y distancia, mala señal.

## 8. Inventario de estanterías y filtro transitorio de Mobile

**Hoy (transitorio):** Mobile (`views/picker/warehouseApi.ts`, `activeShelfPackages`) oculta los envíos `DELIVERED` y `CANCELLED` dentro de una estantería. En la lista solo muestra «Vacía» cuando `deliveries_count` es 0, porque ese conteo incluye los cerrados.

Es un parche sobre un dato inconsistente del servidor: `shelf_id` no se limpia en los cierres por ML. **No es la regla del inventario.**

**Regla definitiva:** el inventario de una estantería es lo que está físicamente bajo custodia del depósito en ella, es decir `shelf_id = S` sin custodia de Driver abierta. Con este diseño, toda salida física limpia `shelf_id`, así que la regla se reduce a `shelf_id = S`. El estado operativo **no** decide si un paquete está en la estantería:

- Un `CANCELLED` que sigue físicamente ahí **debe aparecer**, marcado para retener. El filtro actual lo oculta, y eso es lo que hay que revertir.
- Un `DELIVERED` con `shelf_id` es un dato a corregir en el servidor (3.8), no algo que la app deba filtrar.
- Un `ASSIGNED_TO_ROUTE` todavía no entregado al Driver sigue en la estantería: asignar no transfiere custodia.

**Cuando el backend implemente 3.8 y la sección 8 en `shelfService`:**

- quitar `activeShelfPackages` de Mobile;
- volver a mostrar el número de paquetes en la lista, a partir de un conteo que el servidor calcule con la misma regla;
- mostrar el marcador de cancelado.

## 8.1 Actualización (octubre 2026) — `present_count`/`cancelled_count` ya están en el backend

**Esto NO es la custodia formal de las secciones 1-7** (eso sigue sin implementarse, decisión de MVP vigente). Es solo el prerequisito de backend que la sección 8 pedía para poder sacar el filtro transitorio de Mobile, implementado en `integration/circuito-mvp` (`server/current/warehouse/shelfService.js:listShelves()`), ya probado contra una base real.

`GET /v2/warehouse/shelves` ahora devuelve, además de `deliveries_count` (sin cambios, sigue incluyendo cerrados):

```ts
present_count: number;   // shelf_id = S AND ops_status NOT IN ('DELIVERED','CANCELLED') (NULL cuenta como presente)
cancelled_count: number; // shelf_id = S AND ops_status = 'CANCELLED'
```

Importante: la regla definitiva de la sección 8 (`shelf_id = S` sin custodia de Driver) **todavía no es la regla implementada** — hoy sigue siendo `shelf_id = S` filtrado por `ops_status`, porque la custodia formal (sección 1-7) no existe todavía. Un `CANCELLED` sigue teniendo `shelf_id` (confirmado: `opsService.js` nunca lo limpia al cancelar), así que `cancelled_count` ya refleja exactamente el caso que la sección 8 quería resolver, sin esperar al resto del diseño.

**Cambio pendiente en Mobile** (no aplicado desde este repositorio — lo hace quien edite `lynx_app`):

- `warehouseApi.ts`: el tipo `Shelf` ya tenía `present_count?: number` previsto ("mientras no llegue, no se muestra ninguna cifra") — ya llega. Agregar `cancelled_count: number` al tipo.
- `activeShelfPackages` (el filtro transitorio que oculta `DELIVERED`/`CANCELLED` en cliente): puede reemplazarse por leer directamente `present_count` del servidor en vez de filtrar la lista a mano — mismo resultado, una sola fuente de verdad.
- Mostrar una alerta cuando `cancelled_count > 0` en la lista de estanterías del Picker, igual que WebApp (`src/pages/ShelvesPage.tsx`, mismo patrón: badge de advertencia junto al conteo, clickeable, y en el detalle de contenido resaltar la fila con `ops_status === 'CANCELLED'` para que el Picker identifique cuál es y la retire o gestione).
- `GET /v2/warehouse/shelves/:id/deliveries` (detalle) ya incluye los `CANCELLED` sin filtrar (`shelfContents()` en el backend no filtra por `ops_status`) — confirmado, no hace falta ningún cambio de backend para que el detalle los muestre.

## 9. Riesgos

- **Recepción** es el cambio más sensible (`receive` con custodia abierta y `SHELVED` sin estantería). Necesita pruebas propias y una validación en el depósito antes de activarlo.
- **Choferes Legacy sin cuenta Lynx:** no pueden recibir. Hay que relevar cuántos son antes de la fase 2.
- **Fricción operativa:** escanear cada paquete agrega tiempo en la carga. Por eso la fase 1 es informativa y la bandera es por Warehouse.
- **QR reenviado:** lo mitigan el vencimiento de 30 minutos y la confirmación visual con foto, pero no es infalible.
- **Recorrido cancelado con paquetes ya entregados al Driver:** quedan en su custodia hasta que se reciban. Requiere un aviso operativo en el panel, que puede venir después.
- **Vínculo Legacy por tracking:** es "mejor esfuerzo" (BIGINT contra TEXT, sin FK). Solo alimenta alertas e historial, nunca decisiones.
- **Limpieza histórica de `DELIVERED` con estantería:** escritura única a aprobar y ejecutar en backend, con evento anotado. Los `CANCELLED` se revisan físicamente antes de tocarlos.

**Hallazgos laterales, fuera de este alcance:**

- `GET /v2/drivers/:id/deliveries` no valida que `:id` sea el propio chofer: cualquier Driver puede leer los envíos de otro.
- `PUT /v2/deliveries/self-assign` pasa un objeto como parámetro (`delivery.js:425-429`).

## 10. Orden sugerido

1. **Backend:** tabla, `custodyService`, QR del Driver, endpoints 4.1 a 4.4, cambios en `opsService` y `currentCustodyWarehouseId`, y `pending_handover` informativo.
2. **Backend:** `receive` con `RECEIVED_BACK`, regla de inventario en `shelfService`, unión del historial.
3. **Mobile:** «Mi código de entrega» (Driver) y «Entregar a Driver» (Picker); quitar el filtro transitorio.
4. **Operación:** piloto en un Warehouse, medir "salidas sin entrega registrada" y decidir la fase 2.
5. **Backend:** limpieza histórica aprobada.
