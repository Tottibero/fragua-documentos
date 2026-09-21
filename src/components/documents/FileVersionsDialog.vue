<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import FileVersionsList from '@/components/documents/FileVersionsList.vue'
import type { DriveFileVersion } from '@/types'

function formatDate(modifiedTime: string | null): string {
  if (!modifiedTime) return 'sin fecha registrada'
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(modifiedTime),
  )
}

const props = withDefaults(
  defineProps<{
    open: boolean
    fileName: string
    versions: DriveFileVersion[]
    isLoading: boolean
    loadError?: string
    downloadingVersionId: string | null
    downloadError?: string
    restoringVersionId: string | null
    restoreError?: string
    updatingKeepForeverVersionId: string | null
    keepForeverError?: string
    canRestore?: boolean
    canProtect?: boolean
  }>(),
  {
    loadError: '',
    downloadError: '',
    restoreError: '',
    keepForeverError: '',
    canRestore: true,
    canProtect: true,
  },
)

const emit = defineEmits<{
  download: [versionId: string]
  restore: [versionId: string]
  'toggle-keep-forever': [versionId: string, nextKeepForever: boolean]
  retry: []
  cancel: []
}>()

// Solo se muestra el spinner a pantalla completa mientras no hay ninguna
// versión que enseñar todavía (primera carga, o un reintento tras un fallo
// sin datos previos). La recarga posterior a una restauración con éxito
// también pone `isLoading` a `true`, pero en ese momento ya hay versiones
// cargadas — se dejan visibles en vez de sustituirlas por el spinner.
const showInitialSpinner = computed(() => props.isLoading && props.versions.length === 0)

const dialogEl = ref<HTMLDialogElement>()
const titleEl = ref<HTMLHeadingElement>()

// Mismo mecanismo que el resto de diálogos: distingue un cierre provocado
// por nosotros mismos (al reaccionar a `open` pasando a false) de uno
// iniciado por el usuario (Escape) — solo este último debe emitir "cancel".
let closingFromPropChange = false

// Versión pendiente de confirmación de restauración — estado puramente
// visual de este componente (qué fila abrió el sub-diálogo), nunca del
// store: `drive-versions.ts` solo conoce qué versión se está restaurando
// una vez confirmado, vía `restoringVersionId`.
const isRestoreConfirmOpen = ref(false)
const pendingRestoreVersion = ref<DriveFileVersion | null>(null)

const isPendingVersionRestoring = computed(
  () =>
    pendingRestoreVersion.value !== null &&
    props.restoringVersionId === pendingRestoreVersion.value.id,
)
const hasBlockingMutation = computed(
  () =>
    props.downloadingVersionId !== null ||
    props.restoringVersionId !== null ||
    props.updatingKeepForeverVersionId !== null,
)

const restoreConfirmDescription = computed(() => {
  if (!pendingRestoreVersion.value) return ''
  return `Se creará una nueva versión vigente a partir de la revisión del ${formatDate(pendingRestoreVersion.value.modifiedTime)}. El historial no se modificará ni se eliminará ninguna versión existente.`
})

watch(
  () => props.open,
  async (open) => {
    if (open) {
      dialogEl.value?.showModal()
      await nextTick()
      titleEl.value?.focus()
    } else {
      if (dialogEl.value?.open) {
        closingFromPropChange = true
        dialogEl.value.close()
      }
      // Defensa: el llamador no debería cerrar este diálogo mientras se
      // restaura (ver `handleNativeCancel`/`handleBackdropClick`), pero si
      // ocurriera igualmente, el sub-diálogo de confirmación no debe
      // sobrevivir a una apertura posterior.
      isRestoreConfirmOpen.value = false
      pendingRestoreVersion.value = null
    }
  },
)

