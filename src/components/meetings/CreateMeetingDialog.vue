<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import { MEETING_TYPE_OPTIONS } from '@/utils/meeting-labels'
import { toIsoDateTime, validateMeetingName } from '@/utils/meeting-form'
import type { MeetingType } from '@/types'

const props = withDefaults(
  defineProps<{
    open: boolean
    isCreating: boolean
    error?: string
  }>(),
  { error: '' },
)

const emit = defineEmits<{
  submit: [payload: { name: string; scheduledAt: string; type: MeetingType }]
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

// Mismo mecanismo que el resto de diálogos: distingue un cierre provocado
// por nosotros mismos (al reaccionar a `open` pasando a false) de uno
// iniciado por el usuario (Escape) — solo este último debe emitir "cancel".
let closingFromPropChange = false

watch(
  () => props.open,
  async (open) => {
    if (open) {
      // "Al abrir, limpia estado y enfoca Nombre" — nunca arrastra valores
      // ni errores de una apertura anterior.
      name.value = ''
      scheduledAtLocal.value = ''
      type.value = ''
      nameError.value = ''
      scheduledAtError.value = ''
      typeError.value = ''
      dialogEl.value?.showModal()
      await nextTick()
      nameInput.value?.focus()
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
// se bloquea mientras se crea la reunión para no dejar la operación huérfana.
function handleNativeCancel(event: Event) {
  if (props.isCreating) {
    event.preventDefault()
  }
}

function handleBackdropClick(event: MouseEvent) {
  if (!props.isCreating && event.target === dialogEl.value) {
    emit('cancel')
  }
}

async function handleSubmit() {
  if (props.isCreating) return

  const nameMessage = validateMeetingName(name.value)
  const isoScheduledAt = toIsoDateTime(scheduledAtLocal.value)
  const scheduledAtMessage = isoScheduledAt ? '' : 'La fecha y hora no son válidas.'
  const typeMessage = type.value ? '' : 'El tipo es obligatorio.'

  nameError.value = nameMessage
  scheduledAtError.value = scheduledAtMessage
  typeError.value = typeMessage

  if (nameMessage || scheduledAtMessage || typeMessage) {
    await nextTick()
    if (nameMessage) nameInput.value?.focus()
    else if (scheduledAtMessage) scheduledAtInput.value?.focus()
    else typeSelect.value?.focus()
    return
  }

  emit('submit', {
    name: name.value.trim(),
    scheduledAt: isoScheduledAt as string,
    type: type.value as MeetingType,
  })
}
</script>

<template>
  <dialog
    ref="dialogEl"
    class="create-meeting-dialog"
    aria-labelledby="create-meeting-title"
    @close="handleClose"
    @cancel="handleNativeCancel"
    @click="handleBackdropClick"
  >
    <div class="create-meeting-dialog__box" @click.stop>
      <h2 id="create-meeting-title" class="create-meeting-dialog__title">Nueva reunión</h2>

      <form
        id="create-meeting-form"
        class="create-meeting-dialog__form"
        novalidate
        @submit.prevent="handleSubmit"
      >
        <div class="field">
          <label for="create-meeting-name">Nombre</label>
          <input
            id="create-meeting-name"
            ref="nameInput"
            v-model="name"
            type="text"
            autocomplete="off"
            maxlength="160"
            :disabled="isCreating"
            :aria-invalid="!!nameError"
            :aria-describedby="nameError ? 'create-meeting-name-error' : undefined"
          />
          <span v-if="nameError" id="create-meeting-name-error" class="field-error">{{
            nameError
          }}</span>
        </div>

        <div class="field">
          <label for="create-meeting-scheduled-at">Fecha y hora</label>
          <input
            id="create-meeting-scheduled-at"
            ref="scheduledAtInput"
            v-model="scheduledAtLocal"
            type="datetime-local"
            :disabled="isCreating"
            :aria-invalid="!!scheduledAtError"
            :aria-describedby="scheduledAtError ? 'create-meeting-scheduled-at-error' : undefined"
          />
          <span
            v-if="scheduledAtError"
            id="create-meeting-scheduled-at-error"
            class="field-error"
            >{{ scheduledAtError }}</span
          >
        </div>

        <div class="field">
          <label for="create-meeting-type">Tipo</label>
          <select
            id="create-meeting-type"
            ref="typeSelect"
            v-model="type"
            :disabled="isCreating"
            :aria-invalid="!!typeError"
            :aria-describedby="typeError ? 'create-meeting-type-error' : undefined"
          >
            <option value="" disabled>Selecciona un tipo</option>
            <option v-for="option in MEETING_TYPE_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <span v-if="typeError" id="create-meeting-type-error" class="field-error">{{
            typeError
          }}</span>
        </div>

        <AlertMessage v-if="error" variant="error">{{ error }}</AlertMessage>
      </form>

      <div class="create-meeting-dialog__actions">
        <button
          type="button"
          class="create-meeting-dialog__cancel"
          :disabled="isCreating"
          @click="emit('cancel')"
        >
          Cancelar
        </button>
        <button
          type="submit"
          form="create-meeting-form"
          class="create-meeting-dialog__confirm"
          :disabled="isCreating"
          :aria-busy="isCreating"
        >
          {{ isCreating ? 'Creando…' : 'Crear reunión' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.create-meeting-dialog {
  border: none;
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: var(--shadow-md);
  max-width: min(90vw, 28rem);
  width: 100%;
}

.create-meeting-dialog::backdrop {
  background: rgba(15, 18, 25, 0.45);
}

.create-meeting-dialog__box {
  padding: 1.5rem;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
}

.create-meeting-dialog__title {
  margin: 0 0 1rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
}

.create-meeting-dialog__form {
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

.create-meeting-dialog__actions {
  margin-top: 0.9rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.create-meeting-dialog__cancel,
.create-meeting-dialog__confirm {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.create-meeting-dialog__cancel {
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.create-meeting-dialog__cancel:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.create-meeting-dialog__confirm {
  border: none;
  background: var(--accent);
  color: white;
}

.create-meeting-dialog__confirm:hover:not(:disabled) {
  background: var(--accent-hover);
}

.create-meeting-dialog__cancel:disabled,
.create-meeting-dialog__confirm:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
