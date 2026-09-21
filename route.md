# Hoja de ruta del gestor documental

Este documento divide el desarrollo en entregas pequeñas y verificables. Google Drive
seguirá siendo el almacenamiento, mientras que Fragua gestionará la interfaz, los usuarios,
los permisos internos y la trazabilidad. Los usuarios de Fragua no necesitarán iniciar
sesión en Google.

## Forma de trabajo

Para cada capacidad nueva se seguirá siempre este orden:

1. Implementar el contrato y la lógica en `fragua-gestion/back`.
2. Revisar y corregir el backend.
3. Implementar la interfaz en `fragua-documentos`.
4. Revisar y probar el recorrido completo en local.
5. Cerrar la fase antes de empezar la siguiente.

No se desplegará a producción hasta completar y revisar todas las fases elegidas para la
primera versión. Cada fase debe conservar la contención dentro de `rootFolderId`, no exponer
errores ni credenciales de Google y respetar los roles de Fragua.

## Estado actual

- [x] Frontend independiente con Vue, autenticación, sesión y layout.
- [x] Conexión OAuth de una única cuenta de Google Drive.
- [x] Pantalla de conexión, reconexión, estado y desconexión para `superadmin`.
- [x] Conexión comprobada en local contra Google Drive.
- [x] Backend para listar, crear carpetas, subir y descargar: revisado y aprobado.
- [x] Ampliación OAuth para mostrar también archivos añadidos directamente en Drive, validada en local.
- [x] Navegación por carpetas: fase 1.2 completada y validada en local.
- [x] Creación de carpetas: completada y validada en local.
- [x] Subida de archivos: completada y validada en local.
- [x] Descarga de archivos: completada y validada en local.
- [x] Validación local integral del bloque básico completada.
- [x] Bloque 1 completado y validado en local.
- [x] Bloque 2 completado y validado en local.
- [x] Bloque 3 completado y validado en local: fases 3.1, 3.2, 3.3 (3.3a y 3.3b), 3.4 y 3.5.
- [~] Bloque 4 en curso: fase 4.0, completar el diseño de la aplicación.

## Bloque 1 — Gestor documental básico

### 1.1 Cerrar el backend actual — completada

- Corregir la cancelación de descargas para que no deje peticiones pendientes.
- Validar el `fileId` de descarga antes de consultar Google.
- Diferenciar un recurso ajeno de una revocación real de la conexión.
- Validar los nombres después de normalizarlos.
- Completar la codificación segura de `Content-Disposition`.
- Repetir la revisión del módulo y aprobar sus contratos.

Resultado: API estable para listar, crear carpetas, subir y descargar.

### 1.1 bis — Archivos añadidos directamente en Drive — completada

- Sustituir el scope limitado `drive.file` por `drive` para que la cuenta conectada pueda
  listar y gestionar también archivos creados fuera de Fragua.
- Mantener todas las operaciones confinadas en el backend a `rootFolderId`.
- Preservar el `rootFolderId` anterior durante una reconexión directa y abortar sin cambiarlo
  si Google no permite comprobarlo por un fallo temporal o ambiguo.
- Reconectar la cuenta de Google para emitir un refresh token con el nuevo permiso.
- Confirmar en local que aparece un archivo añadido directamente a la carpeta raíz desde
  Google Drive.
- Tener en cuenta que el scope completo es restringido y puede requerir verificación de
  Google antes de producción.

Resultado: reconexión completada conservando la raíz existente y navegación local verificada
sobre una carpeta, una subcarpeta y un PDF añadidos directamente desde Google Drive.

### 1.2 Navegar por carpetas — completada

- Añadir al frontend los tipos, servicio y store de elementos de Drive.
- Mostrar el contenido de la carpeta raíz.
- Permitir entrar en subcarpetas y volver a la carpeta anterior.
- Mostrar nombre, tipo, tamaño y fecha de modificación.
- Incluir carga, carpeta vacía, error y reintento.
- Mantener la carpeta actual al paginar.
- Evitar navegaciones duplicadas y conservar un foco lógico al entrar en carpetas o volver
  mediante breadcrumbs.

Resultado: cualquier usuario autenticado puede recorrer los documentos desde Fragua.

### 1.3 Crear carpetas — completada

- Añadir la acción “Nueva carpeta”.
- Pedir y validar el nombre en un diálogo accesible.
- Crear dentro de la carpeta que se está viendo.
- Actualizar el listado y mostrar errores sin perder la navegación actual.

Resultado: se pueden organizar documentos sin abrir Google Drive.

Validación completada en local: creación dentro de la carpeta actual, actualización del
listado, tratamiento de nombres inválidos y retorno de foco comprobados.

### 1.4 Subir archivos — completada

- Añadir selector de archivo y zona de arrastre.
- Mostrar el límite configurado antes de subir.
- Mostrar progreso o, como mínimo, estado de subida bloqueando envíos duplicados.
- Subir a la carpeta actual y actualizar el listado.
- Tratar de forma específica archivo vacío, nombre inválido, exceso de tamaño y fallo de
  conexión.

Resultado: se pueden incorporar documentos desde la aplicación.

Validación completada en local: selección y arrastre, límite de tamaño, errores, subida a la
carpeta actual, actualización del listado y retorno de foco comprobados.

### 1.5 Descargar archivos — completada

- Descargar mediante la API autenticada, no mediante enlaces públicos de Google.
- Conservar el nombre indicado por `Content-Disposition`.
- Evitar acciones duplicadas mientras comienza la descarga.
- Mostrar correctamente los errores de archivo inexistente o conexión no disponible.

Resultado: los usuarios pueden recuperar los archivos sin acceder a Drive.

Validación completada en local: descarga autenticada, conservación del nombre, bloqueo de
acciones duplicadas y tratamiento contextual de errores comprobados.

### 1.6 Validación local del bloque básico — completada

- Recorrer varias carpetas y páginas.
- Crear una carpeta y subir archivos de distintos tipos.
- Descargar y comparar el archivo resultante con el original.
- Comprobar archivos vacíos, grandes, nombres inválidos y cancelación de descarga.
- Comprobar los tres roles y una sesión caducada.

Resultado: primera versión utilizable en local.

Validación integral completada en local tras aprobar técnicamente backend y frontend y
confirmar el recorrido manual del gestor documental básico.

## Bloque 2 — Operaciones cotidianas

### 2.1 Renombrar — completada

- Backend: añadir una operación para renombrar por `fileId`, validando contención y nombre.
- Frontend: diálogo “Renombrar” desde las acciones del elemento.
- Actualizar el listado sin cambiar de carpeta.

