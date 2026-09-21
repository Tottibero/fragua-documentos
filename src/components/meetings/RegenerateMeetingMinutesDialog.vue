<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import AlertMessage from '@/components/common/AlertMessage.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    fileName: string
    isRegenerating: boolean
    error?: string
  }>(),
  { error: '' },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const dialogEl = ref<HTMLDialogElement>()
const titleEl = ref<HTMLHeadingElement>()
let closingFromPropChange = false

watch(
  () => props.open,
  async (open) => {
    if (open) {
      dialogEl.value?.showModal()
      await nextTick()
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

function handleNativeCancel(event: Event) {
  if (props.isRegenerating) event.preventDefault()
}

function handleBackdropClick(event: MouseEvent) {
  if (!props.isRegenerating && event.target === dialogEl.value) emit('cancel')
}
</script>

<template>
  <dialog
    ref="dialogEl"
    class="regenerate-dialog"
    aria-labelledby="regenerate-minutes-title"
    aria-describedby="regenerate-minutes-description"
    @close="handleClose"
    @cancel="handleNativeCancel"
    @click="handleBackdropClick"
  >
    <div class="regenerate-dialog__box" @click.stop>
      <h2
        id="regenerate-minutes-title"
        ref="titleEl"
        class="regenerate-dialog__title"
        tabindex="-1"
      >
        Regenerar el acta
      </h2>
      <p id="regenerate-minutes-description" class="regenerate-dialog__description">
        Se actualizará «{{ fileName }}» con los datos actuales de la reunión. La versión anterior
        seguirá disponible en el historial.
      </p>

      <AlertMessage v-if="error" variant="error">{{ error }}</AlertMessage>

      <div class="regenerate-dialog__actions">
        <button
          type="button"
          class="regenerate-dialog__cancel"
          :disabled="isRegenerating"
          @click="emit('cancel')"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="regenerate-dialog__confirm"
          :disabled="isRegenerating"
          :aria-busy="isRegenerating"
          @click="emit('confirm')"
        >
          {{ isRegenerating ? 'Regenerando…' : 'Regenerar acta' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.regenerate-dialog {
  width: min(90vw, 29rem);
  max-width: 29rem;
  padding: 0;
  border: none;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.regenerate-dialog::backdrop {
  background: rgba(15, 18, 25, 0.45);
}

.regenerate-dialog__box {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.5rem;
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
}

.regenerate-dialog__title {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.05rem;
  font-weight: 700;
}

.regenerate-dialog__title:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}

.regenerate-dialog__description {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.regenerate-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 0.35rem;
}

.regenerate-dialog__cancel,
.regenerate-dialog__confirm {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.regenerate-dialog__cancel {
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.regenerate-dialog__confirm {
  border: none;
  background: var(--accent);
  color: white;
}

.regenerate-dialog__cancel:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.regenerate-dialog__confirm:hover:not(:disabled) {
  background: var(--accent-hover);
}

.regenerate-dialog__cancel:disabled,
.regenerate-dialog__confirm:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}
</style>
