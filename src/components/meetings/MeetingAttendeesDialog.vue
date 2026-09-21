<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { meetingAttendanceLabel } from '@/utils/meeting-labels'
import type { MeetingAttendee, MeetingAttendeeOption } from '@/types'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Asistentes actuales de la reunión — la referencia contra la que se
     * calculan los cambios y el aviso de asistencia registrada. */
    attendees: MeetingAttendee[]
    options: MeetingAttendeeOption[]
    isLoadingOptions: boolean
    optionsError?: string
    isSubmitting: boolean
    error?: string
  }>(),
  { optionsError: '', error: '' },
)

const emit = defineEmits<{
  submit: [userIds: string[]]
  cancel: []
  'retry-options': []
}>()

const dialogEl = ref<HTMLDialogElement>()
const cancelButton = ref<HTMLButtonElement>()
const checklistEl = ref<HTMLElement>()

const selectedIds = ref<Set<string>>(new Set())
const localError = ref('')

// Distingue un cierre provocado por nosotros (al reaccionar a `open` a
// false) de uno iniciado por el usuario (Escape): solo este debe emitir
// "cancel".
let closingFromPropChange = false

const currentIds = computed(() => new Set(props.attendees.map((attendee) => attendee.user.id)))
const optionIds = computed(() => new Set(props.options.map((option) => option.id)))

// Un asistente actual que ya no figura entre los candidatos (p. ej. le
// quitaron el rol) no puede aparecer en el checklist ni enviarse en el
// `PUT` (el backend lo rechazaría con 400): se trata como retirado al
// guardar y se explica aparte.
const ineligibleAttendees = computed(() =>
  props.attendees.filter((attendee) => !optionIds.value.has(attendee.user.id)),
)

const removedAttendees = computed(() =>
  props.attendees.filter((attendee) => !selectedIds.value.has(attendee.user.id)),
)

// Quitar a alguien con asistencia ya registrada elimina también ese
// registro: se avisa, no se bloquea.
const attendanceToLose = computed(() =>
  removedAttendees.value.filter((attendee) => attendee.status !== 'planned'),
)

const isChecklistVisible = computed(() => !props.isLoadingOptions && !props.optionsError)

function hasChanges(): boolean {
  const current = currentIds.value
  const selected = selectedIds.value
  if (current.size !== selected.size) return true
  for (const id of selected) {
    if (!current.has(id)) return true
  }
  return false
}

function resetSelection() {
  // Antes de que lleguen los candidatos se parte de los asistentes
  // actuales; `syncSelectionWithOptions` afina el conjunto en cuanto llegan.
  selectedIds.value = new Set(currentIds.value)
  localError.value = ''
}

function syncSelectionWithOptions() {
  const eligible = optionIds.value
  selectedIds.value = new Set([...currentIds.value].filter((id) => eligible.has(id)))
}

async function focusInitialControl() {
  await nextTick()
  const firstCheckbox = checklistEl.value?.querySelector<HTMLInputElement>('input[type="checkbox"]')
  if (firstCheckbox) {
    firstCheckbox.focus()
  } else {
    cancelButton.value?.focus()
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      resetSelection()
      dialogEl.value?.showModal()
      await nextTick()
      cancelButton.value?.focus()
    } else if (dialogEl.value?.open) {
      closingFromPropChange = true
      dialogEl.value.close()
    }
  },
)

// Los candidatos llegan tras abrir: cuando termina la carga se ajusta la
// selección inicial y el foco pasa al primer candidato.
watch(
  () => props.isLoadingOptions,
  async (loading, wasLoading) => {
    if (!props.open || loading || !wasLoading) return
    if (props.optionsError) return
    syncSelectionWithOptions()
    await focusInitialControl()
  },
)

function toggle(id: string, checked: boolean) {
  const next = new Set(selectedIds.value)
  if (checked) next.add(id)
  else next.delete(id)
  selectedIds.value = next
  localError.value = ''
}

function handleSubmit() {
  // Defensa además del `:disabled` de los botones: nunca dos envíos a la vez.
  if (props.isSubmitting) return

  if (!hasChanges()) {
    localError.value = 'No hay cambios que guardar.'
    return
  }
  localError.value = ''
  emit('submit', [...selectedIds.value])
}

function handleClose() {
  if (closingFromPropChange) {
    closingFromPropChange = false
    return
  }
  emit('cancel')
}

// Evento nativo "cancel" (Escape): se bloquea mientras se guarda para no
// dejar la operación huérfana.
function handleNativeCancel(event: Event) {
  if (props.isSubmitting) event.preventDefault()
}

function handleBackdropClick(event: MouseEvent) {
  if (!props.isSubmitting && event.target === dialogEl.value) emit('cancel')
}
</script>