Resultado: archivos, carpetas y documentos nativos pueden renombrarse desde Fragua sin
cambiar su `fileId` ni abandonar la carpeta actual. Backend y frontend revisados y recorrido
manual validado en local.

### 2.2 Mover — completada

- Backend: mover un elemento entre carpetas contenidas en la raíz.
- Validar origen, destino, que el destino sea una carpeta y que no se cree un ciclo.
- Frontend: selector visual en forma de árbol de carpetas, con carga bajo demanda,
  selección clara del nivel de destino y confirmación.
- Consolidar las acciones repetidas del gestor en un sistema coherente de botones de icono,
  inspirado en la jerarquía y densidad de Google Drive sin copiar sus recursos propietarios.
- Trasladar el acceso a la configuración de Google Drive desde el menú lateral a un botón de
  icono junto al usuario del encabezado, visible únicamente para `superadmin`.

Resultado: los usuarios pueden mover archivos y carpetas mediante un árbol visual limitado
a `rootFolderId`, con prevención de ciclos, acciones de icono coherentes y validación
funcional y visual completada en local.

### 2.3 Reemplazar el contenido de un archivo — completada

- Backend: actualizar el contenido con `files.update` manteniendo el mismo `fileId`.
- No permitir reemplazar carpetas ni archivos nativos de Google.
- Aplicar el mismo límite y validaciones que en una subida.
- Frontend: acción “Subir nueva versión”, mostrando claramente el archivo que se reemplaza.

Resultado: Drive conserva la identidad del archivo y genera una nueva revisión; la consulta
y recuperación del historial se implementan por separado en la fase 2.3 bis.

Validación completada en local: disponibilidad correcta de la acción según el tipo de
elemento, reemplazo del contenido, conservación del nombre y ubicación, descarga posterior
y comportamiento del diálogo comprobados.

### 2.3 bis Historial de versiones — completada

- Backend: listar las revisiones de un archivo binario contenido en `rootFolderId`, con
  fecha, autor y tamaño cuando Google proporcione esos datos.
- Permitir descargar una revisión anterior mediante la API autenticada, sin enlaces
  públicos ni carga completa en memoria.
- Permitir restaurar una revisión anterior descargando su contenido desde Google y
  guardándolo como una nueva revisión vigente del mismo `fileId`; no reescribir ni eliminar
  el historial existente.
- Permitir marcar o desmarcar revisiones binarias con `keepForever`, respetando los límites
  de Google y mostrando con claridad cuándo una versión está protegida.
- Frontend: diálogo o vista de historial con revisión actual, revisiones anteriores y
  acciones accesibles de descarga, restauración y conservación.
- Excluir inicialmente carpetas y documentos nativos de Google Docs, Sheets y Slides, cuyo
  historial funciona de forma distinta.
- Aplicar contención, permisos, streaming, errores seguros y auditoría futura con los mismos
  criterios que al resto del gestor.

Resultado: los usuarios pueden consultar y recuperar versiones anteriores sin salir de
Fragua, manteniendo el mismo archivo y un historial no destructivo.

Validación completada en local: consulta y descarga de revisiones, restauración como nueva
versión, protección con `keepForever`, concurrencia y retorno de foco comprobados.

### 2.4 Enviar a la papelera — completada

- Backend: marcar el elemento como `trashed`, sin borrado definitivo. **Implementado en
  `fragua-gestion/back` (`POST /drive/items/:id/trash`), pendiente de revisión.**
- Impedir operar fuera de la raíz.
- Frontend: confirmación con nombre y tipo del elemento. **Implementado**: `TrashItemDialog.vue`
  distingue archivo/carpeta, bloquea confirmación duplicada, Cancelar, Escape y backdrop
  mientras se envía, y conserva el diálogo abierto con el error si falla.
- Retirar el elemento del listado después de completar la operación. **Implementado**: el
  store retira el elemento de `items` solo si el contexto de navegación sigue vigente, sin
  recargar la carpeta ni tocar breadcrumbs/paginación.
- Validación manual del recorrido completo terminada en local.

### 2.4 bis Notificaciones globales de acciones — completada

- Frontend: `useToastStore` (`src/stores/toast.ts`) como única fuente de verdad; tipos
  `success | error | info`, máximo 4 notificaciones visibles (retira primero la más
  antigua), cierre automático en éxitos (~4 s) e información (~6 s), cierre manual
  obligatorio en errores, e ids que no dependen solo de `Date.now()`.
- `ToastContainer.vue` montado una única vez en `AppShell.vue`; `ToastItem.vue` con iconos
  `CircleCheck`/`CircleAlert`/`Info`, botón de cierre de 44×44 px con etiqueta accesible,
  anuncio `polite` en éxito/información y `assertive` en error, sin mover el foco.
- Conectado a crear carpeta, subir archivo, descargar archivo, renombrar, mover, subir
  nueva versión, descargar/restaurar/proteger una versión, enviar a la papelera y
  conectar/reconectar/desconectar Google Drive — siempre en el punto donde la operación ya
  ha terminado, nunca por validaciones locales previas ni por cargas o listados iniciales.
- Los errores del toast reutilizan siempre el mensaje contextual ya traducido de cada store
  (nunca texto crudo del backend) y conviven con el error mostrado dentro del propio
  diálogo o formulario, sin sustituirlo; una recarga posterior fallida o una respuesta
  obsoleta descartada por `navigationSeq`/`sessionId` no generan ningún toast.

Resultado: todas las acciones importantes comunican de forma inmediata y coherente si han
terminado correctamente o han fallado. Validación visual completada en local.

### 2.5 Recuperar desde la papelera — completada

- Backend: listar únicamente elementos eliminados del espacio gestionado y restaurarlos.
  **Implementado en `fragua-gestion/back`** (`GET /drive/trash`,
  `POST /drive/items/:id/restore`) y aprobado.
- Frontend: **Implementado**. `useDriveTrashStore` (`src/stores/drive-trash.ts`), dueño
  exclusivo del listado paginado y del estado de restaurar: primera carga sustituye el
  listado, “cargar más” anexa sin perder lo ya cargado ante un fallo de paginación,
  secuencia de peticiones para descartar respuestas obsoletas y una restauración correcta
  retira el elemento sin recargar toda la papelera.
- Ruta `/trash` (`requiresAuth`, sin restricción de rol) y entrada “Papelera” en el sidebar
  para cualquier usuario autenticado, con icono `Trash2`; ningún acceso a niveles de Drive
  por encima de `rootFolderId`.
