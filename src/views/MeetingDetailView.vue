<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useMeetingsStore } from '@/stores/meetings'
import { useMeetingPointsStore } from '@/stores/meeting-points'
import { useMeetingAttendeesStore } from '@/stores/meeting-attendees'
import { useMeetingMinutesStore } from '@/stores/meeting-minutes'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import AlertMessage from '@/components/common/AlertMessage.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EditMeetingDialog from '@/components/meetings/EditMeetingDialog.vue'
import MeetingPointsSection from '@/components/meetings/MeetingPointsSection.vue'
import MeetingAttendeesSection from '@/components/meetings/MeetingAttendeesSection.vue'
import MeetingMinutesSection from '@/components/meetings/MeetingMinutesSection.vue'
import MeetingTransitionDialog from '@/components/meetings/MeetingTransitionDialog.vue'
import CloseMeetingDialog from '@/components/meetings/CloseMeetingDialog.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { ArrowLeft, CalendarCheck, Lock, LockOpen, Pencil, Trash2 } from '@lucide/vue'
import { meetingStatusLabel, meetingTypeLabel } from '@/utils/meeting-labels'
import type { UpdateMeetingPayload } from '@/services/meetings.service'
import type { MeetingTransitionAction } from '@/types'

const ACTION_ICON_SIZE = 18
const ACTION_ICON_STROKE_WIDTH = 1.75

const route = useRoute()
const router = useRouter()
const meetingsStore = useMeetingsStore()
const meetingPointsStore = useMeetingPointsStore()
const meetingAttendeesStore = useMeetingAttendeesStore()
const meetingMinutesStore = useMeetingMinutesStore()
const authStore = useAuthStore()
const toastStore = useToastStore()

const editButtonRef = ref<HTMLButtonElement>()
const isEditDialogOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const titleRef = ref<HTMLHeadingElement>()

// Fase 3.3b — celebrar y reabrir comparten un diálogo de confirmación;
// cerrar tiene el suyo, con revisión previa.
const isTransitionDialogOpen = ref(false)
const transitionAction = ref<'hold' | 'reopen'>('hold')
let transitionTriggerEl: HTMLElement | null = null

const isCloseDialogOpen = ref(false)
const isReviewLoading = ref(false)
const reviewLoadError = ref('')
let closeTriggerEl: HTMLElement | null = null
// Invalida la recarga de la revisión si el diálogo se cierra, o se cambia de
// reunión, antes de que termine.
let reviewSeq = 0

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

/** Solo ayuda visual: el backend sigue siendo la única autoridad real sobre
 * quién puede editar (ver el comentario de `MeetingsService.update` en
 * `fragua-gestion/back`). Una reunión editable requiere `draft` y, además,
 * ser su creador o tener rol `admin`/`superadmin`. */
const canEdit = computed(() => {
  const meeting = meetingsStore.selectedMeeting
  const user = authStore.user
  if (!meeting || !user) return false
  if (meeting.status !== 'draft') return false
  return meeting.createdBy.id === user.id || user.role === 'admin' || user.role === 'superadmin'
})

const canDelete = computed(() => {
  const meeting = meetingsStore.selectedMeeting
  const user = authStore.user
  if (!meeting || !user) return false
  return meeting.createdBy.id === user.id || user.role === 'admin' || user.role === 'superadmin'
})

/** Fase 3.2 — ayuda visual, derivada aparte de `canEdit`: los puntos siguen
 * siendo gestionables mientras la reunión está `draft` *o* `held` (no solo
 * `draft`), y por el creador o un `admin`/`superadmin`. El backend
 * (`MeetingPointsService.assertMeetingMutable`) sigue siendo la única
 * autoridad real. */
const canManagePoints = computed(() => {
  const meeting = meetingsStore.selectedMeeting
  const user = authStore.user
  if (!meeting || !user) return false
  if (meeting.status !== 'draft' && meeting.status !== 'held') return false
  return meeting.createdBy.id === user.id || user.role === 'admin' || user.role === 'superadmin'
})

