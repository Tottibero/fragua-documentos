<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import type { DriveTrashItem } from '@/types'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Elemento que se va a restaurar — `null` solo antes de la primera
     * apertura. Mientras `open` es `true` el llamador lo mantiene estable
     * (no lo limpia hasta que el diálogo se cierra de verdad), para que un
     * fallo pueda seguir mostrando de qué elemento se trata. */
    item: DriveTrashItem | null
    isRestoring: boolean
    restoreError?: string
  }>(),
  { restoreError: '' },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const dialogEl = ref<HTMLDialogElement>()
const cancelButton = ref<HTMLButtonElement>()

// Mismo mecanismo que el resto de diálogos: distingue un cierre provocado
// por nosotros mismos (al reaccionar a `open` pasando a false) de uno
// iniciado por el usuario (Escape) — solo este último debe emitir "cancel".
let closingFromPropChange = false

watch(
  () => props.open,
  async (open) => {
    if (open) {
      dialogEl.value?.showModal()
      await nextTick()
      // "Cancelar" es el control lógico inicial: es el punto de partida
      // seguro y está presente de forma estable durante toda la vida del
      // diálogo — a diferencia de "Restaurar", que cambia de texto mientras
      // `isRestoring` (mismo criterio que ya aplica TrashItemDialog).
      cancelButton.value?.focus()
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
// se bloquea mientras se restaura para no dejar la operación huérfana.
function handleNativeCancel(event: Event) {
  if (props.isRestoring) {
    event.preventDefault()
  }
}

function handleBackdropClick(event: MouseEvent) {
  if (!props.isRestoring && event.target === dialogEl.value) {
    emit('cancel')
  }
}

function handleConfirmClick() {
  // Defensa además del `:disabled` del botón: mientras haya una
  // restauración en curso no debe iniciarse otra (reentrada por doble clic,
  // clic + Enter…).
  if (props.isRestoring) return
  emit('confirm')
}
</script>

<template>
  <dialog
    ref="dialogEl"
    class="restore-item-dialog"
    aria-labelledby="restore-item-title"
    aria-describedby="restore-item-description"
    @close="handleClose"
    @cancel="handleNativeCancel"
    @click="handleBackdropClick"
  >
    <div class="restore-item-dialog__box" @click.stop>
      <h2 id="restore-item-title" class="restore-item-dialog__title">
        Restaurar «{{ item?.name ?? '' }}»
      </h2>
      <p class="restore-item-dialog__subtitle">{{ item?.isFolder ? 'Carpeta' : 'Archivo' }}</p>
      <p id="restore-item-description" class="restore-item-dialog__description">
        Se intentará recuperar en la carpeta en la que estaba antes de enviarse a la
        papelera. Si esa carpeta ya no está disponible, se recuperará en «Fragua
        Documentos».
      </p>

      <AlertMessage v-if="restoreError" variant="error">{{ restoreError }}</AlertMessage>

      <div class="restore-item-dialog__actions">
        <button
          ref="cancelButton"
          type="button"
          class="restore-item-dialog__cancel"
          :disabled="isRestoring"
          @click="emit('cancel')"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="restore-item-dialog__confirm"
          :disabled="isRestoring"
          :aria-busy="isRestoring"
          @click="handleConfirmClick"
        >
          {{ isRestoring ? 'Restaurando…' : 'Restaurar' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.restore-item-dialog {
  border: none;
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: var(--shadow-md);
  max-width: min(90vw, 26rem);
  width: 100%;
}

.restore-item-dialog::backdrop {
  background: rgba(15, 18, 25, 0.45);
}

.restore-item-dialog__box {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
}

.restore-item-dialog__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.restore-item-dialog__subtitle {
  margin: -0.4rem 0 0;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.restore-item-dialog__description {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.restore-item-dialog__actions {
  margin-top: 0.6rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.restore-item-dialog__cancel,
.restore-item-dialog__confirm {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.restore-item-dialog__cancel {
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.restore-item-dialog__cancel:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.restore-item-dialog__confirm {
  border: none;
  background: var(--accent);
  color: white;
}

.restore-item-dialog__confirm:hover:not(:disabled) {
  background: var(--accent-hover);
}

.restore-item-dialog__cancel:disabled,
.restore-item-dialog__confirm:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
