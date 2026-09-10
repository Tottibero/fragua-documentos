import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { isAxiosError } from 'axios'
import { driveDocumentsService, sanitizeFileName } from '@/services/drive-documents.service'
import type { DriveBreadcrumb, DriveErrorCode, DriveItem } from '@/types'

const ROOT_BREADCRUMB: DriveBreadcrumb = { id: null, name: 'Raíz' }

/** 409/503 son sobre la conexión con Google Drive en sí, no sobre la
 * operación concreta — el mensaje es el mismo se esté listando o creando. */
function describeDriveConnectionError(
  status: number | undefined,
  code: string | undefined,
): { message: string; code: DriveErrorCode } | null {
  if (status === 409 && code === 'DRIVE_NOT_CONNECTED') {
    return {
      message: 'Google Drive no está conectado. Pide a un superadmin que lo conecte desde Ajustes.',
      code: 'DRIVE_NOT_CONNECTED',
    }
  }
  if (status === 409 && code === 'DRIVE_RECONNECT_REQUIRED') {
    return {
      message:
        'La conexión con Google Drive necesita reconectarse. Pide a un superadmin que la restablezca desde Ajustes.',
      code: 'DRIVE_RECONNECT_REQUIRED',
    }
  }
  if (status === 503) {
    return {
      message:
        'Google Drive no está disponible en este momento. Es un problema temporal — inténtalo de nuevo en unos segundos.',
      code: 'DRIVE_UNAVAILABLE',
    }
  }
  return null
}

function describeError(err: unknown): { message: string; code: DriveErrorCode | null } {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const code = (err.response?.data as { code?: string } | undefined)?.code
    const connectionError = describeDriveConnectionError(status, code)
    if (connectionError) return connectionError
    if (status === 404) {
      return { message: 'Esta carpeta ya no existe o no está disponible.', code: null }
    }
  }
  return { message: 'No se ha podido cargar el contenido de Google Drive.', code: null }
}

/** Mismos códigos de conexión que `describeError`, más los específicos de
 * `POST /drive/folders`: 400 (nombre inválido — la validación del diálogo
 * ya debería haberlo evitado) y 404 (la carpeta en la que se creaba ya no
 * existe/está disponible). */
function describeCreateFolderError(err: unknown): { message: string; code: DriveErrorCode | null } {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const code = (err.response?.data as { code?: string } | undefined)?.code
    const connectionError = describeDriveConnectionError(status, code)
    if (connectionError) return connectionError
    if (status === 400) {
      return { message: 'El nombre de la carpeta no es válido.', code: null }
    }
    if (status === 404) {
      return {
        message: 'La carpeta en la que intentabas crear ya no existe o no está disponible.',
        code: null,
      }
    }
  }
  return { message: 'No se ha podido crear la carpeta.', code: null }
}

/** Mismos códigos de conexión que `describeError`, más los específicos de
 * `POST /drive/files` — se distinguen por `code`, nunca por el status HTTP
 * a secas, porque varios (archivo requerido/vacío/nombre inválido/error de
 * proceso) comparten el mismo 400. */
function describeUploadError(err: unknown): { message: string; code: DriveErrorCode | null } {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const code = (err.response?.data as { code?: string } | undefined)?.code
    const connectionError = describeDriveConnectionError(status, code)
    if (connectionError) return connectionError
    if (code === 'DRIVE_FILE_REQUIRED') {
      return { message: 'No se ha seleccionado ningún archivo.', code: 'DRIVE_FILE_REQUIRED' }
    }
    if (code === 'DRIVE_FILE_EMPTY') {
      return { message: 'El archivo está vacío.', code: 'DRIVE_FILE_EMPTY' }
    }
    if (code === 'DRIVE_FILE_NAME_INVALID') {
      return { message: 'El nombre del archivo no es válido.', code: 'DRIVE_FILE_NAME_INVALID' }
    }
    if (code === 'DRIVE_FILE_TOO_LARGE') {
      return {
        message: 'El archivo supera el límite de tamaño permitido.',
        code: 'DRIVE_FILE_TOO_LARGE',
      }
    }
    if (code === 'DRIVE_UPLOAD_ERROR') {
      return { message: 'No se ha podido procesar el archivo subido.', code: 'DRIVE_UPLOAD_ERROR' }
    }
    if (status === 404) {
      return {
        message: 'La carpeta en la que intentabas subir ya no existe o no está disponible.',
        code: null,
      }
    }
  }
  return { message: 'No se ha podido subir el archivo.', code: null }
}