- `TrashView.vue` (orquestadora), `TrashItemsList.vue` (listado presentacional propio, sin
  reutilizar `DriveItemsList`) y `RestoreItemDialog.vue` (confirmación accesible, misma
  disciplina de foco/Escape/backdrop que el resto de diálogos) cubren carga inicial, error
  con reintento, vacío, paginación y restauración.
- Tras restaurar con éxito: toast centralizado (`useToastStore`) distinto según
  `restoredToRoot`, foco al título “Papelera” al desaparecer la fila, y errores de
  restauración (incluido el nuevo `DRIVE_RESTORE_NOT_CONFIRMED`) traducidos por
  `code`/`status`, nunca por texto, y mostrados a la vez en el diálogo y en el toast sin
  duplicar la publicación.
- No se ha incorporado borrado definitivo en esta fase.
- Validación funcional y visual completada en local.

### 2.6 Conflictos de nombre — completada

- Detectar si ya existe un elemento con el mismo nombre en la carpeta de destino.
- En una subida, ofrecer cancelar, conservar ambos o reemplazar el existente.
- En renombrados y movimientos, pedir una decisión explícita antes de continuar.

Backend: **implementado en `fragua-gestion/back` y aprobado.** Helper compartido
(`DriveDocumentsService.findNameConflicts`/`findNameConflictsAcrossParents`) usado por subida,
renombrado y movimiento; nuevo `409 DRIVE_NAME_CONFLICT` (`conflicts`, `allowedResolutions`) y
`DriveConflictResolution` (`error` por defecto, `keep_both`, `replace` — este último solo en
subida). La detección es best-effort y documentada como tal: Google Drive no ofrece una
restricción atómica de nombre único, así que una carrera entre la comprobación y la escritura
no se cierra con base de datos.

Frontend: **implementado en `fragua-documentos` y validado manualmente en local.**
`extractDriveNameConflict` (`drive-documents.service.ts`) reconoce el `409` solo por `code` y
valida defensivamente la forma de `conflicts`/`allowedResolutions` antes de confiar en ellos;
`uploadFile`/`renameItem`/`moveItem` del servicio aceptan `conflictResolution` (y `uploadFile`
también `conflictItemId`), añadiendo solo los campos definidos. El store (`drive-documents.ts`)
añade `uploadConflict`/`renameConflict`/`moveConflict`, independientes entre sí y limpiados por
cada `resetXState()`; las tres acciones devuelven ahora `'success' | 'conflict' | 'error' |
'blocked'` en vez de un `boolean`, guardan el cuerpo estructurado solo si la navegación sigue
vigente (`navigationSeq`) y nunca escriben el error genérico ante un conflicto. Componente
reutilizable `NameConflictResolver.vue` (presentacional, sin store) integrado en
`UploadFileDialog`, `RenameItemDialog` y `MoveItemDialog`: lista los conflictos con icono,
nombre y tipo legible; ofrece "Conservar ambos" cuando el backend lo permite y "Reemplazar
existente" solo en subida, exigiendo selección explícita con controles nativos cuando hay
varios archivos binarios reemplazables (carpetas y documentos nativos de Google nunca son
seleccionables); "Volver" cancela solo la resolución y devuelve el formulario/selector con sus
datos intactos, sin tocar el árbol de destino ni el archivo/nombre ya elegidos. Ningún conflicto
genera toast de error; el éxito de una resolución sí publica el toast contextual habitual, y
cerrar cualquiera de los tres diálogos limpia su conflicto. Concurrencia y foco reutilizan los
mismos mecanismos que el resto de diálogos (bloqueo de botones/Escape/backdrop mientras se
reenvía, foco al título del bloque al aparecer el conflicto y de vuelta al campo/selector
correspondiente al volver).

Resultado: conflictos de subida, renombrado y movimiento resueltos mediante una decisión
explícita, sin sobrescrituras silenciosas. Bloque 2 completado y validado en local.

## Bloque 3 — Reuniones y actas

PostgreSQL será la fuente editable de las reuniones y sus puntos. Google Drive conservará
las actas exportadas, vinculadas mediante sus identificadores, sin convertir Drive en una
base de datos.

### 3.1 Crear y gestionar reuniones

**Fase 3.1a —creación y listado— completada y validada en local.** Backend implementado y
aprobado en `fragua-gestion/back`
(`POST /meetings`, `GET /meetings`). Frontend implementado en `fragua-documentos` (tipos,
servicio, `useMeetingsStore`, ruta `/meetings`, entrada "Reuniones" en el sidebar,
`MeetingsView` con próximas/histórico paginado, filtros por tipo/estado y
`CreateMeetingDialog`) y validado manualmente. Edición, cambio de estado,
puntos, asistentes, actas, eliminación e integración con Drive quedan fuera de esta fase.

**Fase 3.1b —consulta de detalle y edición— backend implementado y aprobado en
`fragua-gestion/back` (`GET /meetings/:id`, `PATCH /meetings/:id`); frontend implementado en
`fragua-documentos` y validado manualmente en local.** Cualquier usuario
autenticado puede consultar el detalle de cualquier reunión. La edición (`name`,
`scheduledAt`, `type`) solo la puede realizar el creador de la reunión o un usuario con rol
`admin`/`superadmin`, y solo mientras la reunión está en `draft`; una reunión `held` o
`closed` responde `409 MEETING_NOT_EDITABLE`. Lectura, autorización, comprobación de estado
y guardado se ejecutan dentro de una única transacción con bloqueo `pessimistic_write` sobre
la fila de la reunión, para evitar condiciones de carrera con un cambio de estado o una
segunda edición concurrente. No cambia el esquema de base de datos. Cambio de estado,
puntos, asistentes, actas, eliminación e integración con Drive quedan fuera de esta fase.

