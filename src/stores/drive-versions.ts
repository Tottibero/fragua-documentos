import { ref } from 'vue'
import { defineStore } from 'pinia'
import { isAxiosError } from 'axios'
import { driveDocumentsService, sanitizeFileName } from '@/services/drive-documents.service'
import type { DriveErrorCode, DriveFileVersion, DriveItem } from '@/types'

/** Mismos códigos de conexión que el resto de flujos documentales — 409 y
 * 503 son sobre la conexión con Google Drive en sí, no sobre la operación
 * concreta del historial de versiones. */
function describeVersionConnectionError(
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

/** Mismos códigos de conexión, más los propios de cualquier endpoint
 * `/drive/files/:id/versions...`: `DRIVE_VERSION_NOT_SUPPORTED` (carpetas y
 * documentos nativos de Google no tienen historial binario — la UI ya evita
 * ofrecer el botón en esos casos, así que este código solo debería llegar
 * de forma defensiva) y 404 (el archivo ya no existe o está fuera de la
 * raíz). */
function describeLoadVersionsError(err: unknown): { message: string; code: DriveErrorCode | null } {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const code = (err.response?.data as { code?: string } | undefined)?.code
    const connectionError = describeVersionConnectionError(status, code)
    if (connectionError) return connectionError
    if (code === 'DRIVE_VERSION_NOT_SUPPORTED') {
      return {
        message: 'Este elemento no tiene historial de versiones.',
        code: 'DRIVE_VERSION_NOT_SUPPORTED',
      }
    }
    if (status === 404) {
      return { message: 'Este archivo ya no existe o no está disponible.', code: null }
    }
  }
  return { message: 'No se ha podido cargar el historial de versiones.', code: null }
}

/** Añade, sobre `describeLoadVersionsError`, el 404 propio de una
 * `versionId` que ya no identifica ninguna revisión de este archivo
 * (`DRIVE_VERSION_NOT_FOUND`) — distinto del 404 llano de archivo
 * inexistente, que ambas comparten. */
function describeVersionActionError(err: unknown): { message: string; code: DriveErrorCode | null } {
  if (isAxiosError(err)) {
    const code = (err.response?.data as { code?: string } | undefined)?.code
    if (code === 'DRIVE_VERSION_NOT_FOUND') {
      return {
        message: 'Esta versión ya no existe. Vuelve a abrir el historial para verlo actualizado.',
        code: 'DRIVE_VERSION_NOT_FOUND',
      }
    }
  }
  return describeLoadVersionsError(err)
}

function describeDownloadVersionError(err: unknown): { message: string; code: DriveErrorCode | null } {
  const described = describeVersionActionError(err)
  if (described.code) return described
  return { message: 'No se ha podido descargar esta versión.', code: null }
}

function describeRestoreVersionError(err: unknown): { message: string; code: DriveErrorCode | null } {
  const described = describeVersionActionError(err)
  if (described.code) return described
  return { message: 'No se ha podido restaurar esta versión.', code: null }
}

/** Igual que `describeVersionActionError`, más `DRIVE_VERSION_KEEP_FOREVER_LIMIT`
 * (409 — este archivo ya tiene el máximo de revisiones protegidas que
 * permite Google). */
function describeKeepForeverError(err: unknown): { message: string; code: DriveErrorCode | null } {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const code = (err.response?.data as { code?: string } | undefined)?.code
    if (status === 409 && code === 'DRIVE_VERSION_KEEP_FOREVER_LIMIT') {
      return {
        message: 'Este archivo ya tiene el máximo de versiones protegidas permitido por Google Drive.',
        code: 'DRIVE_VERSION_KEEP_FOREVER_LIMIT',
      }
    }
  }
  const described = describeVersionActionError(err)
  if (described.code) return described
  return { message: 'No se ha podido cambiar la protección de esta versión.', code: null }
}