/** Fase 3.3a — ayuda visual: seleccionar asistentes y registrar asistencia
 * siguen la misma regla que los puntos (`draft`/`held`, y creador o
 * `admin`/`superadmin`), pero se expone con nombre propio para que cambiar
 * una no arrastre a la otra en fases futuras. El backend
 * (`MeetingAttendeesService.assertAttendeesMutable`) sigue siendo la única
 * autoridad real. */
const canManageAttendees = computed(() => canManagePoints.value)

/** Fase 3.3b — solo ayuda visual: quién ve cada acción de estado. El backend
 * (`MeetingsService.transition`) sigue siendo la única autoridad real.
 * Celebrar lo puede hacer el creador o un `admin`/`superadmin`; cerrar y
 * reabrir, solo `admin`/`superadmin`. */
const isPrivilegedUser = computed(
  () => authStore.user?.role === 'admin' || authStore.user?.role === 'superadmin',
)

const canHold = computed(() => {
  const meeting = meetingsStore.selectedMeeting
  const user = authStore.user
  if (!meeting || !user || meeting.status !== 'draft') return false
  return meeting.createdBy.id === user.id || isPrivilegedUser.value
})

const canClose = computed(
  () => meetingsStore.selectedMeeting?.status === 'held' && isPrivilegedUser.value,
)

const canReopen = computed(
  () => meetingsStore.selectedMeeting?.status === 'closed' && isPrivilegedUser.value,
)

/** Explica qué se puede y qué no según el estado — `draft` no necesita
 * texto. En `held` puntos y asistentes siguen editables, así que el aviso se
 * limita a lo que sí está bloqueado. */
const lockedMessage = computed(() => {
  const status = meetingsStore.selectedMeeting?.status
  if (status === 'held') {
    return 'Celebrada: su nombre, fecha y tipo ya no se pueden editar.'
  }
  if (status === 'closed') {
    return canReopen.value
      ? 'Cerrada: solo lectura. Reábrela para modificarla.'
      : 'Cerrada: solo lectura. Un administrador puede reabrirla.'
  }
  return ''
})

const isCloseBlockedByEdits = computed(
  () => meetingPointsStore.isBusy || meetingAttendeesStore.isBusy,
)

function loadCurrentMeeting() {
  const id = route.params.id
  // El parámetro de ruta siempre debería ser un string único aquí (la ruta
  // no declara `:id` repetible), pero se valida de forma defensiva antes de
  // pasarlo al store.
  if (typeof id !== 'string' || !id) return
  meetingsStore.loadMeeting(id)
}

function handleRetry() {
  meetingsStore.retryMeeting()
}

function handleOpenEditDialog() {
  meetingsStore.resetUpdateState()
  isEditDialogOpen.value = true
}

async function focusEditButton() {
  await nextTick()
  editButtonRef.value?.focus()
}

async function handleEditSubmit(payload: UpdateMeetingPayload) {
  const meeting = meetingsStore.selectedMeeting
  if (!meeting) return

  const updated = await meetingsStore.updateMeeting(meeting.id, payload)
  if (updated) {
    toastStore.success(`La reunión «${updated.name}» se ha actualizado.`)
    isEditDialogOpen.value = false
    await focusEditButton()
  } else if (meetingsStore.updateError) {
    // Único punto de publicación de este error: el diálogo ya lo muestra
    // como texto contextual; el toast lo complementa con el mismo mensaje,
    // nunca con texto crudo del backend. Un `409 MEETING_NOT_EDITABLE` cae
    // aquí igual que cualquier otro fallo real — el diálogo permanece
    // abierto en los tres casos.
    toastStore.error(meetingsStore.updateError)
  }
  // Si falló, el diálogo permanece abierto con los valores y el error del
  // store (updateError) — no se mueve el foco.
}

async function handleEditCancel() {
  isEditDialogOpen.value = false
  await focusEditButton()
}

function handleOpenDeleteDialog() {
  meetingsStore.resetDeleteState()
  isDeleteDialogOpen.value = true
}

