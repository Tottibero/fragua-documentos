<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import type { DriveItem } from '@/types'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Elemento que se va a enviar a la papelera — `null` solo antes de la
     * primera apertura. Mientras `open` es `true` el llamador lo mantiene
     * estable (no lo limpia hasta que el diálogo se cierra de verdad), para
     * que un fallo pueda seguir mostrando de qué elemento se trata. */
    item: DriveItem | null
    isTrashing: boolean
    trashError?: string
  }>(),
  { trashError: '' },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()

// Texto puramente presentacional según el tipo de elemento — no distinto de
// lo que ya decide DriveItemsList (readableType, etc.) a partir del mismo
// dato; ninguna llamada a servicio ni al store vive en este componente.
const description = computed(() => {
  if (!props.item) return ''
  return props.item.isFolder
    ? 'La carpeta y su contenido dejarán de aparecer en el gestor hasta que se restauren.'
    : 'Podrá recuperarse posteriormente desde la papelera.'
})

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
      // estable durante toda la vida del diálogo (a diferencia de "Enviar a
      // la papelera", que cambia de texto mientras `isTrashing`).
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
// se bloquea mientras se envía a la papelera para no dejar la operación
// huérfana.
function handleNativeCancel(event: Event) {
  if (props.isTrashing) {
    event.preventDefault()
  }
}

function handleBackdropClick(event: MouseEvent) {
  if (!props.isTrashing && event.target === dialogEl.value) {
    emit('cancel')
  }
}

function handleConfirmClick() {
  // Defensa además del `:disabled` del botón: mientras haya un envío en
  // curso no debe iniciarse otro (reentrada por doble clic, clic + Enter…).
  if (props.isTrashing) return
  emit('confirm')
}
</script>

<template>
  <dialog
    ref="dialogEl"
    class="trash-item-dialog"
    aria-labelledby="trash-item-title"
    aria-describedby="trash-item-description"
    @close="handleClose"
    @cancel="handleNativeCancel"
    @click="handleBackdropClick"
  >
    <div class="trash-item-dialog__box" @click.stop>
      <h2 id="trash-item-title" class="trash-item-dialog__title">
        Enviar «{{ item?.name ?? '' }}» a la papelera
      </h2>
      <p class="trash-item-dialog__subtitle">{{ item?.isFolder ? 'Carpeta' : 'Archivo' }}</p>
      <p id="trash-item-description" class="trash-item-dialog__description">{{ description }}</p>

      <AlertMessage v-if="trashError" variant="error">{{ trashError }}</AlertMessage>

      <div class="trash-item-dialog__actions">
        <button
          ref="cancelButton"
          type="button"
          class="trash-item-dialog__cancel"
          :disabled="isTrashing"
          @click="emit('cancel')"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="trash-item-dialog__confirm"
          :disabled="isTrashing"
          :aria-busy="isTrashing"
          @click="handleConfirmClick"
        >
          {{ isTrashing ? 'Enviando…' : 'Enviar a la papelera' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.trash-item-dialog {
  border: none;
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: var(--shadow-md);
  max-width: min(90vw, 26rem);
  width: 100%;
}

.trash-item-dialog::backdrop {
  background: rgba(15, 18, 25, 0.45);
}

.trash-item-dialog__box {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
}

.trash-item-dialog__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.trash-item-dialog__subtitle {
  margin: -0.4rem 0 0;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.trash-item-dialog__description {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.trash-item-dialog__actions {
  margin-top: 0.6rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.trash-item-dialog__cancel,
.trash-item-dialog__confirm {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.trash-item-dialog__cancel {
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.trash-item-dialog__cancel:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.trash-item-dialog__confirm {
  border: none;
  background: var(--danger);
  color: white;
}

.trash-item-dialog__confirm:hover:not(:disabled) {
  background: #991616;
}

.trash-item-dialog__cancel:disabled,
.trash-item-dialog__confirm:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
