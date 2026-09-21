<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import type { MeetingPoint } from '@/types'
import type {
  CreateMeetingPointPayload,
  UpdateMeetingPointPayload,
} from '@/services/meetings.service'

const TITLE_MAX_LENGTH = 200
const DESCRIPTION_MAX_LENGTH = 4000
const NOTES_MAX_LENGTH = 8000
const AGREEMENTS_MAX_LENGTH = 8000
const RESPONSIBLE_MAX_LENGTH = 160

// El título es una sola línea — nunca admite tabulador ni salto de línea,
// igual que `MEETING_POINT_TITLE_PATTERN` en el backend.
// eslint-disable-next-line no-control-regex -- se excluyen deliberadamente los caracteres de control
const TITLE_FORBIDDEN_PATTERN = /[\x00-\x1F\x7F]/
// El resto de campos son texto libre multilínea: admiten tabulador y saltos
// de línea, igual que `FORBIDDEN_TEXT_CONTROL_CHARS` en el backend.
// eslint-disable-next-line no-control-regex -- se excluyen deliberadamente los caracteres de control salvo \t \n \r
const MULTILINE_FORBIDDEN_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/

function validateTitle(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return 'El título es obligatorio.'
  if (trimmed.length > TITLE_MAX_LENGTH) {
    return `El título no puede superar los ${TITLE_MAX_LENGTH} caracteres.`
  }
  if (TITLE_FORBIDDEN_PATTERN.test(trimmed)) {
    return 'El título no puede contener caracteres de control.'
  }
  return ''
}

function validateOptionalText(raw: string, maxLength: number, fieldLabel: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (trimmed.length > maxLength) {
    return `${fieldLabel} no puede superar los ${maxLength} caracteres.`
  }
  if (MULTILINE_FORBIDDEN_PATTERN.test(trimmed)) {
    return `${fieldLabel} no puede contener caracteres de control.`
  }
  return ''
}

/** `''` (vacío tras recortar) se normaliza siempre a `null` — igual que
 * hace el backend (`TrimToNullIfEmpty`). */
function normalizeOptional(raw: string): string | null {
  const trimmed = raw.trim()
  return trimmed === '' ? null : trimmed
}

const props = withDefaults(
  defineProps<{
    open: boolean
    mode: 'create' | 'edit'
    /** El punto que se está editando — `null` en modo `create`, o antes de
     * la primera apertura en modo `edit`. Mientras `open` es `true` el
     * llamador lo mantiene estable, para poder calcular el PATCH parcial al
     * enviar. */
    point: MeetingPoint | null
    isSubmitting: boolean
    error?: string
  }>(),
  { error: '' },
)

const emit = defineEmits<{
  submit: [payload: CreateMeetingPointPayload | UpdateMeetingPointPayload]
  cancel: []
}>()

const dialogEl = ref<HTMLDialogElement>()
const titleInput = ref<HTMLInputElement>()
const descriptionInput = ref<HTMLTextAreaElement>()
const notesInput = ref<HTMLTextAreaElement>()
const agreementsInput = ref<HTMLTextAreaElement>()
const responsibleInput = ref<HTMLInputElement>()

const title = ref('')
const description = ref('')
const notes = ref('')
const agreements = ref('')
const responsible = ref('')

const titleError = ref('')
const descriptionError = ref('')
const notesError = ref('')
const agreementsError = ref('')
const responsibleError = ref('')
// Validación local propia de este diálogo, solo en modo edición: "no hay
// cambios que guardar". Nunca convive con `error` (la respuesta traducida
// del backend) — esta bloquea la llamada antes de que exista una respuesta
// que traducir.
const noChangesError = ref('')

// Mismo mecanismo que el resto de diálogos: distingue un cierre provocado
// por nosotros mismos (al reaccionar a `open` pasando a false) de uno
// iniciado por el usuario (Escape) — solo este último debe emitir "cancel".
let closingFromPropChange = false