<template>
  <dialog
    ref="dialogEl"
    class="attendees-dialog"
    aria-labelledby="attendees-dialog-title"
    @close="handleClose"
    @cancel="handleNativeCancel"
    @click="handleBackdropClick"
  >
    <form class="attendees-dialog__box" novalidate @submit.prevent="handleSubmit" @click.stop>
      <h2 id="attendees-dialog-title" class="attendees-dialog__title">Gestionar asistentes</h2>
      <p class="attendees-dialog__description">
        Marca quién asiste a la reunión. Solo pueden asistir administradores y superadministradores.
      </p>

      <LoadingSpinner v-if="isLoadingOptions" label="Cargando candidatos…" />

      <div v-else-if="optionsError" class="attendees-dialog__options-error">
        <AlertMessage variant="error">{{ optionsError }}</AlertMessage>
        <button type="button" class="attendees-dialog__secondary" @click="emit('retry-options')">
          Reintentar
        </button>
      </div>

      <p v-else-if="options.length === 0" class="attendees-dialog__empty">
        Ahora mismo no hay ningún usuario que pueda asistir a reuniones.
      </p>

      <fieldset v-if="isChecklistVisible && options.length > 0" class="attendees-dialog__fieldset">
        <legend class="attendees-dialog__legend">Candidatos</legend>
        <ul ref="checklistEl" class="attendees-dialog__list">
          <li v-for="option in options" :key="option.id" class="attendees-dialog__option">
            <label class="attendees-dialog__check">
              <input
                type="checkbox"
                :checked="selectedIds.has(option.id)"
                :disabled="isSubmitting"
                @change="toggle(option.id, ($event.target as HTMLInputElement).checked)"
              />
              <span>{{ option.nickname }}</span>
            </label>
          </li>
        </ul>
      </fieldset>

      <p v-if="isChecklistVisible && ineligibleAttendees.length > 0" class="attendees-dialog__note">
        Ya no pueden asistir y se quitarán al guardar:
        {{ ineligibleAttendees.map((attendee) => attendee.user.nickname).join(', ') }}.
      </p>

      <AlertMessage v-if="isChecklistVisible && attendanceToLose.length > 0" variant="info">
        Al guardar se perderá la asistencia ya registrada de:
        {{
          attendanceToLose
            .map(
              (attendee) =>
                `${attendee.user.nickname} (${meetingAttendanceLabel(attendee.status)})`,
            )
            .join(', ')
        }}.
      </AlertMessage>

      <AlertMessage v-if="localError" variant="error">{{ localError }}</AlertMessage>
      <AlertMessage v-if="error" variant="error">{{ error }}</AlertMessage>

      <div class="attendees-dialog__actions">
        <button
          ref="cancelButton"
          type="button"
          class="attendees-dialog__secondary"
          :disabled="isSubmitting"
          @click="emit('cancel')"
        >
          Cancelar
        </button>
        <button
          type="submit"
          class="attendees-dialog__submit"
          :disabled="isSubmitting || !isChecklistVisible"
          :aria-busy="isSubmitting"
        >
          {{ isSubmitting ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.attendees-dialog {
  border: none;
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: var(--shadow-md);
  max-width: min(90vw, 28rem);
  width: 100%;
}

.attendees-dialog::backdrop {
  background: rgba(15, 18, 25, 0.45);
}

.attendees-dialog__box {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  max-height: 85vh;
  overflow-y: auto;
}

.attendees-dialog__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.attendees-dialog__description {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.attendees-dialog__options-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.attendees-dialog__empty,
.attendees-dialog__note {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.5;
  color: var(--text-secondary);
}

.attendees-dialog__fieldset {
  margin: 0;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  min-width: 0;
}

.attendees-dialog__legend {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.attendees-dialog__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.attendees-dialog__option + .attendees-dialog__option {
  border-top: 1px solid var(--border);
}

.attendees-dialog__check {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 48px;
  padding: 0.4rem 0.9rem;
  font-size: 0.95rem;
  color: var(--text-primary);
  cursor: pointer;
  overflow-wrap: anywhere;
}

.attendees-dialog__check input {
  width: 1.15rem;
  height: 1.15rem;
  flex-shrink: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

.attendees-dialog__actions {
  margin-top: 0.4rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.attendees-dialog__secondary,
.attendees-dialog__submit {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.attendees-dialog__secondary {
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.attendees-dialog__secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.attendees-dialog__submit {
  border: none;
  background: var(--accent);
  color: white;
}

.attendees-dialog__submit:hover:not(:disabled) {
  background: var(--accent-hover);
}

.attendees-dialog__secondary:disabled,
.attendees-dialog__submit:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
