<script setup lang="ts">
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import DriveDestinationTreeNode from '@/components/documents/DriveDestinationTreeNode.vue'
import type { DriveDestinationNode } from '@/types'

const props = withDefaults(
  defineProps<{
    /** `null` mientras no se conoce todavía la raíz (cargando o falló) —
     * en ese caso no hay nada que recorrer todavía. */
    rootNode: DriveDestinationNode | null
    isLoadingRoot: boolean
    rootError?: string
    selectedDestinationId: string | null
    /** Carpeta en la que está `item` ahora mismo — su nodo no es
     * seleccionable (moverlo ahí sería un no-op). */
    sourceParentId: string | null
    /** Elemento que se está moviendo — si es una carpeta, su nodo no es
     * seleccionable ni expandible. */
    excludedItemId: string | null
  }>(),
  { rootError: '' },
)

const emit = defineEmits<{
  toggle: [nodeId: string]
  select: [nodeId: string]
  'load-more': [nodeId: string]
  retry: [nodeId: string]
  'retry-root': []
}>()
</script>

<template>
  <div class="destination-tree">
    <LoadingSpinner v-if="isLoadingRoot" label="Cargando carpetas…" />

    <div v-else-if="rootError" class="destination-tree__error">
      <AlertMessage variant="error">{{ rootError }}</AlertMessage>
      <button type="button" class="destination-tree__retry" @click="emit('retry-root')">
        Reintentar
      </button>
    </div>

    <ul v-else-if="rootNode" class="destination-tree__list">
      <DriveDestinationTreeNode
        :node="rootNode"
        :depth="0"
        :selected-destination-id="selectedDestinationId"
        :source-parent-id="sourceParentId"
        :excluded-item-id="excludedItemId"
        @toggle="emit('toggle', $event)"
        @select="emit('select', $event)"
        @load-more="emit('load-more', $event)"
        @retry="emit('retry', $event)"
      />
    </ul>
  </div>
</template>

<style scoped>
.destination-tree {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  padding: 0.4rem 0.25rem;
  max-height: 18rem;
  overflow-y: auto;
  overflow-x: hidden;
}

.destination-tree__error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
}

.destination-tree__retry {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: var(--accent);
  color: white;
}

.destination-tree__retry:hover {
  background: var(--accent-hover);
}

.destination-tree__list {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
