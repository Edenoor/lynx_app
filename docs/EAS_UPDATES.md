# Actualizaciones OTA con EAS Update

Lynx Mobile recibe cambios de JavaScript, TypeScript e imágenes sin reinstalar la APK. Los cambios nativos (dependencias, permisos, SDK, configuración de Android) siguen necesitando una APK o AAB nueva.

- Proyecto EAS: `@edenoor/lynx` (`57ae574a-011e-4d21-8627-821f480087a5`), cuenta dueña `edenoor`.
- `expo-updates` `~29.0.20` (SDK 54).
- Paquete Android: `com.beltrameme.wynflexfe`.

## 1. Cómo funciona en el teléfono

| Momento | Qué pasa |
|---|---|
| El chofer abre la app (arranque en frío) | Arranca **en el acto** con lo que ya tiene. No espera a la red (`EXPO_UPDATES_LAUNCH_WAIT_MS = 0`). |
| En segundo plano | Pregunta si hay una actualización para su **canal** y su **runtime**. Si la hay, la descarga. Sin conexión o si falla, no pasa nada: sigue con la versión actual. |
| Próximo arranque en frío | Recién ahí corre la actualización descargada. |
| Si la actualización nueva se cae al arrancar | `expo-updates` vuelve solo a la versión anterior que funcionaba. |

La app **nunca se reinicia sola**: no hay ninguna llamada a `Updates.reloadAsync()`. Una entrega, una colecta, un escaneo o un resultado a medio confirmar no se interrumpen. La sesión (SecureStore) y los datos locales (AsyncStorage) no se tocan: una OTA reemplaza solo el bundle de JS y los assets.

Consecuencia a tener en cuenta: el GPS en segundo plano mantiene vivo el proceso de la app durante la jornada. Por eso, una actualización descargada se aplica cuando la app se cierra de verdad: el chofer la desliza desde recientes, el teléfono se reinicia o Android la cierra. Es lo buscado (nada se corta en medio del trabajo), pero no es inmediato.

**Ver qué está corriendo:** en *Perfil*, debajo de «Cerrar sesión», hay una línea como esta:

```
Lynx 1.0.0 · preview · actualización 1a2b3c4d · runtime 0ffd0b43
```

- `versión instalada`: corre el JS que vino dentro de la APK.
- `actualización xxxxxxxx`: corre una OTA (primeros 8 caracteres de su id).
- `runtime`: el fingerprint de la APK. Una OTA solo llega si el suyo coincide.
- `recuperada`: la última actualización falló y la app volvió a una anterior.

## 2. Configuración

| Archivo | Qué tiene |
|---|---|
| `app.json` | `runtimeVersion: { policy: "fingerprint" }` y `updates` (`url`, `enabled`, `checkAutomatically: ON_LOAD`, `fallbackToCacheTimeout: 0`). |
| `android/app/src/main/AndroidManifest.xml` | El mismo contenido en `meta-data` (`ENABLED`, `EXPO_UPDATE_URL`, `EXPO_RUNTIME_VERSION`, `CHECK_ON_LAUNCH`, `LAUNCH_WAIT_MS`). |
| `android/app/src/main/res/values/strings.xml` | `expo_runtime_version = file:fingerprint`. Gradle calcula el fingerprint al compilar y lo guarda dentro de la APK. |
| `eas.json` | Un canal por perfil: `preview`, `production` y `production-apk`. |
| `src/Presentation/config/appUpdates.ts` | Solo la línea de diagnóstico de Perfil. No descarga ni recarga nada. |

**Por qué el manifest se edita a mano:** la carpeta `android/` está versionada, así que EAS Build no corre `prebuild` y no copia lo de `app.json` a lo nativo. **Cualquier cambio en `updates` o `runtimeVersion` va en los dos lados.** Para ver qué escribiría el plugin oficial sin regenerar `android/`:

```bash
npx expo config --type introspect
```

El canal **no** se escribe en el manifest: lo inyecta EAS Build según el perfil. Una APK compilada a mano (`gradlew assembleRelease`) no tiene canal y no recibe OTA.

### Perfiles y canales

| Perfil | Genera | Canal | Para quién |
|---|---|---|---|
| `preview` | APK | `preview` | Pruebas internas. Nunca recibe lo de `production`. |
| `production-apk` | APK | `production` | APK que hoy se distribuye a los choferes. |
| `production` | AAB | `production` | Google Play, cuando se publique. |
| `development` | dev client | — | Desarrollo con Metro. No usa OTA. |

`appVersionSource: "remote"` con `autoIncrement`: EAS lleva el `versionCode` y lo sube en cada build, compartido entre perfiles. El `versionCode` de `android/app/build.gradle` no se usa.

## 3. `runtimeVersion`: política `fingerprint`

El fingerprint es un hash de todo lo que define la parte nativa:

