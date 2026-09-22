import { ref } from 'vue'
import { defineStore } from 'pinia'
import { isAxiosError } from 'axios'
import {
  meetingsService,
  type CreateMeetingPayload,
  type UpdateMeetingPayload,
} from '@/services/meetings.service'
import type {
  Meeting,
  MeetingErrorCode,
  MeetingsPage,
  MeetingStatus,
  MeetingTransitionAction,
  MeetingType,
} from '@/types'

/** `GET /meetings` no lleva ningún `code` propio (ni 409/503 de Drive: es
 * PostgreSQL, no Google) — se distingue solo por status HTTP. Comparte esta
 * traducción `load()`, `retry()`, los filtros y `goToPastPage()`, todos la
 * misma forma de petición con distinto `pastPage`/filtros. */
function describeListMeetingsError(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    if (status === 403) {
      return 'No tienes permiso para consultar las reuniones.'
    }
    if (status !== undefined && status >= 500) {
      return 'Ha ocurrido un problema temporal en el servidor. Inténtalo de nuevo en unos segundos.'
    }
    if (!err.response) {
      return 'No se ha podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.'
    }
  }
  return 'No se han podido cargar las reuniones.'
}

/** Igual que `describeListMeetingsError`, más el 400 propio de
 * `POST /meetings` (nombre, fecha o tipo rechazados por el backend — la
 * validación local del diálogo ya debería haberlo evitado). */
function describeCreateMeetingError(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    if (status === 400) {
      return 'Los datos de la reunión no son válidos.'
    }
    if (status === 403) {
      return 'No tienes permiso para crear reuniones.'
    }
    if (status !== undefined && status >= 500) {
      return 'Ha ocurrido un problema temporal en el servidor. Inténtalo de nuevo en unos segundos.'
    }
    if (!err.response) {
      return 'No se ha podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.'
    }
  }
  return 'No se ha podido crear la reunión.'
}

/** `GET /meetings/:id` no lleva `code` propio — cualquier usuario
 * autenticado puede consultar cualquier reunión (fase 3.1b), así que el
 * único caso propio de este endpoint es el 404 de una reunión inexistente. */
function describeGetMeetingError(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
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
  return 'No se ha podido cargar la reunión.'
}

/** Añade, sobre los códigos comunes, el `409 MEETING_NOT_EDITABLE` propio de
 * `PATCH /meetings/:id` (reunión `held`/`closed`) — nunca se distingue por
 * texto, solo por `code`. */
