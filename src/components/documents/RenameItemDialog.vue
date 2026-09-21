<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import NameConflictResolver from '@/components/documents/NameConflictResolver.vue'
import type { DriveItem, DriveNameConflictResponse } from '@/types'

// Mismas reglas que el backend (`DRIVE_SAFE_NAME_PATTERN`, ya aplicadas
// sobre el valor recortado): obligatorio, distinto de "." / "..", máximo
// 255 caracteres, sin "/", "\" ni caracteres de control. Además, un nombre
// igual al actual (tras recortar) se rechaza aquí mismo: no tiene sentido
// pedir un renombrado que no cambia nada.
const MAX_NAME_LENGTH = 255
// eslint-disable-next-line no-control-regex -- se excluyen deliberadamente los caracteres de control
const CONTROL_CHAR_PATTERN = /[\x00-\x1F]/

function validateName(rawName: string, currentName: string): string {
  const trimmed = rawName.trim()
  if (!trimmed) return 'El nombre es obligatorio.'
  if (trimmed === '.' || trimmed === '..') {
    return 'El nombre no puede ser «.» ni «..».'
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return `El nombre no puede superar los ${MAX_NAME_LENGTH} caracteres.`
  }
  if (trimmed.includes('/') || trimmed.includes('\\') || CONTROL_CHAR_PATTERN.test(trimmed)) {
    return 'El nombre no puede contener "/", "\\" ni caracteres de control.'
  }
  if (trimmed === currentName) {
    return 'El nombre es igual al actual.'
  }
  return ''
}

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Elemento que se está renombrando — `null` solo antes de la primera
     * apertura. Mientras `open` es `true` el llamador lo mantiene estable
     * (no lo limpia hasta que el diálogo se cierra de verdad). */
    item: DriveItem | null
    isRenaming: boolean
    error?: string
    /** Fase 2.6: conflicto estructurado del renombrado en curso — su sola
     * presencia decide si se muestra el formulario o
     * `NameConflictResolver`. */
    conflict: DriveNameConflictResponse | null
  }>(),
  { error: '' },
)

const emit = defineEmits<{
  submit: [name: string]
  cancel: []
  /** Reenvío tras un conflicto — lleva el mismo nombre ya introducido y
   * validado, con `keep_both` (la única resolución que renombrar admite). */
  'resolve-keep-both': [name: string]
  /** "Volver" del resolver: cancela solo la resolución, nunca el diálogo
   * completo — el padre limpia `conflict` (vía `resetRenameState`) y este
   * componente vuelve a mostrar el formulario con el nombre intacto. */
  'conflict-back': []
}>()

const dialogEl = ref<HTMLDialogElement>()
const nameInput = ref<HTMLInputElement>()
const conflictResolverRef = ref<InstanceType<typeof NameConflictResolver>>()
const name = ref('')
const fieldError = ref('')

// Mismo mecanismo que ConfirmDialog/CreateFolderDialog: distingue un cierre
// provocado por nosotros mismos (al reaccionar a `open` pasando a false) de
// uno iniciado por el usuario (Escape) — solo este último debe emitir
// "cancel".
let closingFromPropChange = false

