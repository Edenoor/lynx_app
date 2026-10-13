# Lynx Mobile — Instrucciones para Claude Code

## 1. Contexto del producto

Lynx es una plataforma logística con aplicaciones Web y Mobile conectadas a una misma API.

Lynx debe entenderse como un sistema operativo de envíos, no como una aplicación centrada exclusivamente en sellers o Mercado Libre.

Entidades principales:

- **Delivery:** entidad central del dominio logístico.
- **Store:** unidad de origen operativo de envíos.
- **Warehouse:** instalación logística física, con tipos CROSSDOCK y DROPOFF.
- **Driver:** recurso operativo que realiza colectas y entregas.
- **Seller:** relación comercial, fiscal o de permisos.

El objetivo es consolidar un MVP operativo, profesional, rápido, estable y extensible.

## 2. Stack y arquitectura

- React Native con Expo (SDK 54, nueva arquitectura, `expo-dev-client`).
- TypeScript (`strict`).
- Backend compartido: Node.js y PostgreSQL.
- Comunicación mediante API HTTP.

### Clean Architecture

Lynx Mobile sigue los principios de **Clean Architecture**. Toda implementación debe respetar esta dirección arquitectónica, adaptándose a la estructura real del repositorio.

Capas principales:

- `src/Domain`: entidades, contratos de dominio y casos de uso.
- `src/Data`: repositorios, implementaciones, persistencia y acceso a API.
- `src/Presentation`: pantallas, navegación, contextos, hooks y componentes visuales.

Reglas:

- Las dependencias deben apuntar hacia el dominio, no al revés.
- El dominio no debe depender de React Native, Expo, componentes visuales ni infraestructura HTTP.
- La lógica de negocio debe residir en las capas correspondientes, no dispersarse entre pantallas.
- Los componentes de presentación no deben asumir responsabilidades de persistencia o reglas operativas.
- Reutilizar los casos de uso, repositorios y servicios existentes.
- No crear capas, interfaces, adaptadores o abstracciones sin una necesidad concreta.
- Respetar los patrones existentes cuando sean compatibles con estos principios.
- Si una implementación legacy no respeta completamente Clean Architecture, encapsularla y mejorarla progresivamente, evitando refactorizaciones masivas innecesarias.

**Clean Architecture debe aportar claridad y mantenibilidad, no burocracia ni complejidad artificial.**

### Estado real del código

> Este apartado describe el estado del repositorio al momento de redactar el archivo. Contrastarlo con el código actual antes de tomar decisiones: la estructura legacy puede haber cambiado.

La arquitectura objetivo está aplicada solo en parte. Antes de ubicar código nuevo, tener en cuenta:

- `src/Domain` y `src/Data/repositories` hoy cubren únicamente autenticación y sesión local (`User`, `AuthRepository`, `UserLocalRepository` y sus casos de uso). El resto de los flujos operativos (envíos, recorridos, escaneo, onboarding) llama a la API directamente desde `src/Presentation`.
- Existen **dos clientes HTTP**. No crear un tercero:
  - `src/Presentation/config/Api.tsx`: helpers sobre `fetch` (`getJson`, `postJson`, `putJson`, `patchJson`, `deleteJson`, `postJsonWithTimeout`). Es el más usado. Lee el token de la sesión guardada en cada pedido.
  - `src/Data/sources/remote/api/ApiDelivery.tsx`: instancia de axios con `setAuthToken` y su propio manejador de 401.
- `src/Presentation/config/` contiene infraestructura transversal además de la configuración de la API: GPS en segundo plano (`DriverLocation.ts`, con `expo-task-manager`) y notificaciones push (`Push.tsx`).
- Las vistas siguen el patrón carpeta + `ViewModel.tsx` (por ejemplo `views/auth/home/`). Respetarlo en pantallas nuevas o modificadas.
- `src/Infrastructure/firebase` resuelve la subida de documentos del chofer.
- `src/Presentation/views/WIP` y `src/Presentation/views/deprecated` no forman parte del flujo activo. No tocarlos salvo pedido explícito.

Para funcionalidad nueva: si la lógica es reutilizable o encierra reglas de negocio, ubicarla fuera de las pantallas (caso de uso o repositorio, o al menos un módulo propio) y reutilizar `Api.tsx`. Si se modifica un flujo legacy, mejorarlo solo en lo que toca la tarea.

## 3. Principios fundamentales de ingeniería

### DRY — Don't Repeat Yourself

Evitar duplicación innecesaria de código, lógica y reglas.

Antes de implementar:

- Buscar funcionalidades, componentes, hooks, utilidades y servicios reutilizables.
- Extender implementaciones existentes cuando corresponda.
- Centralizar reglas compartidas en la capa adecuada.
- Evitar múltiples implementaciones de una misma responsabilidad.