- la carpeta `android/` completa;
- `app.json` / `app.config.ts`, incluidos los valores `EXPO_PUBLIC_*` del `.env` que se cargan en `extra`;
- las dependencias con código nativo y los módulos de `modules/`;
- los config plugins;
- `eas.json` y `.easignore`.

Si algo de eso cambia, cambia el runtime, y las APK anteriores dejan de recibir las OTA nuevas. Una OTA nunca puede caer sobre una APK nativa incompatible. No depende de acordarse de subir un número.

Las alternativas no sirven en este proyecto:

- **`appVersion`, `nativeVersion` y `sdkVersion`:** los resuelve el config plugin durante `prebuild`. Como `android/` está versionada, EAS no corre `prebuild` y habría que sincronizar `strings.xml` a mano. Es fácil de olvidar, y entonces una OTA cae sobre una APK incompatible.
- **`nativeVersion` en particular:** incluye el `versionCode`, que EAS sube en cada build. Cada APK tendría su propio runtime y ninguna OTA le llegaría a más de una.

Verificado (noviembre 2026, commit de esta implementación):

- El fingerprint que Gradle guarda en la APK es el mismo que calcula la CLI: `0ffd0b43565ee42cd72d1aeaec6be1a6c4f2a6e8` (`createReleaseUpdatesResources`, `npx expo-updates fingerprint:generate` y `npx expo-updates runtimeversion:resolve` coinciden).
- Un cambio en archivos de JS no cambia el fingerprint.

## 4. Generar una APK

Desde un working tree limpio, con el `.env` presente. `.easignore` lo sube a EAS Build: es el mismo que se usa al publicar OTA desde esta máquina.

```bash
# APK de pruebas (canal preview)
eas build -p android --profile preview

# APK para choferes (canal production)
eas build -p android --profile production-apk
```

Después de cada build, verificar que el runtime de la build coincide con el del proyecto:

```bash
eas build:list -p android --limit 1                      # mostrar runtimeVersion y channel
npx expo-updates fingerprint:generate --platform android # el "hash" tiene que ser el mismo
```

## 5. Publicar una actualización OTA

Siempre desde el mismo commit que se probó, con el mismo `.env`. El bundle se arma en esta máquina con las variables `EXPO_PUBLIC_*` del `.env` local.

```bash
# Preview: solo la reciben las APK preview con el mismo runtime
eas update --channel preview -p android -m "descripción corta del cambio"

# Production: solo después de validarla en preview
eas update --channel production -p android -m "descripción corta del cambio"

# Production gradual: primero un porcentaje de los choferes
eas update --channel production -p android -m "..." --rollout-percentage 20
```

`eas update` muestra el runtime version de la actualización. Si no coincide con el de la APK instalada, esa APK no la recibe: hace falta una build nueva (sección 8).

Promover a production exactamente lo que se probó en preview, sin volver a empaquetar:

```bash
eas update:republish --channel preview --destination-channel production -m "promovida desde preview"
```

## 6. Verificar qué está publicado

```bash
eas channel:list
eas channel:view production
eas update:list --branch production
eas update:view <id-del-grupo>
eas fingerprint:compare --build-id <id-de-build>   # proyecto actual vs una build
eas update:insights <id-del-grupo>                 # lanzamientos y fallas
```

En el teléfono: la línea de Perfil (sección 1).

## 7. Detener o revertir una actualización defectuosa

| Situación | Comando |
|---|---|
| Que nadie más la descargue (deja todo como está) | `eas channel:pause production` (y `eas channel:resume production` para volver) |
| Volver a una actualización anterior que funcionaba | `eas update:republish --group <id-del-grupo-bueno> --destination-channel production -m "revert"` |
| Volver al JS que vino dentro de la APK | `eas update:roll-back-to-embedded --channel production -p android -m "revert"` |
| Rollout gradual en curso | `eas update:revert-update-rollout` |

Limitaciones:

- **El revert no es instantáneo.** Cada teléfono lo baja al abrir la app y lo aplica en el arranque siguiente: dos arranques en frío. Un teléfono sin red sigue con la versión defectuosa hasta conectarse.
- **Si la versión defectuosa se cae al arrancar**, `expo-updates` vuelve solo a la anterior. Si la falla es de lógica (no se cae), solo la corrige un revert o una OTA nueva.
- **Un revert no deshace lo que la versión defectuosa ya envió al servidor.** El backend sigue siendo la autoridad.
- **Una OTA no puede arreglar un problema nativo.** Hace falta otra build.

## 8. Cuándo hay que generar una APK o AAB nueva

Siempre que cambie el fingerprint. Por ejemplo:

