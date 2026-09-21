<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDown, ChevronRight, Check, Folder, FolderOpen } from '@lucide/vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import type { DriveDestinationNode } from '@/types'

// Mismo tamaño/grosor que el resto del sistema de iconos de la app
// (IconButton) — una sola familia, coherente en todo el árbol.
const ICON_SIZE = 18
const ICON_STROKE_WIDTH = 1.75
const INDENT_REM = 1.25

const props = defineProps<{
  node: DriveDestinationNode
  depth: number
  selectedDestinationId: string | null
  sourceParentId: string | null
  excludedItemId: string | null
}>()

// Recursivo: cada nivel solo retransmite hacia arriba lo que emite un nodo
// hijo, con el mismo id de payload que ese hijo ya incluyó — así el
// componente que orquesta (MoveItemDialog, vía DriveDestinationTree) recibe
// siempre el id real del nodo origen, sin importar a qué profundidad esté.
const emit = defineEmits<{
  toggle: [nodeId: string]
  select: [nodeId: string]
  'load-more': [nodeId: string]
  retry: [nodeId: string]
}>()

const isExcluded = computed(() => props.node.id === props.excludedItemId)
const isSourceParent = computed(() => props.node.id === props.sourceParentId)
const isSelected = computed(() => props.node.id === props.selectedDestinationId)
const canSelect = computed(() => !isExcluded.value && !isSourceParent.value)

const rowIndent = computed(() => `${props.depth * INDENT_REM}rem`)
const branchIndent = computed(() => `${(props.depth + 1) * INDENT_REM}rem`)

function handleToggle() {
  if (isExcluded.value) return
  emit('toggle', props.node.id)
}

function handleSelect() {
  if (!canSelect.value) return
  emit('select', props.node.id)
}

function handleLoadMore() {
  emit('load-more', props.node.id)
}

function handleRetry() {
  emit('retry', props.node.id)
}
</script>

<template>
  <li class="destination-node">
    <div class="destination-node__row" :style="{ paddingLeft: rowIndent }">
      <button
        type="button"
        class="destination-node__toggle"
        :disabled="isExcluded"
        :aria-expanded="isExcluded ? undefined : node.expanded"
        :aria-label="
          isExcluded
            ? `${node.name} no se puede expandir`
            : node.expanded
              ? `Contraer ${node.name}`
              : `Expandir ${node.name}`
        "
        @click="handleToggle"
      >
        <ChevronDown
          v-if="node.expanded && !isExcluded"
          :size="ICON_SIZE"
          :stroke-width="ICON_STROKE_WIDTH"
          aria-hidden="true"
        />
        <ChevronRight v-else :size="ICON_SIZE" :stroke-width="ICON_STROKE_WIDTH" aria-hidden="true" />
      </button>

      <button
        type="button"
        class="destination-node__select"
        :class="{ 'destination-node__select--selected': isSelected }"
        :disabled="!canSelect"
        :aria-pressed="isSelected"
        @click="handleSelect"
      >
        <component
          :is="node.expanded ? FolderOpen : Folder"
          class="destination-node__icon"
          :size="ICON_SIZE"
          :stroke-width="ICON_STROKE_WIDTH"
          aria-hidden="true"
        />
        <span class="destination-node__name">{{ node.name }}</span>
        <span v-if="isSourceParent" class="destination-node__badge">Carpeta actual</span>
        <span v-else-if="isExcluded" class="destination-node__badge">Elemento a mover</span>
        <Check
          v-if="isSelected"
          class="destination-node__check"
          :size="ICON_SIZE"
          :stroke-width="ICON_STROKE_WIDTH"
          aria-hidden="true"
        />
      </button>
    </div>

    <template v-if="node.expanded && !isExcluded">
      <LoadingSpinner
        v-if="node.loading && !node.childrenLoaded"
        label="Cargando…"
        class="destination-node__loading"
        :style="{ paddingLeft: branchIndent }"
      />

      <div v-else-if="node.error && !node.childrenLoaded" class="destination-node__branch-error" :style="{ paddingLeft: branchIndent }">
        <AlertMessage variant="error">{{ node.error }}</AlertMessage>
        <button type="button" class="destination-node__retry" @click="handleRetry">Reintentar</button>
      </div>

      <template v-else>
        <ul v-if="node.children.length > 0" class="destination-node__children">
          <DriveDestinationTreeNode
            v-for="child in node.children"
            :key="child.id"
            :node="child"
            :depth="depth + 1"
            :selected-destination-id="selectedDestinationId"
            :source-parent-id="sourceParentId"
            :excluded-item-id="excludedItemId"
            @toggle="emit('toggle', $event)"
            @select="emit('select', $event)"
            @load-more="emit('load-more', $event)"
            @retry="emit('retry', $event)"
          />
        </ul>
        <p
          v-else-if="node.childrenLoaded && !node.error"
          class="destination-node__empty"
          :style="{ paddingLeft: branchIndent }"
        >
          Sin subcarpetas.
        </p>

        <div v-if="node.error" class="destination-node__branch-error" :style="{ paddingLeft: branchIndent }">
          <AlertMessage variant="error">{{ node.error }}</AlertMessage>
          <button type="button" class="destination-node__retry" @click="handleRetry">Reintentar</button>
        </div>
        <button
          v-else-if="node.nextPageToken"
          type="button"
          class="destination-node__load-more"
          :style="{ marginLeft: branchIndent }"
          :disabled="node.loading"
          :aria-busy="node.loading"
          @click="handleLoadMore"
        >
          {{ node.loading ? 'Cargando…' : 'Cargar más' }}
        </button>
      </template>
    </template>
  </li>
</template>

<style scoped>
.destination-node {
  list-style: none;
}

.destination-node__row {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 0.15rem;
}

.destination-node__toggle {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.destination-node__toggle:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.destination-node__toggle:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.destination-node__select {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 44px;
  padding: 0.4rem 0.6rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.destination-node__select:hover:not(:disabled) {
  background: var(--bg-hover);
}

.destination-node__select--selected {
  background: var(--accent-soft);
  color: var(--accent-text);
}

.destination-node__select--selected:hover:not(:disabled) {
  background: var(--accent-soft);
}

.destination-node__select:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.destination-node__icon {
  flex-shrink: 0;
  color: var(--accent-text);
}

.destination-node__select:disabled .destination-node__icon {
  color: var(--text-muted);
}

.destination-node__name {
  min-width: 0;
  flex-shrink: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.destination-node__badge {
  flex-shrink: 0;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: var(--bg-hover);
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
}

.destination-node__check {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--accent-text);
}

.destination-node__loading {
  padding-top: 0.35rem;
  padding-bottom: 0.35rem;
  justify-content: flex-start;
}

.destination-node__branch-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem 0.35rem 0;
}

.destination-node__branch-error :deep(.alert) {
  flex: 1;
  min-width: 12rem;
}

.destination-node__retry {
  flex-shrink: 0;
  min-height: 36px;
  padding: 0.3rem 0.8rem;
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-primary);
}

.destination-node__retry:hover {
  background: var(--bg-hover);
}

.destination-node__empty {
  margin: 0;
  padding-top: 0.3rem;
  padding-bottom: 0.3rem;
  font-size: 0.82rem;
  color: var(--text-muted);
}

.destination-node__load-more {
  min-height: 36px;
  margin-top: 0.15rem;
  margin-bottom: 0.15rem;
  padding: 0.3rem 0.8rem;
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-primary);
}

.destination-node__load-more:hover:not(:disabled) {
  background: var(--bg-hover);
}

.destination-node__load-more:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.destination-node__children {
  margin: 0;
  padding: 0;
}
</style>
