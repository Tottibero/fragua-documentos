<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { buildMeetingReview } from '@/utils/meeting-review'
import { formatMeetingDateTime, meetingTypeLabel } from '@/utils/meeting-labels'
import type { Meeting, MeetingAttendee, MeetingPoint } from '@/types'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Reunión que se cierra — `null` solo antes de la primera apertura. */
    meeting: Meeting | null
    /** Puntos y asistentes de la reunión, ya recargados por el llamador al
     * abrir el diálogo; el diálogo solo los compone, no los pide. */
    points: MeetingPoint[]
    attendees: MeetingAttendee[]
    /** Se están recargando puntos y asistentes: no se muestra la revisión ni
     * se permite confirmar hasta tenerlos. */
    isLoading: boolean
    /** La recarga falló: sin datos frescos no se cierra a ciegas. */
    loadError?: string
    isSubmitting: boolean
    error?: string
  }>(),
  { loadError: '', error: '' },
)

const emit = defineEmits<{ confirm: []; cancel: []; retry: [] }>()

const dialogEl = ref<HTMLDialogElement>()
const titleEl = ref<HTMLHeadingElement>()

// Distingue un cierre provocado por nosotros (al reaccionar a `open` a
// false) de uno iniciado por el usuario (Escape): solo este debe emitir
// "cancel".
let closingFromPropChange = false

const isReady = computed(() => !props.isLoading && !props.loadError)
const review = computed(() => buildMeetingReview(props.points, props.attendees))

const attendeeGroups = computed(() =>
  [
    { key: 'attended', label: 'Asistieron', list: review.value.attendees.attended },
    { key: 'absent', label: 'Ausentes', list: review.value.attendees.absent },
    { key: 'planned', label: 'Previstos', list: review.value.attendees.planned },
  ].filter((group) => group.list.length > 0),
)

const withoutAgreementsIds = computed(
  () => new Set(review.value.points.withoutAgreements.map((point) => point.id)),
)

watch(
  () => props.open,
  async (open) => {
    if (open) {
      dialogEl.value?.showModal()
      await nextTick()
      // El foco inicial va al título, no a un botón: el contenido es largo y
      // se lee de arriba abajo; los controles siguen a un Tab de distancia.
      titleEl.value?.focus()
    } else if (dialogEl.value?.open) {
      closingFromPropChange = true
      dialogEl.value.close()
    }
  },
)

function handleClose() {
  if (closingFromPropChange) {
    closingFromPropChange = false
    return
  }
  emit('cancel')
}

// Evento nativo "cancel" (Escape): se bloquea mientras se cierra para no
// dejar la operación huérfana. Mientras solo se está recargando, sí se
// permite cancelar.
function handleNativeCancel(event: Event) {
  if (props.isSubmitting) event.preventDefault()
}

function handleBackdropClick(event: MouseEvent) {
  if (!props.isSubmitting && event.target === dialogEl.value) emit('cancel')
}

function handleConfirmClick() {
  // Defensa además del `:disabled`: nunca dos envíos a la vez, ni sin datos
  // frescos.
  if (props.isSubmitting || !isReady.value) return
  emit('confirm')
}
</script>

