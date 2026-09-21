import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { isAxiosError } from 'axios'
import {
  meetingsService,
  type CreateMeetingPointPayload,
  type UpdateMeetingPointPayload,
} from '@/services/meetings.service'
import type { MeetingErrorCode, MeetingPoint } from '@/types'

/** `409 MEETING_NOT_EDITABLE` es común a las cuatro mutaciones (crear,
 * editar, eliminar, reordenar): la reunión ya no está en `draft`/`held`.
 * `null` si el error no es ese caso, para que cada `describe*Error` pueda
 * añadir encima sus propios códigos (400/403/404) sin repetir esta
 * comprobación. */
function describeMeetingNotEditable(err: unknown): string | null {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const code = (err.response?.data as { code?: MeetingErrorCode } | undefined)?.code
    if (status === 409 && code === 'MEETING_NOT_EDITABLE') {
      return 'La reunión está cerrada y sus puntos ya no admiten cambios.'
    }
  }
  return null
}

/** `GET /meetings/:id/points` — cualquier usuario autenticado puede
 * consultar los puntos, así que aquí no hay 400 propio ni
 * `MEETING_NOT_EDITABLE` (la lectura no depende del estado de la reunión). */
function describeLoadPointsError(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    if (status === 403) {
      return 'No tienes permiso para consultar los puntos de esta reunión.'
    }
    if (status === 404) {
      return 'La reunión ya no existe.'
    }
    if (status !== undefined && status >= 500) {
      return 'Ha ocurrido un problema temporal en el servidor. Inténtalo de nuevo en unos segundos.'
    }
    if (!err.response) {
      return 'No se ha podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.'
    }
  }
  return 'No se han podido cargar los puntos de la reunión.'
}

/** Compartida por crear, editar y eliminar — los tres códigos de estado son
 * los mismos, solo cambia el mensaje de fallback cuando no hay nada más
 * específico que decir. */
function describePointMutationError(err: unknown, fallback: string): string {
  const notEditable = describeMeetingNotEditable(err)
  if (notEditable) return notEditable

  if (isAxiosError(err)) {
    const status = err.response?.status
    if (status === 400) {
      return 'Los datos del punto no son válidos.'
    }
    if (status === 403) {
      return 'No tienes permiso para modificar los puntos de esta reunión.'
    }
    if (status === 404) {
      return 'La reunión o el punto ya no está disponible.'
    }
    if (status !== undefined && status >= 500) {
      return 'Ha ocurrido un problema temporal en el servidor. Inténtalo de nuevo en unos segundos.'
    }
    if (!err.response) {
      return 'No se ha podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.'
    }
  }
  return fallback
}

/** Igual que `describePointMutationError`, con el 400 propio de
 * `pointIds` inválido (orden incompleto, duplicado o ajeno) y sin 404 de
 * punto individual (la reordenación opera sobre el conjunto completo). */
function describeReorderError(err: unknown): string {
  const notEditable = describeMeetingNotEditable(err)
  if (notEditable) return notEditable

  if (isAxiosError(err)) {
    const status = err.response?.status
    if (status === 400) {
      return 'El orden de los puntos no es válido.'
    }
    if (status === 403) {
      return 'No tienes permiso para reordenar los puntos de esta reunión.'
    }
    if (status === 404) {
      return 'La reunión ya no existe.'
    }
    if (status !== undefined && status >= 500) {
      return 'Ha ocurrido un problema temporal en el servidor. Inténtalo de nuevo en unos segundos.'
    }
    if (!err.response) {
      return 'No se ha podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.'
    }
  }
  return 'No se han podido reordenar los puntos.'
}

function sortByPosition(list: MeetingPoint[]): MeetingPoint[] {
  return [...list].sort((a, b) => a.position - b.position)
}

/** Renumera `1..N` en el orden en que ya vienen los puntos (se asume que
 * `list` ya está ordenada por `position`, invariante que mantiene todo el
 * resto del store), sin alterar ese orden relativo — solo el valor de
 * `position`. La usa `deletePoint()` para compactar localmente en cuanto el
 * backend confirma el borrado, antes de que llegue la recarga que trae las
 * posiciones reales; nunca sustituye a esa recarga, solo evita huecos
 * (`1, 2, 4, 5`) mientras tanto. Devuelve objetos nuevos solo para los
 * puntos cuya posición realmente cambia, para no invalidar por referencia
 * los que ya estaban bien. */
function compactPositions(list: MeetingPoint[]): MeetingPoint[] {
  return list.map((point, index) => {
    const position = index + 1
    return point.position === position ? point : { ...point, position }
  })
}

/**
 * Puntos de una reunión (fase 3.2), dueño exclusivo de su propio ciclo de
 * vida — deliberadamente independiente de `useMeetingsStore`, igual que
 * `useDriveVersionsStore` lo es de `useDriveDocumentsStore`. `open(meetingId)`
 * y `close()` delimitan una "sesión" (`sessionId`): abrir invalida
 * cualquier petición en vuelo de una sesión anterior, y toda respuesta
 * comprueba la sesión vigente antes de escribir nada, así un `finally`
 * obsoleto nunca limpia un flag que ya pertenece a una sesión nueva.
 *
 * Las cuatro mutaciones (crear, editar, eliminar, reordenar) se bloquean
 * entre sí mediante `isMutating()`: solo una puede estar en curso a la vez,
 * cualquiera que sea su tipo.
 */
