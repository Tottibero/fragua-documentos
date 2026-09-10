<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import DriveBreadcrumbs from '@/components/documents/DriveBreadcrumbs.vue'
import type { DriveBreadcrumb, DriveItem } from '@/types'

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
    // Estado del selector de destino (store `drive-destination`), pasado
    // como props porque este componente es puramente presentacional.
    breadcrumbs: DriveBreadcrumb[]
    folders: DriveItem[]
    /** Carpeta que se está mostrando ahora mismo en el selector, resuelta a
     * un id real de Drive (nunca el sentinel `null` de raíz). `null` solo
     * antes de que termine la primera carga. */
    destinationId: string | null
    /** `true` solo cuando `destinationId` es un id verificado y estable —
     * calculado en el store (`isLoading`/`isLoadingMore`/`error` incluidos),
     * no solo derivable de las props sueltas de abajo, para que el diálogo
     * y `DocumentsView.handleMoveSubmit` compartan exactamente el mismo
     * criterio y no puedan divergir. */
    isDestinationReady: boolean
    nextPageToken: string | null
    isLoading: boolean
    error?: string
    isLoadingMore: boolean
    loadMoreError?: string
    isMoving: boolean
    moveError?: string
  }>(),
  { error: '', loadMoreError: '', moveError: '' },
)

const emit = defineEmits<{
  'open-folder': [item: DriveItem]
  'select-breadcrumb': [index: number]
  'load-more': []
  retry: []
  submit: []
  cancel: []
}>()

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
      // El contenido varía según el estado del selector (cargando, error,
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

// El selector queda bloqueado por completo mientras se mueve: ni navegar a
// otra carpeta del destino, ni paginar, ni reintentar tiene sentido cuando
// la operación ya está en curso.
function handleSelectBreadcrumb(index: number) {
  if (props.isMoving) return
  emit('select-breadcrumb', index)
}

function handleOpenFolder(folder: DriveItem) {
  if (props.isMoving || folder.id === props.item?.id) return
  emit('open-folder', folder)
}

function handleLoadMore() {
  if (props.isMoving || props.isLoadingMore || !props.nextPageToken) return
  emit('load-more')
}

function handleRetry() {
  if (props.isMoving) return
  emit('retry')
}

// Fuente única de verdad de si "Mover aquí" puede activarse: bloquea un
// movimiento en curso, un destino todavía no verificado o inestable
// (`isDestinationReady` ya cubre "sin rootFolderId todavía", "cargando
// inicialmente", "navegando a otra carpeta", "paginando" y "la carga de la
// carpeta actual falló"), el mismo padre actual (no cambiaría nada) y el
// propio elemento (solo alcanzable de forma defensiva — el listado ya
// deshabilita e impide entrar en esa carpeta).
const canSubmit = computed(() => {
  if (props.isMoving) return false
  if (!props.isDestinationReady) return false
  if (!props.item || !props.destinationId) return false
  if (props.destinationId === props.sourceParentId) return false
  if (props.destinationId === props.item.id) return false
  return true
})

const isAlreadyHere = computed(
  () => props.destinationId !== null && props.destinationId === props.sourceParentId,
)
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

      <p class="move-item-dialog__section-label">Selecciona la carpeta de destino:</p>
      <DriveBreadcrumbs :breadcrumbs="breadcrumbs" @select="handleSelectBreadcrumb" />

      <LoadingSpinner v-if="isLoading" label="Cargando carpetas…" />

      <div v-else-if="error" class="move-item-dialog__error">
        <AlertMessage variant="error">{{ error }}</AlertMessage>
        <button type="button" class="move-item-dialog__retry" @click="handleRetry">
          Reintentar
        </button>
      </div>

      <template v-else>
        <ul v-if="folders.length > 0" class="move-item-dialog__folders">
          <li v-for="folder in folders" :key="folder.id">
            <button
              type="button"
              class="move-item-dialog__folder"
              :disabled="isMoving || folder.id === item?.id"
              :title="folder.id === item?.id ? 'No puedes mover un elemento dentro de sí mismo.' : undefined"
              @click="handleOpenFolder(folder)"
            >
              {{ folder.name }}
            </button>
          </li>
        </ul>
        <p v-else class="move-item-dialog__empty">No hay subcarpetas aquí.</p>

        <AlertMessage v-if="loadMoreError" variant="error">{{ loadMoreError }}</AlertMessage>

        <button
          v-if="nextPageToken"
          type="button"
          class="move-item-dialog__load-more"
          :disabled="isMoving || isLoadingMore"
          :aria-busy="isLoadingMore"
          @click="handleLoadMore"
        >
          {{ isLoadingMore ? 'Cargando…' : 'Cargar más' }}
        </button>
      </template>

      <p v-if="isAlreadyHere" class="move-item-dialog__hint">Este elemento ya está en esta carpeta.</p>

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
  max-width: min(90vw, 30rem);
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
  max-height: 85vh;
  overflow-y: auto;
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

.move-item-dialog__error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.move-item-dialog__retry {
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

.move-item-dialog__retry:hover {
  background: var(--accent-hover);
}

.move-item-dialog__folders {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 14rem;
  overflow-y: auto;
}

.move-item-dialog__folder {
  width: 100%;
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  overflow-wrap: anywhere;
}

.move-item-dialog__folder:hover:not(:disabled) {
  background: var(--bg-hover);
}

.move-item-dialog__folder:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.move-item-dialog__empty {
  margin: 0;
  padding: 0.5rem 0;
  font-size: 0.88rem;
  color: var(--text-secondary);
}

.move-item-dialog__load-more {
  align-self: flex-start;
  min-height: 44px;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-primary);
}

.move-item-dialog__load-more:hover:not(:disabled) {
  background: var(--bg-hover);
}

.move-item-dialog__load-more:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.move-item-dialog__hint {
  margin: 0;
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
</style>
