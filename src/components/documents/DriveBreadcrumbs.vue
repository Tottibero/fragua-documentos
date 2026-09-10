<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import type { DriveBreadcrumb } from '@/types'

const props = defineProps<{ breadcrumbs: DriveBreadcrumb[] }>()
const emit = defineEmits<{ select: [index: number] }>()

// El tramo actual (último) se renderiza aparte del `v-for` — así la
// template ref no vive dentro del bucle y apunta siempre a un único
// elemento, sin ambigüedad de índice.
const previousCrumbs = computed(() => props.breadcrumbs.slice(0, -1))
const currentCrumb = computed(() => props.breadcrumbs[props.breadcrumbs.length - 1])

const currentEl = useTemplateRef<HTMLElement>('currentEl')

// Punto de foco explícito para cuando una navegación elimina del DOM el
// control que el usuario acababa de activar (una carpeta, otro breadcrumb):
// mover el foco aquí anuncia la nueva ubicación en vez de perderlo en el
// body. El orquestador (DocumentsView) decide cuándo llamarlo.
function focusCurrent() {
  currentEl.value?.focus()
}

defineExpose({ focusCurrent })
</script>

<template>
  <nav class="drive-breadcrumbs" aria-label="Ruta de carpetas">
    <ol class="drive-breadcrumbs__list">
      <li
        v-for="(crumb, index) in previousCrumbs"
        :key="crumb.id ?? 'root'"
        class="drive-breadcrumbs__item"
      >
        <button type="button" class="drive-breadcrumbs__link" @click="emit('select', index)">
          {{ crumb.name }}
        </button>
        <span class="drive-breadcrumbs__separator" aria-hidden="true">/</span>
      </li>

      <li v-if="currentCrumb" class="drive-breadcrumbs__item">
        <span
          ref="currentEl"
          class="drive-breadcrumbs__current"
          tabindex="-1"
          aria-current="location"
        >
          {{ currentCrumb.name }}
        </span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.drive-breadcrumbs__list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 0.1rem;
}

.drive-breadcrumbs__item {
  display: flex;
  align-items: center;
  gap: 0.1rem;
  max-width: 100%;
}

.drive-breadcrumbs__link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 0.5rem;
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.drive-breadcrumbs__link:hover {
  background: var(--bg-hover);
  text-decoration: underline;
}

.drive-breadcrumbs__current {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 0.5rem;
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.drive-breadcrumbs__separator {
  color: var(--text-muted);
  font-size: 0.85rem;
}
</style>