export const useMeetingPointsStore = defineStore('meeting-points', () => {
  const meetingId = ref<string | null>(null)
  const points = ref<MeetingPoint[]>([])

  const isLoading = ref(false)
  const loadError = ref('')

  const isCreating = ref(false)
  const createError = ref('')

  const updatingPointId = ref<string | null>(null)
  const updateError = ref('')

  const deletingPointId = ref<string | null>(null)
  const deleteError = ref('')

  const isReordering = ref(false)
  const reorderError = ref('')

  // Se incrementa en cada open()/close() — ver el comentario de clase.
  let sessionId = 0

  function isMutating(): boolean {
    return (
      isCreating.value ||
      updatingPointId.value !== null ||
      deletingPointId.value !== null ||
      isReordering.value
    )
  }

  /** Versión reactiva de `isMutating()`, para que la vista pueda deshabilitar
   * acciones (p. ej. abrir la revisión previa al cierre) mientras haya una
   * mutación de puntos en vuelo. */
  const isBusy = computed(isMutating)

  /** Carga (o recarga) el listado completo de puntos del `meetingId`
   * vigente. La usan `open()`, `retry()` y la recarga posterior a un
   * borrado con éxito. Un fallo nunca toca `points` — el listado anterior
   * permanece visible junto con `loadError`. Devuelve `true` solo si la
   * carga terminó bien y la sesión seguía vigente. */
  async function loadPoints(): Promise<boolean> {
    const id = meetingId.value
    if (!id) return false

    const session = sessionId
    isLoading.value = true
    loadError.value = ''

    try {
      const loaded = await meetingsService.listMeetingPoints(id)
      if (session !== sessionId) return false
      points.value = sortByPosition(loaded)
      return true
    } catch (err) {
      if (session !== sessionId) return false
      loadError.value = describeLoadPointsError(err)
      return false
    } finally {
      if (session === sessionId) isLoading.value = false
    }
  }

  /** Recarga los puntos de la sesión vigente sin vaciar el listado (a
   * diferencia de `open()`), para la revisión previa al cierre de la
   * reunión. `false` si hubo un fallo, si la sesión cambió mientras cargaba
   * o si hay una mutación en curso (sus datos aún no son definitivos). */
  function refresh(): Promise<boolean> {
    if (isMutating()) return Promise.resolve(false)
    return loadPoints()
  }

  /** Abre los puntos de `id` desde cero: invalida cualquier sesión anterior
   * (otra reunión, errores previos, cualquier mutación que siguiera en
   * vuelo) y pide la primera carga. */
  async function open(id: string) {
    close()
    meetingId.value = id
    await loadPoints()
  }

  function retry() {
    if (isLoading.value) return
    if (!loadError.value) return
    loadPoints()
  }

  function resetCreateState() {
    createError.value = ''
  }

  function resetUpdateState() {
    updateError.value = ''
  }

  function resetDeleteState() {
    deleteError.value = ''
  }

  /** Crea un punto y lo añade (o lo sustituye si por lo que sea ya existía
   * con ese id) conservando el orden por `position` — el backend siempre
   * asigna la posición siguiente, así que en la práctica esto es un
   * `append`, pero ordenar de nuevo es más robusto que asumirlo. `null` si
   * hay otra mutación en curso o si la creación falla; el error queda en
   * `createError`. */
  async function createPoint(payload: CreateMeetingPointPayload): Promise<MeetingPoint | null> {
    const id = meetingId.value
    if (!id) return null
    if (isMutating()) return null

    const session = sessionId
    isCreating.value = true
    createError.value = ''

    try {
      const created = await meetingsService.createMeetingPoint(id, payload)
      if (session !== sessionId) return null
      const withoutExisting = points.value.filter((point) => point.id !== created.id)
      points.value = sortByPosition([...withoutExisting, created])
      return created
    } catch (err) {
      if (session !== sessionId) return null
      createError.value = describePointMutationError(err, 'No se ha podido añadir el punto.')
      return null
    } finally {
      if (session === sessionId) isCreating.value = false
    }
  }

  /** Edita `pointId` y lo sustituye por id dentro de `points`, sin tocar el
   * orden (una edición nunca cambia `position`). `null` si hay otra
   * mutación en curso, si `pointId` ya no está en el listado local al
   * recibir la respuesta, o si la edición falla. */
  async function updatePoint(
    pointId: string,
    payload: UpdateMeetingPointPayload,
  ): Promise<MeetingPoint | null> {
    const id = meetingId.value
    if (!id) return null
    if (isMutating()) return null

    const session = sessionId
    updatingPointId.value = pointId
    updateError.value = ''

    try {
      const updated = await meetingsService.updateMeetingPoint(id, pointId, payload)
      if (session !== sessionId) return null
      const index = points.value.findIndex((point) => point.id === pointId)
      if (index !== -1) {
        points.value = [
          ...points.value.slice(0, index),
          updated,
          ...points.value.slice(index + 1),
        ]
      }
      return updated
    } catch (err) {
      if (session !== sessionId) return null
      updateError.value = describePointMutationError(err, 'No se ha podido actualizar el punto.')
      return null
    } finally {
      if (session === sessionId) updatingPointId.value = null
    }
  }

  /**
   * Elimina `pointId` y, si el backend lo acepta (y la sesión sigue siendo
   * la misma), lo retira de inmediato de `points` y compacta localmente las
   * posiciones restantes (`compactPositions`) para que la lista nunca
   * muestre huecos (`1, 2, 4, 5`) mientras se confirma con el backend —
   * nunca antes de que el `DELETE` haya tenido éxito. A continuación
   * recarga el listado completo, que sigue siendo la autoridad real y
   * sustituye esta compactación provisional por las posiciones que
   * confirme el backend. Un fallo de esa recarga no deshace el éxito del
   * borrado (ya ocurrió, y la lista ya quedó compactada localmente): queda
   * escrito en `loadError` por `loadPoints()`, nunca en `deleteError` — esta
   * función sigue devolviendo `true`. Solo devuelve `false` si hay otra
   * mutación en curso o si el propio `DELETE` falla.
   */
  async function deletePoint(pointId: string): Promise<boolean> {
    const id = meetingId.value
    if (!id) return false
    if (isMutating()) return false

    const session = sessionId
    deletingPointId.value = pointId
    deleteError.value = ''

    try {
      await meetingsService.deleteMeetingPoint(id, pointId)
      if (session !== sessionId) return false

      points.value = compactPositions(points.value.filter((point) => point.id !== pointId))
      await loadPoints()
      return true
    } catch (err) {
      if (session !== sessionId) return false
      deleteError.value = describePointMutationError(err, 'No se ha podido eliminar el punto.')
      return false
    } finally {
      if (session === sessionId) deletingPointId.value = null
    }
  }

  /** Envía siempre el conjunto completo de ids en el nuevo orden y, si el
   * backend lo acepta, sustituye `points` directamente por la lista que
   * devuelve (ya reordenada) — nunca una reordenación optimista que
   * pudiera quedar desincronizada. Un fallo conserva el orden anterior. */
  async function reorder(pointIds: string[]): Promise<boolean> {
    const id = meetingId.value
    if (!id) return false
    if (isMutating()) return false

    const session = sessionId
    isReordering.value = true
    reorderError.value = ''

    try {
      const reordered = await meetingsService.reorderMeetingPoints(id, pointIds)
      if (session !== sessionId) return false
      points.value = reordered
      return true
    } catch (err) {
      if (session !== sessionId) return false
      reorderError.value = describeReorderError(err)
      return false
    } finally {
      if (session === sessionId) isReordering.value = false
    }
  }

  /** Construye el array completo de ids intercambiando `pointId` con el
   * anterior y llama a `reorder()` una sola vez. No hace nada si `pointId`
   * ya es el primero. */
  function movePointUp(pointId: string): Promise<boolean> {
    const index = points.value.findIndex((point) => point.id === pointId)
    if (index <= 0) return Promise.resolve(false)

    const ids = points.value.map((point) => point.id)
    ;[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]
    return reorder(ids)
  }

  /** Igual que `movePointUp`, intercambiando con el siguiente. No hace nada
   * si `pointId` ya es el último. */
  function movePointDown(pointId: string): Promise<boolean> {
    const index = points.value.findIndex((point) => point.id === pointId)
    if (index === -1 || index >= points.value.length - 1) return Promise.resolve(false)

    const ids = points.value.map((point) => point.id)
    ;[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]
    return reorder(ids)
  }

  /** Invalida de inmediato cualquier petición en vuelo (incrementa
   * `sessionId` antes de tocar nada más) y repone todo el estado a su
   * valor neutro — llamada desde `open()` y desde el `onUnmounted`/cambio
   * de id de `MeetingDetailView`. */
  function close() {
    sessionId++
    meetingId.value = null
    points.value = []
    isLoading.value = false
    loadError.value = ''
    isCreating.value = false
    createError.value = ''
    updatingPointId.value = null
    updateError.value = ''
    deletingPointId.value = null
    deleteError.value = ''
    isReordering.value = false
    reorderError.value = ''
  }

  return {
    meetingId,
    points,
    isLoading,
    loadError,
    isCreating,
    createError,
    updatingPointId,
    updateError,
    deletingPointId,
    deleteError,
    isReordering,
    reorderError,
    isBusy,
    open,
    retry,
    refresh,
    createPoint,
    updatePoint,
    deletePoint,
    movePointUp,
    movePointDown,
    resetCreateState,
    resetUpdateState,
    resetDeleteState,
    close,
  }
})