watch(
  () => props.open,
  async (open) => {
    if (open) {
      name.value = props.item?.name ?? ''
      fieldError.value = ''
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
// se bloquea mientras se está renombrando para no dejar la operación
// huérfana.
function handleNativeCancel(event: Event) {
  if (props.isRenaming) {
    event.preventDefault()
  }
}

function handleBackdropClick(event: MouseEvent) {
  if (!props.isRenaming && event.target === dialogEl.value) {
    emit('cancel')
  }
}

async function handleSubmit() {
  if (props.isRenaming) return

  const message = validateName(name.value, props.item?.name ?? '')
  if (message) {
    fieldError.value = message
    await nextTick()
    nameInput.value?.focus()
    return
  }

  fieldError.value = ''
  emit('submit', name.value.trim())
}

// Fase 2.6: al aparecer un conflicto, el foco pasa al título del bloque de
// resolución; al desaparecer (por "Volver" o por una nueva petición que ya
// no lo reproduce) vuelve al campo de nombre, con el texto seleccionado
// igual que al abrir el diálogo.
watch(
  () => props.conflict,
  async (conflict, previousConflict) => {
    if (!props.open) return
    if (conflict) {
      await nextTick()
      await conflictResolverRef.value?.focusTitle()
    } else if (previousConflict) {
      await nextTick()
      nameInput.value?.focus()
      nameInput.value?.select()
    }
  },
)

// Reenvío de una decisión explícita: siempre con el mismo nombre ya
// introducido y validado — el backend ya lo aceptó salvo por el nombre
// duplicado. Renombrar solo admite `keep_both` (nunca `replace`).
function handleKeepBoth() {
  emit('resolve-keep-both', name.value.trim())
}

function handleConflictBack() {
  emit('conflict-back')
}
</script>

<template>
  <dialog
    ref="dialogEl"
    class="rename-item-dialog"
    aria-labelledby="rename-item-title"
    @close="handleClose"
    @cancel="handleNativeCancel"
    @click="handleBackdropClick"
  >
    <div class="rename-item-dialog__box" @click.stop>
      <h2 id="rename-item-title" class="rename-item-dialog__title">
        Renombrar «{{ item?.name ?? '' }}»
      </h2>

      <NameConflictResolver
        v-if="conflict"
        ref="conflictResolverRef"
        :conflicts="conflict.conflicts"
        :allowed-resolutions="conflict.allowedResolutions"
        operation="rename"
        :busy="isRenaming"
        @keep-both="handleKeepBoth"
        @cancel="handleConflictBack"
      />

      <form
        v-else
        id="rename-item-form"
        class="rename-item-dialog__form"
        novalidate
        @submit.prevent="handleSubmit"
      >
        <div class="field">
          <label for="rename-item-name">Nuevo nombre</label>
          <input
            id="rename-item-name"
            ref="nameInput"
            v-model="name"
            type="text"
            autocomplete="off"
            :disabled="isRenaming"
            :aria-invalid="!!fieldError"
            :aria-describedby="fieldError ? 'rename-item-name-error' : undefined"
          />
          <span v-if="fieldError" id="rename-item-name-error" class="field-error">{{
            fieldError
          }}</span>
        </div>

        <AlertMessage v-if="error" variant="error">{{ error }}</AlertMessage>
      </form>

      <div class="rename-item-dialog__actions">
        <button
          type="button"
          class="rename-item-dialog__cancel"
          :disabled="isRenaming"
          @click="emit('cancel')"
        >
          Cancelar
        </button>
        <button
          v-if="!conflict"
          type="submit"
          form="rename-item-form"
          class="rename-item-dialog__confirm"
          :disabled="isRenaming"
          :aria-busy="isRenaming"
        >
          {{ isRenaming ? 'Renombrando…' : 'Renombrar' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.rename-item-dialog {
  border: none;
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: var(--shadow-md);
  max-width: min(90vw, 26rem);
  width: 100%;
}

.rename-item-dialog::backdrop {
  background: rgba(15, 18, 25, 0.45);
}

.rename-item-dialog__box {
  padding: 1.5rem;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
}

.rename-item-dialog__title {
  margin: 0 0 1rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.rename-item-dialog__form {
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

.rename-item-dialog__actions {
  margin-top: 0.25rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.rename-item-dialog__cancel,
.rename-item-dialog__confirm {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.rename-item-dialog__cancel {
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.rename-item-dialog__cancel:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.rename-item-dialog__confirm {
  border: none;
  background: var(--accent);
  color: white;
}

.rename-item-dialog__confirm:hover:not(:disabled) {
  background: var(--accent-hover);
}

.rename-item-dialog__cancel:disabled,
.rename-item-dialog__confirm:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