Frontend: tipos (`UpdateMeetingPayload` en `meetings.service.ts`, `MeetingErrorCode`
separado de `DriveErrorCode`), `meetingsService.getMeeting`/`updateMeeting` y
`useMeetingsStore` ampliado con detalle y edición (`selectedMeeting`, `isLoadingDetail`,
`detailError`, `detailNotFound`, `isUpdating`, `updateError`, `loadMeeting`, `retryMeeting`,
`updateMeeting`, `resetUpdateState`, `clearSelectedMeeting`), con una sesión de detalle
(`detailSessionId`) independiente de la secuencia del listado: invalida cargas/ediciones
obsoletas al cambiar de id o al abandonar la vista, y una edición correcta sustituye
`selectedMeeting`; si solo cambia el nombre actualiza localmente el elemento, y si cambia
fecha o tipo vuelve a sincronizar los grupos y la página histórica conservando los filtros,
con normalización de páginas que hayan dejado de existir. Ruta
`/meetings/:id` (`meeting-detail`, hija de `AppShell`, solo `requiresAuth`, sin guard de rol)
con `MeetingDetailView` (carga, error con reintento y enlace de vuelta, detalle, 404 sin
información técnica) y `EditMeetingDialog` (reutiliza `validateMeetingName`/`toIsoDateTime`/
`toLocalDateTimeInputValue`, extraídas a `utils/meeting-form.ts` junto con
`CreateMeetingDialog`; PATCH parcial solo con campos cambiados, validación local "No hay
cambios que guardar" sin llamar al backend, bloqueo de Guardar/Cancelar/Escape/backdrop
mientras guarda). `canEdit` es una ayuda visual (`computed` sobre `status === 'draft'` y
creador/admin/superadmin) que oculta por completo el botón "Editar reunión" sin permiso, sin
usar `v-show`. Errores traducidos por código/estado (incluido `MEETING_NOT_EDITABLE`), toast
de éxito/error sin duplicar publicaciones, y foco devuelto al botón "Editar reunión" tras
cancelar o tras un guardado correcto. `CurrentMeetingsList` y `PastMeetingsList` convierten
cada fila en un `RouterLink` al detalle con nombre accesible propio. Recorrido manual
completado en local.

- Guardar en PostgreSQL `name`, `scheduledAt`, `type`, `status`, `createdByUserId`, `createdAt` y
  `updatedAt`.
- Limitar `type` a `event`, `association` u `other`, con etiquetas en español en el
  frontend: Evento, Asociación y Otro.
- Asignar `createdByUserId` desde el usuario autenticado y `createdAt` desde el servidor;
  ninguno de los dos se acepta desde el cliente.
- Comenzar con `status: draft` al crear la reunión; los cambios de estado se desarrollarán
  en las fases de celebración y cierre.
- Permitir crear, consultar y editar reuniones desde Fragua.
- Tratar `scheduledAt` como fecha y hora de la reunión: el frontend la introduce en horario
  local y la API la intercambia como fecha ISO 8601 con zona horaria; PostgreSQL la guarda
  como `timestamptz`. No añadir lugar ni descripción hasta que exista una necesidad real.
- Devolver en el listado dos grupos: reuniones de hoy y futuras sin paginación, ordenadas de
  más próxima a más lejana, y reuniones anteriores paginadas, ordenadas de más reciente a
  más antigua. El límite de página se aplica únicamente al histórico.
- Definir permisos en backend y no depender únicamente de controles visuales.

### 3.2 Puntos de la reunión — completada

**Backend implementado y aprobado en `fragua-gestion/back`.**
(`GET/POST /meetings/:id/points`, `PATCH /meetings/:id/points/reorder`,
`PATCH/DELETE /meetings/:id/points/:pointId`). **Frontend implementado y validado
manualmente en `fragua-documentos`.** Tipos (`MeetingPoint`
en `types/index.ts`) y `meetingsService` ampliado con
`listMeetingPoints`/`createMeetingPoint`/`updateMeetingPoint`/
`deleteMeetingPoint`/`reorderMeetingPoints`. Store independiente
`useMeetingPointsStore` (`src/stores/meeting-points.ts`), dueño exclusivo de
los puntos de una reunión con su propia sesión (`open`/`close`) igual que
`useDriveVersionsStore`: invalida cualquier petición en vuelo al abrir otra
reunión o al cerrar, y bloquea crear/editar/eliminar/reordenar entre sí
(solo una mutación a la vez). Un borrado retira el punto de inmediato tras
la confirmación del backend y compacta localmente las posiciones restantes
(`1..N`, sin huecos) antes de recargar el listado, que sigue siendo la
autoridad real y sustituye esa compactación provisional; un fallo de esa
recarga no deshace el borrado ni deja huecos visibles — la lista se queda
en la compactación local, con el fallo escrito en `loadError`, nunca en
`deleteError`. El destino del foco tras el borrado se calcula siempre sobre
esa lista ya compactada, nunca sobre un filtrado propio del snapshot previo
al borrado. Reordenar siempre envía el conjunto completo de ids y aplica
tal cual la lista que devuelve el backend, sin optimismo.

Integración en `MeetingDetailView` (orquestadora): `MeetingPointsSection`
(cabecera, estados de carga/error/vacío y listado), `MeetingPointsList`
(listado plegable), `MeetingPointFormDialog` (crear/editar) y
`DeleteMeetingPointDialog` (confirmación), todos en
`src/components/meetings/`. La vista abre/cierra el store de puntos según
la sesión de detalle de la reunión (`selectedMeeting.id`), sin ruta nueva.
`canManagePoints` es una ayuda visual separada de `canEdit`: reunión en
`draft`/`held` y usuario creador, `admin` o `superadmin`; cualquier usuario
autenticado puede ver los puntos. En `closed` se muestra un texto discreto;
en una reunión mutable sin permiso no se renderiza ninguna acción — el
backend sigue siendo la única autoridad real.

Todos los puntos aparecen contraídos al cargar, cada uno se expande de
forma independiente mediante un botón real con `aria-expanded`/
`aria-controls`/etiqueta accesible dinámica, hermano (nunca anidado) de sus
acciones de icono (`ArrowUp`/`ArrowDown`/`Pencil`/`Trash2` vía
`IconButton`); subir se deshabilita en el primero, bajar en el último, y
cualquier mutación en curso deshabilita las acciones incompatibles
mostrando `busy` solo en la acción realmente activa. El formulario valida
título (obligatorio, máximo 200) y descripción/notas/acuerdos/responsable
(opcionales, límites propios, normalizados a `null` si quedan vacíos);
edición construye un PATCH parcial solo con los campos cambiados y avisa
localmente si no hay ninguno, sin llamar al backend. Reordenar mantiene el
foco de forma natural (mismo nodo por `:key="point.id"`); eliminar mueve el
foco al punto siguiente, al anterior si era el último, o al título de la
sección si no queda ninguno. Errores traducidos por código/estado
(incluido `MEETING_NOT_EDITABLE`) y toasts específicos por operación,
nunca por carga inicial, reintento o validación local.

Comprobaciones ejecutadas: `pnpm build` (`vue-tsc -b && vite build`) sin
errores. Validación manual completada por el usuario; la ordenación mediante flechas es el
comportamiento previsto y el drag-and-drop queda como mejora opcional futura.

