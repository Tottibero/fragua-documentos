/**
 * Tipos compartidos de la aplicación.
 * Fuente única de verdad para las formas de datos de autenticación.
 */

export type UserRole = 'superadmin' | 'admin' | 'user'

export interface User {
  id: string
  nickname: string
  role: UserRole
}

export interface LoginPayload {
  identifier: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}

export type DriveConnectionState =
  | 'not_connected'
  | 'connected'
  | 'revoked'
  | 'unreadable_token'
  | 'google_unavailable'

export interface DriveStatus {
  connected: boolean
  state: DriveConnectionState
  rootFolderId: string | null
  connectedAt: string | null
}

export interface DriveConnectUrlResponse {
  url: string
}

export interface DriveDisconnectResponse {
  message: string
}

export interface DriveItem {
  id: string
  name: string
  mimeType: string
  isFolder: boolean
  size: number | null
  createdTime: string | null
  modifiedTime: string | null
}

export interface DriveItemPage {
  items: DriveItem[]
  nextPageToken: string | null
  rootFolderId: string
}

/** Códigos estables que el backend devuelve en `code` junto al cuerpo de
 * error de los endpoints documentales (listar, crear carpeta, subir
 * archivo) — nunca se debe distinguir por texto. */
export type DriveErrorCode =
  | 'DRIVE_NOT_CONNECTED'
  | 'DRIVE_RECONNECT_REQUIRED'
  | 'DRIVE_UNAVAILABLE'
  | 'DRIVE_FILE_REQUIRED'
  | 'DRIVE_FILE_EMPTY'
  | 'DRIVE_FILE_NAME_INVALID'
  | 'DRIVE_FILE_TOO_LARGE'
  | 'DRIVE_UPLOAD_ERROR'
  | 'DRIVE_MOVE_INVALID'
  | 'DRIVE_FILE_REPLACE_NOT_SUPPORTED'
  | 'DRIVE_VERSION_NOT_SUPPORTED'
  | 'DRIVE_VERSION_NOT_FOUND'
  | 'DRIVE_VERSION_KEEP_FOREVER_LIMIT'
  | 'DRIVE_TRASH_NOT_CONFIRMED'
  | 'DRIVE_RESTORE_NOT_CONFIRMED'

/** Un nivel de la ruta de navegación documental. `id: null` representa la
 * raíz (la petición a `/drive/items` correspondiente no lleva `parentId`). */
export interface DriveBreadcrumb {
  id: string | null
  name: string
}

/**
 * Vista de un nodo del árbol de carpetas de destino de `MoveItemDialog` —
 * ya anidado (`children` resueltos, no ids) para que los componentes
 * presentacionales del árbol no necesiten conocer la representación
 * interna del store (`drive-destination.ts`), solo estos datos por prop.
 */
export interface DriveDestinationNode {
  id: string
  name: string
  children: DriveDestinationNode[]
  /** `true` en cuanto ha llegado con éxito la primera página de hijos de
   * este nodo — controla si expandirlo vuelve a pedirlos o reutiliza los
   * ya conocidos, y si `children.length === 0` significa "carpeta vacía"
   * en vez de "todavía no se sabe". */
  childrenLoaded: boolean
  nextPageToken: string | null
  expanded: boolean
  /** Petición de hijos en curso para este nodo — la inicial o una página
   * adicional ("cargar más"); nunca las dos a la vez. */
  loading: boolean
  /** No vacío si el último intento de cargar los hijos de este nodo
   * (inicial o "cargar más") falló — nunca invalida el resto del árbol. */
  error: string
}

export interface DriveUploadConfig {
  maxUploadBytes: number
}

export interface DriveFileVersionAuthor {
  displayName: string
}

/** Una revisión binaria de un archivo — reflejo tipado de `DriveVersion` en
 * el backend (`GET /drive/files/:id/versions`). Todo campo que Google puede
 * omitir llega como `null`, nunca `undefined`; `isCurrent` ya viene resuelto
 * por el backend comparando con el `headRevisionId` real del archivo, no
 * por la posición de la revisión en la lista. */
export interface DriveFileVersion {
  id: string
  modifiedTime: string | null
  size: number | null
  originalFilename: string | null
  mimeType: string | null
  keepForever: boolean
  isCurrent: boolean
  author: DriveFileVersionAuthor | null
}