// La confirmación de restauración se cierra sola en cuanto el store deja de
// restaurar la versión pendiente — tanto si tuvo éxito (el propio llamador
// cierra además este diálogo entero, ver DocumentsView) como si falló (este
// diálogo permanece abierto mostrando `restoreError`).
watch(
  () => props.restoringVersionId,
  (restoringVersionId) => {
    if (pendingRestoreVersion.value && restoringVersionId === null) {
      isRestoreConfirmOpen.value = false
      pendingRestoreVersion.value = null
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
// se bloquea mientras se restaura una versión, para no dejar la operación
// huérfana.
function handleNativeCancel(event: Event) {
  if (hasBlockingMutation.value) {
    event.preventDefault()
  }
}

function handleBackdropClick(event: MouseEvent) {
  if (!hasBlockingMutation.value && event.target === dialogEl.value) {
    emit('cancel')
  }
}

function handleRestoreRequest(version: DriveFileVersion) {
  if (props.restoringVersionId !== null) return
  pendingRestoreVersion.value = version
  isRestoreConfirmOpen.value = true
}

function handleConfirmRestore() {
  if (!pendingRestoreVersion.value) return
  emit('restore', pendingRestoreVersion.value.id)
}

function handleCancelRestoreConfirm() {
  // Solo alcanzable cuando no hay restauración en curso: ConfirmDialog ya
  // bloquea su propio Escape/backdrop/cancelar mientras `isConfirming`.
  isRestoreConfirmOpen.value = false
  pendingRestoreVersion.value = null
}

function handleToggleKeepForever(versionId: string, nextKeepForever: boolean) {
  emit('toggle-keep-forever', versionId, nextKeepForever)
}
</script>

<template>
  <dialog
    ref="dialogEl"
    class="file-versions-dialog"
    aria-labelledby="file-versions-title"
    @close="handleClose"
    @cancel="handleNativeCancel"
    @click="handleBackdropClick"
  >
    <div class="file-versions-dialog__box" @click.stop>
      <h2 id="file-versions-title" ref="titleEl" class="file-versions-dialog__title" tabindex="-1">
        Historial de versiones de «{{ fileName }}»
      </h2>

      <LoadingSpinner v-if="showInitialSpinner" label="Cargando historial de versiones…" />

      <template v-else>
        <div v-if="loadError" class="file-versions-dialog__load-error">
          <AlertMessage variant="error">{{ loadError }}</AlertMessage>
          <button type="button" class="file-versions-dialog__retry" @click="emit('retry')">
            Reintentar
          </button>
        </div>

        <EmptyState
          v-else-if="versions.length === 0"
          title="Sin versiones anteriores"
          description="Este archivo todavía no tiene revisiones registradas."
        />

        <FileVersionsList
          v-if="versions.length > 0"
          :versions="versions"
          :downloading-version-id="downloadingVersionId"
          :restoring-version-id="restoringVersionId"
          :updating-keep-forever-version-id="updatingKeepForeverVersionId"
          :can-restore="canRestore"
          :can-protect="canProtect"
          @download="emit('download', $event)"
          @restore-request="handleRestoreRequest"
          @toggle-keep-forever="handleToggleKeepForever"
        />

        <AlertMessage v-if="downloadError" variant="error">{{ downloadError }}</AlertMessage>
        <AlertMessage v-if="restoreError" variant="error">{{ restoreError }}</AlertMessage>
        <AlertMessage v-if="keepForeverError" variant="error">{{ keepForeverError }}</AlertMessage>
      </template>

      <div class="file-versions-dialog__actions">
        <button
          type="button"
          class="file-versions-dialog__close"
          :disabled="hasBlockingMutation"
          @click="emit('cancel')"
        >
          Cerrar
        </button>
      </div>
    </div>

    <ConfirmDialog
      :open="isRestoreConfirmOpen"
      title="Restaurar esta versión"
      :description="restoreConfirmDescription"
      confirm-label="Restaurar"
      cancel-label="Cancelar"
      :is-confirming="isPendingVersionRestoring"
      @confirm="handleConfirmRestore"
      @cancel="handleCancelRestoreConfirm"
    />
  </dialog>
</template>

<style scoped>
.file-versions-dialog {
  border: none;
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: var(--shadow-md);
  max-width: min(94vw, 34rem);
  width: 100%;
}

.file-versions-dialog::backdrop {
  background: rgba(15, 18, 25, 0.45);
}

.file-versions-dialog__box {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  max-height: 85vh;
  overflow-y: auto;
  overflow-x: hidden;
}

.file-versions-dialog__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.file-versions-dialog__title:focus-visible {
  outline: none;
}

.file-versions-dialog__load-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.file-versions-dialog__retry {
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

.file-versions-dialog__retry:hover {
  background: var(--accent-hover);
}

.file-versions-dialog__actions {
  margin-top: 0.25rem;
  display: flex;
  justify-content: flex-end;
}

.file-versions-dialog__close {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.file-versions-dialog__close:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.file-versions-dialog__close:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .file-versions-dialog {
    max-width: 100vw;
  }

  .file-versions-dialog__box {
    padding: 1.1rem;
  }
}
</style>
