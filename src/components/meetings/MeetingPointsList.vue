<script setup lang="ts">
import { ref, watch, type ComponentPublicInstance } from 'vue'
import IconButton from '@/components/common/IconButton.vue'
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, Pencil, Trash2 } from '@lucide/vue'
import type { MeetingPoint } from '@/types'

const props = defineProps<{
  points: MeetingPoint[]
  canManage: boolean
  updatingPointId: string | null
  deletingPointId: string | null
  isReordering: boolean
}>()

const emit = defineEmits<{
  'edit-request': [point: MeetingPoint, triggerElement: HTMLElement]
  'delete-request': [point: MeetingPoint, triggerElement: HTMLElement]
  'move-up': [pointId: string]
  'move-down': [pointId: string]
}>()

// Todos empiezan contraídos; cada punto se expande de forma independiente
// (varios pueden estar abiertos a la vez). Estado puramente de UI local —
// nunca del store, que solo conoce los datos de negocio.
const expandedIds = ref<Set<string>>(new Set())

// Retira del conjunto de expandidos cualquier id que ya no exista en
// `points` (p. ej. tras un borrado) — nunca deja ids "huérfanos".
watch(
  () => props.points,
  (points) => {
    const currentIds = new Set(points.map((point) => point.id))
    let changed = false
    const next = new Set(expandedIds.value)
    for (const id of next) {
      if (!currentIds.has(id)) {
        next.delete(id)
        changed = true
      }
    }
    if (changed) expandedIds.value = next
  },
)

function isExpanded(pointId: string): boolean {
  return expandedIds.value.has(pointId)
}

function toggle(pointId: string) {
  const next = new Set(expandedIds.value)
  if (next.has(pointId)) next.delete(pointId)
  else next.add(pointId)
  expandedIds.value = next
}

function contentId(pointId: string): string {
  return `meeting-point-content-${pointId}`
}