- Añadir, editar, ordenar y eliminar puntos dentro de una reunión.
- Guardar título, descripción, notas, acuerdos y responsable cuando corresponda.
- Mantener un orden explícito y estable en PostgreSQL.
- Impedir modificaciones incompatibles con el estado cerrado de la reunión.

Resultado: cualquier usuario autenticado puede consultar los puntos de una reunión; solo el
creador de la reunión o un `admin`/`superadmin` puede crearlos, editarlos, reordenarlos o
eliminarlos, y solo mientras la reunión está `draft` o `held` — `closed` responde
`409 MEETING_NOT_EDITABLE`. `position` la asigna y mantiene siempre el backend (nunca el
cliente); la reordenación completa y la compactación de posiciones tras un borrado usan una
restricción única `(meetingId, position)` real y diferible (`DEFERRABLE`) para reescribir
varias posiciones a la vez sin colisión transitoria, dentro de una transacción que bloquea
primero la fila de la reunión. Asistentes, cierre, actas, eliminación de reuniones e
integración con Drive quedan fuera de esta fase.

### 3.3 Asistentes y cierre

**Fase 3.3a —selección de asistentes y registro de asistencia— completada y validada en
local.** Backend implementado en `fragua-gestion/back` y aprobado; frontend implementado en
`fragua-documentos` y validado manualmente.
(`GET /meetings/:id/attendee-options`, `GET/PUT /meetings/:id/attendees`,
`PATCH /meetings/:id/attendees/:userId`). Los socios que pueden asistir están representados
por usuarios de Fragua con rol `admin` o `superadmin` — ambos roles son candidatos elegibles
y pueden añadirse como asistentes; ningún otro rol aparece como candidato. Añadir un asistente
lo dobla como `planned`; su asistencia real (`attended`/`absent`) se registra después con un
cambio de estado independiente. `PUT /meetings/:id/attendees` sustituye la selección completa
de una vez (acepta `[]` para vaciarla), validando que cada id exista y sea actualmente elegible
antes de insertar o eliminar nada, y conservando sin tocar el estado/fechas de los asistentes
retenidos. Lectura abierta a cualquier usuario autenticado; seleccionar asistentes o modificar
asistencia solo lo puede hacer el creador de la reunión o un `admin`/`superadmin`, y solo
mientras la reunión está `draft` o `held` — `closed` responde `409 MEETING_NOT_EDITABLE`, igual
que los puntos de la fase 3.2. Un usuario no controla ids, relaciones, timestamps ni el estado
inicial de un asistente fuera de estos contratos. Frontend, revisión de conjunto antes de
cerrar la reunión y el propio cierre quedan fuera de esta fase.

Decisiones de producto para el frontend de 3.3a (acordadas con el usuario): la asistencia real
(`attended`/`absent`/`planned`) puede registrarse en cualquier momento mientras la reunión esté
`draft` o `held`, sin esperar a la fase de cierre; y quitar de la selección a un asistente con
asistencia ya registrada (`attended`/`absent`) solo exige un aviso de confirmación en la UI,
sin bloquearlo — el backend elimina esa fila y con ella el registro.

Frontend (implementado y validado manualmente en local): tipos `MeetingAttendee`/
`MeetingAttendeeOption`/`MeetingAttendanceStatus`; `meetingsService` con
`listAttendeeOptions`/`listAttendees`/`replaceAttendees`/`updateAttendeeStatus`; store
independiente `useMeetingAttendeesStore` (`src/stores/meeting-attendees.ts`) con la misma
sesión `open`/`close` que los puntos, mutaciones (reemplazar selección, cambiar estado)
bloqueadas entre sí y sin optimismo; candidatos cargados solo al abrir el diálogo. Componentes
en `src/components/meetings/`: `MeetingAttendeesSection` (cabecera, resumen por estado,
carga/error/vacío, toasts por operación), `MeetingAttendeesList` (estado editable con `<select>`
nativo para quien puede gestionar, solo texto para el resto) y `MeetingAttendeesDialog`
(checklist de candidatos, `PUT` único con el conjunto completo, "No hay cambios que guardar"
local, aviso informativo con nombre y estado de quien pierde asistencia registrada, y aviso
aparte para asistentes que ya no son elegibles, que se retiran al guardar). Integrado en
`MeetingDetailView` con `canManageAttendees` (misma regla visual que los puntos) y sin ruta nueva.
Comprobaciones: `pnpm build` sin errores. Validación manual completada por el usuario.

- Seleccionar asistentes entre los usuarios de Fragua. — **hecho (fase 3.3a, backend y frontend)**.
- Registrar asistencia sin duplicar usuarios. — **hecho (fase 3.3a, backend y frontend)**: `UNIQUE
  (meetingId, userId)` a nivel de base de datos además de la validación de servicio.
- Mostrar una revisión completa antes de cerrar la reunión. — **hecho (fase 3.3b)**.
- Exigir confirmación para el cierre y definir qué campos siguen siendo editables después. —
  **hecho (fase 3.3b)**: cerrar exige confirmar tras la revisión y una reunión cerrada es de solo
  lectura hasta que un `admin`/`superadmin` la reabre.

**Fase 3.3b —transiciones de estado, revisión y cierre— completada y validada en local.**
Backend implementado en `fragua-gestion/back` y aprobado; frontend implementado en
`fragua-documentos` y validado manualmente.

Decisiones acordadas con el usuario:

- Cerrar y reabrir una reunión solo lo pueden hacer `admin` y `superadmin` (el creador sin
  esos roles no puede).
- Una reunión `closed` es de solo lectura: para modificarla hay que reabrirla; no hay
  campos editables sueltos tras el cierre.
- La revisión previa al cierre muestra: resumen de puntos, asistentes por estado y avisos
  informativos (p. ej. puntos sin acuerdos). Los avisos no bloquean el cierre.

Alcance del backend (`fragua-gestion/back`), confirmado con el usuario, incluidas las dos
propuestas:

- Transiciones permitidas: `draft → held` (celebrar), `held → closed` (cerrar) y
  `closed → held` (reabrir). Cualquier otra combinación, incluido repetir una transición ya
  aplicada o cerrar directamente desde `draft`, responde `409 MEETING_INVALID_TRANSITION`.
- Endpoints de acción, sin cuerpo: `POST /meetings/:id/hold`, `/close` y `/reopen`. Devuelven
  el `MeetingResponse` actualizado con `200`. `hold` lo permite el creador o
  `admin`/`superadmin`, igual que el resto de mutaciones; `close` y `reopen` solo
  `admin`/`superadmin`.