async function handleDeleteConfirm() {
  const meeting = meetingsStore.selectedMeeting
  if (!meeting) return

  const name = meeting.name
  const deleted = await meetingsStore.deleteMeeting(meeting.id)
  if (deleted) {
    isDeleteDialogOpen.value = false
    toastStore.success(`La reunión «${name}» se ha eliminado.`)
    await router.replace({ name: 'meetings' })
  } else if (meetingsStore.deleteError) {
    toastStore.error(meetingsStore.deleteError)
  }
}

function handleDeleteCancel() {
  isDeleteDialogOpen.value = false
}

const TRANSITION_SUCCESS_MESSAGES: Record<MeetingTransitionAction, (name: string) => string> = {
  hold: (name) => `La reunión «${name}» se ha marcado como celebrada.`,
  close: (name) => `La reunión «${name}» se ha cerrado.`,
  reopen: (name) => `La reunión «${name}» se ha reabierto.`,
}

async function focusTitle() {
  await nextTick()
  titleRef.value?.focus()
}

/** Devuelve el foco al botón que abrió el diálogo. Tras un cambio de estado
 * (o un `409` que refresca la reunión) ese botón puede haber desaparecido,
 * y entonces el foco va al título, que siempre existe. */
async function focusTriggerOrTitle(trigger: HTMLElement | null) {
  await nextTick()
  if (trigger?.isConnected) {
    trigger.focus()
  } else {
    titleRef.value?.focus()
  }
}

function handleOpenTransitionDialog(action: 'hold' | 'reopen', event: MouseEvent) {
  meetingsStore.resetTransitionState()
  transitionAction.value = action
  transitionTriggerEl = event.currentTarget as HTMLElement
  isTransitionDialogOpen.value = true
}

async function handleTransitionConfirm() {
  const meeting = meetingsStore.selectedMeeting
  if (!meeting) return

  const action = transitionAction.value
  const updated = await meetingsStore.transitionMeeting(meeting.id, action)
  if (updated) {
    toastStore.success(TRANSITION_SUCCESS_MESSAGES[action](updated.name))
    isTransitionDialogOpen.value = false
    transitionTriggerEl = null
    await focusTitle()
  } else if (meetingsStore.transitionError) {
    // Único punto de publicación: el diálogo ya muestra el mismo mensaje como
    // texto contextual y permanece abierto, sea cual sea el fallo.
    toastStore.error(meetingsStore.transitionError)
  }
}

async function handleTransitionCancel() {
  isTransitionDialogOpen.value = false
  const trigger = transitionTriggerEl
  transitionTriggerEl = null
  await focusTriggerOrTitle(trigger)
}

/** Recarga puntos y asistentes antes de mostrar la revisión, para no
 * revisar una copia vieja. Si falla, no se puede confirmar el cierre. */
async function refreshReviewData() {
  const seq = ++reviewSeq
  isReviewLoading.value = true
  reviewLoadError.value = ''

  const [pointsOk, attendeesOk] = await Promise.all([
    meetingPointsStore.refresh(),
    meetingAttendeesStore.refresh(),
  ])
  if (seq !== reviewSeq) return

  isReviewLoading.value = false
  if (!pointsOk || !attendeesOk) {
    reviewLoadError.value =
      'No se han podido cargar los puntos y asistentes actualizados. Sin ellos no se puede revisar la reunión antes de cerrarla.'
  }
}

function resetReviewState() {
  reviewSeq++
  isReviewLoading.value = false
  reviewLoadError.value = ''
}

function handleOpenCloseDialog(event: MouseEvent) {
  meetingsStore.resetTransitionState()
  closeTriggerEl = event.currentTarget as HTMLElement
  isCloseDialogOpen.value = true
  void refreshReviewData()
}