No crear abstracciones prematuras para eliminar duplicaciones triviales.

### KISS — Keep It Simple

Priorizar siempre la solución más simple que resuelva correctamente el problema.

- No agregar complejidad innecesaria.
- No sobrediseñar funcionalidades.
- No incorporar patrones de diseño sin una necesidad demostrable.
- Evitar archivos, estados, servicios y dependencias adicionales cuando no aporten valor real.
- Preferir código explícito, legible y fácil de mantener.
- Evitar soluciones temporales que generen deuda técnica importante cuando exista una alternativa simple y correcta.

### YAGNI — You Aren't Gonna Need It

No implementar funcionalidades hipotéticas.

- Construir lo que el MVP necesita actualmente.
- No anticipar escenarios futuros sin requerimientos concretos.
- Diseñar para permitir evolución sin desarrollar funcionalidades que todavía no se utilizan.

### Reutilización antes que creación

Antes de crear un componente, función, hook, servicio o módulo nuevo, comprobar si existe una implementación reutilizable.

**Menos código, menos duplicación y menos complejidad, siempre que se preserve la claridad y el comportamiento correcto.**

## 4. Performance y calidad del producto

Lynx Mobile es una herramienta operativa utilizada por conductores durante jornadas reales de trabajo.

La velocidad, la estabilidad y la fluidez son requisitos fundamentales del producto.

### Prioridades

- Respuestas rápidas de la interfaz.
- Navegación fluida entre pantallas.
- Inicio de aplicación eficiente.
- Consultas HTTP eficientes.
- Renderizados controlados.
- Uso responsable de memoria, batería, GPS y conectividad.
- Comportamiento robusto con conexiones móviles inestables.
- Experiencia profesional, consistente y predecible.

### Reglas técnicas

- Evitar llamadas HTTP duplicadas o innecesarias.
- Evitar solicitudes secuenciales cuando puedan ejecutarse en paralelo de forma segura.
- No bloquear la interfaz con tareas que puedan ejecutarse asincrónicamente.
- Evitar renderizados innecesarios y estados redundantes.
- Optimizar listas extensas mediante los mecanismos apropiados de React Native.
- Reutilizar datos disponibles cuando sea correcto, sin mostrar información operativa obsoleta.
- Aplicar memoización únicamente cuando exista un beneficio razonable.
- Evitar cálculos costosos durante el renderizado.
- Mantener controlados los procesos de segundo plano.
- No introducir polling agresivo ni procesos permanentes sin justificación.
- Considerar el impacto de cada funcionalidad sobre batería, red y rendimiento.

En segundo plano, `fetch` puede quedar colgado indefinidamente. Para pedidos desde la tarea de GPS o similares, usar `postJsonWithTimeout` (timeout nativo vía `XMLHttpRequest`).

No sacrificar consistencia de datos, seguridad ni integridad operativa para obtener mejoras marginales de velocidad.

**Toda optimización debe responder a un problema real o a un beneficio técnicamente justificable.**

## 5. Contratos con backend

Mobile consume la misma API que Lynx Web (URL en `EXPO_PUBLIC_API_URL`, con valor por defecto en `Api.tsx`; rutas bajo `/v2/...`).

Reglas:

- No inventar endpoints, campos, estados ni contratos.
- Verificar los contratos existentes antes de implementar funcionalidades.
- Diferenciar claramente entre comportamiento confirmado y supuestos.
- Mantener compatibilidad con los flujos operativos existentes.
- No modificar el repositorio Backend desde este proyecto.
- Cuando sea necesario un cambio de API, documentar exactamente el contrato requerido (método, ruta, autenticación, body, respuesta y códigos de error).
- Evitar duplicar validaciones de negocio cuya autoridad corresponde al servidor.
- Manejar correctamente errores HTTP, timeouts y conectividad intermitente.
- Evitar reintentos automáticos que puedan duplicar operaciones no idempotentes.

## 6. Reglas de desarrollo

- Priorizar soluciones pequeñas, funcionales y verificables.
- No reescribir módulos completos si alcanza con una adaptación localizada.
- Mantener TypeScript consistente.
- Reutilizar componentes, servicios y patrones existentes.
- Mantener responsabilidades claramente separadas.
- Preservar autenticación, GPS, notificaciones, escaneo y recorridos.
- No agregar dependencias sin justificar su necesidad. Si se agrega una dependencia Expo, usar la versión compatible con el SDK (`npx expo install`).
- No introducir funcionalidades ajenas a la tarea solicitada.
- No modificar código legacy sin una razón vinculada al objetivo.
- No introducir código muerto, estados innecesarios ni configuraciones sin uso.
- Evitar comentarios redundantes que simplemente repitan lo que hace el código.
- Priorizar nombres claros y comportamiento explícito.
- Mantener consistencia visual y funcional entre pantallas (usar `AppTheme`).
- Nunca registrar tokens, contraseñas, credenciales ni secretos en logs, tampoco bajo `__DEV__`. Los logs de depuración deben evitar datos sensibles (respuestas de login completas, datos personales); `__DEV__` no habilita a registrarlos.

