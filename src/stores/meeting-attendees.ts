import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { isAxiosError } from 'axios'
import { meetingsService } from '@/services/meetings.service'
import type {
  MeetingAttendanceStatus,
  MeetingAttendee,
  MeetingAttendeeOption,
  MeetingErrorCode,
} from '@/types'

const SERVER_ERROR_MESSAGE =
  'Ha ocurrido un problema temporal en el servidor. Inténtalo de nuevo en unos segundos.'
const NETWORK_ERROR_MESSAGE =
  'No se ha podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.'

/** `409 MEETING_NOT_EDITABLE` es común a las dos mutaciones (selección y
 * cambio de estado): la reunión ya no está en `draft`/`held`. `null` si el
 * error no es ese caso, para que cada `describe*Error` añada encima sus
 * propios códigos (400/403/404) sin repetir la comprobación. */
function describeMeetingNotEditable(err: unknown): string | null {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const code = (err.response?.data as { code?: MeetingErrorCode } | undefined)?.code
    if (status === 409 && code === 'MEETING_NOT_EDITABLE') {
      return 'La reunión está cerrada y sus asistentes ya no admiten cambios.'
    }
  }
  return null
}

/** Compartida por `GET .../attendees` y `GET .../attendee-options` — la
 * lectura está abierta a cualquier usuario autenticado y no depende del
 * estado de la reunión, así que no hay 400 propio ni `MEETING_NOT_EDITABLE`. */
function describeLoadError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    if (status === 403) return 'No tienes permiso para consultar los asistentes de esta reunión.'
    if (status === 404) return 'La reunión ya no existe.'
    if (status !== undefined && status >= 500) return SERVER_ERROR_MESSAGE
    if (!err.response) return NETWORK_ERROR_MESSAGE
  }
  return fallback
}

function describeReplaceError(err: unknown): string {
  const notEditable = describeMeetingNotEditable(err)
  if (notEditable) return notEditable

  if (isAxiosError(err)) {
    const status = err.response?.status
    if (status === 400) {
      return 'Alguno de los usuarios seleccionados ya no existe o no puede asistir a reuniones. Vuelve a abrir la selección.'
    }
    if (status === 403) return 'No tienes permiso para modificar los asistentes de esta reunión.'
    if (status === 404) return 'La reunión ya no existe.'
    if (status !== undefined && status >= 500) return SERVER_ERROR_MESSAGE
    if (!err.response) return NETWORK_ERROR_MESSAGE
  }
  return 'No se han podido guardar los asistentes.'
}

function describeStatusError(err: unknown): string {
  const notEditable = describeMeetingNotEditable(err)
  if (notEditable) return notEditable

  if (isAxiosError(err)) {
    const status = err.response?.status
    if (status === 400) return 'El estado de asistencia no es válido.'
    if (status === 403) return 'No tienes permiso para modificar la asistencia de esta reunión.'
    if (status === 404) return 'La reunión o el asistente ya no está disponible.'
    if (status !== undefined && status >= 500) return SERVER_ERROR_MESSAGE
    if (!err.response) return NETWORK_ERROR_MESSAGE
  }
  return 'No se ha podido actualizar la asistencia.'
}

/**
 * Asistentes de una reunión (fase 3.3a), dueño exclusivo de su propio ciclo
 * de vida — deliberadamente independiente de `useMeetingsStore` y de
 * `useMeetingPointsStore`, con la misma disciplina de sesión que este
 * último: `open(meetingId)` y `close()` delimitan una "sesión"
 * (`sessionId`), abrir invalida cualquier petición en vuelo de una sesión
 * anterior y toda respuesta comprueba la sesión vigente antes de escribir
 * nada.
 *
 * Las dos mutaciones (reemplazar la selección y cambiar un estado) se
 * bloquean entre sí mediante `isMutating()`. Ninguna es optimista: se
 * aplica siempre lo que devuelve el backend.
 */
