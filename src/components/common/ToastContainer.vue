<script setup lang="ts">
import { useToastStore } from '@/stores/toast'
import ToastItem from '@/components/common/ToastItem.vue'

// Único punto de montaje de todo el sistema de notificaciones (AppShell.vue)
// — el store es la fuente de verdad, este componente solo lo pinta.
const toastStore = useToastStore()
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast" tag="div" class="toast-container__list">
      <ToastItem
        v-for="toast in toastStore.toasts"
        :key="toast.id"
        :toast="toast"
        @close="toastStore.remove"
      />
    </TransitionGroup>
  </div>
</template>

<style scoped>
/* Posición fija que nunca tapa el encabezado (empieza debajo de
   `--header-height`) y deja siempre un margen de seguridad a los lados —
   en escritorio queda anclada a la esquina superior derecha porque su
   ancho se limita a 22rem; en móvil ese límite cede ante el ancho
   disponible y ambos márgenes de 1rem se mantienen igual. */
.toast-container {
  position: fixed;
  top: calc(var(--header-height) + 1rem);
  right: 1rem;
  z-index: 40;
  width: min(22rem, calc(100vw - 2rem));
  pointer-events: none;
}

.toast-container__list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.toast-container__list > :deep(*) {
  pointer-events: auto;
}

.toast-move,
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(16px);
}

/* Técnica FLIP habitual de TransitionGroup: al salir, el elemento se saca
   del flujo para que los que quedan se reacomoden con su propia
   transición de `transform` en vez de saltar de golpe. */
.toast-leave-active {
  position: absolute;
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .toast-move,
  .toast-enter-active,
  .toast-leave-active {
    transition: opacity 0.01ms;
  }

  .toast-enter-from,
  .toast-leave-to {
    transform: none;
  }
}
</style>