async function handleCloseConfirm() {
  const meeting = meetingsStore.selectedMeeting
  if (!meeting) return
  // Sin datos frescos no se cierra a ciegas (el diálogo ya lo impide; esto es
  // la defensa por si el evento llegara igualmente).
  if (isReviewLoading.value || reviewLoadError.value) return

  const updated = await meetingsStore.transitionMeeting(meeting.id, 'close')
  if (updated) {
    toastStore.success(TRANSITION_SUCCESS_MESSAGES.close(updated.name))
    resetReviewState()
    isCloseDialogOpen.value = false
    closeTriggerEl = null
    await focusTitle()
  } else if (meetingsStore.transitionError) {
    toastStore.error(meetingsStore.transitionError)
  }
}

async function handleCloseCancel() {
  resetReviewState()
  isCloseDialogOpen.value = false
  const trigger = closeTriggerEl
  closeTriggerEl = null
  await focusTriggerOrTitle(trigger)
}

// Cambiar de id sin desmontar la vista (p. ej. navegar de un detalle a otro
// mediante un enlace) invalida de inmediato la carga/edición anterior — ver
// el comentario de `loadMeeting` en el store.
watch(
  () => route.params.id,
  () => {
    loadCurrentMeeting()
  },
)

// Carga los puntos, los asistentes y el acta solo cuando el detalle de la reunión se
// ha cargado correctamente (`selectedMeeting.id` pasa a tener valor) — nunca
// antes. `loadMeeting` pone `selectedMeeting` a `null` en cuanto empieza una
// carga nueva (inicial, reintento o cambio de id), así que esta misma
// transición a `null` cierra/invalida de inmediato los stores de la reunión
// anterior antes de que `open()` abra la nueva sesión — nunca quedan
// mezclados los datos de dos reuniones distintas. Editar el nombre/fecha/
// tipo de la reunión ya cargada no cambia su `id`, así que no los reabre.
watch(
  () => meetingsStore.selectedMeeting?.id,
  (id) => {
    // Cualquier diálogo de estado abierto pertenecía a la reunión anterior.
    isTransitionDialogOpen.value = false
    isCloseDialogOpen.value = false
    resetReviewState()
    if (id) {
      meetingPointsStore.open(id)
      meetingAttendeesStore.open(id)
      meetingMinutesStore.open(id)
    } else {
      meetingPointsStore.close()
      meetingAttendeesStore.close()
      meetingMinutesStore.close()
    }
  },
)

onMounted(() => {
  loadCurrentMeeting()
})

// Al abandonar el detalle, invalida de inmediato cualquier carga o edición
// que siguiera en vuelo — no espera a una próxima entrada a `/meetings/:id`
// para descartar su resultado (ver el comentario de `clearSelectedMeeting`
// en el store). Cierra también los stores de puntos, asistentes y acta, por la misma razón.
onUnmounted(() => {
  meetingsStore.clearSelectedMeeting()
  meetingPointsStore.close()
  meetingAttendeesStore.close()
  meetingMinutesStore.close()
})
</script>