- Cada transición bloquea la fila de la reunión (`pessimistic_write`) antes de comprobar
  permisos y estado, igual que puntos y asistentes: una edición concurrente termina antes del
  cierre o recibe `409 MEETING_NOT_EDITABLE` después.
- Sin cambios de esquema. `PATCH /meetings/:id` sigue limitado a `draft`: una reunión
  reabierta vuelve a `held`, no a `draft`, así que nombre, fecha y tipo no se pueden editar.
- Comprobaciones ejecutadas: 22 suites y 481 tests de `src/meetings` pasan; ESLint y Prettier
  sin avisos sobre los archivos tocados. Cubren cada transición válida e inválida, permisos
  por rol, orden 404/403/409, bloqueo `pessimistic_write`, rutas HTTP y la matriz de
  `assertMeetingMutable` (cerrar bloquea puntos y asistentes; reabrir los desbloquea).
- Revisión del backend: sin bloqueantes; suite completa del backend (43 suites, 1084 tests)
  en verde. Observaciones aceptadas: el rol se lee del JWT (por defecto 7 días, sin recargar
  el usuario), así que un admin degradado conserva `close`/`reopen` hasta que caduque su
  token — patrón común a todo el backend, a tratar en 5.2/Bloque 8, no aquí; `hold` no
  comprueba la fecha (se puede celebrar una reunión futura; el frontend lo avisa sin
  bloquearlo); los bloqueos solo están probados con mocks, sin test de integración con base
  de datos, igual que las fases anteriores.
- La revisión previa no tiene endpoint propio: el frontend la compone con los puntos y
  asistentes que ya expone el backend, recargados al abrir el diálogo.

Alcance del frontend (`fragua-documentos`), acordado tras la revisión del backend:

- Tipos y servicio: `MeetingErrorCode` incorpora `MEETING_INVALID_TRANSITION`;
  `meetingsService.holdMeeting`/`closeMeeting`/`reopenMeeting` (`POST /meetings/:id/<acción>`).
- `useMeetingsStore`: `transitionMeeting(action)` con `isTransitioning`/`transitionError`/
  `resetTransitionState`, misma sesión de detalle que `updateMeeting`; sustituye
  `selectedMeeting` con la respuesta y sincroniza los listados (recarga conservando filtros si
  hay filtro por estado activo, actualización local si no). Un `409 MEETING_INVALID_TRANSITION`
  recarga el detalle para reflejar el estado real.
- Stores de puntos y asistentes: `refresh()` (recarga sin vaciar la lista) e `isMutating`
  expuesto, para que la revisión use datos frescos y no se abra con una mutación en curso.
- `MeetingDetailView`: acciones de cabecera según estado — `draft`: «Marcar como celebrada»
  (creador/`admin`/`superadmin`) además de «Editar reunión»; `held`: «Cerrar reunión»
  (`admin`/`superadmin`); `closed`: «Reabrir reunión» (`admin`/`superadmin`). Los textos de
  bloqueo pasan a ser específicos por estado. Solo ayuda visual: el backend decide.
- `MeetingTransitionDialog.vue` (celebrar y reabrir): confirmación con error contextual;
  al celebrar una reunión con fecha futura muestra un aviso, sin bloquear.
- `CloseMeetingDialog.vue` (cerrar): recarga puntos y asistentes al abrir; muestra datos de la
  reunión, resumen de puntos, asistentes por estado y avisos no bloqueantes (sin puntos, sin
  asistentes, asistencia aún en «Previsto», puntos sin acuerdos); no permite confirmar hasta
  tener los datos frescos, con reintento si la recarga falla. La composición vive en
  `utils/meeting-review.ts`, sin lógica en el componente.
- Toasts por operación, error dentro del diálogo y en toast sin duplicar, foco al título de la
  reunión tras un cambio de estado correcto y al disparador tras cancelar.

Frontend implementado y validado manualmente en local: todo lo anterior, tal como se acordó.
Detalles: la revisión previa se recarga con `refresh()` de ambos stores (`false` si falla, si la
sesión cambió o si hay una mutación en curso) y el botón «Cerrar reunión» se deshabilita mientras
haya una mutación de puntos o asistentes en vuelo; cambiar de reunión cierra cualquier diálogo de
estado abierto e invalida la recarga en curso; tras un `409 MEETING_INVALID_TRANSITION` la
reunión se relee sin vaciar la vista y, si el botón que abrió el diálogo ya no existe, el foco
va al título. Comprobaciones: `pnpm build` (`vue-tsc -b && vite build`) sin errores, y
`buildMeetingReview` verificada con un script desechable (avisos, singular/plural, agrupación);
el proyecto no tiene framework de tests ni script de lint.

### 3.4 Exportar el acta a Google Drive

- Crear de forma idempotente la estructura
  `Reuniones/<año>/<AAAA-MM-DD - nombre de la reunión>/` dentro de `rootFolderId`.
- Generar un acta con los datos de la reunión, asistentes, puntos, notas y acuerdos.
- Guardar el acta en Drive sin enlaces públicos y registrar en PostgreSQL su `fileId` y
  `folderId`.
- Permitir descargar el acta desde Fragua mediante la API autenticada.
- Definir el formato inicial del acta antes de implementar la generación; comenzar con un
  único formato estable. — **decidido: PDF.**

**Fase 3.4 — completada y validada en local.** Backend implementado en `fragua-gestion/back` y
aprobado; frontend implementado en `fragua-documentos` y validado manualmente.

Decisiones acordadas con el usuario:

- El acta se guarda como **PDF**: es un archivo binario, así que cada corrección posterior
  (reabrir, cambiar cosas y volver a exportar) se conserva como una revisión de Drive con el
  historial de la fase 2.3 bis. La regeneración sobre el mismo `fileId` es la fase 3.5; 3.4 solo
  crea el acta la primera vez.
- Contenido: datos de la reunión, **fecha de cierre y quién la cerró**, asistentes con su
  estado, y puntos con descripción, responsable, notas y acuerdos.
- Solo se genera cuando la reunión está en `closed`.

Consecuencia de esas decisiones: la reunión debe recordar cuándo y por quién se cerró, y hoy
no lo guarda (`closedAt`/`closedByUserId` no existen), así que 3.4 incluye una migración.

Alcance del backend, confirmado con el usuario (incluidas las dos propuestas: solo
`admin`/`superadmin` exportan, y una segunda exportación es `409` hasta la fase 3.5):