### Configuración nativa

- La carpeta `android/` está versionada. Un cambio de permisos, plugins o configuración nativa debe quedar coherente entre `app.json` (y `app.config.ts`) y `android/` (por ejemplo `AndroidManifest.xml`).
- Los cambios nativos no se entregan por OTA: requieren un build nuevo. Indicarlo siempre que aplique.
- No exponer claves nuevas en `app.json`; usar variables de entorno.

## 7. Operación logística

Los recorridos de colecta se organizan mediante paradas físicas.

Una parada de colecta puede tener como origen una Store o un Warehouse DROPOFF, según el contrato del backend.

No asumir que un recorrido reserva o preasigna todos los envíos presentes en una parada.

Respetar las transiciones de custodia y los estados operativos definidos por el servidor.

La recepción en un DROPOFF no equivale a recepción en un CROSSDOCK.

No duplicar reglas operativas del backend en Mobile si el servidor ya es responsable de validarlas.

## 8. Flujo de trabajo obligatorio

### Antes de modificar código

1. Inspeccionar los archivos involucrados.
2. Explicar el comportamiento actual.
3. Identificar la solución más simple que respete Clean Architecture.
4. Buscar código existente que pueda reutilizarse.
5. Señalar dependencias, riesgos y compatibilidad.
6. Proponer los archivos a modificar.

### Durante la implementación

- Trabajar por etapas pequeñas.
- Mantener el alcance solicitado.
- Evitar refactorizaciones no relacionadas.
- No eliminar funcionalidades existentes sin autorización.
- No introducir complejidad por anticipación.
- Mantener una única fuente de verdad cuando corresponda.
- Priorizar rendimiento y claridad sin sacrificar seguridad.

### Después de implementar

- Ejecutar las validaciones disponibles (ver abajo).
- Informar los archivos modificados.
- Indicar qué se probó y qué quedó pendiente.
- Distinguir pruebas automatizadas de validaciones reales en dispositivos.
- Informar si se introdujeron nuevas dependencias o riesgos.
- Verificar que no se haya agregado duplicación innecesaria.
- Revisar que la implementación respete las responsabilidades arquitectónicas.

### Validaciones disponibles

> Este apartado describe el estado del repositorio al momento de redactar el archivo. Contrastarlo con el código actual antes de tomar decisiones: no asumir que las versiones, los errores conocidos o los scripts disponibles siguen iguales.

- `npx tsc --noEmit`: hay errores preexistentes, la mayoría en `views/WIP` y algunos en `AuthRepository.tsx` y `views/auth/register/ViewModel.tsx`. El criterio es **no agregar errores nuevos**: comparar contra el estado anterior al cambio.
- `npx expo install --check`: solo para revisar la compatibilidad de dependencias con el SDK. No aplicar actualizaciones sin autorización.
- No hay scripts de lint ni tests automatizados en el repositorio. Lo que solo se pueda verificar en un dispositivo (GPS en segundo plano, push, cámara y escaneo) debe informarse como pendiente de prueba real.

## 9. Git y seguridad

- No ejecutar merge, rebase, reset destructivo ni cambios de rama sin autorización.
- No realizar commits ni push sin autorización.
- No modificar archivos `.env` ni exponer credenciales.
- No asumir que las ramas remotas están integradas.
- Verificar siempre la rama actual y el estado del repositorio antes de cambios importantes.
- No introducir secretos en código, logs o archivos versionados.

## 10. Forma de responder

Responder en español, con lenguaje técnico claro, concreto y orientado a implementación.

Para propuestas de implementación, informar:

- Objetivo.
- Enfoque recomendado.
- Archivos involucrados.
- Impacto esperado.
- Dependencias y riesgos.

Priorizar soluciones reales sobre propuestas abstractas.

Evitar explicaciones extensas cuando una respuesta breve y precisa sea suficiente.

Cuando se solicite una auditoría, no modificar código hasta recibir autorización.

Si existen varias alternativas, recomendar la más simple y justificar brevemente por qué.

## 11. Prioridad actual

La prioridad inmediata es estabilizar e integrar los desarrollos pendientes de Mobile y luego validar las colectas mixtas Store/DROPOFF contra los contratos actuales del backend.

Esta prioridad es temporal y no debe interpretarse como una regla permanente del producto.