export const useMeetingAttendeesStore = defineStore('meeting-attendees', () => {
  const meetingId = ref<string | null>(null)
  const attendees = ref<MeetingAttendee[]>([])

  const isLoading = ref(false)
  const loadError = ref('')

  const options = ref<MeetingAttendeeOption[]>([])
  const isLoadingOptions = ref(false)
  const optionsError = ref('')

  const isReplacing = ref(false)
  const replaceError = ref('')

  const updatingUserId = ref<string | null>(null)
  const statusError = ref('')

  // Se incrementa en cada open()/close() — ver el comentario de clase.
  let sessionId = 0

  function isMutating(): boolean {
    return isReplacing.value || updatingUserId.value !== null
  }

  /** Versión reactiva de `isMutating()`, para que la vista pueda deshabilitar
   * acciones (p. ej. abrir la revisión previa al cierre) mientras haya una
   * mutación de asistentes en vuelo. */
  const isBusy = computed(isMutating)

  /** Carga (o recarga) los asistentes del `meetingId` vigente. Un fallo
   * nunca toca `attendees` — el listado anterior permanece visible junto
   * con `loadError`. Devuelve `true` solo si la carga terminó bien y la
   * sesión seguía vigente. */
  async function loadAttendees(): Promise<boolean> {
    const id = meetingId.value
    if (!id) return false

    const session = sessionId
    isLoading.value = true
    loadError.value = ''

    try {
      const loaded = await meetingsService.listAttendees(id)
      if (session !== sessionId) return false
      attendees.value = loaded
      return true
    } catch (err) {
      if (session !== sessionId) return false
      loadError.value = describeLoadError(err, 'No se han podido cargar los asistentes.')
      return false
    } finally {
      if (session === sessionId) isLoading.value = false
    }
  }

  /** Recarga los asistentes de la sesión vigente sin vaciar el listado (a
   * diferencia de `open()`), para la revisión previa al cierre de la
   * reunión. `false` si hubo un fallo, si la sesión cambió mientras cargaba
   * o si hay una mutación en curso (sus datos aún no son definitivos). */
  function refresh(): Promise<boolean> {
    if (isMutating()) return Promise.resolve(false)
    return loadAttendees()
  }

  /** Abre los asistentes de `id` desde cero: invalida cualquier sesión
   * anterior y pide la primera carga. */
  async function open(id: string) {
    close()
    meetingId.value = id
    await loadAttendees()
  }

  function retry() {
    if (isLoading.value) return
    if (!loadError.value) return
    loadAttendees()
  }

  /** Carga los candidatos elegibles. Se pide cada vez que se abre el
   * diálogo de selección (los roles pueden haber cambiado desde la última
   * vez), nunca al abrir la reunión. Un fallo deja `options` como estaba. */
  async function loadOptions() {
    const id = meetingId.value
    if (!id) return
    if (isLoadingOptions.value) return

    const session = sessionId
    isLoadingOptions.value = true
    optionsError.value = ''

    try {
      const loaded = await meetingsService.listAttendeeOptions(id)
      if (session !== sessionId) return
      options.value = loaded
    } catch (err) {
      if (session !== sessionId) return
      optionsError.value = describeLoadError(err, 'No se han podido cargar los candidatos.')
    } finally {
      if (session === sessionId) isLoadingOptions.value = false
    }
  }

  function resetReplaceState() {
    replaceError.value = ''
  }

  function resetStatusState() {
    statusError.value = ''
  }

  /** Sustituye la selección completa por `userIds` y, si el backend la
   * acepta, aplica tal cual la lista que devuelve. `null` si hay otra
   * mutación en curso o si la operación falla; el error queda en
   * `replaceError`. */
  async function replaceAttendees(userIds: string[]): Promise<MeetingAttendee[] | null> {
    const id = meetingId.value
    if (!id) return null
    if (isMutating()) return null

    const session = sessionId
    isReplacing.value = true
    replaceError.value = ''

    try {
      const replaced = await meetingsService.replaceAttendees(id, userIds)
      if (session !== sessionId) return null
      attendees.value = replaced
      return replaced
    } catch (err) {
      if (session !== sessionId) return null
      replaceError.value = describeReplaceError(err)
      return null
    } finally {
      if (session === sessionId) isReplacing.value = false
    }
  }

  /** Cambia el estado de un asistente y lo sustituye por id con la
   * respuesta, sin tocar el orden. `null` si hay otra mutación en curso, si
   * el asistente ya no está en el listado local al recibir la respuesta, o
   * si la operación falla. */
  async function setStatus(
    userId: string,
    status: MeetingAttendanceStatus,
  ): Promise<MeetingAttendee | null> {
    const id = meetingId.value
    if (!id) return null
    if (isMutating()) return null

    const session = sessionId
    updatingUserId.value = userId
    statusError.value = ''

    try {
      const updated = await meetingsService.updateAttendeeStatus(id, userId, status)
      if (session !== sessionId) return null
      const index = attendees.value.findIndex((attendee) => attendee.user.id === userId)
      if (index === -1) return null
      attendees.value = [
        ...attendees.value.slice(0, index),
        updated,
        ...attendees.value.slice(index + 1),
      ]
      return updated
    } catch (err) {
      if (session !== sessionId) return null
      statusError.value = describeStatusError(err)
      return null
    } finally {
      if (session === sessionId) updatingUserId.value = null
    }
  }

  /** Invalida de inmediato cualquier petición en vuelo (incrementa
   * `sessionId` antes de tocar nada más) y repone todo el estado a su valor
   * neutro — llamada desde `open()` y desde el cambio de id/`onUnmounted`
   * de `MeetingDetailView`. */
  function close() {
    sessionId++
    meetingId.value = null
    attendees.value = []
    isLoading.value = false
    loadError.value = ''
    options.value = []
    isLoadingOptions.value = false
    optionsError.value = ''
    isReplacing.value = false
    replaceError.value = ''
    updatingUserId.value = null
    statusError.value = ''
  }

  return {
    meetingId,
    attendees,
    isLoading,
    loadError,
    options,
    isLoadingOptions,
    optionsError,
    isReplacing,
    replaceError,
    updatingUserId,
    statusError,
    isBusy,
    open,
    retry,
    refresh,
    loadOptions,
    replaceAttendees,
    setStatus,
    resetReplaceState,
    resetStatusState,
    close,
  }
})
