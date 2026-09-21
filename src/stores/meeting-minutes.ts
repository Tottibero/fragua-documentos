import { ref } from 'vue'
import { defineStore } from 'pinia'
import { isAxiosError } from 'axios'
import { meetingsService } from '@/services/meetings.service'
import { describeDriveConnectionError } from '@/utils/drive-connection-error'
import { sanitizeFileName } from '@/services/drive-documents.service'
import type { DriveFileVersion, DriveItem, MeetingErrorCode, MeetingMinutes } from '@/types'

const SERVER_ERROR_MESSAGE =
  'Ha ocurrido un problema temporal en el servidor. Inténtalo de nuevo en unos segundos.'
const NETWORK_ERROR_MESSAGE =
  'No se ha podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.'

/** Cómo terminó `exportMinutes()`:
 * - `'success'`: el acta se generó y se guardó en Drive.
 * - `'already-exported'`: otra persona (u otra pestaña) la exportó antes; no
 *   es un fallo, ya se ha cargado la que existe y se muestra tal cual.
 * - `'not-closed'`: la reunión ya no está cerrada — quien llama debe releer
 *   la reunión para reflejar su estado real.
 * - `'error'`: un fallo real, con el mensaje en `exportError`.
 * - `'blocked'`: ya había una operación en curso; no se hizo nada. */
export type MinutesExportOutcome = 'success' | 'already-exported' | 'not-closed' | 'error' | 'blocked'
export type MinutesRegenerateOutcome =
  | 'success'
  | 'not-closed'
  | 'not-exported'
  | 'unavailable'
  | 'invalid'
  | 'error'
  | 'blocked'

function errorCodeOf(err: unknown): string | undefined {
  if (!isAxiosError(err)) return undefined
  return (err.response?.data as { code?: MeetingErrorCode | string } | undefined)?.code
}

/** `GET /meetings/:id/minutes` — el `404` (aún no hay acta) se trata aparte,
 * en `loadMinutes()`: aquí solo llegan los fallos reales. */
function describeLoadError(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    if (status === 403) return 'No tienes permiso para consultar el acta de esta reunión.'
    if (status !== undefined && status >= 500) return SERVER_ERROR_MESSAGE
    if (!err.response) return NETWORK_ERROR_MESSAGE
  }
  return 'No se ha podido consultar el acta de la reunión.'
}

/** Códigos propios del `POST` (`MEETING_NOT_CLOSED` y
 * `MEETING_MINUTES_ALREADY_EXPORTED` se resuelven antes, como desenlaces
 * distintos, y no llegan aquí). Los `409`/`503` de conexión con Drive
 * comparten mensaje con el gestor documental. */
function describeExportError(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const connection = describeDriveConnectionError(status, errorCodeOf(err))
    if (connection) return connection.message
    if (status === 403) return 'Solo un administrador puede exportar el acta.'
    if (status === 404) return 'La reunión ya no existe.'
    if (status !== undefined && status >= 500) return SERVER_ERROR_MESSAGE
    if (!err.response) return NETWORK_ERROR_MESSAGE
  }
  return 'No se ha podido exportar el acta.'
}

function describeDownloadError(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const code = errorCodeOf(err)
    const connection = describeDriveConnectionError(status, code)
    if (connection) return connection.message
    if (code === 'MEETING_MINUTES_FILE_UNAVAILABLE') {
      return 'El archivo del acta ya no está disponible dentro del espacio gestionado de Drive.'
    }
    if (status === 404) {
      return 'El acta ya no está disponible en Drive. Puede haberse movido o enviado a la papelera.'
    }
    if (status !== undefined && status >= 500) return SERVER_ERROR_MESSAGE
    if (!err.response) return NETWORK_ERROR_MESSAGE
  }
  return 'No se ha podido descargar el acta.'
}

function describeMinutesFileError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const code = errorCodeOf(err)
    const connection = describeDriveConnectionError(status, code)
    if (connection) return connection.message
    if (code === 'MEETING_MINUTES_FILE_UNAVAILABLE') {
      return 'El archivo del acta ya no está disponible dentro del espacio gestionado de Drive.'
    }
    if (code === 'MEETING_MINUTES_FILE_INVALID') {
      return 'El archivo vinculado al acta ya no es un PDF reemplazable.'
    }
    if (code === 'DRIVE_VERSION_NOT_FOUND') {
      return 'Esta versión ya no existe. Recarga el historial para verlo actualizado.'
    }
    if (code === 'DRIVE_VERSION_KEEP_FOREVER_LIMIT') {
      return 'El acta ya tiene el máximo de versiones protegidas permitido por Google Drive.'
    }
    if (status === 403) return 'Solo un administrador puede realizar esta acción.'
    if (status !== undefined && status >= 500) return SERVER_ERROR_MESSAGE
    if (!err.response) return NETWORK_ERROR_MESSAGE
  }
  return fallback
}