<template>
  <dialog
    ref="dialogEl"
    class="close-dialog"
    aria-labelledby="close-dialog-title"
    @close="handleClose"
    @cancel="handleNativeCancel"
    @click="handleBackdropClick"
  >
    <div class="close-dialog__box" @click.stop>
      <h2 id="close-dialog-title" ref="titleEl" tabindex="-1" class="close-dialog__title">
        Cerrar reunión
      </h2>
      <p class="close-dialog__intro">
        Revisa la reunión antes de cerrarla. Una reunión cerrada es de solo lectura, pero se puede
        reabrir más tarde.
      </p>

      <LoadingSpinner v-if="isLoading" label="Cargando puntos y asistentes…" />

      <div v-else-if="loadError" class="close-dialog__load-error">
        <AlertMessage variant="error">{{ loadError }}</AlertMessage>
        <button type="button" class="close-dialog__secondary" @click="emit('retry')">
          Reintentar
        </button>
      </div>

      <template v-else-if="meeting">
        <dl class="close-dialog__summary">
          <div class="close-dialog__summary-row">
            <dt>Reunión</dt>
            <dd>{{ meeting.name }}</dd>
          </div>
          <div class="close-dialog__summary-row">
            <dt>Fecha y hora</dt>
            <dd>{{ formatMeetingDateTime(meeting.scheduledAt) }}</dd>
          </div>
          <div class="close-dialog__summary-row">
            <dt>Tipo</dt>
            <dd>{{ meetingTypeLabel(meeting.type) }}</dd>
          </div>
        </dl>

        <section class="close-dialog__section" aria-labelledby="close-dialog-warnings-title">
          <h3 id="close-dialog-warnings-title" class="close-dialog__section-title">Avisos</h3>
          <ul v-if="review.warnings.length > 0" class="close-dialog__warnings">
            <li
              v-for="warning in review.warnings"
              :key="warning.code"
              class="close-dialog__warning"
            >
              <span>{{ warning.message }}</span>
              <span v-if="warning.details.length > 0" class="close-dialog__warning-details">
                {{ warning.details.join(', ') }}
              </span>
            </li>
          </ul>
          <p v-else class="close-dialog__ok">Sin avisos: no hay nada pendiente que revisar.</p>
          <p v-if="review.warnings.length > 0" class="close-dialog__hint">
            Los avisos son informativos: puedes cerrar la reunión igualmente.
          </p>
        </section>

        <section class="close-dialog__section" aria-labelledby="close-dialog-points-title">
          <h3 id="close-dialog-points-title" class="close-dialog__section-title">
            Puntos ({{ review.points.total }})
          </h3>
          <p v-if="review.points.total === 0" class="close-dialog__empty">
            La reunión no tiene puntos.
          </p>
          <ol v-else class="close-dialog__points">
            <li v-for="point in points" :key="point.id" class="close-dialog__point">
              <span class="close-dialog__point-title">{{ point.title }}</span>
              <span v-if="withoutAgreementsIds.has(point.id)" class="close-dialog__tag">
                Sin acuerdos
              </span>
            </li>
          </ol>
        </section>

        <section class="close-dialog__section" aria-labelledby="close-dialog-attendees-title">
          <h3 id="close-dialog-attendees-title" class="close-dialog__section-title">
            Asistentes ({{ review.attendees.total }})
          </h3>
          <p v-if="review.attendees.total === 0" class="close-dialog__empty">
            La reunión no tiene asistentes.
          </p>
          <dl v-else class="close-dialog__attendees">
            <div v-for="group in attendeeGroups" :key="group.key" class="close-dialog__attendee-row">
              <dt>{{ group.label }} ({{ group.list.length }})</dt>
              <dd>{{ group.list.map((attendee) => attendee.user.nickname).join(', ') }}</dd>
            </div>
          </dl>
        </section>
      </template>

      <AlertMessage v-if="error" variant="error">{{ error }}</AlertMessage>

      <div class="close-dialog__actions">
        <button
          type="button"
          class="close-dialog__secondary"
          :disabled="isSubmitting"
          @click="emit('cancel')"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="close-dialog__confirm"
          :disabled="isSubmitting || !isReady"
          :aria-busy="isSubmitting"
          @click="handleConfirmClick"
        >
          {{ isSubmitting ? 'Cerrando…' : 'Cerrar reunión' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.close-dialog {
  border: none;
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: var(--shadow-md);
  max-width: min(92vw, 34rem);
  width: 100%;
}

.close-dialog::backdrop {
  background: rgba(15, 18, 25, 0.45);
}

.close-dialog__box {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  max-height: 88vh;
  overflow-y: auto;
}

.close-dialog__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.close-dialog__title:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.close-dialog__intro {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--text-secondary);
}

.close-dialog__load-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.close-dialog__summary {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.close-dialog__summary-row,
.close-dialog__attendee-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.2rem 1rem;
}

.close-dialog__summary-row dt,
.close-dialog__attendee-row dt {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.close-dialog__summary-row dd,
.close-dialog__attendee-row dd {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.close-dialog__section {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.close-dialog__section-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}

.close-dialog__warnings {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.close-dialog__warning {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.55rem 0.8rem;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  font-size: 0.88rem;
  line-height: 1.4;
  color: var(--text-primary);
}

.close-dialog__warning-details {
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

.close-dialog__hint,
.close-dialog__empty,
.close-dialog__ok {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.close-dialog__points {
  margin: 0;
  padding-left: 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.close-dialog__point {
  padding-left: 0.2rem;
}

.close-dialog__point-title {
  overflow-wrap: anywhere;
}

.close-dialog__tag {
  margin-left: 0.5rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--bg-hover);
  color: var(--text-secondary);
  white-space: nowrap;
}

.close-dialog__attendees {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.close-dialog__actions {
  margin-top: 0.3rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.close-dialog__secondary,
.close-dialog__confirm {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.close-dialog__secondary {
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.close-dialog__secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.close-dialog__confirm {
  border: none;
  background: var(--accent);
  color: white;
}

.close-dialog__confirm:hover:not(:disabled) {
  background: var(--accent-hover);
}

.close-dialog__secondary:disabled,
.close-dialog__confirm:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