/** Mismos códigos de conexión que `describeError`, más los específicos de
 * `PATCH /drive/items/:id`: 400 (nombre inválido — la validación del
 * diálogo ya debería haberlo evitado) y 404 (el elemento ya no existe, está
 * fuera de la raíz gestionada, o es la propia carpeta raíz conectada, que
 * nunca puede renombrarse). Igual que en creación de carpetas, el backend
 * no distingue ese 400 con un `code` propio. */
function describeRenameError(err: unknown): { message: string; code: DriveErrorCode | null } {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const code = (err.response?.data as { code?: string } | undefined)?.code
    const connectionError = describeDriveConnectionError(status, code)
    if (connectionError) return connectionError
    if (status === 400) {
      return { message: 'El nombre no es válido.', code: null }
    }
    if (status === 404) {
      return { message: 'Este elemento ya no existe o no está disponible.', code: null }
    }
  }
  return { message: 'No se ha podido renombrar el elemento.', code: null }
}

/** Mismos códigos de conexión que `describeError`, más los propios de
 * `GET /drive/files/:id/download`: 404 (el archivo ya no existe/está fuera
 * de la raíz) y 400 (carpetas y archivos nativos de Google no son
 * descargables directamente — la UI ya evita ofrecer el botón en esos
 * casos, así que este 400 solo debería llegar de forma defensiva). El
 * backend no distingue esos dos 400 con un `code` propio, así que aquí
 * tampoco se distinguen por texto — un único mensaje para ambos. */
function describeDownloadError(err: unknown): { message: string; code: DriveErrorCode | null } {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const code = (err.response?.data as { code?: string } | undefined)?.code
    const connectionError = describeDriveConnectionError(status, code)
    if (connectionError) return connectionError
    if (status === 404) {
      return { message: 'Este archivo ya no existe o no está disponible.', code: null }
    }
    if (status === 400) {
      return { message: 'Este archivo no se puede descargar directamente.', code: null }
    }
  }
  return { message: 'No se ha podido descargar el archivo.', code: null }
}

/** Mismos códigos de conexión que `describeError`, más los propios de
 * `PATCH /drive/items/:id/move`: `DRIVE_MOVE_INVALID` (mover una carpeta
 * dentro de sí misma o de una de sus descendientes — el selector de destino
 * ya debería impedir llegar a proponer ese destino, así que esto es
 * defensivo) y 404 (el elemento o la carpeta de destino ya no existen o
 * están fuera de la raíz). El backend no distingue con un `code` propio
 * ningún otro 400, así que cualquier otro se trata con un mensaje genérico
 * — nunca por texto. */
function describeMoveError(err: unknown): { message: string; code: DriveErrorCode | null } {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const code = (err.response?.data as { code?: string } | undefined)?.code
    const connectionError = describeDriveConnectionError(status, code)
    if (connectionError) return connectionError
    if (code === 'DRIVE_MOVE_INVALID') {
      return {
        message: 'No se puede mover un elemento dentro de sí mismo o de una de sus subcarpetas.',
        code: 'DRIVE_MOVE_INVALID',
      }
    }
    if (status === 400) {
      return { message: 'El destino no es válido.', code: null }
    }
    if (status === 404) {
      return {
        message: 'El elemento o la carpeta de destino ya no existen o no están disponibles.',
        code: null,
      }
    }
  }
  return { message: 'No se ha podido mover el elemento.', code: null }
}