- Migración: `meetings.closedAt`/`closedByUserId` (los rellena `close`, los limpia `reopen`) y
  la tabla `meeting_minutes` (una fila por reunión con `driveFileId`, `driveFolderId`,
  `fileName`, `exportedAt`, `exportedByUserId`). `MeetingResponse` añade `closedAt` y
  `closedBy`.
- Endpoints: `POST /meetings/:id/minutes` (`admin`/`superadmin`; `409 MEETING_NOT_CLOSED` si no
  está cerrada; `409 MEETING_MINUTES_ALREADY_EXPORTED` si ya existe), `GET .../minutes`
  (metadatos, `404` si no hay) y `GET .../minutes/download` (PDF por la API autenticada).
- PDF con `pdfkit` y la fuente DejaVu Sans incluida (acentos, `«»`, `€`, griego y cirílico; los
  caracteres CJK no se cubren). Ruta en Drive:
  `Reuniones/<año>/<AAAA-MM-DD - nombre>/Acta <AAAA-MM-DD> - <nombre>.pdf`, con la fecha en
  horario de Madrid.
- Drive: `ensureFolderPath` (carpetas idempotentes, serializado en proceso: solo protege una
  instancia del backend) y `saveGeneratedFile` (crea o sustituye el contenido de un binario
  del mismo nombre, para que un reintento no duplique).
- La exportación mantiene el bloqueo `pessimistic_write` de la reunión durante las llamadas a
  Drive, a propósito: dos exportaciones simultáneas se serializan y `reopen` espera a que
  termine. Coste: una conexión de base de datos abierta unos segundos.
- Comprobaciones ejecutadas: suite completa del backend (49 suites, 1195 tests), ESLint y
  Prettier sin avisos; migración probada en un Postgres desechable (subida, bajada, subida y
  sin deriva de esquema); exportación y concurrencia verificadas contra Postgres real (doble
  exportación → un solo archivo y una sola fila; `reopen` espera a la exportación); `nest
  build` real copia las fuentes y el PDF se genera desde `dist`; PDF de muestra inspeccionado
  (texto y aspecto).
- Prueba de extremo a extremo contra el **Google Drive real** (desarrollo local, backend en el
  contenedor `fragua-gestion-back-app-1`): reunión de prueba llevada hasta `closed`,
  `POST /meetings/:id/minutes` → `201`; el PDF aparece en Drive en
  `Reuniones/2026/2026-09-21 - <nombre>/Acta 2026-09-21 - <nombre>.pdf` (`application/pdf`);
  `GET .../minutes` devuelve los metadatos; `GET .../minutes/download` devuelve el PDF con
  `Content-Disposition` correcto y el contenido esperado (acentos, fecha de cierre en horario de
  Madrid, quién cerró, asistencia, puntos, pie con paginación); una segunda exportación →
  `409 MEETING_MINUTES_ALREADY_EXPORTED`. Quedan en el entorno de desarrollo la reunión de
  prueba «PRUEBA acta 3.4 (borrar)» y su carpeta en Drive, pendientes de borrar a mano.
  El usuario revisó en Drive el PDF (acentos correctos) y la estructura de carpetas creada
  (correcta), y con ello se da el backend por aprobado.
- La migración `AddMeetingMinutesAndClosing` **ya está aplicada en la base de desarrollo**
  (`fragua_gestion`): `main.ts` ejecuta `runMigrations()` en cada arranque y el contenedor de
  desarrollo reinicia solo al editar archivos, así que se aplicó como efecto secundario mientras
  se implementaba. Es aditiva (columnas nulas y una tabla nueva). Para cualquier otro entorno se
  aplicará en el primer arranque con este código.
- Contenedor de desarrollo: hubo que reinstalar dependencias dentro (`pnpm install
  --frozen-lockfile` con `CI=true`) porque su volumen de `node_modules` no incluía `pdfkit`; en
  cualquier entorno con volumen propio de `node_modules` habrá que hacer lo mismo tras esta fase.

Frontend implementado y validado manualmente en local:

- Tipos: `Meeting` gana `closedAt`/`closedBy`; `MeetingMinutes`; `MeetingErrorCode` suma
  `MEETING_NOT_CLOSED` y `MEETING_MINUTES_ALREADY_EXPORTED`. `meetingsService`:
  `getMinutes`, `exportMinutes` y `downloadMinutes` (blob, reutilizando la lectura de
  `Content-Disposition` y el tratamiento de errores en `Blob` del gestor documental).
- `useMeetingMinutesStore` (`src/stores/meeting-minutes.ts`): misma sesión `open`/`close` que
  puntos y asistentes; tres estados de «qué hay» (cargando, con acta, sin acta — el `404` no es
  un error); exportar y descargar se bloquean entre sí. `exportMinutes()` devuelve
  `success`/`already-exported`/`not-closed`/`error`/`blocked`: un `409 ALREADY_EXPORTED` no es un
  fallo (se carga y se muestra el acta existente) y un `409 NOT_CLOSED` relee la reunión.
- `MeetingMinutesSection.vue` en el detalle: visible solo con la reunión cerrada o con acta ya
  existente; sin acta → texto y «Exportar acta a Drive» solo para `admin`/`superadmin` (el resto
  ve «Solo un administrador puede exportar el acta»); con acta → archivo, quién y cuándo la
  exportó, «Descargar acta» y, si la reunión se reabrió o volvió a cerrarse después de exportar,
  el aviso «puede estar desactualizada» (regenerar es la fase 3.5). Toasts por operación,
  foco al botón de descarga tras exportar.
- `MeetingDetailView`: muestra «Cerrada el» y «Cerrada por», y abre/cierra el store del acta con
  el mismo `watch` que los otros dos.
- Refactors mínimos para reutilizar: `describeDriveConnectionError` pasa a
  `utils/drive-connection-error.ts` (lo comparten el gestor documental y el acta),
  `toReadableAxiosError` se exporta, y `useMeetingsStore.refreshMeeting()` (relectura silenciosa
  del detalle) sustituye a la lógica equivalente que estaba dentro de `transitionMeeting`.
- Comprobaciones: `pnpm build` (`vue-tsc -b && vite build`) sin errores; el proyecto no tiene
  framework de tests ni script de lint.

### 3.5 Regeneración e historial del acta — completada y validada en local

- Regenerar el acta corregida sobre el mismo `fileId`, creando una revisión nueva en Drive.
- Reutilizar el historial y la restauración implementados en la fase 2.3 bis.
- No eliminar ni reescribir las revisiones anteriores.
- Mostrar desde la reunión la última exportación, su fecha y el acceso a sus versiones.
- Tratar expresamente el caso en que la carpeta o el acta hayan sido movidas o enviadas a
  la papelera directamente desde Drive.

