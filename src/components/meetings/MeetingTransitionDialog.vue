<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import { formatMeetingDateTime } from '@/utils/meeting-labels'
import type { Meeting } from '@/types'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Solo las dos transiciones que se confirman en este diálogo; cerrar
     * tiene su propia revisión previa (`CloseMeetingDialog`). */
    action: 'hold' | 'reopen'
    /** Reunión afectada — `null` solo antes de la primera apertura. Mientras
     * `open` es `true` el llamador la mantiene estable, aunque el estado
     * cambie, para que un fallo siga mostrando de qué reunión se trata. */
    meeting: Meeting | null
    isSubmitting: boolean
    error?: string
  }>(),
  { error: '' },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const dialogEl = ref<HTMLDialogElement>()
const cancelButton = ref<HTMLButtonElement>()

// Distingue un cierre provocado por nosotros (al reaccionar a `open` a
// false) de uno iniciado por el usuario (Escape): solo este debe emitir
// "cancel".
let closingFromPropChange = false

const copy = computed(() => {
  if (props.action === 'hold') {
    return {
      title: 'Marcar como celebrada',
      description:
        'La reunión pasará a «Celebrada». A partir de ese momento su nombre, fecha y tipo ya no se podrán editar; sus puntos y asistentes seguirán editables hasta que se cierre.',
      confirm: 'Marcar como celebrada',
      busy: 'Guardando…',
    }
  }
  return {
    title: 'Reabrir reunión',
    description:
      'La reunión volverá a «Celebrada»: se podrán editar de nuevo sus puntos y asistentes. Su nombre, fecha y tipo seguirán sin poder editarse.',
    confirm: 'Reabrir reunión',
    busy: 'Reabriendo…',
  }
})

// Celebrar una reunión cuya fecha aún no ha llegado es válido (el backend no
// lo impide), pero probablemente sea un despiste: se avisa sin bloquear.
const isFuture = computed(() => {
  if (props.action !== 'hold' || !props.meeting) return false
  return new Date(props.meeting.scheduledAt).getTime() > Date.now()
})

watch(
  () => props.open,
  async (open) => {
    if (open) {
      dialogEl.value?.showModal()
      await nextTick()
      // «Cancelar» es el punto de partida seguro y está presente de forma
      // estable durante toda la vida del diálogo.
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

// Evento nativo "cancel" (Escape): se bloquea mientras se guarda para no
// dejar la operación huérfana.
function handleNativeCancel(event: Event) {
  if (props.isSubmitting) event.preventDefault()
}

function handleBackdropClick(event: MouseEvent) {
  if (!props.isSubmitting && event.target === dialogEl.value) emit('cancel')
}

function handleConfirmClick() {
  // Defensa además del `:disabled`: nunca dos envíos a la vez (doble clic,
  // clic + Enter…).
  if (props.isSubmitting) return
  emit('confirm')
}
</script>

<template>
  <dialog
    ref="dialogEl"
    class="transition-dialog"
    aria-labelledby="transition-dialog-title"
    aria-describedby="transition-dialog-description"
    @close="handleClose"
    @cancel="handleNativeCancel"
    @click="handleBackdropClick"
  >
    <div class="transition-dialog__box" @click.stop>
      <h2 id="transition-dialog-title" class="transition-dialog__title">{{ copy.title }}</h2>
      <p class="transition-dialog__meeting">«{{ meeting?.name ?? '' }}»</p>
      <p id="transition-dialog-description" class="transition-dialog__description">
        {{ copy.description }}
      </p>
      <p v-if="isFuture && meeting" class="transition-dialog__note">
        Ojo: la reunión está programada para el {{ formatMeetingDateTime(meeting.scheduledAt) }} y
        todavía no ha llegado esa fecha.
      </p>

      <AlertMessage v-if="error" variant="error">{{ error }}</AlertMessage>

      <div class="transition-dialog__actions">
        <button
          ref="cancelButton"
          type="button"
          class="transition-dialog__cancel"
          :disabled="isSubmitting"
          @click="emit('cancel')"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="transition-dialog__confirm"
          :disabled="isSubmitting"
          :aria-busy="isSubmitting"
          @click="handleConfirmClick"
        >
          {{ isSubmitting ? copy.busy : copy.confirm }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.transition-dialog {
  border: none;
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: var(--shadow-md);
  max-width: min(90vw, 27rem);
  width: 100%;
}

.transition-dialog::backdrop {
  background: rgba(15, 18, 25, 0.45);
}

.transition-dialog__box {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
}

.transition-dialog__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
}

.transition-dialog__meeting {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.transition-dialog__description,
.transition-dialog__note {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.transition-dialog__note {
  padding: 0.6rem 0.8rem;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  color: var(--text-primary);
}

.transition-dialog__actions {
  margin-top: 0.6rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.transition-dialog__cancel,
.transition-dialog__confirm {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.transition-dialog__cancel {
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.transition-dialog__cancel:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.transition-dialog__confirm {
  border: none;
  background: var(--accent);
  color: white;
}

.transition-dialog__confirm:hover:not(:disabled) {
  background: var(--accent-hover);
}

.transition-dialog__cancel:disabled,
.transition-dialog__confirm:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