export interface DriveFileVersionsPage {
  versions: DriveFileVersion[]
}

/** `POST /drive/items/:id/trash` — confirmación de que el elemento se ha
 * marcado como `trashed` en Drive; `itemId` coincide con el `id` enviado. */
export interface DriveTrashResponse {
  message: string
  itemId: string
}

/** Elemento tal como aparece en `GET /drive/trash` — mismos campos que
 * `DriveItem` más el momento en que se envió a la papelera (`null` si Drive
 * no lo informa). */
export interface DriveTrashItem extends DriveItem {
  trashedTime: string | null
}

export interface DriveTrashPage {
  items: DriveTrashItem[]
  nextPageToken: string | null
}

/** `POST /drive/items/:id/restore` — el elemento restaurado (ya fuera de la
 * papelera) y si tuvo que recuperarse en la raíz gestionada porque la
 * carpeta en la que estaba antes de eliminarse ya no está disponible. */
export interface DriveRestoreResult {
  item: DriveItem
  restoredToRoot: boolean
}

/** Cómo resolver un conflicto de nombre detectado por el backend en subida
 * (`POST /drive/files`), renombrado (`PATCH /drive/items/:id`) o movimiento
 * (`PATCH /drive/items/:id/move`) — fase 2.6, refleja
 * `DriveConflictResolution` del backend. `'error'` (el valor implícito si se
 * omite) hace fallar la petición con `409 DRIVE_NAME_CONFLICT` en vez de
 * tocar Drive; `'keep_both'` continúa aceptando el nombre duplicado;
 * `'replace'` — solo en subida — sobrescribe el contenido de un archivo
 * existente (`conflictItemId`) en vez de crear uno nuevo. Renombrar y mover
 * nunca envían `'replace'`: ninguno de los dos lleva contenido nuevo que
 * escribir. */
export type DriveConflictResolution = 'error' | 'keep_both' | 'replace'

/** Cuerpo de `409 DRIVE_NAME_CONFLICT`, devuelto por subida, renombrado y
 * movimiento cuando ya existe un elemento con ese nombre exacto en la
 * carpeta de destino. `conflicts` son los elementos encontrados, ya con la
 * forma de `DriveItem` habitual (nunca un objeto crudo de Google);
 * `allowedResolutions` dice qué resoluciones puede reenviar el llamador —
 * `'keep_both'` siempre que hay conflicto, `'replace'` solo cuando la
 * petición era una subida y al menos uno de los conflictos es un archivo
 * binario normal (ni carpeta ni documento nativo de Google). Se identifica
 * siempre por `code`, nunca por el texto de `message`. */
export interface DriveNameConflictResponse {
  statusCode: 409
  code: 'DRIVE_NAME_CONFLICT'
  message: string
  conflicts: DriveItem[]
  allowedResolutions: Array<'keep_both' | 'replace'>
}

/** Fase 3.1a — reflejo tipado de `MeetingType`/`MeetingStatus` en
 * `fragua-gestion/back` (`src/entities/Meeting.entity.ts`). Las etiquetas en
 * español viven en `src/utils/meeting-labels.ts`, nunca aquí. */
export type MeetingType = 'event' | 'association' | 'other'
export type MeetingStatus = 'draft' | 'held' | 'closed'

/** Fase 3.1b — código estable devuelto en `code` por `PATCH /meetings/:id`
 * cuando la reunión no está en `draft` (`meetings.exceptions.ts` en
 * `fragua-gestion/back`). Familia separada de `DriveErrorCode` a propósito:
 * son dominios distintos (reuniones en PostgreSQL vs. Google Drive) y nunca
 * deben mezclarse en un mismo tipo. */
export type MeetingErrorCode =
  | 'MEETING_NOT_EDITABLE'
  | 'MEETING_INVALID_TRANSITION'
  | 'MEETING_NOT_CLOSED'
  | 'MEETING_MINUTES_ALREADY_EXPORTED'
  | 'MEETING_MINUTES_NOT_EXPORTED'
  | 'MEETING_MINUTES_FILE_UNAVAILABLE'
  | 'MEETING_MINUTES_FILE_INVALID'

/** Fase 3.3b — acciones de cambio de estado de una reunión, una por endpoint
 * (`POST /meetings/:id/hold|close|reopen`): `draft → held`, `held → closed` y
 * `closed → held`. El estado destino lo fija siempre el backend. */
