# Release de producción y OTA (Lynx Mobile)

## APK vigente

| | |
|---|---|
| Versión | **1.1.1** (versionCode 13), tag `mobile-v1.1.1`, rama `main` |
| Build EAS | `c209f838-8a12-4049-a276-7d11062a5e4d` |
| Runtime | `7416ebafa5fa3618bbcb0ed54b9f2e8249c6bd45` |
| Canal | `production` |
| Incluye | linterna en los escáneres y Sugerencias y errores |

Las OTA del canal `production` solo llegan a teléfonos con este APK (mismo
runtime). Respaldo: 1.1.0 (tag `mobile-v1.1.0`, build `308536a0`, runtime
`aae3475b`), que no se distribuyó.

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
  npx eas-cli@20.1.0 fingerprint:compare --build-id c209f838-8a12-4049-a276-7d11062a5e4d

# 2. Revisar el bundle: tiene que traer solo la API de producción.
rm -rf /tmp/lynx-ota && EXPO_PUBLIC_API_URL=https://api.wynflex.com.ar \
  npx expo export --platform android --no-bytecode --clear --output-dir /tmp/lynx-ota
grep -ohE "https?://(32\.197\.[0-9.:]+|api\.wynflex\.com\.ar)" /tmp/lynx-ota/_expo/static/js/android/*.js | sort | uniq -c
#    esperado: solo https://api.wynflex.com.ar

# 3. Publicar (siempre con --clear-cache).
EXPO_PUBLIC_API_URL=https://api.wynflex.com.ar \
  npx eas-cli@20.1.0 update --channel production -p android --clear-cache --message "<qué cambia>"
```

Si el paso 1 no coincide, **no publicar**: el cambio necesita un APK nuevo (o
el entorno local no es el de producción). Si el paso 2 muestra la IP de TEST,
**no publicar**.

**Por qué `--clear-cache`:** la OTA se arma en esta máquina, y Metro guarda en
caché el código ya transformado con las variables `EXPO_PUBLIC_*` adentro.
Después de un export o una OTA de TEST, un export de producción sin limpiar el
caché salió con `http://32.197.148.77:5000` (comprobado el 24-nov). El APK no
tiene este problema, porque EAS Build compila desde cero.

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
- APK 1.1.0 (versionCode 12, piloto): instalar encima.

Los APK anteriores están en otros canales (`test`, `preview`,
`picker-preview`, `mvp-test`) y no reciben las OTA de `production`: cada
teléfono necesita instalar el APK oficial una vez.

Versión mínima obligatoria (`APP_MIN_VERSION` en el backend): todavía sin
configurar. Con `1.1.1` bloquearía los APK anteriores (`1.0.0` y el piloto
`1.1.0`).