function toggleLabel(point: MeetingPoint): string {
  const action = isExpanded(point.id) ? 'Contraer' : 'Expandir'
  return `${action} los detalles del punto «${point.title}»`
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

function hasAdditionalContent(point: MeetingPoint): boolean {
  return Boolean(point.description || point.notes || point.agreements)
}

// Referencias a los botones de expansión de cada fila, indexadas por id —
// solo se usan para devolver el foco tras un borrado (ver
// `focusToggleButton`, expuesto al padre). Nunca se usan para las acciones
// de editar/eliminar: esas devuelven el foco a su propio elemento
// disparador, capturado por el padre en el propio evento de clic.
const toggleButtonRefs = new Map<string, HTMLButtonElement>()

function setToggleButtonRef(pointId: string, el: Element | ComponentPublicInstance | null) {
  if (!el) {
    toggleButtonRefs.delete(pointId)
    return
  }
  toggleButtonRefs.set(pointId, el as HTMLButtonElement)
}

function focusToggleButton(pointId: string): boolean {
  const el = toggleButtonRefs.get(pointId)
  if (!el) return false
  el.focus()
  return true
}

defineExpose({ focusToggleButton })

// Reordenación: solo el botón realmente pulsado debe mostrar `busy` —
// `isReordering` del store es un flag único y compartido, así que aquí se
// recuerda localmente qué punto y qué dirección lo dispararon, y se olvida
// en cuanto `isReordering` vuelve a `false` (éxito o fallo, da igual).
const pendingMove = ref<{ pointId: string; direction: 'up' | 'down' } | null>(null)

watch(
  () => props.isReordering,
  (reordering) => {
    if (!reordering) pendingMove.value = null
  },
)

function isRowActionsBlocked(): boolean {
  return props.updatingPointId !== null || props.deletingPointId !== null || props.isReordering
}

function handleMoveUpClick(point: MeetingPoint, index: number) {
  if (index === 0) return
  if (isRowActionsBlocked()) return
  pendingMove.value = { pointId: point.id, direction: 'up' }
  emit('move-up', point.id)
}

function handleMoveDownClick(point: MeetingPoint, index: number) {
  if (index === props.points.length - 1) return
  if (isRowActionsBlocked()) return
  pendingMove.value = { pointId: point.id, direction: 'down' }
  emit('move-down', point.id)
}

function handleEditClick(point: MeetingPoint, event: MouseEvent) {
  if (isRowActionsBlocked()) return
  emit('edit-request', point, event.currentTarget as HTMLElement)
}

function handleDeleteClick(point: MeetingPoint, event: MouseEvent) {
  if (isRowActionsBlocked()) return
  emit('delete-request', point, event.currentTarget as HTMLElement)
}
</script>

<template>
  <ul class="meeting-points-list">
    <li v-for="(point, index) in points" :key="point.id" class="meeting-points-list__item">
      <div class="meeting-points-list__header">
        <button
          type="button"
          class="meeting-points-list__toggle"
          :ref="(el) => setToggleButtonRef(point.id, el)"
          :aria-expanded="isExpanded(point.id)"
          :aria-controls="contentId(point.id)"
          :aria-label="toggleLabel(point)"
          @click="toggle(point.id)"
        >
          <component
            :is="isExpanded(point.id) ? ChevronDown : ChevronRight"
            :size="18"
            :stroke-width="1.75"
            aria-hidden="true"
            class="meeting-points-list__chevron"
          />
          <span class="meeting-points-list__position">{{ point.position }}.</span>
          <span class="meeting-points-list__title">{{ point.title }}</span>
          <span v-if="point.responsible" class="meeting-points-list__responsible">
            {{ point.responsible }}
          </span>
        </button>

        <div v-if="canManage" class="meeting-points-list__actions">
          <IconButton
            :icon="ArrowUp"
            :label="`Subir «${point.title}»`"
            :disabled="index === 0 || isRowActionsBlocked()"
            :busy="
              isReordering &&
              pendingMove?.pointId === point.id &&
              pendingMove.direction === 'up'
            "
            @click="handleMoveUpClick(point, index)"
          />
          <IconButton
            :icon="ArrowDown"
            :label="`Bajar «${point.title}»`"
            :disabled="index === points.length - 1 || isRowActionsBlocked()"
            :busy="
              isReordering &&
              pendingMove?.pointId === point.id &&
              pendingMove.direction === 'down'
            "
            @click="handleMoveDownClick(point, index)"
          />
          <IconButton
            :icon="Pencil"
            :label="`Editar «${point.title}»`"
            :disabled="isRowActionsBlocked()"
            :busy="updatingPointId === point.id"
            @click="handleEditClick(point, $event)"
          />
          <IconButton
            :icon="Trash2"
            :label="`Eliminar «${point.title}»`"
            :disabled="isRowActionsBlocked()"
            :busy="deletingPointId === point.id"
            @click="handleDeleteClick(point, $event)"
          />
        </div>
      </div>

      <div v-show="isExpanded(point.id)" :id="contentId(point.id)" class="meeting-points-list__content">
        <template v-if="hasAdditionalContent(point)">
          <div v-if="point.description" class="meeting-points-list__block">
            <h4>Descripción</h4>
            <p>{{ point.description }}</p>
          </div>
          <div v-if="point.notes" class="meeting-points-list__block">
            <h4>Notas</h4>
            <p>{{ point.notes }}</p>
          </div>
          <div v-if="point.agreements" class="meeting-points-list__block">
            <h4>Acuerdos</h4>
            <p>{{ point.agreements }}</p>
          </div>
        </template>
        <p v-else class="meeting-points-list__empty">Sin contenido adicional</p>

        <div v-if="point.responsible" class="meeting-points-list__block">
          <h4>Responsable</h4>
          <p>{{ point.responsible }}</p>
        </div>

        <p class="meeting-points-list__updated">
          Actualizado el {{ formatDateTime(point.updatedAt) }}
        </p>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.meeting-points-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.meeting-points-list__item {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  overflow: hidden;
}

.meeting-points-list__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  padding: 0.3rem 0.4rem;
}

.meeting-points-list__toggle {
  flex: 1 1 14rem;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 44px;
  padding: 0.3rem 0.4rem;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  font: inherit;
  text-align: left;
  color: var(--text-primary);
  cursor: pointer;
}

.meeting-points-list__toggle:hover {
  background: var(--bg-hover);
}

.meeting-points-list__chevron {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.meeting-points-list__position {
  flex-shrink: 0;
  font-weight: 600;
  color: var(--text-secondary);
}

.meeting-points-list__title {
  min-width: 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.meeting-points-list__responsible {
  min-width: 0;
  flex-shrink: 1;
  font-size: 0.82rem;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

.meeting-points-list__actions {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.1rem;
}

.meeting-points-list__content {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0 1rem 0.9rem 2.85rem;
}

.meeting-points-list__block h4 {
  margin: 0 0 0.2rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.meeting-points-list__block p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-primary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.meeting-points-list__empty {
  margin: 0;
  font-size: 0.85rem;
  font-style: italic;
  color: var(--text-muted);
}

.meeting-points-list__updated {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .meeting-points-list__content {
    padding-left: 0.6rem;
  }
}
</style>
