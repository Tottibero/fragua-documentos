import { ref } from 'vue'
import { defineStore } from 'pinia'
import { isAxiosError } from 'axios'
import { driveDocumentsService } from '@/services/drive-documents.service'
import type { DriveRestoreResult, DriveTrashItem } from '@/types'

/** Mismos mensajes de conexión que el resto de flujos documentales (409/503
 * son sobre la conexión con Google Drive en sí, no sobre listar o restaurar
 * en particular) — duplicados aquí a propósito, igual que ya hace
 * `drive-versions.ts`: cada store documental es dueño de sus propios
 * mensajes, nunca se distinguen por texto fuera de este punto. */
function describeTrashConnectionError(
  status: number | undefined,
  code: string | undefined,
): string | null {
  if (status === 409 && code === 'DRIVE_NOT_CONNECTED') {
    return 'Google Drive no está conectado. Pide a un superadmin que lo conecte desde Ajustes.'
  }
  if (status === 409 && code === 'DRIVE_RECONNECT_REQUIRED') {
    return 'La conexión con Google Drive necesita reconectarse. Pide a un superadmin que la restablezca desde Ajustes.'
  }
  if (status === 503) {
    return 'Google Drive no está disponible en este momento. Es un problema temporal — inténtalo de nuevo en unos segundos.'
  }
  return null
}

/** `GET /drive/trash` no recibe ningún id concreto que pueda faltar — solo
 * la conexión con Drive puede fallar aquí. */
function describeLoadTrashError(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const code = (err.response?.data as { code?: string } | undefined)?.code
    const connectionError = describeTrashConnectionError(status, code)
    if (connectionError) return connectionError
  }
  return 'No se ha podido cargar la papelera.'
}

/** Añade, sobre los mensajes de conexión, los propios de
 * `POST /drive/items/:id/restore`: `DRIVE_RESTORE_NOT_CONFIRMED` (502 —
 * Google no confirmó la restauración, así que puede no haberse completado)
 * y 404 (el elemento ya no está disponible en la papelera — se eliminó
 * definitivamente desde Drive, o ya se había restaurado). */
function describeRestoreError(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const code = (err.response?.data as { code?: string } | undefined)?.code
    const connectionError = describeTrashConnectionError(status, code)
    if (connectionError) return connectionError
    if (code === 'DRIVE_RESTORE_NOT_CONFIRMED') {
      return 'Google no ha confirmado la restauración. Puede que no se haya completado — inténtalo de nuevo.'
    }
    if (status === 404) {
      return 'Este elemento ya no está disponible en la papelera.'
    }
  }
  return 'No se ha podido restaurar el elemento.'
}

/**
 * Papelera (fase 2.5), deliberadamente separada de `useDriveDocumentsStore`:
 * a diferencia del listado principal no hay navegación por carpetas — es una
 * única lista plana, paginada, de los elementos eliminados dentro del
 * espacio gestionado. Dueño exclusivo de esa lista y del estado de
 * restaurar un elemento.
 */
