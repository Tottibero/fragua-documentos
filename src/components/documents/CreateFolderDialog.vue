<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import AlertMessage from '@/components/common/AlertMessage.vue'

// Mismas reglas que el backend (`DRIVE_SAFE_NAME_PATTERN`, ya aplicadas
// sobre el valor recortado): obligatorio, distinto de "." / "..", máximo
// 255 caracteres, sin "/", "\" ni caracteres de control.
const MAX_NAME_LENGTH = 255
// eslint-disable-next-line no-control-regex -- se excluyen deliberadamente los caracteres de control
const CONTROL_CHAR_PATTERN = /[\x00-\x1F]/

function validateName(rawName: string): string {
  const trimmed = rawName.trim()
  if (!trimmed) return 'El nombre de la carpeta es obligatorio.'
  if (trimmed === '.' || trimmed === '..') {
    return 'El nombre de la carpeta no puede ser «.» ni «..».'
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return `El nombre no puede superar los ${MAX_NAME_LENGTH} caracteres.`
  }
  if (trimmed.includes('/') || trimmed.includes('\\') || CONTROL_CHAR_PATTERN.test(trimmed)) {
    return 'El nombre no puede contener "/", "\\" ni caracteres de control.'
  }
  return ''
}

const props = withDefaults(
  defineProps<{
    open: boolean
    isCreating: boolean
    error?: string
  }>(),
  { error: '' },
)

const emit = defineEmits<{ submit: [name: string]; cancel: [] }>()

const dialogEl = ref<HTMLDialogElement>()
const nameInput = ref<HTMLInputElement>()
const name = ref('')
const fieldError = ref('')

// Mismo mecanismo que ConfirmDialog: distingue un cierre provocado por
// nosotros mismos (al reaccionar a `open` pasando a false) de uno iniciado
// por el usuario (Escape) — solo este último debe emitir "cancel".
let closingFromPropChange = false

watch(
  () => props.open,
  async (open) => {
    if (open) {
      name.value = ''
      fieldError.value = ''
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
// se bloquea mientras se está creando para no dejar la creación huérfana.
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

  const message = validateName(name.value)
  if (message) {
    fieldError.value = message
    await nextTick()
    nameInput.value?.focus()
    return
  }

  fieldError.value = ''
  emit('submit', name.value.trim())
}
</script>

<template>
  <dialog
    ref="dialogEl"
    class="create-folder-dialog"
    aria-labelledby="create-folder-title"
    @close="handleClose"
    @cancel="handleNativeCancel"
    @click="handleBackdropClick"
  >
    <div class="create-folder-dialog__box" @click.stop>
      <h2 id="create-folder-title" class="create-folder-dialog__title">Nueva carpeta</h2>

      <form class="create-folder-dialog__form" novalidate @submit.prevent="handleSubmit">
        <div class="field">
          <label for="folder-name">Nombre de la carpeta</label>
          <input
            id="folder-name"
            ref="nameInput"
            v-model="name"
            type="text"
            autocomplete="off"
            :disabled="isCreating"
            :aria-invalid="!!fieldError"
            :aria-describedby="fieldError ? 'folder-name-error' : undefined"
          />
          <span v-if="fieldError" id="folder-name-error" class="field-error">{{ fieldError }}</span>
        </div>

        <AlertMessage v-if="error" variant="error">{{ error }}</AlertMessage>

        <div class="create-folder-dialog__actions">
          <button
            type="button"
            class="create-folder-dialog__cancel"
            :disabled="isCreating"
            @click="emit('cancel')"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="create-folder-dialog__confirm"
            :disabled="isCreating"
            :aria-busy="isCreating"
          >
            {{ isCreating ? 'Creando…' : 'Crear' }}
          </button>
        </div>
      </form>
    </div>
  </dialog>
</template>

<style scoped>
.create-folder-dialog {
  border: none;
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: var(--shadow-md);
  max-width: min(90vw, 26rem);
  width: 100%;
}

.create-folder-dialog::backdrop {
  background: rgba(15, 18, 25, 0.45);
}

.create-folder-dialog__box {
  padding: 1.5rem;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
}

.create-folder-dialog__title {
  margin: 0 0 1rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
}

.create-folder-dialog__form {
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

.field input {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  font-size: 0.95rem;
  background: var(--bg-surface);
  color: var(--text-primary);
}

.field input:focus {
  border-color: var(--accent);
}

.field input:disabled {
  background: var(--bg-hover);
  color: var(--text-muted);
}

.field input[aria-invalid='true'] {
  border-color: var(--danger);
}

.field-error {
  font-size: 0.8rem;
  color: var(--danger);
}

.create-folder-dialog__actions {
  margin-top: 0.25rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.create-folder-dialog__cancel,
.create-folder-dialog__confirm {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.create-folder-dialog__cancel {
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.create-folder-dialog__cancel:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.create-folder-dialog__confirm {
  border: none;
  background: var(--accent);
  color: white;
}

.create-folder-dialog__confirm:hover:not(:disabled) {
  background: var(--accent-hover);
}

.create-folder-dialog__cancel:disabled,
.create-folder-dialog__confirm:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