/**
 * Acta exportada de una reunión (fase 3.4), dueño exclusivo de su propio
 * ciclo de vida — independiente de `useMeetingsStore`, con la misma
 * disciplina de sesión que los stores de puntos y asistentes: `open(id)` y
 * `close()` delimitan una sesión (`sessionId`), abrir invalida cualquier
 * petición en vuelo de una anterior, y toda respuesta comprueba la sesión
 * vigente antes de escribir nada.
 *
 * Tres estados de "qué hay": cargando (`isLoading`), con acta (`minutes`) o
 * sin ella (`isLoaded` con `minutes === null` — el `404` de "todavía no se
 * ha exportado", que no es un error). Exportar y descargar se bloquean
 * entre sí: solo una a la vez.
 */
export const useMeetingMinutesStore = defineStore('meeting-minutes', () => {
  const meetingId = ref<string | null>(null)
  const minutes = ref<MeetingMinutes | null>(null)
  // `true` en cuanto se sabe si hay acta o no (con o sin ella); distingue "no
  // hay acta" de "todavía no se ha preguntado".
  const isLoaded = ref(false)

  const isLoading = ref(false)
  const loadError = ref('')

  const isExporting = ref(false)
  const exportError = ref('')

  const isDownloading = ref(false)
  const downloadError = ref('')

  const isRegenerating = ref(false)
  const regenerateError = ref('')

  const versions = ref<DriveFileVersion[]>([])
  const isLoadingVersions = ref(false)
  const versionsLoadError = ref('')
  const downloadingVersionId = ref<string | null>(null)
  const versionDownloadError = ref('')
  const restoringVersionId = ref<string | null>(null)
  const restoreError = ref('')
  const updatingKeepForeverVersionId = ref<string | null>(null)
  const keepForeverError = ref('')

  // Se incrementa en cada open()/close() — ver el comentario de clase.
  let sessionId = 0

  function isMutating(): boolean {
    return (
      isExporting.value ||
      isDownloading.value ||
      isRegenerating.value ||
      downloadingVersionId.value !== null ||
      restoringVersionId.value !== null ||
      updatingKeepForeverVersionId.value !== null
    )
  }

  /** Carga (o recarga) el acta del `meetingId` vigente. Un `404` significa
   * "todavía sin acta", no un fallo. Un fallo real nunca toca `minutes` — lo
   * que hubiera antes permanece junto con `loadError`. */
  async function loadMinutes() {
    const id = meetingId.value
    if (!id) return

    const session = sessionId
    isLoading.value = true
    loadError.value = ''

    try {
      const loaded = await meetingsService.getMinutes(id)
      if (session !== sessionId) return
      minutes.value = loaded
      isLoaded.value = true
    } catch (err) {
      if (session !== sessionId) return
      if (isAxiosError(err) && err.response?.status === 404) {
        minutes.value = null
        isLoaded.value = true
      } else {
        loadError.value = describeLoadError(err)
      }
    } finally {
      if (session === sessionId) isLoading.value = false
    }
  }

  /** Abre el acta de `id` desde cero: invalida cualquier sesión anterior y
   * pide la primera carga. */
  async function open(id: string) {
    close()
    meetingId.value = id
    await loadMinutes()
  }

  function retry() {
    if (isLoading.value) return
    if (!loadError.value) return
    loadMinutes()
  }

  function resetExportState() {
    exportError.value = ''
  }

  function resetDownloadState() {
    downloadError.value = ''
  }

  function resetRegenerateState() {
    regenerateError.value = ''
  }

  /**
   * Genera el acta y la guarda en Drive (`POST /meetings/:id/minutes`). Ver
   * `MinutesExportOutcome`. Un `409 MEETING_MINUTES_ALREADY_EXPORTED` no se
   * trata como fallo: se recarga el acta que ya existe para mostrarla. Un
   * `409 MEETING_NOT_CLOSED` deja el mensaje en `exportError` y devuelve
   * `'not-closed'` para que la vista relea la reunión.
   */
  async function exportMinutes(): Promise<MinutesExportOutcome> {
    const id = meetingId.value
    if (!id) return 'blocked'
    if (isMutating()) return 'blocked'

    const session = sessionId
    isExporting.value = true
    exportError.value = ''

    try {
      const exported = await meetingsService.exportMinutes(id)
      if (session !== sessionId) return 'blocked'
      minutes.value = exported
      isLoaded.value = true
      return 'success'
    } catch (err) {
      if (session !== sessionId) return 'blocked'

      const status = isAxiosError(err) ? err.response?.status : undefined
      const code = errorCodeOf(err)

      if (status === 409 && code === 'MEETING_MINUTES_ALREADY_EXPORTED') {
        // No es un fallo: alguien la exportó antes. Se trae la que existe.
        await loadMinutes()
        return 'already-exported'
      }
      if (status === 409 && code === 'MEETING_NOT_CLOSED') {
        exportError.value =
          'La reunión ya no está cerrada, así que no se puede exportar el acta. Se ha actualizado su estado.'
        return 'not-closed'
      }
      exportError.value = describeExportError(err)
      return 'error'
    } finally {
      if (session === sessionId) isExporting.value = false
    }
  }

  /** Pide el PDF por la API autenticada. Devuelve el blob y el nombre con el
   * que guardarlo (el que envía el backend, o el registrado si falta), o
   * `null` si falla o hay otra operación en curso; el error queda en
   * `downloadError`. El efecto DOM (crear el enlace de descarga) lo hace
   * quien llama, con `saveBlobAsFile`. */
  async function downloadMinutes(): Promise<{ blob: Blob; fileName: string } | null> {
    const id = meetingId.value
    const current = minutes.value
    if (!id || !current) return null
    if (isMutating()) return null

    const session = sessionId
    isDownloading.value = true
    downloadError.value = ''

    try {
      const result = await meetingsService.downloadMinutes(id)
      if (session !== sessionId) return null
      return { blob: result.blob, fileName: result.fileName ?? current.fileName }
    } catch (err) {
      if (session !== sessionId) return null
      downloadError.value = describeDownloadError(err)
      return null
    } finally {
      if (session === sessionId) isDownloading.value = false
    }
  }

  async function regenerateMinutes(): Promise<MinutesRegenerateOutcome> {
    const id = meetingId.value
    if (!id || !minutes.value || isMutating()) return 'blocked'

    const session = sessionId
    isRegenerating.value = true
    regenerateError.value = ''
    try {
      const regenerated = await meetingsService.regenerateMinutes(id)
      if (session !== sessionId) return 'blocked'
      minutes.value = regenerated
      versions.value = []
      return 'success'
    } catch (err) {
      if (session !== sessionId) return 'blocked'
      const code = errorCodeOf(err)
      if (code === 'MEETING_NOT_CLOSED') {
        regenerateError.value = 'La reunión ya no está cerrada. Se ha actualizado su estado.'
        return 'not-closed'
      }
      if (code === 'MEETING_MINUTES_NOT_EXPORTED') {
        minutes.value = null
        isLoaded.value = true
        regenerateError.value = 'El acta ya no figura como exportada.'
        return 'not-exported'
      }
      regenerateError.value = describeMinutesFileError(err, 'No se ha podido regenerar el acta.')
      if (code === 'MEETING_MINUTES_FILE_UNAVAILABLE') return 'unavailable'
      if (code === 'MEETING_MINUTES_FILE_INVALID') return 'invalid'
      return 'error'
    } finally {
      if (session === sessionId) isRegenerating.value = false
    }
  }

  async function loadVersions(): Promise<boolean> {
    const id = meetingId.value
    if (!id || !minutes.value || isLoadingVersions.value || isMutating()) return false
    const session = sessionId
    isLoadingVersions.value = true
    versionsLoadError.value = ''
    try {
      const page = await meetingsService.listMinutesVersions(id)
      if (session !== sessionId) return false
      versions.value = page.versions
      return true
    } catch (err) {
      if (session !== sessionId) return false
      versionsLoadError.value = describeMinutesFileError(
        err,
        'No se ha podido cargar el historial de versiones.',
      )
      return false
    } finally {
      if (session === sessionId) isLoadingVersions.value = false
    }
  }

  async function downloadVersion(
    versionId: string,
  ): Promise<{ blob: Blob; fileName: string } | null> {
    const id = meetingId.value
    const current = minutes.value
    if (!id || !current || isMutating()) return null
    const session = sessionId
    downloadingVersionId.value = versionId
    versionDownloadError.value = ''
    try {
      const result = await meetingsService.downloadMinutesVersion(id, versionId)
      if (session !== sessionId) return null
      const version = versions.value.find((candidate) => candidate.id === versionId)
      const fallbackName = sanitizeFileName(version?.originalFilename || current.fileName)
      return { blob: result.blob, fileName: result.fileName ?? fallbackName }
    } catch (err) {
      if (session !== sessionId) return null
      versionDownloadError.value = describeMinutesFileError(
        err,
        'No se ha podido descargar esta versión.',
      )
      return null
    } finally {
      if (session === sessionId) downloadingVersionId.value = null
    }
  }

  async function restoreVersion(versionId: string): Promise<DriveItem | null> {
    const id = meetingId.value
    if (!id || !minutes.value || isMutating()) return null
    const session = sessionId
    restoringVersionId.value = versionId
    restoreError.value = ''
    try {
      const restored = await meetingsService.restoreMinutesVersion(id, versionId)
      if (session !== sessionId) return null
      await loadVersionsAfterMutation(session, id)
      return restored
    } catch (err) {
      if (session !== sessionId) return null
      restoreError.value = describeMinutesFileError(err, 'No se ha podido restaurar esta versión.')
      return null
    } finally {
      if (session === sessionId) restoringVersionId.value = null
    }
  }

  async function updateKeepForever(versionId: string, keepForever: boolean): Promise<boolean> {
    const id = meetingId.value
    if (!id || !minutes.value || isMutating()) return false
    const session = sessionId
    updatingKeepForeverVersionId.value = versionId
    keepForeverError.value = ''
    try {
      const updated = await meetingsService.updateMinutesVersion(id, versionId, keepForever)
      if (session !== sessionId) return false
      versions.value = versions.value.map((version) =>
        version.id === updated.id ? updated : version,
      )
      return true
    } catch (err) {
      if (session !== sessionId) return false
      keepForeverError.value = describeMinutesFileError(
        err,
        'No se ha podido cambiar la protección de esta versión.',
      )
      return false
    } finally {
      if (session === sessionId) updatingKeepForeverVersionId.value = null
    }
  }

  async function loadVersionsAfterMutation(session: number, id: string) {
    try {
      const page = await meetingsService.listMinutesVersions(id)
      if (session === sessionId) versions.value = page.versions
    } catch {
      if (session === sessionId) {
        versionsLoadError.value = 'La versión se restauró, pero no se pudo actualizar el historial.'
      }
    }
  }

  function clearVersions() {
    versions.value = []
    versionsLoadError.value = ''
    versionDownloadError.value = ''
    restoreError.value = ''
    keepForeverError.value = ''
  }

  /** Invalida de inmediato cualquier petición en vuelo (incrementa
   * `sessionId` antes de tocar nada más) y repone todo el estado a su valor
   * neutro — llamada desde `open()` y desde el cambio de id/`onUnmounted` de
   * `MeetingDetailView`. */
  function close() {
    sessionId++
    meetingId.value = null
    minutes.value = null
    isLoaded.value = false
    isLoading.value = false
    loadError.value = ''
    isExporting.value = false
    exportError.value = ''
    isDownloading.value = false
    downloadError.value = ''
    isRegenerating.value = false
    regenerateError.value = ''
    versions.value = []
    isLoadingVersions.value = false
    versionsLoadError.value = ''
    downloadingVersionId.value = null
    versionDownloadError.value = ''
    restoringVersionId.value = null
    restoreError.value = ''
    updatingKeepForeverVersionId.value = null
    keepForeverError.value = ''
  }

  return {
    meetingId,
    minutes,
    isLoaded,
    isLoading,
    loadError,
    isExporting,
    exportError,
    isDownloading,
    downloadError,
    isRegenerating,
    regenerateError,
    versions,
    isLoadingVersions,
    versionsLoadError,
    downloadingVersionId,
    versionDownloadError,
    restoringVersionId,
    restoreError,
    updatingKeepForeverVersionId,
    keepForeverError,
    open,
    retry,
    exportMinutes,
    downloadMinutes,
    regenerateMinutes,
    loadVersions,
    downloadVersion,
    restoreVersion,
    updateKeepForever,
    clearVersions,
    resetExportState,
    resetDownloadState,
    resetRegenerateState,
    close,
  }
})