<template>
  <section class="meeting-detail" aria-labelledby="meeting-detail-title">
    <RouterLink :to="{ name: 'meetings' }" class="meeting-detail__back-link">
      <ArrowLeft :size="ACTION_ICON_SIZE" :stroke-width="ACTION_ICON_STROKE_WIDTH" aria-hidden="true" />
      Volver a reuniones
    </RouterLink>

    <LoadingSpinner v-if="meetingsStore.isLoadingDetail" label="Cargando reunión…" />

    <div v-else-if="meetingsStore.detailNotFound" class="meeting-detail__error">
      <AlertMessage variant="error">{{ meetingsStore.detailError }}</AlertMessage>
    </div>

    <div v-else-if="meetingsStore.detailError" class="meeting-detail__error">
      <AlertMessage variant="error">{{ meetingsStore.detailError }}</AlertMessage>
      <button type="button" class="meeting-detail__retry-button" @click="handleRetry">
        Reintentar
      </button>
    </div>

    <template v-else-if="meetingsStore.selectedMeeting">
      <div class="meeting-detail__header">
        <h1
          id="meeting-detail-title"
          ref="titleRef"
          tabindex="-1"
          class="meeting-detail__title"
        >
          {{ meetingsStore.selectedMeeting.name }}
        </h1>

        <div class="meeting-detail__actions">
          <button
            v-if="canEdit"
            ref="editButtonRef"
            type="button"
            class="meeting-detail__edit-button"
            @click="handleOpenEditDialog"
          >
            <Pencil :size="ACTION_ICON_SIZE" :stroke-width="ACTION_ICON_STROKE_WIDTH" aria-hidden="true" />
            Editar reunión
          </button>

          <button
            v-if="canDelete"
            type="button"
            class="meeting-detail__action-button meeting-detail__action-button--danger"
            :disabled="meetingsStore.isDeleting"
            @click="handleOpenDeleteDialog"
          >
            <Trash2 :size="ACTION_ICON_SIZE" :stroke-width="ACTION_ICON_STROKE_WIDTH" aria-hidden="true" />
            Eliminar reunión
          </button>

          <button
            v-if="canHold"
            type="button"
            class="meeting-detail__action-button meeting-detail__action-button--secondary"
            :disabled="meetingsStore.isTransitioning"
            @click="handleOpenTransitionDialog('hold', $event)"
          >
            <CalendarCheck :size="ACTION_ICON_SIZE" :stroke-width="ACTION_ICON_STROKE_WIDTH" aria-hidden="true" />
            Marcar como celebrada
          </button>

          <button
            v-if="canClose"
            type="button"
            class="meeting-detail__action-button"
            :disabled="meetingsStore.isTransitioning || isCloseBlockedByEdits"
            @click="handleOpenCloseDialog($event)"
          >
            <Lock :size="ACTION_ICON_SIZE" :stroke-width="ACTION_ICON_STROKE_WIDTH" aria-hidden="true" />
            Cerrar reunión
          </button>

          <button
            v-if="canReopen"
            type="button"
            class="meeting-detail__action-button meeting-detail__action-button--secondary"
            :disabled="meetingsStore.isTransitioning"
            @click="handleOpenTransitionDialog('reopen', $event)"
          >
            <LockOpen :size="ACTION_ICON_SIZE" :stroke-width="ACTION_ICON_STROKE_WIDTH" aria-hidden="true" />
            Reabrir reunión
          </button>
        </div>
      </div>

      <p v-if="lockedMessage" class="meeting-detail__locked">{{ lockedMessage }}</p>

      <dl class="meeting-detail__fields">
        <div class="meeting-detail__field">
          <dt>Fecha y hora</dt>
          <dd>{{ formatDateTime(meetingsStore.selectedMeeting.scheduledAt) }}</dd>
        </div>

        <div class="meeting-detail__field">
          <dt>Tipo</dt>
          <dd>{{ meetingTypeLabel(meetingsStore.selectedMeeting.type) }}</dd>
        </div>

        <div class="meeting-detail__field">
          <dt>Estado</dt>
          <dd>{{ meetingStatusLabel(meetingsStore.selectedMeeting.status) }}</dd>
        </div>

        <div v-if="meetingsStore.selectedMeeting.closedAt" class="meeting-detail__field">
          <dt>Cerrada el</dt>
          <dd>{{ formatDateTime(meetingsStore.selectedMeeting.closedAt) }}</dd>
        </div>

        <div v-if="meetingsStore.selectedMeeting.closedBy" class="meeting-detail__field">
          <dt>Cerrada por</dt>
          <dd>{{ meetingsStore.selectedMeeting.closedBy.nickname }}</dd>
        </div>

        <div class="meeting-detail__field">
          <dt>Creador</dt>
          <dd>{{ meetingsStore.selectedMeeting.createdBy.nickname }}</dd>
        </div>

        <div class="meeting-detail__field">
          <dt>Fecha de creación</dt>
          <dd>{{ formatDateTime(meetingsStore.selectedMeeting.createdAt) }}</dd>
        </div>

        <div class="meeting-detail__field">
          <dt>Última actualización</dt>
          <dd>{{ formatDateTime(meetingsStore.selectedMeeting.updatedAt) }}</dd>
        </div>
      </dl>

      <MeetingPointsSection
        :meeting="meetingsStore.selectedMeeting"
        :can-manage-points="canManagePoints"
      />

      <MeetingAttendeesSection
        :meeting="meetingsStore.selectedMeeting"
        :can-manage-attendees="canManageAttendees"
      />

      <MeetingMinutesSection
        :meeting="meetingsStore.selectedMeeting"
        :can-export="isPrivilegedUser"
      />
    </template>

    <EditMeetingDialog
      :open="isEditDialogOpen"
      :meeting="meetingsStore.selectedMeeting"
      :is-updating="meetingsStore.isUpdating"
      :error="meetingsStore.updateError"
      @submit="handleEditSubmit"
      @cancel="handleEditCancel"
    />

    <ConfirmDialog
      :open="isDeleteDialogOpen"
      title="¿Eliminar reunión?"
      :description="`Eliminarás definitivamente «${meetingsStore.selectedMeeting?.name ?? ''}» y sus puntos y asistentes. Un acta ya exportada no se elimina de Google Drive. Esta acción no se puede deshacer.`"
      confirm-label="Eliminar reunión"
      danger
      :is-confirming="meetingsStore.isDeleting"
      @confirm="handleDeleteConfirm"
      @cancel="handleDeleteCancel"
    />

    <MeetingTransitionDialog
      :open="isTransitionDialogOpen"
      :action="transitionAction"
      :meeting="meetingsStore.selectedMeeting"
      :is-submitting="meetingsStore.isTransitioning"
      :error="meetingsStore.transitionError"
      @confirm="handleTransitionConfirm"
      @cancel="handleTransitionCancel"
    />

    <CloseMeetingDialog
      :open="isCloseDialogOpen"
      :meeting="meetingsStore.selectedMeeting"
      :points="meetingPointsStore.points"
      :attendees="meetingAttendeesStore.attendees"
      :is-loading="isReviewLoading"
      :load-error="reviewLoadError"
      :is-submitting="meetingsStore.isTransitioning"
      :error="meetingsStore.transitionError"
      @confirm="handleCloseConfirm"
      @cancel="handleCloseCancel"
      @retry="refreshReviewData"
    />
  </section>