- agregar, quitar o actualizar una dependencia con código nativo, incluido `npx expo install --fix`;
- actualizar el SDK de Expo o React Native;
- cualquier archivo de `android/`, o de `modules/*/android`;
- en `app.json` / `app.config.ts`: la `version`, los permisos, los plugins, el ícono, el splash, `updates` o `runtimeVersion`;
- un valor del `.env` (`EXPO_PUBLIC_API_URL`, la clave de Maps): entra en la configuración y, por lo tanto, en el fingerprint;
- `eas.json` o `.easignore`.

Ante la duda, comparar antes de publicar:

```bash
eas fingerprint:compare --build-id <id-de-la-build-instalada>
```

`AppVersionGate` (versión mínima que pide el servidor) usa `expo.version`, que es nativa. Una OTA no la cambia: para exigir una versión nueva hace falta una APK con la `version` subida.

## 9. Google Play

- **Generar el AAB:** `eas build -p android --profile production`, y subirlo con `eas submit -p android --profile production` cuando exista la ficha en Play Console y su cuenta de servicio.
- **Mismo canal `production`:** el AAB usa el mismo canal que la APK de choferes. Las OTA siguen llegando igual a la app instalada desde Play, si el runtime coincide.
- **Reparto de responsabilidades:** Play distribuye los cambios nativos y EAS Update los de JS. Publicar OTA de JS y assets está permitido por las políticas de Play; no se usa para cambiar el propósito de la app.
- **Firma:** las builds de EAS se firman con el keystore que guarda EAS (credenciales remotas). En Play, ese keystore pasa a ser la **clave de subida** y Play App Signing firma lo que llega a los teléfonos. Antes de la primera publicación:
  - confirmar con `eas credentials -p android` cuál es el keystore y su SHA-1, y descargar un respaldo;
  - no generar uno nuevo;
  - el `debug.keystore` de `android/app` es solo para compilaciones locales y no se usa para distribuir.
- **Cambio de origen:** una APK instalada a mano no se actualiza desde Play: hay que desinstalarla e instalar desde Play. Si las dos están firmadas con el mismo keystore, Play puede actualizarla sin desinstalar.

## 10. Si se pierde acceso al proyecto EAS

- **Lo que sigue funcionando:** las apps instaladas siguen andando con la última versión que bajaron. Solo se pierde la posibilidad de publicar OTA y de compilar en EAS.
- **Antes de que pase, guardar fuera de EAS:**
  - el respaldo del keystore (`eas credentials -p android` → descargar);
  - quiénes tienen acceso a la cuenta `edenoor`. Agregar un segundo administrador en expo.dev.
- **Recuperar:** recuperar la cuenta desde expo.dev (correo de la cuenta). El proyecto, los canales y el historial de actualizaciones quedan del lado de Expo.
- **Proyecto nuevo:** la URL de actualizaciones (`u.expo.dev/<projectId>`) está dentro de cada APK. Pasar a otro proyecto obliga a una APK nueva con el `projectId` y la URL nuevos, en `app.json` y en `AndroidManifest.xml`. Para Play, hace falta el mismo keystore: por eso el respaldo.

## 11. Prueba real en un teléfono (antes de distribuir)

No se da por buena la OTA hasta ver estos pasos en un Android físico.

1. `eas build -p android --profile preview`. Anotar el `runtimeVersion` de `eas build:list -p android --limit 1`.
2. Instalar la APK. En Perfil tiene que decir `preview · versión instalada · runtime <primeros 8 del runtimeVersion>`. Iniciar sesión.
3. Hacer un cambio visible solo de JS (por ejemplo, un texto) y publicarlo:
   `eas update --channel preview -p android -m "prueba OTA"`.
   El runtime que informa tiene que ser el mismo del paso 1.
4. Cerrar la app del todo (deslizarla desde recientes) y abrirla: la descarga en segundo plano.
5. Cerrarla del todo otra vez y abrirla: ahora tiene que verse el cambio, y Perfil tiene que decir `actualización <id>`.
6. Confirmar que no se reinstaló nada y que la sesión sigue iniciada.
7. Sin conexión (modo avión): cerrar y abrir. Tiene que arrancar normal con la última versión descargada.
8. Separación de canales, sin tocar production: publicar otro cambio visible en un branch que no esté vinculado al canal `preview`:
   `eas update --branch qa-aislamiento -p android -m "no debe llegar"`.
   La APK `preview` no tiene que recibirlo: Perfil sigue igual después de dos arranques. El otro sentido se comprueba cuando exista la primera APK `production-apk`: no tiene que recibir lo publicado en `preview`. Borrar después el branch de prueba con `eas branch:delete qa-aislamiento`.
9. Revertir la OTA de prueba en preview (`eas update:roll-back-to-embedded --channel preview -p android -m "fin prueba"`). Después de dos arranques, Perfil vuelve a `versión instalada`.

Si en el paso 5 no llega:

- Comparar el runtime de Perfil con el que informó `eas update`. Si difieren, hace falta una build nueva.
- Si coinciden, revisar el canal: `eas channel:view preview`.
