# Release de producción y OTA (Lynx Mobile)

Primer APK oficial: **1.1.0**, tag `mobile-v1.1.0`, rama `main`.

## Ramas

- `main`: rama oficial de producción. Todo APK de producción y toda OTA del
  canal `production` salen de acá.
- `integracion-mvp-test`: integración y validación contra TEST (perfil
  `mvp-test`). Lo que se valida acá pasa a `main` por fast-forward.
- Nunca force push en `main`.

### Del día a día a producción

```sh
git checkout main
git merge --ff-only integracion-mvp-test
git push origin main
```

Si `--ff-only` falla, `main` tiene un hotfix que integración no tiene: primero
llevarlo a integración (abajo).

### Hotfix urgente

```sh
git checkout main
# corregir, commit
git push origin main
git checkout integracion-mvp-test
git merge --ff-only main || git merge main   # dejar integración al día
git push origin integracion-mvp-test
```

## Perfil y canal

| Perfil EAS | Canal | API | Uso |
|---|---|---|---|
| `production-apk` | `production` | `https://api.wynflex.com.ar` | APK oficial |
| `production` | `production` | idem | AAB (Play Store, sin uso por ahora) |
| `mvp-test` | `mvp-test` | TEST (HTTP) | pruebas; nunca en manos del equipo operativo |

Producción **no** define `LYNX_ALLOW_CLEARTEXT` (HTTP sin cifrar apagado) ni
`EXPO_PUBLIC_PICKER_PUSH_USERS` (sin push de Picker; ver `chat-v2.md`).
`EXPO_PUBLIC_GOOGLE_MAPS_KEY` viene del `.env`, que se sube a EAS (`.easignore`).

Mismo identificador (`com.beltrameme.wynflexfe`) y misma firma (credenciales
remotas de EAS) en todos los perfiles. El versionCode lo asigna EAS
(`appVersionSource: remote` + `autoIncrement`).

## APK nuevo

Hace falta cuando cambia algo nativo: dependencias, `android/`, `app.json`,
plugins, íconos. La versión va en `app.json` (`expo.version`) y en
`versionName` de `android/app/build.gradle`, siempre iguales.

```sh
git checkout main && git pull --ff-only
npx eas-cli@20.1.0 build -p android --profile production-apk
```

Verificar el APK antes de distribuirlo: commit, canal `production`, versión,
versionCode mayor al anterior, firma SHA-256 `47cd1373…783c879`, solo
`https://api.wynflex.com.ar` en el bundle y `usesCleartextTraffic=false`.

## OTA (EAS Update)

El runtime es un fingerprint que incluye la configuración de Expo, y
`app.config.ts` copia `EXPO_PUBLIC_API_URL` en `extra`: **una OTA calculada con
otra URL tiene otro runtime y no le llega a nadie.** Por eso, siempre desde
`main` y con la URL de producción:

```sh
git checkout main && git pull --ff-only
git status            # sin cambios salvo strings.xml (saltos de línea)

# 1. El runtime local tiene que coincidir con el del APK vigente.
EXPO_PUBLIC_API_URL=https://api.wynflex.com.ar \
  npx eas-cli@20.1.0 fingerprint:compare --build-id <BUILD_ID_DEL_APK_VIGENTE>

# 2. Publicar.
EXPO_PUBLIC_API_URL=https://api.wynflex.com.ar \
  npx eas-cli@20.1.0 update --channel production --message "<qué cambia>"
```

Si el paso 1 no coincide, **no publicar**: el cambio necesita un APK nuevo (o
el entorno local no es el de producción).

La app busca la OTA al abrir y la aplica en el siguiente arranque.

Para volver atrás: `npx eas-cli@20.1.0 update:republish` con el grupo de la
OTA anterior (mismo entorno).

## Quién tiene un APK anterior

Todos los APK anteriores usan el mismo identificador y la misma firma, con
versionCode menor: el oficial se instala encima como actualización.

- APK de producción anterior (`picker-preview`, `preview`): instalar encima.
  Se conserva la sesión.
- APK de TEST (`test` v8, `mvp-test` v10/v11): **cerrar sesión antes** de
  instalar (o borrar los datos de la app). La sesión guardada es de TEST.

Los APK anteriores están en otros canales (`test`, `preview`,
`picker-preview`, `mvp-test`) y no reciben las OTA de `production`: cada
teléfono necesita instalar el APK oficial una vez.

Versión mínima obligatoria (`APP_MIN_VERSION` en el backend): todavía sin
configurar. Con `1.1.0` bloquearía los APK anteriores (todos `1.0.0`).