</template>

<style scoped>
.meeting-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 40rem;
}

.meeting-detail__back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  align-self: flex-start;
  min-height: 44px;
  padding: 0.3rem 0.2rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-decoration: none;
}

.meeting-detail__back-link:hover {
  color: var(--text-primary);
}

.meeting-detail__error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.meeting-detail__retry-button {
  min-height: 44px;
  padding: 0.55rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: var(--accent);
  color: white;
}

.meeting-detail__retry-button:hover {
  background: var(--accent-hover);
}

.meeting-detail__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.meeting-detail__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.meeting-detail__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.meeting-detail__title:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.meeting-detail__action-button {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 44px;
  padding: 0.55rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  background: var(--accent);
  color: white;
}

.meeting-detail__action-button:hover:not(:disabled) {
  background: var(--accent-hover);
}

.meeting-detail__action-button--secondary {
  border-color: var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.meeting-detail__action-button--secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.meeting-detail__action-button--danger {
  background: var(--danger);
}

.meeting-detail__action-button--danger:hover:not(:disabled) {
  background: #991616;
}

.meeting-detail__action-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.meeting-detail__edit-button {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 44px;
  padding: 0.55rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: var(--accent);
  color: white;
}

.meeting-detail__edit-button:hover {
  background: var(--accent-hover);
}

.meeting-detail__locked {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.meeting-detail__fields {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.meeting-detail__field {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.35rem 1rem;
}

.meeting-detail__field dt {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.meeting-detail__field dd {
  margin: 0;
  font-size: 0.92rem;
  color: var(--text-primary);
  text-align: right;
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .meeting-detail__field {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
  }

  .meeting-detail__field dd {
    text-align: left;
  }
}
</style>