export const useDriveDocumentsStore = defineStore('drive-documents', () => {
  const breadcrumbs = ref<DriveBreadcrumb[]>([ROOT_BREADCRUMB])
  const items = ref<DriveItem[]>([])
  const nextPageToken = ref<string | null>(null)
  // Id real de la carpeta raíz conectada — a diferencia de `currentFolderId`,
  // que usa `null` como sentinel de "raíz" en la navegación local, este es
  // siempre el id de Drive concreto que el backend usa para `parentId`.
  // Se conoce tras el primer listado y no cambia mientras dure la conexión;
  // lo necesita el flujo de mover para resolver el padre real de un
  // elemento cuando se está viendo la raíz (`currentFolderId === null`).
  const rootFolderId = ref<string | null>(null)

  const isLoading = ref(false)
  const error = ref('')
  const errorCode = ref<DriveErrorCode | null>(null)

  const isLoadingMore = ref(false)
  const loadMoreError = ref('')

  const isCreatingFolder = ref(false)
  const createFolderError = ref('')

  const maxUploadBytes = ref<number | null>(null)
  const isLoadingUploadConfig = ref(false)
  const uploadConfigError = ref('')

  const isUploading = ref(false)
  const uploadError = ref('')

  const downloadingFileId = ref<string | null>(null)
  const downloadError = ref('')

  const isRenaming = ref(false)
  const renamingItemId = ref<string | null>(null)
  const renameError = ref('')

  const isMoving = ref(false)
  const movingItemId = ref<string | null>(null)
  const moveError = ref('')

  const currentFolderId = computed(
    () => breadcrumbs.value[breadcrumbs.value.length - 1]?.id ?? null,
  )

  // Toda carga o recarga de un listado (raíz, abrir carpeta, breadcrumb,
  // reintento, "cargar más", y las recargas tras crear una carpeta o subir
  // un archivo) incrementa este contador. Una respuesta solo se aplica si
  // su id sigue siendo el vigente al llegar — así una petición antigua
  // nunca puede sobrescribir el resultado de una carga posterior, aunque
  // llegue más tarde. Uso exclusivo: carreras de carga/paginación del
  // listado — no sirve para saber si el usuario *navegó* (ver
  // `navigationSeq`), porque también cambia con `loadMore()` sin que haya
  // cambiado de carpeta.
  let requestSeq = 0

  // Contexto de navegación explícito, independiente de `requestSeq`: solo
  // cambia cuando el usuario navega de verdad a otra vista de carpeta
  // (raíz, abrir carpeta, saltar a un breadcrumb) — nunca con `loadMore()`,
  // `retry()`, ni las recargas posteriores a crear una carpeta o subir un
  // archivo (todas ellas vuelven a la carpeta en la que ya se estaba). Una
  // ida y vuelta también lo cambia, aunque termine en el mismo folderId —
  // es la "carpeta que se está mostrando ahora" lo que importa, no su id.
  // `downloadFile()` lo usa para decidir si un fallo de descarga sigue
  // siendo del contexto donde se inició.
  let navigationSeq = 0

  /**
   * Devuelve `true` cuando esta llamada siguió siendo la vigente hasta el
   * final y su resultado (éxito o error) se aplicó al estado; `false` si
   * quedó obsoleta por una navegación posterior antes de completarse. Los
   * llamadores usan este valor para decidir si les corresponde mover el
   * foco al breadcrumb actual.
   */
  async function loadFolder(parentId: string | null): Promise<boolean> {
    const requestId = ++requestSeq
    isLoading.value = true
    error.value = ''
    errorCode.value = null
    items.value = []
    nextPageToken.value = null
    // Cualquier "cargar más" en curso pertenece a la carpeta que se abandona:
    // se descarta ya (su propio `finally` es un no-op idempotente si llega
    // después), para no dejar el botón bloqueado en la carpeta nueva.
    isLoadingMore.value = false
    loadMoreError.value = ''
    // Igual que `loadMoreError`: un error de descarga es de la carpeta que
    // se abandona, nunca de la que se está a punto de mostrar.
    downloadError.value = ''

    try {
      const page = await driveDocumentsService.listItems({ parentId: parentId ?? undefined })
      if (requestId !== requestSeq) return false
      items.value = page.items
      nextPageToken.value = page.nextPageToken
      rootFolderId.value = page.rootFolderId
      return true
    } catch (err) {
      if (requestId !== requestSeq) return false
      const described = describeError(err)
      error.value = described.message
      errorCode.value = described.code
      return true
    } finally {
      if (requestId === requestSeq) isLoading.value = false
    }
  }

  async function loadRoot() {
    navigationSeq++
    breadcrumbs.value = [ROOT_BREADCRUMB]
    await loadFolder(null)
  }

  /** `true` solo si esta llamada llegó a iniciar la navegación (no bloqueada
   * por reentrada) y su resultado siguió siendo el vigente al completarse. */
  async function openFolder(item: DriveItem): Promise<boolean> {
    if (!item.isFolder) return false
    // Reentrada: una segunda activación (doble clic, clic + Enter, etc.)
    // mientras ya hay una navegación en curso no debe añadir otro breadcrumb
    // ni lanzar otra petición. `isLoadingMore` se deja fuera a propósito —
    // paginar no debe impedir abrir una carpeta.
    if (isLoading.value) return false
    navigationSeq++
    breadcrumbs.value = [...breadcrumbs.value, { id: item.id, name: item.name }]
    return await loadFolder(item.id)
  }

  /** Mismo criterio que `openFolder`: `true` solo si esta llamada inició y
   * completó la navegación vigente. */
  async function goToBreadcrumb(index: number): Promise<boolean> {
    if (index < 0 || index >= breadcrumbs.value.length - 1) return false
    navigationSeq++
    breadcrumbs.value = breadcrumbs.value.slice(0, index + 1)
    return await loadFolder(currentFolderId.value)
  }

  async function retry() {
    await loadFolder(currentFolderId.value)
  }

  async function loadMore() {
    if (isLoading.value || isLoadingMore.value || !nextPageToken.value) return

    const requestId = ++requestSeq
    const parentId = currentFolderId.value
    const pageToken = nextPageToken.value
    isLoadingMore.value = true
    loadMoreError.value = ''

    try {
      const page = await driveDocumentsService.listItems({
        parentId: parentId ?? undefined,
        pageToken,
      })
      if (requestId !== requestSeq) return
      items.value = [...items.value, ...page.items]
      nextPageToken.value = page.nextPageToken
      rootFolderId.value = page.rootFolderId
    } catch (err) {
      if (requestId !== requestSeq) return
      loadMoreError.value = describeError(err).message
    } finally {
      // Igual que en `isLoading`: solo la petición que sigue siendo la
      // vigente puede limpiar el flag. Si esta quedó obsoleta (una
      // navegación la invalidó y, con ella, ya pudo empezar un `loadMore`
      // posterior), tocar `isLoadingMore` aquí pisaría el estado de esa
      // paginación más reciente en vez del suyo propio. El caso "atascado
      // para siempre" que esto podría reintroducir ya lo cubre `loadFolder`,
      // que resetea `isLoadingMore` de forma proactiva en cuanto se navega.
      if (requestId === requestSeq) isLoadingMore.value = false
    }
  }

  /** Limpia el error de un intento de creación anterior — llamada al abrir
   * el diálogo, para no arrastrar el mensaje de un intento previo. */
  function resetCreateFolderState() {
    createFolderError.value = ''
  }

  /**
   * `true` solo si la carpeta se creó realmente en Drive (el diálogo debe
   * cerrarse); `false` si la petición está bloqueada por un envío duplicado
   * o si la creación falló (el diálogo debe permanecer abierto conservando
   * el nombre introducido).
   *
   * Al crearse con éxito, si `currentFolderId` sigue siendo la carpeta en la
   * que se creó (el usuario no navegó a otro sitio mientras tanto), se
   * espera la recarga de esa misma carpeta antes de resolver — sin tocar
   * `breadcrumbs` — para que `isCreatingFolder` (y por tanto el botón "Nueva
   * carpeta") solo vuelva a quedar disponible cuando el listado ya refleja
   * la carpeta nueva. A partir de que el POST tiene éxito, la carpeta ya
   * existe en Drive: un fallo de esa recarga se refleja únicamente en
   * `error`/`errorCode` (el mecanismo normal de navegación, con su propio
   * reintento) y nunca en `createFolderError` — no debe parecer que la
   * creación falló ni invitar a repetirla.
   */
  async function createFolder(name: string): Promise<boolean> {
    if (isCreatingFolder.value) return false
    const trimmedName = name.trim()
    if (!trimmedName) return false

    const parentId = currentFolderId.value
    isCreatingFolder.value = true
    createFolderError.value = ''

    try {
      await driveDocumentsService.createFolder({
        name: trimmedName,
        parentId: parentId ?? undefined,
      })
      if (currentFolderId.value === parentId) {
        // `loadFolder` nunca rechaza (gestiona sus propios errores), así
        // que esperarla aquí no puede hacer caer este `try` en el `catch`
        // de creación.
        await loadFolder(parentId)
      }
      return true
    } catch (err) {
      createFolderError.value = describeCreateFolderError(err).message
      return false
    } finally {
      isCreatingFolder.value = false
    }
  }

  /** Carga inicial y reintento del límite de subida son la misma llamada:
   * un fallo no bloquea la navegación por documentos (no toca `isLoading`,
   * `items` ni `error`). Ante cualquier fallo de red, o si la respuesta no
   * trae un `maxUploadBytes` numérico, finito y positivo, `maxUploadBytes`
   * queda en `null` — lo que impide habilitar una subida cuyo límite no se
   * conoce (o no es utilizable) — y se informa del error. */
  async function fetchUploadConfig() {
    if (isLoadingUploadConfig.value) return
    isLoadingUploadConfig.value = true
    uploadConfigError.value = ''
    try {
      const config = await driveDocumentsService.getUploadConfig()
      const bytes = config.maxUploadBytes
      if (typeof bytes === 'number' && Number.isFinite(bytes) && bytes > 0) {
        maxUploadBytes.value = bytes
      } else {
        maxUploadBytes.value = null
        uploadConfigError.value = 'No se ha podido obtener el límite de subida.'
      }
    } catch {
      maxUploadBytes.value = null
      uploadConfigError.value = 'No se ha podido obtener el límite de subida.'
    } finally {
      isLoadingUploadConfig.value = false
    }
  }

  /** Limpia el error de una subida anterior — llamada al abrir el diálogo,
   * para no arrastrar el mensaje de un intento previo. */
  function resetUploadState() {
    uploadError.value = ''
  }

  /**
   * Mismo criterio que `createFolder`: `true` solo si el archivo se subió
   * realmente a Drive (el diálogo debe cerrarse); `false` si está bloqueado
   * por un envío duplicado o si la subida falló (el diálogo permanece
   * abierto conservando el archivo elegido).
   *
   * Al subirse con éxito, si `currentFolderId` sigue siendo la carpeta a la
   * que se subió, se espera la recarga de esa misma carpeta antes de
   * resolver — sin tocar `breadcrumbs` — y `isUploading` no vuelve a `false`
   * hasta que esa recarga termina (vía `finally`). Un fallo de la recarga
   * se refleja únicamente en `error`/`errorCode` (el mecanismo normal de
   * navegación, con su propio reintento) y nunca en `uploadError`: el
   * archivo ya se subió, así que no debe parecer que la subida falló ni
   * invitar a repetirla.
   */
  async function uploadFile(file: File): Promise<boolean> {
    if (isUploading.value) return false

    const parentId = currentFolderId.value
    isUploading.value = true
    uploadError.value = ''

    try {
      await driveDocumentsService.uploadFile({ file, parentId: parentId ?? undefined })
      if (currentFolderId.value === parentId) {
        // `loadFolder` nunca rechaza, así que esperarla aquí no puede hacer
        // caer este `try` en el `catch` de subida.
        await loadFolder(parentId)
      }
      return true
    } catch (err) {
      uploadError.value = describeUploadError(err).message
      return false
    } finally {
      isUploading.value = false
    }
  }

  /**
   * Descarga `item` y devuelve su contenido al llamador (que decide qué
   * hacer con él — p. ej. guardarlo — sin que este store toque el DOM en
   * ningún momento); `null` si está bloqueada por una descarga en curso
   * (de este archivo o de cualquier otro: solo se permite una a la vez) o
   * si la descarga falló.
   *
   * El nombre devuelto prioriza el de `Content-Disposition`; si el
   * servicio no pudo extraerlo, cae al nombre ya conocido del `DriveItem`
   * — saneado igual que el otro, porque un archivo añadido directamente a
   * Drive (fuera de Fragua) puede tener caracteres que aquí no se
   * permitirían al crear/subir.
   *
   * La descarga es independiente de la navegación: nunca se cancela ni se
   * descarta por haber cambiado de carpeta mientras estaba en curso — un
   * Blob y nombre que lleguen bien se devuelven y se guardan igual. Lo
   * único que depende de seguir en la misma vista es si un *fallo* se
   * publica en `downloadError`: se captura `navigationSeq` (no `requestSeq`
   * — ese también cambia con `loadMore()`, que no es una navegación) al
   * empezar, y solo si sigue siendo el vigente cuando la descarga termina
   * en error se escribe el mensaje — así ni una navegación de ida y vuelta
   * (aunque termine en el mismo `folderId`) ni una respuesta obsoleta
   * pueden pintar un error sobre el listado de una carpeta distinta a la
   * que falló.
   */
  async function downloadFile(item: DriveItem): Promise<{ blob: Blob; fileName: string } | null> {
    if (downloadingFileId.value) return null

    const navigationId = navigationSeq
    downloadingFileId.value = item.id
    downloadError.value = ''

    try {
      const result = await driveDocumentsService.downloadFile(item.id)
      return {
        blob: result.blob,
        fileName: result.fileName ?? sanitizeFileName(item.name),
      }
    } catch (err) {
      if (navigationSeq === navigationId) {
        downloadError.value = describeDownloadError(err).message
      }
      return null
    } finally {
      downloadingFileId.value = null
    }
  }

  /** Limpia el error de un intento de renombrado anterior — llamada al abrir
   * el diálogo, para no arrastrar el mensaje de un intento previo. */
  function resetRenameState() {
    renameError.value = ''
  }

  /**
   * Mismo criterio que `createFolder`/`uploadFile`: `true` solo si el
   * elemento se renombró realmente en Drive (el diálogo debe cerrarse);
   * `false` si está bloqueado por un envío duplicado (solo se permite un
   * renombrado a la vez, igual que las descargas) o si el renombrado falló
   * (el diálogo debe permanecer abierto conservando el nombre introducido y
   * mostrando `renameError`).
   *
   * Al renombrarse con éxito, el `DriveItem` que devuelve el backend
   * sustituye al original dentro de `items` por `id` — sin recargar la
   * carpeta, sin tocar `breadcrumbs`, `nextPageToken` ni el resto de
   * páginas ya cargadas — pero solo si el usuario sigue en el mismo
   * contexto de navegación (`navigationSeq` capturado al empezar, igual que
   * `downloadFile`): si navegó a otra carpeta mientras la petición estaba en
   * curso, el listado visible ya pertenece a otra carpeta y no debe
   * tocarse. El renombrado se considera un éxito en cualquier caso — ya
   * ocurrió en Drive — así que el diálogo siempre se cierra.
   */
  async function renameItem(item: DriveItem, name: string): Promise<boolean> {
    if (isRenaming.value) return false

    const navigationId = navigationSeq
    isRenaming.value = true
    renamingItemId.value = item.id
    renameError.value = ''

    try {
      const renamed = await driveDocumentsService.renameItem(item.id, name)
      if (navigationSeq === navigationId) {
        const index = items.value.findIndex((current) => current.id === item.id)
        if (index !== -1) {
          items.value = [...items.value.slice(0, index), renamed, ...items.value.slice(index + 1)]
        }
      }
      return true
    } catch (err) {
      renameError.value = describeRenameError(err).message
      return false
    } finally {
      isRenaming.value = false
      renamingItemId.value = null
    }
  }

  /** Limpia el error de un intento de movimiento anterior — llamada al abrir
   * el diálogo, para no arrastrar el mensaje de un intento previo. */
  function resetMoveState() {
    moveError.value = ''
  }

  /**
   * Mueve `item` a la carpeta `destinationId`, conocida la carpeta en la
   * que se encontraba (`sourceParentId`) cuando se abrió el diálogo. `true`
   * solo si el elemento se movió realmente en Drive (el diálogo debe
   * cerrarse); `false` si está bloqueado por un envío duplicado (solo se
   * permite un movimiento a la vez, igual que renombrados y descargas), si
   * el destino es el mismo padre actual o el propio elemento — el selector
   * ya debería impedir llegar a proponer cualquiera de los dos; esto es
   * solo la misma defensa que ya aplican `handleDownloadClick`/
   * `handleRenameClick` contra un `:disabled` que no llegó a tiempo — o si
   * el movimiento falló (el diálogo permanece abierto mostrando
   * `moveError`).
   *
   * Al moverse con éxito, si el usuario sigue en el mismo contexto de
   * navegación que cuando se inició (`navigationSeq` capturado al empezar,
   * igual que `downloadFile`/`renameItem`) el elemento se retira de `items`
   * por `id` — sin recargar la carpeta, sin tocar `breadcrumbs` ni
   * `nextPageToken`. Si navegó a otro sitio mientras la petición estaba en
   * curso, el listado visible ya pertenece a otra carpeta y no debe
   * tocarse; el movimiento se considera un éxito en cualquier caso — ya
   * ocurrió en Drive.
   */
  async function moveItem(
    item: DriveItem,
    destinationId: string,
    sourceParentId: string,
  ): Promise<boolean> {
    if (isMoving.value) return false
    if (destinationId === sourceParentId) return false
    if (destinationId === item.id) return false

    const navigationId = navigationSeq
    isMoving.value = true
    movingItemId.value = item.id
    moveError.value = ''

    try {
      await driveDocumentsService.moveItem(item.id, destinationId)
      if (navigationSeq === navigationId) {
        items.value = items.value.filter((current) => current.id !== item.id)
      }
      return true
    } catch (err) {
      moveError.value = describeMoveError(err).message
      return false
    } finally {
      isMoving.value = false
      movingItemId.value = null
    }
  }

  return {
    breadcrumbs,
    items,
    nextPageToken,
    rootFolderId,
    currentFolderId,
    isLoading,
    error,
    errorCode,
    isLoadingMore,
    loadMoreError,
    isCreatingFolder,
    createFolderError,
    maxUploadBytes,
    isLoadingUploadConfig,
    uploadConfigError,
    isUploading,
    uploadError,
    downloadingFileId,
    downloadError,
    isRenaming,
    renamingItemId,
    renameError,
    isMoving,
    movingItemId,
    moveError,
    loadRoot,
    openFolder,
    goToBreadcrumb,
    retry,
    loadMore,
    createFolder,
    resetCreateFolderState,
    fetchUploadConfig,
    resetUploadState,
    uploadFile,
    downloadFile,
    resetRenameState,
    renameItem,
    resetMoveState,
    moveItem,
  }
})
