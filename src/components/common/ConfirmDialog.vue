<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
    isConfirming?: boolean
  }>(),
  {
    description: '',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    danger: false,
    isConfirming: false,
  },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const dialogEl = ref<HTMLDialogElement>()

// Distingue un cierre provocado por nosotros mismos (al reaccionar a `open`
// pasando a false, tanto tras confirmar con éxito como tras cancelar) de un
// cierre iniciado por el usuario a través del navegador (Escape). Solo este
// último debe emitir "cancel", para no duplicar el evento.
let closingFromPropChange = false

watch(
  () => props.open,
  (open) => {
    if (open) {
      dialogEl.value?.showModal()
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

// El evento nativo "cancel" se dispara (y es cancelable) cuando el usuario
// pulsa Escape, antes de "close". Se bloquea mientras hay una confirmación
// en curso para no dejar la acción huérfana sin forma de ver su resultado.
function handleNativeCancel(event: Event) {
  if (props.isConfirming) {
    event.preventDefault()
  }
}

function handleBackdropClick(event: MouseEvent) {
  if (!props.isConfirming && event.target === dialogEl.value) {
    emit('cancel')
  }
}
</script>

<template>
  <dialog
    ref="dialogEl"
    class="confirm-dialog"
    aria-labelledby="confirm-dialog-title"
    :aria-describedby="description ? 'confirm-dialog-description' : undefined"
    @close="handleClose"
    @cancel="handleNativeCancel"
    @click="handleBackdropClick"
  >
    <div class="confirm-dialog__box" @click.stop>
      <h2 id="confirm-dialog-title" class="confirm-dialog__title">{{ title }}</h2>
      <p v-if="description" id="confirm-dialog-description" class="confirm-dialog__description">
        {{ description }}
      </p>

      <div class="confirm-dialog__actions">
        <button
          type="button"
          class="confirm-dialog__cancel"
          :disabled="isConfirming"
          @click="emit('cancel')"
        >
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          class="confirm-dialog__confirm"
          :class="{ 'confirm-dialog__confirm--danger': danger }"
          :disabled="isConfirming"
          :aria-busy="isConfirming"
          @click="emit('confirm')"
        >
          {{ isConfirming ? 'Procesando…' : confirmLabel }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.confirm-dialog {
  border: none;
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: var(--shadow-md);
  max-width: min(90vw, 26rem);
  width: 100%;
}

.confirm-dialog::backdrop {
  background: rgba(15, 18, 25, 0.45);
}

.confirm-dialog__box {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
}

.confirm-dialog__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
}

.confirm-dialog__description {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.confirm-dialog__actions {
  margin-top: 0.6rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.confirm-dialog__cancel,
.confirm-dialog__confirm {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.confirm-dialog__cancel {
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.confirm-dialog__cancel:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.confirm-dialog__confirm {
  border: none;
  background: var(--accent);
  color: white;
}

.confirm-dialog__confirm:hover:not(:disabled) {
  background: var(--accent-hover);
}

.confirm-dialog__confirm--danger {
  background: var(--danger);
}

.confirm-dialog__confirm--danger:hover:not(:disabled) {
  background: #991616;
}

.confirm-dialog__cancel:disabled,
.confirm-dialog__confirm:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