/**
 * Historial de versiones de un archivo binario (fase 2.3 bis), deliberada-
 * mente separado de `useDriveDocumentsStore`: dueño exclusivo del archivo
 * seleccionado, sus revisiones y el estado de las cuatro operaciones que
 * ofrece el diálogo (cargar, descargar, restaurar, proteger/desproteger).
 * No toca `items` del listado principal — quien orquesta la restauración
 * (`DocumentsView`) usa `useDriveDocumentsStore().applyItemUpdate` con el
 * `DriveItem` que devuelve `restoreVersion` para reflejarlo allí.
 */
export const useDriveVersionsStore = defineStore('drive-versions', () => {
  const selectedItem = ref<DriveItem | null>(null)
  const versions = ref<DriveFileVersion[]>([])

  const isLoading = ref(false)
  const loadError = ref('')
  const loadErrorCode = ref<DriveErrorCode | null>(null)

  const downloadingVersionId = ref<string | null>(null)
  const downloadError = ref('')

  const restoringVersionId = ref<string | null>(null)
  const restoreError = ref('')

  const updatingKeepForeverVersionId = ref<string | null>(null)
  const keepForeverError = ref('')

  // Se incrementa en cada apertura/cierre del historial (`open()`/`close()`).
  // Toda petición en vuelo captura el valor vigente al empezar y, si ya no
  // coincide al resolver, descarta la escritura de estado (pero no el
  // resultado que ya se le devolvió al llamador — p. ej. un Blob de
  // descarga ya en camino se sigue entregando para guardar, igual que en
  // `useDriveDocumentsStore().downloadFile`) — así ni la respuesta de un
  // diálogo ya cerrado ni la de un archivo distinto puede escribir sobre la
  // sesión nueva.
  let sessionId = 0

  /** Carga (o recarga) el historial del archivo seleccionado. Sirve tanto
   * para la carga inicial de `open()` como para el reintento
   * (`retryLoad()`) y para la recarga posterior a una restauración con
   * éxito — en los tres casos un fallo se refleja únicamente en
   * `loadError`/`loadErrorCode`, nunca en el error de otra operación. */
  async function loadVersions() {
    const item = selectedItem.value
    if (!item) return

    const session = sessionId
    isLoading.value = true
    loadError.value = ''
    loadErrorCode.value = null

    try {
      const page = await driveDocumentsService.listFileVersions(item.id)
      if (session !== sessionId) return
      versions.value = page.versions
    } catch (err) {
      if (session !== sessionId) return
      const described = describeLoadVersionsError(err)
      loadError.value = described.message
      loadErrorCode.value = described.code
    } finally {
      if (session === sessionId) isLoading.value = false
    }
  }

  /** Cierre real del historial — cancelar, Escape, backdrop, o tras una
   * restauración con éxito; nunca una recarga interna. Incrementa
   * `sessionId` primero, antes de tocar cualquier otro estado, para que
   * cualquier petición en vuelo (carga, descarga, restauración,
   * protección) quede invalidada de inmediato: al resolver, su
   * comprobación de sesión le impedirá escribir sobre una apertura
   * posterior. `open()` reutiliza este mismo cierre como primer paso de
   * cada sesión nueva. */
  function close() {
    sessionId++
    selectedItem.value = null
    versions.value = []
    isLoading.value = false
    loadError.value = ''
    loadErrorCode.value = null
    downloadingVersionId.value = null
    downloadError.value = ''
    restoringVersionId.value = null
    restoreError.value = ''
    updatingKeepForeverVersionId.value = null
    keepForeverError.value = ''
  }

  /** Abre el historial de `item` desde cero: limpia cualquier estado de una
   * apertura anterior (otro archivo, errores previos, cualquier operación
   * que siguiera en vuelo) y pide la primera página de versiones. */
  async function open(item: DriveItem) {
    close()
    selectedItem.value = item
    await loadVersions()
  }

  function retryLoad() {
    if (isLoading.value) return
    loadVersions()
  }

  /**
   * Descarga la revisión `versionId` y devuelve su contenido al llamador
   * (que decide guardarlo, igual que `useDriveDocumentsStore().downloadFile`);
   * `null` si ya hay una descarga en curso (de esta revisión o de otra —
   * solo se permite una a la vez) o si la descarga falló. El nombre
   * devuelto prioriza el de `Content-Disposition`; si el servicio no pudo
   * extraerlo, cae al `originalFilename` de la propia revisión y, en su
   * defecto, al nombre actual del archivo.
   */
  async function downloadVersion(
    versionId: string,
  ): Promise<{ blob: Blob; fileName: string } | null> {
    const item = selectedItem.value
    if (!item) return null
    if (downloadingVersionId.value) return null

    const session = sessionId
    downloadingVersionId.value = versionId
    downloadError.value = ''

    try {
      const result = await driveDocumentsService.downloadFileVersion(item.id, versionId)
      const version = versions.value.find((current) => current.id === versionId)
      const fallbackName = version?.originalFilename || item.name
      return {
        blob: result.blob,
        fileName: result.fileName ?? sanitizeFileName(fallbackName),
      }
    } catch (err) {
      if (session === sessionId) {
        downloadError.value = describeDownloadVersionError(err).message
      }
      return null
    } finally {
      if (session === sessionId) downloadingVersionId.value = null
    }
  }

  /**
   * Restaura la revisión `versionId` como nueva revisión vigente del
   * archivo seleccionado y devuelve el `DriveItem` resultante (o `null` si
   * está bloqueada por una restauración ya en curso o si la restauración
   * falló). El historial se recarga antes de resolver, para reflejar la
   * nueva revisión vigente — si esa recarga falla, el fallo se publica en
   * `loadError` (con su propio reintento ya disponible en el diálogo), no
   * en `restoreError`: la restauración ya tuvo éxito en Drive en ese punto.
   * No toca `items` del listado principal ni ningún estado de
   * `useDriveDocumentsStore` — eso es responsabilidad de quien llama,
   * usando el `DriveItem` devuelto.
   */
  async function restoreVersion(versionId: string): Promise<DriveItem | null> {
    const item = selectedItem.value
    if (!item) return null
    if (restoringVersionId.value) return null

    const session = sessionId
    restoringVersionId.value = versionId
    restoreError.value = ''

    try {
      const restored = await driveDocumentsService.restoreFileVersion(item.id, versionId)
      if (session === sessionId) {
        selectedItem.value = restored
        await loadVersions()
      }
      return restored
    } catch (err) {
      if (session === sessionId) {
        restoreError.value = describeRestoreVersionError(err).message
      }
      return null
    } finally {
      if (session === sessionId) restoringVersionId.value = null
    }
  }

  /**
   * Marca o desmarca `keepForever` en la revisión `versionId`; `true` solo
   * si el cambio se aplicó realmente en Drive. Bloqueada mientras haya una
   * restauración en curso (de cualquier revisión de este archivo) además de
   * mientras haya otro cambio de protección en curso — solo se permite uno
   * a la vez. Al aplicarse con éxito, la revisión devuelta por el backend
   * sustituye a la original dentro de `versions` por `id`, sin recargar el
   * resto del historial.
   */
  async function updateKeepForever(versionId: string, keepForever: boolean): Promise<boolean> {
    const item = selectedItem.value
    if (!item) return false
    if (updatingKeepForeverVersionId.value) return false
    if (restoringVersionId.value) return false

    const session = sessionId
    updatingKeepForeverVersionId.value = versionId
    keepForeverError.value = ''

    try {
      const updated = await driveDocumentsService.updateFileVersion(item.id, versionId, keepForever)
      if (session === sessionId) {
        const index = versions.value.findIndex((current) => current.id === versionId)
        if (index !== -1) {
          versions.value = [
            ...versions.value.slice(0, index),
            updated,
            ...versions.value.slice(index + 1),
          ]
        }
      }
      return true
    } catch (err) {
      if (session === sessionId) {
        keepForeverError.value = describeKeepForeverError(err).message
      }
      return false
    } finally {
      if (session === sessionId) updatingKeepForeverVersionId.value = null
    }
  }

  return {
    selectedItem,
    versions,
    isLoading,
    loadError,
    loadErrorCode,
    downloadingVersionId,
    downloadError,
    restoringVersionId,
    restoreError,
    updatingKeepForeverVersionId,
    keepForeverError,
    open,
    close,
    retryLoad,
    downloadVersion,
    restoreVersion,
    updateKeepForever,
  }
})
