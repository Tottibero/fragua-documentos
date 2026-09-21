<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import DriveDestinationTree from '@/components/documents/DriveDestinationTree.vue'
import NameConflictResolver from '@/components/documents/NameConflictResolver.vue'
import type { DriveDestinationNode, DriveItem, DriveNameConflictResponse } from '@/types'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Elemento que se está moviendo — `null` solo antes de la primera
     * apertura. Mientras `open` es `true` el llamador lo mantiene estable
     * (no lo limpia hasta que el diálogo se cierra de verdad). */
    item: DriveItem | null
    /** Carpeta en la que se encontraba `item` cuando se abrió el diálogo —
     * captura, no lectura en vivo del listado principal, para no depender
     * de que el usuario no haya navegado entretanto. */
    sourceParentId: string | null
    // Estado del árbol de destino (store `drive-destination`), pasado como
    // props porque este componente es puramente presentacional.
    rootNode: DriveDestinationNode | null
    isLoadingRoot: boolean
    rootError?: string
    selectedDestinationId: string | null
    /** Ruta completa (raíz → seleccionado) del destino elegido, ya
     * resuelta por el store — vacía si todavía no hay selección. */
    selectedPath: { id: string; name: string }[]
    isMoving: boolean
    moveError?: string
    /** Fase 2.6: conflicto estructurado del movimiento en curso — su sola
     * presencia decide si se muestra el árbol de destino o
     * `NameConflictResolver`. */
    conflict: DriveNameConflictResponse | null
  }>(),
  { rootError: '', moveError: '' },
)

const emit = defineEmits<{
  toggle: [nodeId: string]
  select: [nodeId: string]
  'load-more': [nodeId: string]
  retry: [nodeId: string]
  'retry-root': []
  submit: []
  cancel: []
  /** Reenvío tras un conflicto, con `keep_both` (la única resolución que
   * mover admite) — sin payload: el padre relee el mismo elemento y destino
   * ya elegidos (`item`, `sourceParentId`, `selectedDestinationId`), igual
   * que hace el `submit` inicial. */
  'resolve-keep-both': []
  /** "Volver" del resolver: cancela solo la resolución, nunca el diálogo
   * completo — el padre limpia `conflict` (vía `resetMoveState`) y este
   * componente vuelve a mostrar el árbol; su estado (expansión, selección)
   * no se ha tocado en ningún momento, así que reaparece tal cual estaba. */
  'conflict-back': []
}>()

// El elemento que se mueve es siempre el nodo excluido del árbol — no hace
// falta una prop aparte, `item` ya lo lleva.
const excludedItemId = computed(() => props.item?.id ?? null)

const dialogEl = ref<HTMLDialogElement>()
const cancelButton = ref<HTMLButtonElement>()
const conflictResolverRef = ref<InstanceType<typeof NameConflictResolver>>()

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
      // El contenido varía según el estado del árbol (cargando, error,
      // listado) así que no hay un control inicial estable dentro de él;
      // "Cancelar" está presente en los tres casos.
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
// se bloquea mientras se está moviendo para no dejar la operación huérfana.
function handleNativeCancel(event: Event) {
  if (props.isMoving) {
    event.preventDefault()
  }
}

function handleBackdropClick(event: MouseEvent) {
  if (!props.isMoving && event.target === dialogEl.value) {
    emit('cancel')
  }
}

// El árbol queda bloqueado por completo mientras se mueve: ni expandir,
// seleccionar, paginar ni reintentar tiene sentido cuando la operación ya
// está en curso.
function handleToggle(nodeId: string) {
  if (props.isMoving) return
  emit('toggle', nodeId)
}

function handleSelect(nodeId: string) {
  if (props.isMoving) return
  emit('select', nodeId)
}

function handleLoadMore(nodeId: string) {
  if (props.isMoving) return
  emit('load-more', nodeId)
}

function handleRetry(nodeId: string) {
  if (props.isMoving) return
  emit('retry', nodeId)
}

function handleRetryRoot() {
  if (props.isMoving) return
  emit('retry-root')
}

// Fuente única de verdad de si "Mover aquí" puede activarse: un movimiento
// en curso, ninguna selección todavía, o (de forma defensiva — el árbol ya
// deshabilita esas filas) el mismo padre actual o el propio elemento como
// destino.
const canSubmit = computed(() => {
  if (props.isMoving) return false
  if (!props.item || !props.selectedDestinationId) return false
  if (props.selectedDestinationId === props.sourceParentId) return false
  if (props.selectedDestinationId === props.item.id) return false
  return true
})

const selectedPathLabel = computed(() => props.selectedPath.map((node) => node.name).join(' / '))