watch(
  () => props.open,
  async (open) => {
    if (open) {
      title.value = props.point?.title ?? ''
      description.value = props.point?.description ?? ''
      notes.value = props.point?.notes ?? ''
      agreements.value = props.point?.agreements ?? ''
      responsible.value = props.point?.responsible ?? ''
      titleError.value = ''
      descriptionError.value = ''
      notesError.value = ''
      agreementsError.value = ''
      responsibleError.value = ''
      noChangesError.value = ''
      dialogEl.value?.showModal()
      await nextTick()
      if (props.mode === 'edit') {
        titleInput.value?.focus()
        titleInput.value?.select()
      } else {
        titleInput.value?.focus()
      }
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
// se bloquea mientras se guarda para no dejar la operación huérfana.
function handleNativeCancel(event: Event) {
  if (props.isSubmitting) {
    event.preventDefault()
  }
}

function handleBackdropClick(event: MouseEvent) {
  if (!props.isSubmitting && event.target === dialogEl.value) {
    emit('cancel')
  }
}

async function handleSubmit() {
  if (props.isSubmitting) return

  const titleMessage = validateTitle(title.value)
  const descriptionMessage = validateOptionalText(
    description.value,
    DESCRIPTION_MAX_LENGTH,
    'La descripción',
  )
  const notesMessage = validateOptionalText(notes.value, NOTES_MAX_LENGTH, 'Las notas')
  const agreementsMessage = validateOptionalText(
    agreements.value,
    AGREEMENTS_MAX_LENGTH,
    'Los acuerdos',
  )
  const responsibleMessage = validateOptionalText(
    responsible.value,
    RESPONSIBLE_MAX_LENGTH,
    'El responsable',
  )

  titleError.value = titleMessage
  descriptionError.value = descriptionMessage
  notesError.value = notesMessage
  agreementsError.value = agreementsMessage
  responsibleError.value = responsibleMessage
  noChangesError.value = ''

  if (titleMessage || descriptionMessage || notesMessage || agreementsMessage || responsibleMessage) {
    await nextTick()
    if (titleMessage) titleInput.value?.focus()
    else if (descriptionMessage) descriptionInput.value?.focus()
    else if (notesMessage) notesInput.value?.focus()
    else if (agreementsMessage) agreementsInput.value?.focus()
    else responsibleInput.value?.focus()
    return
  }

  const normalizedTitle = title.value.trim()
  const normalizedDescription = normalizeOptional(description.value)
  const normalizedNotes = normalizeOptional(notes.value)
  const normalizedAgreements = normalizeOptional(agreements.value)
  const normalizedResponsible = normalizeOptional(responsible.value)

  if (props.mode === 'create') {
    emit('submit', {
      title: normalizedTitle,
      description: normalizedDescription,
      notes: normalizedNotes,
      agreements: normalizedAgreements,
      responsible: normalizedResponsible,
    })
    return
  }

  // Edición: PATCH parcial, solo con los campos cuyo valor normalizado
  // difiere del original. Si ninguno cambió, es una validación local —
  // nunca se llama al backend con un cuerpo vacío.
  const original = props.point
  if (!original) return

  const payload: UpdateMeetingPointPayload = {}
  if (normalizedTitle !== original.title) payload.title = normalizedTitle
  if (normalizedDescription !== original.description) payload.description = normalizedDescription
  if (normalizedNotes !== original.notes) payload.notes = normalizedNotes
  if (normalizedAgreements !== original.agreements) payload.agreements = normalizedAgreements
  if (normalizedResponsible !== original.responsible) payload.responsible = normalizedResponsible

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
    class="meeting-point-form-dialog"
    aria-labelledby="meeting-point-form-title-heading"
    @close="handleClose"
    @cancel="handleNativeCancel"
    @click="handleBackdropClick"
  >
    <div class="meeting-point-form-dialog__box" @click.stop>
      <h2 id="meeting-point-form-title-heading" class="meeting-point-form-dialog__title">
        {{ mode === 'create' ? 'Añadir punto' : `Editar punto «${point?.title ?? ''}»` }}
      </h2>

      <form
        id="meeting-point-form"
        class="meeting-point-form-dialog__form"
        novalidate
        @submit.prevent="handleSubmit"
      >
        <div class="field">
          <label for="meeting-point-form-title">Título</label>
          <input
            id="meeting-point-form-title"
            ref="titleInput"
            v-model="title"
            type="text"
            autocomplete="off"
            :maxlength="TITLE_MAX_LENGTH"
            :disabled="isSubmitting"
            :aria-invalid="!!titleError"
            :aria-describedby="titleError ? 'meeting-point-form-title-error' : undefined"
          />
          <span v-if="titleError" id="meeting-point-form-title-error" class="field-error">{{
            titleError
          }}</span>
        </div>

        <div class="field">
          <label for="meeting-point-form-description">Descripción</label>
          <textarea
            id="meeting-point-form-description"
            ref="descriptionInput"
            v-model="description"
            rows="3"
            :maxlength="DESCRIPTION_MAX_LENGTH"
            :disabled="isSubmitting"
            :aria-invalid="!!descriptionError"
            :aria-describedby="descriptionError ? 'meeting-point-form-description-error' : undefined"
          ></textarea>
          <span
            v-if="descriptionError"
            id="meeting-point-form-description-error"
            class="field-error"
            >{{ descriptionError }}</span
          >
        </div>

        <div class="field">
          <label for="meeting-point-form-notes">Notas</label>
          <textarea
            id="meeting-point-form-notes"
            ref="notesInput"
            v-model="notes"
            rows="3"
            :maxlength="NOTES_MAX_LENGTH"
            :disabled="isSubmitting"
            :aria-invalid="!!notesError"
            :aria-describedby="notesError ? 'meeting-point-form-notes-error' : undefined"
          ></textarea>
          <span v-if="notesError" id="meeting-point-form-notes-error" class="field-error">{{
            notesError
          }}</span>
        </div>

        <div class="field">
          <label for="meeting-point-form-agreements">Acuerdos</label>
          <textarea
            id="meeting-point-form-agreements"
            ref="agreementsInput"
            v-model="agreements"
            rows="3"
            :maxlength="AGREEMENTS_MAX_LENGTH"
            :disabled="isSubmitting"
            :aria-invalid="!!agreementsError"
            :aria-describedby="agreementsError ? 'meeting-point-form-agreements-error' : undefined"
          ></textarea>
          <span
            v-if="agreementsError"
            id="meeting-point-form-agreements-error"
            class="field-error"
            >{{ agreementsError }}</span
          >
        </div>

        <div class="field">
          <label for="meeting-point-form-responsible">Responsable</label>
          <input
            id="meeting-point-form-responsible"
            ref="responsibleInput"
            v-model="responsible"
            type="text"
            autocomplete="off"
            :maxlength="RESPONSIBLE_MAX_LENGTH"
            :disabled="isSubmitting"
            :aria-invalid="!!responsibleError"
            :aria-describedby="responsibleError ? 'meeting-point-form-responsible-error' : undefined"
          />
          <span
            v-if="responsibleError"
            id="meeting-point-form-responsible-error"
            class="field-error"
            >{{ responsibleError }}</span
          >
        </div>

        <AlertMessage v-if="noChangesError" variant="info">{{ noChangesError }}</AlertMessage>
        <AlertMessage v-if="error" variant="error">{{ error }}</AlertMessage>
      </form>

      <div class="meeting-point-form-dialog__actions">
        <button
          type="button"
          class="meeting-point-form-dialog__cancel"
          :disabled="isSubmitting"
          @click="emit('cancel')"
        >
          Cancelar
        </button>
        <button
          type="submit"
          form="meeting-point-form"
          class="meeting-point-form-dialog__confirm"
          :disabled="isSubmitting"
          :aria-busy="isSubmitting"
        >
          {{ isSubmitting ? 'Guardando…' : mode === 'create' ? 'Añadir punto' : 'Guardar cambios' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.meeting-point-form-dialog {
  border: none;
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: var(--shadow-md);
  max-width: min(90vw, 32rem);
  width: 100%;
}

.meeting-point-form-dialog::backdrop {
  background: rgba(15, 18, 25, 0.45);
}

.meeting-point-form-dialog__box {
  padding: 1.5rem;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  max-height: 85vh;
  overflow-y: auto;
}

.meeting-point-form-dialog__title {
  margin: 0 0 1rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.meeting-point-form-dialog__form {
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
.field textarea {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  font-size: 0.95rem;
  font-family: inherit;
  background: var(--bg-surface);
  color: var(--text-primary);
}

.field input {
  min-height: 44px;
}

.field textarea {
  resize: vertical;
  min-height: 4.5rem;
}

.field input:focus,
.field textarea:focus {
  border-color: var(--accent);
}

.field input:disabled,
.field textarea:disabled {
  background: var(--bg-hover);
  color: var(--text-muted);
}

.field input[aria-invalid='true'],
.field textarea[aria-invalid='true'] {
  border-color: var(--danger);
}

.field-error {
  font-size: 0.8rem;
  color: var(--danger);
}

.meeting-point-form-dialog__actions {
  margin-top: 0.9rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.meeting-point-form-dialog__cancel,
.meeting-point-form-dialog__confirm {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.meeting-point-form-dialog__cancel {
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.meeting-point-form-dialog__cancel:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.meeting-point-form-dialog__confirm {
  border: none;
  background: var(--accent);
  color: white;
}

.meeting-point-form-dialog__confirm:hover:not(:disabled) {
  background: var(--accent-hover);
}

.meeting-point-form-dialog__cancel:disabled,
.meeting-point-form-dialog__confirm:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