function describeUpdateMeetingError(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const code = (err.response?.data as { code?: MeetingErrorCode } | undefined)?.code
    if (status === 409 && code === 'MEETING_NOT_EDITABLE') {
      return 'La reunión ya no admite cambios.'
    }
    if (status === 400) {
      return 'Los datos de la reunión no son válidos.'
    }
    if (status === 403) {
      return 'No tienes permiso para editar esta reunión.'
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
  return 'No se ha podido actualizar la reunión.'
}

function describeDeleteMeetingError(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    if (status === 403) {
      return 'No tienes permiso para eliminar esta reunión.'
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
  return 'No se ha podido eliminar la reunión. Inténtalo de nuevo.'
}

const TRANSITION_FALLBACK_MESSAGES: Record<MeetingTransitionAction, string> = {
  hold: 'No se ha podido marcar la reunión como celebrada.',
  close: 'No se ha podido cerrar la reunión.',
  reopen: 'No se ha podido reabrir la reunión.',
}

const TRANSITION_FORBIDDEN_MESSAGES: Record<MeetingTransitionAction, string> = {
  hold: 'No tienes permiso para marcar esta reunión como celebrada.',
  close: 'Solo un administrador puede cerrar una reunión.',
  reopen: 'Solo un administrador puede reabrir una reunión.',
}

/** `POST /meetings/:id/hold|close|reopen` (fase 3.3b). Distingue por `code`,
 * nunca por texto: `409 MEETING_INVALID_TRANSITION` es la reunión ya en otro
 * estado (otra persona la cambió antes, o una doble pulsación). */
function describeTransitionError(err: unknown, action: MeetingTransitionAction): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    const code = (err.response?.data as { code?: MeetingErrorCode } | undefined)?.code
    if (status === 409 && code === 'MEETING_INVALID_TRANSITION') {
      return 'La reunión ya no está en un estado que permita esta acción. Se ha actualizado con su estado actual.'
    }
    if (status === 403) {
      return TRANSITION_FORBIDDEN_MESSAGES[action]
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
  return TRANSITION_FALLBACK_MESSAGES[action]
}

/**
 * Reuniones (fases 3.1a y 3.1b), independiente de `useDriveDocumentsStore`:
 * dueño exclusivo de los dos grupos que devuelve `GET /meetings` (próximas e
 * históricas paginadas), sus filtros, la creación, y ahora también el
 * detalle y la edición de una reunión concreta, y (fase 3.3b) su cambio de
 * estado. No incluye puntos, asistentes, actas ni integración con Drive: los
 * dos primeros tienen su propio store.
 */
export const useMeetingsStore = defineStore('meetings', () => {
  const currentMeetings = ref<Meeting[]>([])
  const pastMeetings = ref<Meeting[]>([])
  const pastPage = ref(1)
  const pastPageSize = ref(20)
  const pastTotal = ref(0)
  const pastTotalPages = ref(0)

  const isLoading = ref(false)
  const loadError = ref('')

  const isLoadingPast = ref(false)
  const pastError = ref('')

  const isCreating = ref(false)
  const createError = ref('')

  // Fase 3.1b — detalle y edición de una reunión concreta.
  const selectedMeeting = ref<Meeting | null>(null)
  const isLoadingDetail = ref(false)
  const detailError = ref('')
  // Distingue un 404 (la reunión no existe) del resto de fallos de carga: la
  // vista necesita mostrar un estado sin "Reintentar" solo en ese caso, sin
  // volver a inspeccionar el error crudo — `detailError` ya trae el mismo
  // texto ("La reunión ya no existe.") en ambos casos.
  const detailNotFound = ref(false)
  const isUpdating = ref(false)
  const updateError = ref('')
  const isDeleting = ref(false)
  const deleteError = ref('')
  // Fase 3.3b — cambio de estado (celebrar, cerrar, reabrir).
  const isTransitioning = ref(false)
  const transitionError = ref('')

  const typeFilter = ref<MeetingType | null>(null)
  const statusFilter = ref<MeetingStatus | null>(null)

  // Secuencia compartida por load()/retry()/los filtros/goToPastPage() y la
  // recarga posterior a crear: todas piden la misma forma de datos
  // (GET /meetings con los filtros vigentes) y solo la más reciente puede
  // escribir el estado. Una petición obsoleta (superada por otra, o por
  // close()) se descarta sin tocar loadError/pastError/los listados.
  let requestSeq = 0

  // Secuencia propia de createMeeting(): independiente de requestSeq (un
  // cambio de filtro o de página no debe invalidar una creación en curso).
  // Solo close() la invalida, para que el finally de una creación abandonada
  // (la vista se desmontó antes de que la petición o su recarga posterior
  // terminaran) no limpie isCreating/createError de una sesión nueva.
  let createSeq = 0

  function buildParams(page: number) {
    return {
      pastPage: page,
      pastPageSize: pastPageSize.value,
      type: typeFilter.value ?? undefined,
      status: statusFilter.value ?? undefined,
    }
  }

  function applyResponse(response: MeetingsPage) {
    currentMeetings.value = response.current
    pastMeetings.value = response.past.items
    pastPage.value = response.past.page
    pastPageSize.value = response.past.pageSize
    pastTotal.value = response.past.total
    pastTotalPages.value = response.past.totalPages
  }

  /** El backend echa de vuelta `pastPage` tal cual se pidió — nunca lo
   * corrige contra `totalPages` (ver `MeetingsService.findAll` en
   * `fragua-gestion/back`), así que la corrección es responsabilidad
   * exclusiva de este frontend. Página válida más cercana a `requestedPage`
   * dado el `totalPages` real: la 1 si ya no hay ninguna página (histórico
   * vacío), la última si `requestedPage` la supera, o la misma si ya era
   * válida. Nunca deja una combinación como "página 3 de 2". */
  function normalizePastPage(requestedPage: number, totalPages: number): number {
    if (totalPages === 0) return 1
    if (requestedPage > totalPages) return totalPages
    return requestedPage
  }

  /**
   * Carga completa: sustituye `current` y `past` a la vez. La usan la carga
   * inicial, `retry()` y los filtros (siempre con `page: 1`). Bloquea la
   * vista con `isLoading` — a diferencia de `fetchPreservingVisible`, aquí
   * no hay nada útil que mantener visible mientras tanto (primera carga, o
   * un cambio de filtro que hace irrelevante lo que había).
   */
  async function fetchFull(page: number) {
    const requestId = ++requestSeq
    isLoading.value = true
    loadError.value = ''

    try {
      const response = await meetingsService.listMeetings(buildParams(page))
      if (requestId !== requestSeq) return
      applyResponse(response)
    } catch (err) {
      if (requestId !== requestSeq) return
      loadError.value = describeListMeetingsError(err)
    } finally {
      if (requestId === requestSeq) isLoading.value = false
    }
  }

  /**
   * Recarga sin ocultar lo ya visible: la usan `goToPastPage()` (navegación
   * histórica), la recarga posterior a crear una reunión y la recarga
   * posterior a editar `scheduledAt`/`type` — la misma normalización de
   * página sirve a las tres, en vez de que cada llamador la repita por su
   * cuenta. Un fallo aquí nunca toca `currentMeetings`/`pastMeetings`/
   * `pastPage` — solo escribe `pastError`, para que el histórico ya cargado
   * (y las reuniones actuales) sigan mostrándose con la opción de
   * reintentar.
   *
   * `page` es la página pedida, no necesariamente la que se acaba
   * aplicando: como el backend nunca corrige `pastPage` contra
   * `totalPages` (`normalizePastPage`), la respuesta se inspecciona antes
   * de escribir nada. Si `page` ya no es válida para el `totalPages` que
   * acaba de llegar, esa primera respuesta ni se aplica ni se muestra
   * (evita un "página 3 de 2" aunque sea un instante): se pide de inmediato
   * la página normalizada, con los mismos filtros (`buildParams` reutiliza
   * `typeFilter`/`statusFilter` vigentes) y el mismo `requestId` — nunca uno
   * nuevo, para que una petición ajena y más reciente pueda seguir
   * invalidando toda la operación, pero la corrección en sí no cuente como
   * una petición aparte. Es una única corrección, nunca una cadena: la
   * segunda respuesta se aplica tal cual, sin volver a normalizarla.
   */
  async function fetchPreservingVisible(page: number): Promise<boolean> {
    const requestId = ++requestSeq
    isLoadingPast.value = true
    pastError.value = ''

    try {
      let response = await meetingsService.listMeetings(buildParams(page))
      if (requestId !== requestSeq) return false

      const normalizedPage = normalizePastPage(page, response.past.totalPages)
      if (normalizedPage !== page) {
        response = await meetingsService.listMeetings(buildParams(normalizedPage))
        if (requestId !== requestSeq) return false
      }

      applyResponse(response)
      return true
    } catch (err) {
      if (requestId !== requestSeq) return false
      pastError.value = describeListMeetingsError(err)
      return false
    } finally {
      if (requestId === requestSeq) isLoadingPast.value = false
    }
  }

  /** Carga inicial: sustituye ambos grupos. */
  async function load() {
    if (isLoading.value || isLoadingPast.value) return
    await fetchFull(1)
  }

  function retry() {
    if (isLoading.value || isLoadingPast.value) return
    if (!loadError.value) return
    load()
  }

  /**
   * Cambia solo la página histórica — las reuniones actuales y el histórico
   * anterior permanecen visibles mientras carga (`isLoadingPast`, no
   * `isLoading`). Un fallo conserva la página y el contenido anteriores
   * (`fetchPreservingVisible` no los toca) y dispara `pastError`; reintentar
   * es volver a llamar a `goToPastPage(page)` con la misma página.
   */
  async function goToPastPage(page: number) {
    if (isLoading.value || isLoadingPast.value) return
    if (page < 1 || page === pastPage.value) return
    if (pastTotalPages.value !== 0 && page > pastTotalPages.value) return
    await fetchPreservingVisible(page)
  }

  /** Reinicia el histórico a la página 1 y recarga ambos grupos con el tipo
   * indicado (`null` = sin filtrar). Un valor igual al vigente no dispara
   * ninguna petición. */
  function setTypeFilter(type: MeetingType | null) {
    if (typeFilter.value === type) return
    typeFilter.value = type
    fetchFull(1)
  }

  /** Igual que `setTypeFilter`, para el estado. */
  function setStatusFilter(status: MeetingStatus | null) {
    if (statusFilter.value === status) return
    statusFilter.value = status
    fetchFull(1)
  }

  /** Limpia el error de un intento de creación anterior — llamada al abrir
   * el diálogo, para no arrastrar el mensaje de un intento previo. */
  function resetCreateState() {
    createError.value = ''
  }

  /**
   * Crea la reunión y, si el backend la acepta, espera la recarga del
   * listado (misma página histórica vigente) antes de devolver el control —
   * `isCreating` permanece activo durante toda la recarga, no solo durante
   * la creación. Un fallo de esa recarga posterior no convierte la creación
   * en un fallo: se escribe en `pastError` (o `loadError`, según cuál pida
   * `fetchPreservingVisible`/`fetchFull` — aquí siempre la primera), nunca en
   * `createError`, porque la reunión ya existe en el backend. Devuelve
   * `true` solo si la creación en sí tuvo éxito.
   */
  async function createMeeting(payload: CreateMeetingPayload): Promise<boolean> {
    if (isCreating.value) return false

    const requestId = ++createSeq
    isCreating.value = true
    createError.value = ''

    try {
      await meetingsService.createMeeting(payload)
      if (requestId !== createSeq) return false
      await fetchPreservingVisible(pastPage.value)
      return requestId === createSeq
    } catch (err) {
      if (requestId !== createSeq) return false
      createError.value = describeCreateMeetingError(err)
      return false
    } finally {
      if (requestId === createSeq) isCreating.value = false
    }
  }

  /**
   * Invalida de inmediato cualquier `load()`/`goToPastPage()`/filtro/
   * `createMeeting()` que siguiera en vuelo — llamada desde el
   * `onUnmounted` de `MeetingsView`. Incrementa ambas secuencias antes de
   * reponer los flags a su estado neutro, así los `finally` de peticiones ya
   * invalidadas no tienen nada que limpiar sobre una sesión nueva. Los
   * listados y la paginación no se tocan: la próxima entrada a `/meetings`
   * llama a `load()`, que los sustituye igualmente.
   */
  function close() {
    requestSeq++
    createSeq++
    isLoading.value = false
    loadError.value = ''
    isLoadingPast.value = false
    pastError.value = ''
    isCreating.value = false
    createError.value = ''
  }

  // --- Fase 3.1b — detalle y edición ---------------------------------

  // Identidad de la "sesión de detalle" vigente: `loadMeeting(id)` la
  // incrementa en cada llamada (carga inicial, reintento o un cambio rápido
  // de id sin desmontar `MeetingDetailView`) y `clearSelectedMeeting()` la
  // incrementa al abandonar la vista. `updateMeeting()` no la incrementa —
  // opera *dentro* de la sesión vigente y solo escribe su resultado si esa
  // sesión sigue siendo la misma al resolver, así una edición pendiente
  // queda invalidada tanto por un cambio de id como por un cierre de la
  // vista, sin necesitar una segunda secuencia independiente. Sirve
  // exactamente el mismo propósito que `sessionId` en
  // `useDriveVersionsStore`, aplicado aquí a una reunión en vez de a un
  // archivo.
  let detailSessionId = 0
  // Id de la última reunión pedida — solo para que `retryMeeting()` sepa
  // qué volver a pedir; no se expone como estado reactivo.
  let currentDetailId: string | null = null

  /** Carga (o recarga) el detalle de `id`. Sirve tanto para la entrada
   * inicial a `/meetings/:id` como para un cambio de id sin desmontar la
   * vista (la nueva sesión invalida cualquier carga o edición anterior en
   * vuelo) y para `retryMeeting()`. Limpia siempre cualquier edición en
   * curso de la sesión anterior: pertenece a un detalle que esta llamada ya
   * está sustituyendo. */
  async function loadMeeting(id: string) {
    const session = ++detailSessionId
    currentDetailId = id
    isLoadingDetail.value = true
    detailError.value = ''
    detailNotFound.value = false
    selectedMeeting.value = null
    isUpdating.value = false
    updateError.value = ''
    isTransitioning.value = false
    transitionError.value = ''

    try {
      const meeting = await meetingsService.getMeeting(id)
      if (session !== detailSessionId) return
      selectedMeeting.value = meeting
    } catch (err) {
      if (session !== detailSessionId) return
      detailNotFound.value = isAxiosError(err) && err.response?.status === 404
      detailError.value = describeGetMeetingError(err)
    } finally {
      if (session === detailSessionId) isLoadingDetail.value = false
    }
  }

  /** Reintenta la última carga de detalle solicitada — no hace nada si ya
   * hay una carga en curso, si no hubo error, o si aún no se ha pedido
   * ningún detalle. */
  function retryMeeting() {
    if (isLoadingDetail.value) return
    if (!detailError.value) return
    if (!currentDetailId) return
    loadMeeting(currentDetailId)
  }

  /** Limpia el error de una edición anterior — llamada al abrir el diálogo,
   * para no arrastrar el mensaje de un intento previo. */
  function resetUpdateState() {
    updateError.value = ''
  }

  /**
   * Sustituye por id, en el sitio, la reunión equivalente en
   * `currentMeetings`/`pastMeetings` si está cargada — sin recargar ni
   * reordenar ninguno de los dos listados. Correcto únicamente cuando lo
   * único que cambió es `name`: ese campo no participa en el agrupamiento
   * próximas/históricas, ni en el orden de ninguno de los dos grupos
   * (`scheduledAt`/`createdAt`/`id`), ni en los filtros de tipo/estado —
   * así que la reunión no puede haber cambiado de grupo, de posición ni de
   * página histórica, y una sustitución local es exacta. Ver `updateMeeting`
   * para el caso en que cambió `scheduledAt` o `type`, donde esta función
   * nunca es suficiente y no se usa.
   */
  function applyMeetingToLists(updated: Meeting) {
    const currentIndex = currentMeetings.value.findIndex((meeting) => meeting.id === updated.id)
    if (currentIndex !== -1) {
      currentMeetings.value = [
        ...currentMeetings.value.slice(0, currentIndex),
        updated,
        ...currentMeetings.value.slice(currentIndex + 1),
      ]
    }

    const pastIndex = pastMeetings.value.findIndex((meeting) => meeting.id === updated.id)
    if (pastIndex !== -1) {
      pastMeetings.value = [
        ...pastMeetings.value.slice(0, pastIndex),
        updated,
        ...pastMeetings.value.slice(pastIndex + 1),
      ]
    }
  }

  /**
   * Envía el `PATCH` parcial de `id` y, si el backend lo acepta, sustituye
   * `selectedMeeting` de inmediato con la respuesta real del PATCH —
   * siempre, antes de decidir cómo sincronizar el listado cacheado.
   *
   * La sincronización del listado depende de qué cambió, porque
   * `currentMeetings`/`pastMeetings` no son solo una colección de
   * reuniones: `scheduledAt` decide el grupo (próximas/históricas) y el
   * orden dentro de cada uno, y `type`/`status` deciden si la reunión sigue
   * cumpliendo `typeFilter`/`statusFilter`. Si `payload` solo trae `name`,
   * ninguna de esas tres cosas puede haber cambiado, así que basta con
   * `applyMeetingToLists` (sustitución local por id). Si `payload` trae
   * `scheduledAt` o `type`, ese razonamiento ya no vale — la reunión puede
   * haber cruzado el límite de "hoy", cambiado de orden dentro de su grupo,
   * caído en otra página histórica o dejado de cumplir el filtro vigente —
   * así que el listado cacheado se descarta y se recarga con el mecanismo
   * existente, `fetchPreservingVisible(pastPage.value)` (el mismo que usa
   * `createMeeting` tras crear una reunión y `goToPastPage()`): reaplica
   * `typeFilter`/`statusFilter` y pide de nuevo la página histórica vigente
   * tal cual está, sin reconstruir nada a mano — si esa página ya no existe,
   * `fetchPreservingVisible` la normaliza (ver `normalizePastPage`) antes de
   * aplicar nada, porque el backend nunca la corrige por su cuenta. Un
   * fallo de esta recarga nunca deshace el éxito de la edición (el PATCH ya
   * se aplicó en el backend): queda
   * escrito en `pastError` por `fetchPreservingVisible`, nunca en
   * `updateError`.
   *
   * `isUpdating` permanece activo durante todo esto — PATCH y, si aplica,
   * la recarga posterior — para que no haya un estado intermedio en el que
   * la reunión ya se editó pero el listado todavía no se sincronizó.
   * Bloqueada mientras haya otra edición en curso, para no reenviar dos
   * veces la misma edición. Devuelve la reunión actualizada solo si la
   * sesión de detalle sigue siendo la misma justo al recibir la respuesta
   * del PATCH; en caso contrario (la vista se abandonó, o se cargó otro id,
   * mientras la petición estaba en vuelo) no escribe nada y devuelve
   * `null`, igual que un fallo real — `loadMeeting`/`retryMeeting` son los
   * únicos que avanzan esa sesión, y solo lo hacen ante una entrada real a
   * otro id o un reintento tras un error de carga (imposible mientras esta
   * función está en curso, porque nunca toca `detailError`), así que nunca
   * invalidan por accidente una edición todavía vigente para el mismo id.
   * Un fallo real conserva `selectedMeeting` tal cual estaba y escribe el
   * mensaje traducido en `updateError`, para que el diálogo lo muestre
   * junto a los valores que el usuario ya había introducido.
   */
  async function updateMeeting(id: string, payload: UpdateMeetingPayload): Promise<Meeting | null> {
    if (isUpdating.value || isTransitioning.value) return null

    const session = detailSessionId
    isUpdating.value = true
    updateError.value = ''

    try {
      const updated = await meetingsService.updateMeeting(id, payload)
      if (session !== detailSessionId) return null

      selectedMeeting.value = updated

      const mayHaveMovedOrFiltered = payload.scheduledAt !== undefined || payload.type !== undefined
      if (mayHaveMovedOrFiltered) {
        await fetchPreservingVisible(pastPage.value)
      } else {
        applyMeetingToLists(updated)
      }

      return updated
    } catch (err) {
      if (session !== detailSessionId) return null
      updateError.value = describeUpdateMeetingError(err)
      return null
    } finally {
      if (session === detailSessionId) isUpdating.value = false
    }
  }

  function resetDeleteState() {
    deleteError.value = ''
  }

  async function deleteMeeting(id: string): Promise<boolean> {
    if (isDeleting.value || isUpdating.value || isTransitioning.value) return false

    const session = detailSessionId
    isDeleting.value = true
    deleteError.value = ''

    try {
      await meetingsService.deleteMeeting(id)
      if (session !== detailSessionId) return false
      return true
    } catch (err) {
      if (session !== detailSessionId) return false
      deleteError.value = describeDeleteMeetingError(err)
      return false
    } finally {
      if (session === detailSessionId) isDeleting.value = false
    }
  }

  /** Limpia el error de un cambio de estado anterior — llamada al abrir el
   * diálogo correspondiente. */
  function resetTransitionState() {
    transitionError.value = ''
  }

  /** Sincroniza el listado cacheado tras un cambio de estado. `scheduledAt`
   * y `type` no cambian, así que la reunión no puede cambiar de grupo ni de
   * posición; solo `status` puede sacarla del filtro por estado vigente. Sin
   * filtro por estado basta la sustitución local (`applyMeetingToLists`); con
   * él se recarga conservando filtros y página, igual que `updateMeeting`. Un
   * fallo de esa recarga nunca deshace el cambio (ya está aplicado en el
   * backend): queda en `pastError`. */
  async function syncListsAfterStatusChange(updated: Meeting) {
    if (statusFilter.value !== null) {
      await fetchPreservingVisible(pastPage.value)
    } else {
      applyMeetingToLists(updated)
    }
  }

  /**
   * Vuelve a pedir el detalle de `id` y lo sustituye *sin vaciarlo* (a
   * diferencia de `loadMeeting`, que deja la vista en blanco), para reflejar
   * un estado que cambió por otro lado — otra persona lo cambió antes, o un
   * `409` de una acción que dependía del estado (`MEETING_INVALID_TRANSITION`
   * al cambiar de estado, `MEETING_NOT_CLOSED` al exportar el acta). Solo
   * escribe si la sesión de detalle sigue siendo la vigente al resolver, y un
   * fallo de la relectura se ignora: quien la llama ya tiene su propio error
   * que mostrar y no debe perderlo por esto.
   */
  async function refreshMeeting(id: string) {
    const session = detailSessionId
    try {
      const fresh = await meetingsService.getMeeting(id)
      if (session !== detailSessionId) return
      selectedMeeting.value = fresh
      await syncListsAfterStatusChange(fresh)
    } catch {
      // Ver el comentario de la función.
    }
  }

  /**
   * Celebra, cierra o reabre `id` y, si el backend lo acepta, sustituye
   * `selectedMeeting` con la respuesta real y sincroniza el listado. Misma
   * sesión de detalle que `updateMeeting`: solo escribe si sigue vigente al
   * resolver, así abandonar la vista o cargar otro id invalida la operación
   * sin más. Bloqueada mientras haya una edición o un cambio de estado en
   * curso. Un `409 MEETING_INVALID_TRANSITION` significa que la reunión ya
   * estaba en otro estado: se vuelve a pedir su detalle *sin vaciarlo*
   * (sin pasar por `loadMeeting`, que dejaría la vista en blanco) para que
   * la interfaz muestre el estado real; el error de la transición se
   * conserva y un fallo de esa relectura no lo sustituye. `null` si hay otra
   * operación en curso, si la sesión ya no es la vigente o si falla.
   */
  async function transitionMeeting(
    id: string,
    action: MeetingTransitionAction,
  ): Promise<Meeting | null> {
    if (isTransitioning.value || isUpdating.value) return null

    const session = detailSessionId
    isTransitioning.value = true
    transitionError.value = ''

    try {
      const updated = await meetingsService.transitionMeeting(id, action)
      if (session !== detailSessionId) return null

      selectedMeeting.value = updated
      await syncListsAfterStatusChange(updated)
      return updated
    } catch (err) {
      if (session !== detailSessionId) return null
      transitionError.value = describeTransitionError(err, action)

      const isInvalidTransition =
        isAxiosError(err) &&
        err.response?.status === 409 &&
        (err.response.data as { code?: MeetingErrorCode } | undefined)?.code ===
          'MEETING_INVALID_TRANSITION'
      if (isInvalidTransition) {
        await refreshMeeting(id)
      }
      return null
    } finally {
      if (session === detailSessionId) isTransitioning.value = false
    }
  }

  /**
   * Invalida de inmediato cualquier `loadMeeting()`/`updateMeeting()` que
   * siguiera en vuelo — llamada desde el `onUnmounted` de
   * `MeetingDetailView` (o antes de entrar a un id nuevo). No toca
   * `currentMeetings`/`pastMeetings`: solo el estado propio del detalle.
   */
  function clearSelectedMeeting() {
    detailSessionId++
    currentDetailId = null
    selectedMeeting.value = null
    isLoadingDetail.value = false
    detailError.value = ''
    detailNotFound.value = false
    isUpdating.value = false
    updateError.value = ''
    isDeleting.value = false
    deleteError.value = ''
    isTransitioning.value = false
    transitionError.value = ''
  }

  return {
    currentMeetings,
    pastMeetings,
    pastPage,
    pastPageSize,
    pastTotal,
    pastTotalPages,
    isLoading,
    loadError,
    isLoadingPast,
    pastError,
    isCreating,
    createError,
    selectedMeeting,
    isLoadingDetail,
    detailError,
    detailNotFound,
    isUpdating,
    updateError,
    isDeleting,
    deleteError,
    isTransitioning,
    transitionError,
    typeFilter,
    statusFilter,
    load,
    retry,
    goToPastPage,
    setTypeFilter,
    setStatusFilter,
    resetCreateState,
    createMeeting,
    close,
    loadMeeting,
    retryMeeting,
    updateMeeting,
    resetUpdateState,
    deleteMeeting,
    resetDeleteState,
    transitionMeeting,
    resetTransitionState,
    refreshMeeting,
    clearSelectedMeeting,
  }
})