export const useDriveTrashStore = defineStore('drive-trash', () => {
  const items = ref<DriveTrashItem[]>([])
  const nextPageToken = ref<string | null>(null)

  const isLoading = ref(false)
  const loadError = ref('')

  const isLoadingMore = ref(false)
  const loadMoreError = ref('')

  const restoringItemId = ref<string | null>(null)
  const restoreError = ref('')

  // Se incrementa en cada `load()` (carga inicial, o recarga al reintentar)
  // y en `close()`. Tanto esa petición como cualquier `loadMore()`/
  // `restoreItem()` que siguiera en vuelo capturan el valor vigente al
  // empezar; si al resolver ya no coincide, el resultado se descarta sin
  // tocar el estado — así una respuesta tardía nunca puede escribir sobre
  // una sesión posterior.
  let requestSeq = 0

  /**
   * Invalida de inmediato cualquier `load()`/`loadMore()`/`restoreItem()`
   * que siguiera en vuelo — llamada desde el `onUnmounted` de `TrashView`,
   * nunca desde una recarga interna. Incrementa `requestSeq` primero: así,
   * cuando esa petición resuelva más tarde, su comprobación de sesión la
   * descartará sin retirar elementos, sin escribir ningún error y sin que
   * el llamador (ya desmontado) llegue a publicar un toast a partir de su
   * resultado. Como esas peticiones invalidadas ya no van a limpiar sus
   * propios flags en su `finally` (la comprobación de sesión se lo impide),
   * este método los repone aquí mismo a su estado neutro — si no, un
   * `restoringItemId` o un `isLoadingMore` abandonados dejarían acciones
   * bloqueadas sin motivo la próxima vez que se entre en `/trash`. `items`
   * y `nextPageToken` no se tocan: no son estado transitorio de una
   * petición en curso, y `load()` los sustituye igualmente en la siguiente
   * entrada a la vista.
   */
  function close() {
    requestSeq++
    isLoading.value = false
    loadError.value = ''
    isLoadingMore.value = false
    loadMoreError.value = ''
    restoringItemId.value = null
    restoreError.value = ''
  }

  /**
   * Carga (o recarga) la primera página desde cero — sustituye cualquier
   * listado anterior. Sirve tanto para la carga inicial como para
   * `retry()`.
   *
   * No depende de que el diálogo de restauración sea modal para protegerse:
   * si hay una restauración vigente de esta misma sesión (`restoringItemId`),
   * el guard sale sin incrementar `requestSeq` ni tocar ningún flag —
   * interrumpirla a mitad con una recarga completa dejaría su resultado sin
   * poder aplicarse nunca sobre el listado que la sustituye. Sí puede (a
   * propósito) invalidar un `loadMore()` en vuelo, más abajo. Tras `close()`
   * `restoringItemId` ya está a `null`, así que `load()` puede arrancar con
   * normalidad al volver a entrar en la vista.
   */
  async function load() {
    if (restoringItemId.value !== null) return

    const requestId = ++requestSeq
    isLoading.value = true
    loadError.value = ''
    items.value = []
    nextPageToken.value = null
    // Cualquier "cargar más" en curso pertenece a la carga que se abandona:
    // se descarta ya, para no dejar el botón bloqueado sobre el listado
    // nuevo.
    isLoadingMore.value = false
    loadMoreError.value = ''

    try {
      const page = await driveDocumentsService.listTrash({})
      if (requestId !== requestSeq) return
      items.value = page.items
      nextPageToken.value = page.nextPageToken
    } catch (err) {
      if (requestId !== requestSeq) return
      loadError.value = describeLoadTrashError(err)
    } finally {
      if (requestId === requestSeq) isLoading.value = false
    }
  }

  function retry() {
    if (isLoading.value) return
    load()
  }

  /**
   * Pagina el listado ya cargado: anexa resultados sin sustituir los ya
   * mostrados. Un fallo aquí nunca borra lo que ya se había cargado con
   * éxito — solo se refleja en `loadMoreError`, con su propio reintento
   * (reintentar "cargar más" vuelve a llamar a esta misma función).
   *
   * Se niega a arrancar mientras haya una carga completa, otra paginación o
   * una restauración en curso — este guard no depende de que el diálogo de
   * restauración sea modal, es la propia condición de carrera la que se
   * comprueba aquí. Sale antes de tocar `requestSeq` o cualquier flag.
   */
  async function loadMore() {
    if (isLoading.value || isLoadingMore.value || restoringItemId.value !== null) return
    if (!nextPageToken.value) return

    const requestId = ++requestSeq
    const pageToken = nextPageToken.value
    isLoadingMore.value = true
    loadMoreError.value = ''

    try {
      const page = await driveDocumentsService.listTrash({ pageToken })
      if (requestId !== requestSeq) return
      items.value = [...items.value, ...page.items]
      nextPageToken.value = page.nextPageToken
    } catch (err) {
      if (requestId !== requestSeq) return
      loadMoreError.value = describeLoadTrashError(err)
    } finally {
      if (requestId === requestSeq) isLoadingMore.value = false
    }
  }

  /** Limpia el error de un intento de restauración anterior — llamada al
   * abrir el diálogo, para no arrastrar el mensaje de un intento previo. */
  function resetRestoreState() {
    restoreError.value = ''
  }

  /**
   * Restaura `item` desde la papelera y devuelve el resultado del backend
   * (incluido `restoredToRoot`, que decide el mensaje de éxito) al llamador;
   * `null` si está bloqueada por una carga completa, una paginación o una
   * restauración ya en curso (solo se permite una operación a la vez — este
   * guard no depende de que el diálogo de restauración sea modal, es la
   * propia condición de carrera la que se comprueba aquí) o si la
   * restauración falló (el diálogo permanece abierto mostrando
   * `restoreError`, con el elemento seleccionado, para poder reintentar). Un
   * guard bloqueado sale antes de tocar `requestSeq`, `restoringItemId` o
   * `restoreError` — no publica nada, ni siquiera un toast, porque el
   * llamador solo actúa sobre un resultado no nulo o sobre `restoreError`.
   *
   * Al restaurarse con éxito, si el listado sigue siendo la misma sesión de
   * carga que cuando se inició (`requestSeq` capturado al empezar — la vista
   * no se abandonó ni se inició una carga nueva mientras tanto) el elemento
   * se retira de `items` por `id`, sin recargar toda la papelera ni tocar
   * `nextPageToken`. La restauración se considera un éxito en cualquier
   * caso — ya ocurrió en Drive.
   */
  async function restoreItem(item: DriveTrashItem): Promise<DriveRestoreResult | null> {
    if (isLoading.value || isLoadingMore.value || restoringItemId.value !== null) return null

    const requestId = requestSeq
    restoringItemId.value = item.id
    restoreError.value = ''

    try {
      const result = await driveDocumentsService.restoreItem(item.id)
      if (requestId === requestSeq) {
        items.value = items.value.filter((current) => current.id !== item.id)
      }
      return result
    } catch (err) {
      if (requestId === requestSeq) {
        restoreError.value = describeRestoreError(err)
      }
      return null
    } finally {
      if (requestId === requestSeq) restoringItemId.value = null
    }
  }

  return {
    items,
    nextPageToken,
    isLoading,
    loadError,
    isLoadingMore,
    loadMoreError,
    restoringItemId,
    restoreError,
    load,
    retry,
    loadMore,
    resetRestoreState,
    restoreItem,
    close,
  }
})
