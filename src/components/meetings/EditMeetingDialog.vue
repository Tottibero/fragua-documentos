<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import { MEETING_TYPE_OPTIONS } from '@/utils/meeting-labels'
import { toIsoDateTime, toLocalDateTimeInputValue, validateMeetingName } from '@/utils/meeting-form'
import type { Meeting, MeetingType } from '@/types'
import type { UpdateMeetingPayload } from '@/services/meetings.service'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Reunión que se está editando — `null` solo antes de la primera
     * apertura. Mientras `open` es `true` el llamador la mantiene estable
     * (no la limpia hasta que el diálogo se cierra de verdad), así que sus
     * valores originales siguen disponibles para calcular el PATCH parcial
     * al enviar. */
    meeting: Meeting | null
    isUpdating: boolean
    error?: string
  }>(),
  { error: '' },
)

const emit = defineEmits<{
  submit: [payload: UpdateMeetingPayload]
  cancel: []
}>()

const dialogEl = ref<HTMLDialogElement>()
const nameInput = ref<HTMLInputElement>()
const scheduledAtInput = ref<HTMLInputElement>()
const typeSelect = ref<HTMLSelectElement>()

const name = ref('')
const scheduledAtLocal = ref('')
const type = ref<MeetingType | ''>('')

const nameError = ref('')
const scheduledAtError = ref('')
const typeError = ref('')
// Validación local propia de este diálogo (fase 3.1b): "no hay cambios que
// guardar". Distinta de `error` (la respuesta traducida del backend) —
// nunca se envían ambas a la vez, porque esta bloquea la llamada antes de
// que exista una respuesta que traducir.
const noChangesError = ref('')

// Mismo mecanismo que el resto de diálogos: distingue un cierre provocado
// por nosotros mismos (al reaccionar a `open` pasando a false) de uno
// iniciado por el usuario (Escape) — solo este último debe emitir "cancel".
let closingFromPropChange = false

