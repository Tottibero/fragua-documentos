<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { LoaderCircle, type LucideIcon } from '@lucide/vue'

// Tamaño y grosor de trazo fijos para todo el sistema de botones de icono —
// una sola familia (lucide), un solo tamaño, un solo grosor, coherentes en
// toda la app, sin exponerlos como prop para que ningún uso pueda desviarse.
const ICON_SIZE = 18
const ICON_STROKE_WIDTH = 1.75

const props = withDefaults(
  defineProps<{
    icon: LucideIcon
    /** Obligatorio: es a la vez el nombre accesible (`aria-label`) y el
     * texto del tooltip visual — nunca cambia con el estado `busy`, igual
     * que ya hacían los botones de texto que sustituye (el aviso de "en
     * curso" lo da el spinner + `aria-busy`, no un texto distinto). */
    label: string
    disabled?: boolean
    /** Sustituye el icono por un spinner y marca `aria-busy`, sin tocar
     * `label` — el elemento sigue anunciándose por lo que hace, no por que
     * esté ocupado. */
    busy?: boolean
    /** Si se indica, el control se renderiza como `RouterLink` (navegación)
     * en vez de `button` (acción) — mismo aspecto y mismo componente, para
     * que un enlace de icono en el encabezado se vea del mismo sistema que
     * las acciones de icono del listado. */
    to?: RouteLocationRaw
  }>(),
  { disabled: false, busy: false },
)

const emit = defineEmits<{ click: [event: MouseEvent] }>()

const isDisabled = computed(() => props.disabled || props.busy)

function handleClick(event: MouseEvent) {
  // Los enlaces no tienen `disabled` nativo (el `button` de abajo ya lo
  // bloquea con el atributo) — esto es solo la misma defensa que el resto
  // de la app aplica contra un `:disabled` que no llegara a tiempo.
  if (props.to && isDisabled.value) {
    event.preventDefault()
    return
  }
  emit('click', event)
}
</script>

<template>
  <RouterLink
    v-if="to"
    :to="to"
    class="icon-button"
    :aria-label="label"
    :aria-busy="busy"
    :aria-disabled="isDisabled || undefined"
    @click="handleClick"
  >
    <component
      :is="busy ? LoaderCircle : icon"
      class="icon-button__icon"
      :class="{ 'icon-button__icon--spin': busy }"
      :size="ICON_SIZE"
      :stroke-width="ICON_STROKE_WIDTH"
      aria-hidden="true"
    />
    <span class="icon-button__tooltip" role="tooltip" aria-hidden="true">{{ label }}</span>
  </RouterLink>

  <button
    v-else
    type="button"
    class="icon-button"
    :aria-label="label"
    :aria-busy="busy"
    :disabled="isDisabled"
    @click="handleClick"
  >
    <component
      :is="busy ? LoaderCircle : icon"
      class="icon-button__icon"
      :class="{ 'icon-button__icon--spin': busy }"
      :size="ICON_SIZE"
      :stroke-width="ICON_STROKE_WIDTH"
      aria-hidden="true"
    />
    <span class="icon-button__tooltip" role="tooltip" aria-hidden="true">{{ label }}</span>
  </button>
</template>

<style scoped>
.icon-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.icon-button:hover:not(:disabled):not([aria-disabled='true']) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.icon-button:disabled,
.icon-button[aria-disabled='true'] {
  opacity: 0.5;
  cursor: not-allowed;
}

button.icon-button[aria-disabled='true'] {
  pointer-events: none;
}

.icon-button.router-link-active {
  background: var(--accent-soft);
  color: var(--accent-text);
}

.icon-button__icon {
  flex-shrink: 0;
}

.icon-button__icon--spin {
  animation: icon-button-spin 0.7s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .icon-button__icon--spin {
    animation-duration: 1.6s;
  }
}

@keyframes icon-button-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Tooltip visual: complementa `aria-label` (el nombre accesible real) para
   quien ve la pantalla — por eso lleva `aria-hidden`, no debe anunciarse
   dos veces. Visible en hover y en foco de teclado, nunca solo en hover. */
.icon-button__tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translate(-50%, 4px);
  margin-top: 4px;
  padding: 0.3rem 0.55rem;
  border-radius: var(--radius-sm);
  background: var(--text-primary);
  color: var(--bg-surface);
  font-size: 0.72rem;
  font-weight: 500;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
  z-index: 10;
}

.icon-button:hover .icon-button__tooltip,
.icon-button:focus-visible .icon-button__tooltip {
  opacity: 1;
  transform: translate(-50%, 0);
}

@media (max-width: 768px) {
  /* Sin hover fiable en táctil, y el foco no debe depender de él: el
   * tooltip nunca es la única forma de saber qué hace el botón (el
   * `aria-label` ya lo resuelve para lectores de pantalla), así que aquí
   * simplemente se omite en vez de arriesgarse a quedar pegado tras un tap. */
  .icon-button__tooltip {
    display: none;
  }
}
</style>
