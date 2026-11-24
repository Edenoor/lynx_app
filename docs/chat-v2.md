# Chat V2 en Mobile (estado al 24-nov-2026)

Integrado en `integracion-mvp-test` (commits de `feat/chat-v2` más `881a965` y `4170dc4`)
y publicado en el APK oficial 1.1.0 (`main`). Funciona en TEST y en
**producción**: `/v2/chat` está desplegado y su base responde (verificado el
24-nov con GET a `/v2/chat/inbox` y `/v2/chat/unread`).

## Qué funciona

| | Driver | Picker |
|---|---|---|
| Acceso | Alertas › Mensajes | Alertas › Mensajes |
| Charlas | La fija con «Lynx» (equipo interno) y el asistente | Charlas de a uno y «Nueva charla» (directorio de usuarios internos) |
| Leer y responder | Sí | Sí |
| «<<» | A su lista de chats | A Alertas › Mensajes, dentro del área Picker |
| Push de un mensaje (`CHAT_MESSAGE`) | Sí: tocado abre la charla | **Pendiente**: solo para los usuarios de `EXPO_PUBLIC_PICKER_PUSH_USERS` |

El servidor decide qué charlas ve cada usuario (`chatAccess.js`). La app no
usa el rol Driver ni los permisos `deposito.*` para el chat; una charla que el
servidor no deja ver (404) muestra «Esta charla ya no está disponible.».

## Push de mensajes en Picker: pendiente de habilitación general

El Picker registra su push solo si su usuario figura en
`EXPO_PUBLIC_PICKER_PUSH_USERS` (`views/picker/pickerPush.ts`). Solo la
define el perfil de prueba `mvp-test` (usuario `picker` de TEST); en
producción no está definida: **ningún Picker recibe avisos de mensajes**. El
chat se usa igual desde Alertas › Mensajes, que se actualiza al abrirlo.
Habilitarlo más adelante es un cambio de JS: se entrega por OTA.

Se mantiene la lista a propósito (decisión del 23-nov): registrar a todos los
Pickers les haría llegar también los avisos de `NotifyAllAdmins` (respuesta de
un chofer a una asignación, con su nombre y el tracking). Para habilitarlo en
general, backend tiene que mandar esos avisos por perfil o permiso
(`NotifyAdminsByProfile`); después, el gate de `pickerPush.ts` pasa a ser
«usuario del área Picker».

## Pendiente en backend (no se toca desde Mobile)

1. `NotifyUser` ignora `log: false`: los mensajes del chat quedan en
   `notification_log`. Mobile los saca de Alertas › Notificaciones del Picker
   y los marca vistos (`splitChatRows`), pero la corrección es del servidor.
2. `NotifyAllAdmins` llega a los Pickers (ver arriba).
3. Opcional: el id del destinatario en el `data` del push, para que la app
   descarte un aviso que no es del usuario actual.
4. ~~Desplegar Chat V2 en producción~~: hecho (24-nov). Verificar en la WebApp
   que alguien tenga el rol de equipo para atender la charla «Lynx» de los
   choferes.

## Seguridad del token de push

`881a965`: la app anota a nombre de quién quedó el token y, al entrar otro
usuario (o con una baja pendiente), lo da de baja antes de mostrar la app.
Sin eso, tras una sesión vencida el teléfono seguía recibiendo los avisos del
usuario anterior, mensajes del chat incluidos.

## Pruebas en dispositivo pendientes

Push con la app abierta, en segundo plano y cerrada; cambio de usuario en el
mismo teléfono; charla real contra TEST.