export type MeetingTransitionAction = 'hold' | 'close' | 'reopen'

/** Autor de una reunión — igual que `MeetingResponse['createdBy']` en el
 * backend, ya reducido a `id`/`nickname` (nunca el `User` completo). */
export interface MeetingCreatedBy {
  id: string
  nickname: string
}

/** Reflejo tipado de `MeetingResponse` (`GET /meetings`, `POST /meetings`).
 * `status` siempre llega en `'draft'` al crear — la fase 3.1a no expone
 * cambios de estado. */
export interface Meeting {
  id: string
  name: string
  scheduledAt: string
  type: MeetingType
  status: MeetingStatus
  createdBy: MeetingCreatedBy
  /** Fase 3.4 — cuándo y quién cerró la reunión: no nulos exactamente mientras
   * `status` es `closed` (los rellena el cierre y los limpia la reapertura). */
  closedAt: string | null
  closedBy: MeetingCreatedBy | null
  createdAt: string
  updatedAt: string
}

/** Grupo paginado de reuniones anteriores a hoy — `page`/`pageSize` reflejan
 * lo que el backend aplicó realmente (con sus valores por defecto), no lo
 * que pidió el cliente. */
export interface MeetingsPastPage {
  items: Meeting[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** `GET /meetings` — `current` son las reuniones de hoy o futuras, ya
 * ordenadas de más próxima a más lejana y sin paginar; `past` es el
 * histórico paginado, ordenado de más reciente a más antiguo. */
export interface MeetingsPage {
  current: Meeting[]
  past: MeetingsPastPage
}

/** Fase 3.2 — reflejo tipado de `MeetingPointResponse`
 * (`meeting-points.service.ts` en `fragua-gestion/back`). `position` la
 * asigna y mantiene siempre el backend (creación, borrado con compactación
 * y reordenación completa) — el cliente nunca la calcula ni la envía. */
export interface MeetingPoint {
  id: string
  meetingId: string
  position: number
  title: string
  description: string | null
  notes: string | null
  agreements: string | null
  responsible: string | null
  createdAt: string
  updatedAt: string
}

/** Fase 3.3a — estado de asistencia de un asistente a una reunión. Las
 * etiquetas en español viven en `src/utils/meeting-labels.ts`. */
export type MeetingAttendanceStatus = 'planned' | 'attended' | 'absent'

/** Fase 3.3a — reflejo tipado de `MeetingAttendeeResponse`
 * (`meeting-attendees.service.ts` en `fragua-gestion/back`). `user` ya viene
 * reducido a `id`/`nickname`. */
export interface MeetingAttendee {
  id: string
  meetingId: string
  user: {
    id: string
    nickname: string
  }
  status: MeetingAttendanceStatus
  createdAt: string
  updatedAt: string
}

/** Fase 3.3a — candidato elegible a asistente (`MeetingAttendeeOption` en el
 * backend): usuarios con rol `admin` o `superadmin`. */
export interface MeetingAttendeeOption {
  id: string
  nickname: string
}

/** Fase 3.4 — reflejo tipado de `MeetingMinutesResponse`
 * (`meeting-minutes.service.ts` en `fragua-gestion/back`): el acta exportada
 * de una reunión. El PDF vive en Google Drive; `fileId`/`folderId` son ids
 * opacos de Drive, nunca un enlace — se descarga siempre por la API
 * autenticada de Fragua. */
export interface MeetingMinutes {
  id: string
  meetingId: string
  fileId: string
  folderId: string
  fileName: string
  exportedAt: string
  exportedBy: MeetingCreatedBy
}

/** Fase 5 — una dinámica no tiene estados: solo título, fecha y contenido. */
export interface Dynamic {
  id: string
  title: string
  /** Fecha de calendario en formato `YYYY-MM-DD`, sin hora ni zona. */
  date: string
  createdBy: MeetingCreatedBy
  createdAt: string
  updatedAt: string
}

export interface DynamicEntry {
  id: string
  dynamicId: string
  position: number
  title: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface DynamicPdf {
  id: string
  dynamicId: string
  fileId: string
  folderId: string
  fileName: string
  exportedAt: string
  exportedBy: MeetingCreatedBy
}

export interface DynamicDetail extends Dynamic {
  entries: DynamicEntry[]
  pdf: DynamicPdf | null
}
