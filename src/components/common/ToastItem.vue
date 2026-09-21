<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheck, CircleAlert, Info, X, type LucideIcon } from '@lucide/vue'
import IconButton from '@/components/common/IconButton.vue'
import type { Toast, ToastType } from '@/stores/toast'

const ICON_SIZE = 20
const ICON_STROKE_WIDTH = 1.75

const ICONS_BY_TYPE: Record<ToastType, LucideIcon> = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
}

const props = defineProps<{ toast: Toast }>()

const emit = defineEmits<{ close: [id: string] }>()

const icon = computed(() => ICONS_BY_TYPE[props.toast.type])

// Los errores se anuncian de inmediato, sin esperar a que el lector de
// pantalla termine lo que estuviera leyendo (`assertive`/`role="alert"`);
// éxitos e información se anuncian sin interrumpir (`polite`/`role="status"`).
// Ninguno de los dos mueve el foco del teclado al propio toast.
const isError = computed(() => props.toast.type === 'error')
</script>

<template>
  <div
    class="toast-item"
    :class="`toast-item--${toast.type}`"
    :role="isError ? 'alert' : 'status'"
    :aria-live="isError ? 'assertive' : 'polite'"
  >
    <component
      :is="icon"
      class="toast-item__icon"
      :size="ICON_SIZE"
      :stroke-width="ICON_STROKE_WIDTH"
      aria-hidden="true"
    />
    <p class="toast-item__message">{{ toast.message }}</p>
    <IconButton
      :icon="X"
      label="Cerrar notificación"
      class="toast-item__close"
      @click="emit('close', toast.id)"
    />
  </div>
</template>

<style scoped>
.toast-item {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.65rem 0.4rem 0.65rem 0.85rem;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  box-shadow: var(--shadow-md);
  background: var(--bg-elevated);
}

.toast-item__icon {
  flex-shrink: 0;
  margin-top: 0.2rem;
}

.toast-item__message {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding-top: 0.2rem;
  font-size: 0.88rem;
  line-height: 1.4;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.toast-item__close {
  flex-shrink: 0;
}

.toast-item--success {
  border-color: color-mix(in srgb, var(--success) 25%, transparent);
  background: var(--success-soft);
}

.toast-item--success .toast-item__icon {
  color: var(--success);
}

.toast-item--error {
  border-color: color-mix(in srgb, var(--danger) 25%, transparent);
  background: var(--danger-soft);
}

.toast-item--error .toast-item__icon {
  color: var(--danger);
}

.toast-item--info {
  border-color: color-mix(in srgb, var(--accent) 25%, transparent);
  background: var(--accent-soft);
}

.toast-item--info .toast-item__icon {
  color: var(--accent-text);
}
</style>