watch(
  () => props.open,
  async (open) => {
    if (open) {
      // Precarga los valores actuales de la reunión — nunca arrastra
      // valores ni errores de una apertura anterior.
      name.value = props.meeting?.name ?? ''
      scheduledAtLocal.value = props.meeting ? toLocalDateTimeInputValue(props.meeting.scheduledAt) : ''
      type.value = props.meeting?.type ?? ''
      nameError.value = ''
      scheduledAtError.value = ''
      typeError.value = ''
      noChangesError.value = ''
      dialogEl.value?.showModal()
      await nextTick()
      nameInput.value?.focus()
      nameInput.value?.select()
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

// Evento nativo "cancel" (Escape), disparado antes de "close" y cancelable:
// se bloquea mientras se guarda la edición para no dejar la operación
// huérfana.
function handleNativeCancel(event: Event) {
  if (props.isUpdating) {
    event.preventDefault()
  }
}

function handleBackdropClick(event: MouseEvent) {
  if (!props.isUpdating && event.target === dialogEl.value) {
    emit('cancel')
  }
}

async function handleSubmit() {
  if (props.isUpdating) return
  if (!props.meeting) return

  const nameMessage = validateMeetingName(name.value)
  const isoScheduledAt = toIsoDateTime(scheduledAtLocal.value)
  const scheduledAtMessage = isoScheduledAt ? '' : 'La fecha y hora no son válidas.'
  const typeMessage = type.value ? '' : 'El tipo es obligatorio.'

  nameError.value = nameMessage
  scheduledAtError.value = scheduledAtMessage
  typeError.value = typeMessage
  noChangesError.value = ''

  if (nameMessage || scheduledAtMessage || typeMessage) {
    await nextTick()
    if (nameMessage) nameInput.value?.focus()
    else if (scheduledAtMessage) scheduledAtInput.value?.focus()
    else typeSelect.value?.focus()
    return
  }

  // PATCH parcial: solo los campos cuyo valor normalizado difiere del
  // original. Si ninguno cambió, es una validación local — nunca se llama
  // al backend con un cuerpo vacío.
  const normalizedName = name.value.trim()
  const payload: UpdateMeetingPayload = {}
  if (normalizedName !== props.meeting.name) payload.name = normalizedName
  if (isoScheduledAt !== props.meeting.scheduledAt) payload.scheduledAt = isoScheduledAt as string
  if (type.value !== props.meeting.type) payload.type = type.value as MeetingType

  if (Object.keys(payload).length === 0) {
    noChangesError.value = 'No hay cambios que guardar.'
    return
  }

  emit('submit', payload)
}
</script>

<template>
  <dialog
    ref="dialogEl"
    class="edit-meeting-dialog"
    aria-labelledby="edit-meeting-title"
    @close="handleClose"
    @cancel="handleNativeCancel"
    @click="handleBackdropClick"
  >
    <div class="edit-meeting-dialog__box" @click.stop>
      <h2 id="edit-meeting-title" class="edit-meeting-dialog__title">
        Editar reunión «{{ meeting?.name ?? '' }}»
      </h2>

      <form
        id="edit-meeting-form"
        class="edit-meeting-dialog__form"
        novalidate
        @submit.prevent="handleSubmit"
      >
        <div class="field">
          <label for="edit-meeting-name">Nombre</label>
          <input
            id="edit-meeting-name"
            ref="nameInput"
            v-model="name"
            type="text"
            autocomplete="off"
            maxlength="160"
            :disabled="isUpdating"
            :aria-invalid="!!nameError"
            :aria-describedby="nameError ? 'edit-meeting-name-error' : undefined"
          />
          <span v-if="nameError" id="edit-meeting-name-error" class="field-error">{{
            nameError
          }}</span>
        </div>

        <div class="field">
          <label for="edit-meeting-scheduled-at">Fecha y hora</label>
          <input
            id="edit-meeting-scheduled-at"
            ref="scheduledAtInput"
            v-model="scheduledAtLocal"
            type="datetime-local"
            :disabled="isUpdating"
            :aria-invalid="!!scheduledAtError"
            :aria-describedby="scheduledAtError ? 'edit-meeting-scheduled-at-error' : undefined"
          />
          <span
            v-if="scheduledAtError"
            id="edit-meeting-scheduled-at-error"
            class="field-error"
            >{{ scheduledAtError }}</span
          >
        </div>

        <div class="field">
          <label for="edit-meeting-type">Tipo</label>
          <select
            id="edit-meeting-type"
            ref="typeSelect"
            v-model="type"
            :disabled="isUpdating"
            :aria-invalid="!!typeError"
            :aria-describedby="typeError ? 'edit-meeting-type-error' : undefined"
          >
            <option value="" disabled>Selecciona un tipo</option>
            <option v-for="option in MEETING_TYPE_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <span v-if="typeError" id="edit-meeting-type-error" class="field-error">{{
            typeError
          }}</span>
        </div>

        <AlertMessage v-if="noChangesError" variant="info">{{ noChangesError }}</AlertMessage>
        <AlertMessage v-if="error" variant="error">{{ error }}</AlertMessage>
      </form>

      <div class="edit-meeting-dialog__actions">
        <button
          type="button"
          class="edit-meeting-dialog__cancel"
          :disabled="isUpdating"
          @click="emit('cancel')"
        >
          Cancelar
        </button>
        <button
          type="submit"
          form="edit-meeting-form"
          class="edit-meeting-dialog__confirm"
          :disabled="isUpdating"
          :aria-busy="isUpdating"
        >
          {{ isUpdating ? 'Guardando…' : 'Guardar cambios' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.edit-meeting-dialog {
  border: none;
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: var(--shadow-md);
  max-width: min(90vw, 28rem);
  width: 100%;
}

.edit-meeting-dialog::backdrop {
  background: rgba(15, 18, 25, 0.45);
}

.edit-meeting-dialog__box {
  padding: 1.5rem;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
}

.edit-meeting-dialog__title {
  margin: 0 0 1rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.edit-meeting-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.field input,
.field select {
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  font-size: 0.95rem;
  font-family: inherit;
  background: var(--bg-surface);
  color: var(--text-primary);
}

.field input:focus,
.field select:focus {
  border-color: var(--accent);
}

.field input:disabled,
.field select:disabled {
  background: var(--bg-hover);
  color: var(--text-muted);
}

.field input[aria-invalid='true'],
.field select[aria-invalid='true'] {
  border-color: var(--danger);
}

.field-error {
  font-size: 0.8rem;
  color: var(--danger);
}

.edit-meeting-dialog__actions {
  margin-top: 0.9rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.edit-meeting-dialog__cancel,
.edit-meeting-dialog__confirm {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.edit-meeting-dialog__cancel {
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.edit-meeting-dialog__cancel:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.edit-meeting-dialog__confirm {
  border: none;
  background: var(--accent);
  color: white;
}

.edit-meeting-dialog__confirm:hover:not(:disabled) {
  background: var(--accent-hover);
}

.edit-meeting-dialog__cancel:disabled,
.edit-meeting-dialog__confirm:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