// Fase 2.6: al aparecer un conflicto, el foco pasa al título del bloque de
// resolución; al desaparecer (por "Volver" o por una nueva petición que ya
// no lo reproduce) vuelve a "Cancelar" — el mismo anclaje estable que ya usa
// la apertura inicial del diálogo, porque el árbol no tiene un control de
// destino único y fijo al que volver (nodo expandido/seleccionado, según lo
// que hubiera antes del conflicto).
watch(
  () => props.conflict,
  async (conflict, previousConflict) => {
    if (!props.open) return
    if (conflict) {
      await nextTick()
      await conflictResolverRef.value?.focusTitle()
    } else if (previousConflict) {
      await nextTick()
      cancelButton.value?.focus()
    }
  },
)

// Reenvío de una decisión explícita: sin payload, el padre relee el mismo
// elemento y destino ya elegidos. Mover solo admite `keep_both` (nunca
// `replace`).
function handleKeepBoth() {
  emit('resolve-keep-both')
}

function handleConflictBack() {
  emit('conflict-back')
}
</script>

<template>
  <dialog
    ref="dialogEl"
    class="move-item-dialog"
    aria-labelledby="move-item-title"
    @close="handleClose"
    @cancel="handleNativeCancel"
    @click="handleBackdropClick"
  >
    <div class="move-item-dialog__box" @click.stop>
      <h2 id="move-item-title" class="move-item-dialog__title">
        Mover «{{ item?.name ?? '' }}»
      </h2>
      <p class="move-item-dialog__subtitle">{{ item?.isFolder ? 'Carpeta' : 'Archivo' }}</p>

      <NameConflictResolver
        v-if="conflict"
        ref="conflictResolverRef"
        :conflicts="conflict.conflicts"
        :allowed-resolutions="conflict.allowedResolutions"
        operation="move"
        :busy="isMoving"
        @keep-both="handleKeepBoth"
        @cancel="handleConflictBack"
      />

      <template v-else>
        <p class="move-item-dialog__section-label">Selecciona la carpeta de destino:</p>

        <DriveDestinationTree
          :root-node="rootNode"
          :is-loading-root="isLoadingRoot"
          :root-error="rootError"
          :selected-destination-id="selectedDestinationId"
          :source-parent-id="sourceParentId"
          :excluded-item-id="excludedItemId"
          @toggle="handleToggle"
          @select="handleSelect"
          @load-more="handleLoadMore"
          @retry="handleRetry"
          @retry-root="handleRetryRoot"
        />

        <p v-if="selectedPath.length > 0" class="move-item-dialog__destination">
          <span class="move-item-dialog__destination-label">Destino:</span>
          {{ selectedPathLabel }}
        </p>
        <p v-else class="move-item-dialog__hint">Todavía no has seleccionado ninguna carpeta.</p>
      </template>

      <AlertMessage v-if="moveError" variant="error">{{ moveError }}</AlertMessage>

      <div class="move-item-dialog__actions">
        <button
          ref="cancelButton"
          type="button"
          class="move-item-dialog__cancel"
          :disabled="isMoving"
          @click="emit('cancel')"
        >
          Cancelar
        </button>
        <button
          v-if="!conflict"
          type="button"
          class="move-item-dialog__confirm"
          :disabled="!canSubmit"
          :aria-busy="isMoving"
          @click="emit('submit')"
        >
          {{ isMoving ? 'Moviendo…' : 'Mover aquí' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.move-item-dialog {
  border: none;
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: var(--shadow-md);
  max-width: min(94vw, 32rem);
  width: 100%;
}

.move-item-dialog::backdrop {
  background: rgba(15, 18, 25, 0.45);
}

.move-item-dialog__box {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  max-height: 90vh;
  overflow-y: auto;
  overflow-x: hidden;
}

.move-item-dialog__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.move-item-dialog__subtitle {
  margin: -0.5rem 0 0;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.move-item-dialog__section-label {
  margin: 0.25rem 0 -0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.move-item-dialog__destination {
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 0.85rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.move-item-dialog__destination-label {
  font-weight: 700;
  margin-right: 0.3rem;
}

.move-item-dialog__hint {
  margin: 0;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.move-item-dialog__actions {
  margin-top: 0.25rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.move-item-dialog__cancel,
.move-item-dialog__confirm {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.move-item-dialog__cancel {
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.move-item-dialog__cancel:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.move-item-dialog__confirm {
  border: none;
  background: var(--accent);
  color: white;
}

.move-item-dialog__confirm:hover:not(:disabled) {
  background: var(--accent-hover);
}

.move-item-dialog__cancel:disabled,
.move-item-dialog__confirm:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .move-item-dialog {
    max-width: 100vw;
  }

  .move-item-dialog__box {
    padding: 1.1rem;
  }
}
</style>