Resultado: las reuniones se gestionan como datos estructurados y editables en Fragua, y sus
actas se conservan y versionan en Google Drive sin que los usuarios tengan que entrar en él.

Validación completada: regeneración sobre el mismo `fileId`, creación de una revisión nueva,
consulta, descarga, restauración y protección del historial desde la reunión, permisos por rol,
y tratamiento de un acta movida dentro de la raíz gestionada o no disponible por papelera/salida
de esa raíz.

## Bloque 4 — Diseño, consulta y comodidad

### 4.0 Completar el diseño de la aplicación — en curso

- Integrar el logotipo de Fragua 47 en acceso y encabezado, manteniendo alternativas de texto
  accesibles.
- Añadir modo oscuro persistente, con una paleta completa basada en los tokens existentes y un
  control disponible tanto antes como después de iniciar sesión.
- Revisar contraste, estados de foco, formularios, diálogos, navegación y adaptación móvil en
  ambos temas.
- Conservar la jerarquía funcional de las fases anteriores: el rediseño no altera contratos,
  permisos, rutas ni operaciones documentales.

Resultado esperado: una identidad visual reconocible y consistente, cómoda para sesiones largas
y usable en entornos de poca luz.

### 4.1 Previsualización de imágenes

- Añadir un endpoint autenticado para servir contenido visualizable de forma segura.
- Mostrar imágenes en un visor sin hacer público el archivo.
- Mantener disponible la descarga original.

### 4.2 Previsualización de PDF

- Reutilizar el acceso autenticado y mostrar el PDF dentro de la aplicación.
- Incluir carga, error, descarga y cierre accesible del visor.
- No añadir edición de PDF.

### 4.3 Búsqueda

- Buscar por nombre dentro de toda la carpeta raíz gestionada.
- Añadir filtros sencillos por tipo y fecha de modificación.
- Paginar resultados y permitir abrir su carpeta contenedora.

### 4.4 Recientes y favoritos

- Guardar en PostgreSQL las aperturas recientes y favoritos por usuario.
- Drive conserva el archivo; la base de datos solo guarda referencias y preferencias.
- Eliminar referencias internas cuando Drive confirme que un elemento ya no existe.

### 4.5 Subida múltiple

- Seleccionar o arrastrar varios archivos.
- Mostrar estado individual: pendiente, subiendo, completado o fallido.
- Permitir reintentar únicamente los fallidos.

## Bloque 5 — Dinámicas

### 5.1 Gestión de dinámicas — implementada, pendiente de revisión

- Crear dinámicas con título y fecha de calendario, sin estados ni transiciones.
- Añadir, editar y eliminar contenidos ordenados; cada uno tiene título y explicación.
- Mostrar listado y detalle independientes de Reuniones, con una interfaz más ligera.
- Exportar a PDF y guardarlo en Google Drive en `Dinamicas/<año>/<título>`.
- Al volver a exportar, actualizar el mismo PDF para conservar sus versiones en Drive.
- Permitir descargar el PDF mediante la API autenticada.

Resultado esperado: cada dinámica mantiene un documento PDF actualizado y localizable
sin añadir el ciclo de vida, asistentes o acuerdos de una reunión.

## Bloque 6 — Control interno de Fragua

### 6.1 Auditoría documental

- Registrar usuario, acción, `fileId`, nombre conocido y fecha.
- Cubrir creación, subida, descarga, reemplazo, renombrado, movimiento, papelera y
  restauración.
- No guardar tokens, contenido ni errores crudos de Google.
- Añadir una vista filtrable para administradores.

### 6.2 Permisos internos

- Definir capacidades separadas: ver, descargar, subir, organizar y administrar.
- Asignarlas inicialmente por rol de Fragua.
- Aplicarlas en backend; ocultar o deshabilitar en frontend es solo una ayuda visual.
- Mantener conexión, reconexión y desconexión exclusivamente para `superadmin`.

### 6.3 Etiquetas y clasificación

- Guardar etiquetas internas en PostgreSQL asociadas al `fileId`.
- Permitir añadir, retirar y filtrar etiquetas.
- No alterar la estructura real de Drive para representar etiquetas.

## Bloque 7 — Integración con la gestión de Fragua

### 7.1 Vincular documentos con eventos

- Asociar uno o varios `fileId` a un evento sin duplicar archivos.
- Mostrar los documentos vinculados desde el evento y desde el gestor documental.
- Definir qué ocurre con la referencia si el archivo va a la papelera.

### 7.2 Vincular documentos con facturas

- Asociar justificantes, facturas o albaranes con registros de facturación existentes.
- Permitir subir directamente desde el contexto de una factura.
- Mantener la contención y los permisos documentales habituales.

## Bloque 8 — Funciones avanzadas opcionales

Estas fases solo se harán si aportan valor real después de usar los bloques anteriores:

### 8.1 Descarga de carpeta como ZIP

- Construir el ZIP mediante streaming y con límites de tamaño y número de archivos.
- Rechazar o tratar expresamente archivos nativos de Google.
- Cancelar la lectura de Drive si el cliente abandona la descarga.

### 8.2 Caducidades y avisos

- Guardar fecha de caducidad y responsables en PostgreSQL.
- Mostrar documentos próximos a caducar.
- Añadir notificaciones únicamente cuando se haya decidido el canal de entrega.

### 8.3 Uso de almacenamiento

- Mostrar número de archivos, tamaño conocido y archivos más grandes o antiguos.
- Presentar las cifras como información del espacio gestionado, no de todo el Drive.

## Bloque 9 — Preparación y despliegue a producción

- Cerrar el alcance exacto de la primera versión; las fases opcionales no bloquean producción.
- Revisar permisos, límites, CORS, URLs OAuth, secretos y política de copias de seguridad.
- Crear credenciales OAuth y URLs de redirección específicas de producción.
- Separar secretos y claves de cifrado de los archivos versionados.
- Aplicar migraciones y desplegar primero el backend.
- Desplegar el frontend con su URL de API definitiva.
- Recorrer en producción conexión, navegación, subida, descarga y operaciones habilitadas.
- Documentar recuperación de la clave de cifrado, reconexión de Drive y rollback.

## Fuera de alcance por ahora

- Editar dentro de Fragua el contenido de Word, PDF o archivos de Google Workspace.
- Exponer enlaces públicos de Drive.
- Permitir que cada usuario conecte su propia cuenta de Google.
- Borrado definitivo sin una fase específica de seguridad y recuperación.
