<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import type { MeetingPoint } from '@/types'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Punto que se va a eliminar — `null` solo antes de la primera
     * apertura. Mientras `open` es `true` el llamador lo mantiene estable
     * (no lo limpia hasta que el diálogo se cierra de verdad), para que un
     * fallo pueda seguir mostrando de qué punto se trata. */
    point: MeetingPoint | null
    isDeleting: boolean
    deleteError?: string
  }>(),
  { deleteError: '' },
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
      // seguro de una confirmación destructiva y está presente de forma
      // estable durante toda la vida del diálogo (a diferencia de
      // "Eliminar punto", que cambia de texto mientras `isDeleting`).
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
// se bloquea mientras se elimina para no dejar la operación huérfana.
function handleNativeCancel(event: Event) {
  if (props.isDeleting) {
    event.preventDefault()
  }
}

function handleBackdropClick(event: MouseEvent) {
  if (!props.isDeleting && event.target === dialogEl.value) {
    emit('cancel')
  }
}

function handleConfirmClick() {
  // Defensa además del `:disabled` del botón: mientras haya un envío en
  // curso no debe iniciarse otro (reentrada por doble clic, clic + Enter…).
  if (props.isDeleting) return
  emit('confirm')
}
</script>

<template>
  <dialog
    ref="dialogEl"
    class="delete-meeting-point-dialog"
    aria-labelledby="delete-meeting-point-title"
    aria-describedby="delete-meeting-point-description"
    @close="handleClose"
    @cancel="handleNativeCancel"
    @click="handleBackdropClick"
  >
    <div class="delete-meeting-point-dialog__box" @click.stop>
      <h2 id="delete-meeting-point-title" class="delete-meeting-point-dialog__title">
        Eliminar el punto «{{ point?.title ?? '' }}»
      </h2>
      <p id="delete-meeting-point-description" class="delete-meeting-point-dialog__description">
        Se eliminarán también sus notas y acuerdos. Esta acción no afecta a la reunión ni al
        resto de sus puntos.
      </p>

      <AlertMessage v-if="deleteError" variant="error">{{ deleteError }}</AlertMessage>

      <div class="delete-meeting-point-dialog__actions">
        <button
          ref="cancelButton"
          type="button"
          class="delete-meeting-point-dialog__cancel"
          :disabled="isDeleting"
          @click="emit('cancel')"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="delete-meeting-point-dialog__confirm"
          :disabled="isDeleting"
          :aria-busy="isDeleting"
          @click="handleConfirmClick"
        >
          {{ isDeleting ? 'Eliminando…' : 'Eliminar punto' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.delete-meeting-point-dialog {
  border: none;
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: var(--shadow-md);
  max-width: min(90vw, 26rem);
  width: 100%;
}

.delete-meeting-point-dialog::backdrop {
  background: rgba(15, 18, 25, 0.45);
}

.delete-meeting-point-dialog__box {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
}

.delete-meeting-point-dialog__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.delete-meeting-point-dialog__description {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.delete-meeting-point-dialog__actions {
  margin-top: 0.6rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.delete-meeting-point-dialog__cancel,
.delete-meeting-point-dialog__confirm {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.delete-meeting-point-dialog__cancel {
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.delete-meeting-point-dialog__cancel:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.delete-meeting-point-dialog__confirm {
  border: none;
  background: var(--danger);
  color: white;
}

.delete-meeting-point-dialog__confirm:hover:not(:disabled) {
  background: #991616;
}

.delete-meeting-point-dialog__cancel:disabled,
.delete-meeting-point-dialog__confirm:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
