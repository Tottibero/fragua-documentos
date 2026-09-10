<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useDriveDocumentsStore } from '@/stores/drive-documents'
import { useDriveDestinationStore } from '@/stores/drive-destination'
import AlertMessage from '@/components/common/AlertMessage.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import DriveBreadcrumbs from '@/components/documents/DriveBreadcrumbs.vue'
import DriveItemsList from '@/components/documents/DriveItemsList.vue'
import CreateFolderDialog from '@/components/documents/CreateFolderDialog.vue'
import UploadFileDialog from '@/components/documents/UploadFileDialog.vue'
import RenameItemDialog from '@/components/documents/RenameItemDialog.vue'
import MoveItemDialog from '@/components/documents/MoveItemDialog.vue'
import { saveBlobAsFile } from '@/utils/download-file'
import type { DriveItem } from '@/types'

const driveDocumentsStore = useDriveDocumentsStore()
const driveDestinationStore = useDriveDestinationStore()

const breadcrumbsRef = ref<InstanceType<typeof DriveBreadcrumbs>>()
const newFolderButtonRef = ref<HTMLButtonElement>()
const uploadButtonRef = ref<HTMLButtonElement>()
const isCreateDialogOpen = ref(false)
const isUploadDialogOpen = ref(false)
const isRenameDialogOpen = ref(false)
// Elemento que se está renombrando y control que abrió el diálogo — se
// conservan estables mientras el diálogo está abierto (incluido durante un
// fallo, para que el diálogo pueda seguir mostrando el nombre actual) y solo
// se limpian una vez cerrado, al devolver el foco.
const renamingTargetItem = ref<DriveItem | null>(null)
const renameTriggerEl = ref<HTMLElement | null>(null)

const isMoveDialogOpen = ref(false)
// Igual que en renombrado: elemento que se mueve y control que abrió el
// diálogo, estables mientras el diálogo está abierto (incluido durante un
// fallo). `moveSourceParentId` captura la carpeta en la que estaba el
// elemento al abrir el diálogo — no se relee del store principal al
// confirmar, así el movimiento no depende de que el usuario no haya podido
// navegar mientras tanto (el diálogo, además, lo bloquea).
const movingTargetItem = ref<DriveItem | null>(null)
const moveSourceParentId = ref<string | null>(null)
const moveTriggerEl = ref<HTMLElement | null>(null)

// Abrir una carpeta o saltar a un breadcrumb elimina del DOM el control que
// el usuario acababa de activar (la lista se sustituye, o el breadcrumb
// pasa a ser el tramo final no interactivo). Tras esperar a que el store
// termine y el DOM se actualice, el foco se mueve al breadcrumb actual para
// no perderlo y anunciar la nueva ubicación. loadRoot() (montaje), la
// paginación y las recargas tras crear una carpeta o subir un archivo no
// pasan por aquí — no deben robar el foco.
async function focusCurrentBreadcrumb() {
  await nextTick()
  breadcrumbsRef.value?.focusCurrent()
}

async function handleOpenFolder(item: DriveItem) {
  const navigated = await driveDocumentsStore.openFolder(item)
  // Una activación ignorada (no es carpeta) u obsoleta (bloqueada por
  // reentrada, o superada por una navegación posterior) no debe mover el
  // foco por adelantado — solo la llamada que realmente completó la
  // navegación vigente lo hace.
  if (navigated) {
    await focusCurrentBreadcrumb()
  }
}

async function handleSelectBreadcrumb(index: number) {
  const navigated = await driveDocumentsStore.goToBreadcrumb(index)
  if (navigated) {
    await focusCurrentBreadcrumb()
  }
}

function handleRetry() {
  driveDocumentsStore.retry()
}

function handleLoadMore() {
  driveDocumentsStore.loadMore()
}

function handleOpenCreateFolderDialog() {
  driveDocumentsStore.resetCreateFolderState()
  isCreateDialogOpen.value = true
}

async function focusNewFolderButton() {
  await nextTick()
  newFolderButtonRef.value?.focus()
}

async function handleCreateFolderSubmit(name: string) {
  const created = await driveDocumentsStore.createFolder(name)
  if (created) {
    isCreateDialogOpen.value = false
    await focusNewFolderButton()
  }
  // Si falló, el diálogo permanece abierto con el nombre y el error del
  // store (createFolderError) — no se mueve el foco.
}

async function handleCreateFolderCancel() {
  isCreateDialogOpen.value = false
  await focusNewFolderButton()
}

function handleOpenUploadDialog() {
  driveDocumentsStore.resetUploadState()
  isUploadDialogOpen.value = true
}

async function focusUploadButton() {
  await nextTick()
  uploadButtonRef.value?.focus()
}

async function handleUploadSubmit(file: File) {
  const uploaded = await driveDocumentsStore.uploadFile(file)
  if (uploaded) {
    isUploadDialogOpen.value = false
    await focusUploadButton()
  }
  // Si falló, el diálogo permanece abierto con el archivo elegido y el
  // error del store (uploadError) — no se mueve el foco.
}

async function handleUploadCancel() {
  isUploadDialogOpen.value = false
  await focusUploadButton()
}

function handleRetryUploadConfig() {
  driveDocumentsStore.fetchUploadConfig()
}

function handleRenameRequest(item: DriveItem, triggerElement: HTMLElement) {
  driveDocumentsStore.resetRenameState()
  renamingTargetItem.value = item
  renameTriggerEl.value = triggerElement
  isRenameDialogOpen.value = true
}

async function focusRenameTrigger() {
  await nextTick()
  renameTriggerEl.value?.focus()
}

async function handleRenameSubmit(name: string) {
  const item = renamingTargetItem.value
  if (!item) return
  const renamed = await driveDocumentsStore.renameItem(item, name)
  if (renamed) {
    isRenameDialogOpen.value = false
    await focusRenameTrigger()
    renamingTargetItem.value = null
    renameTriggerEl.value = null
  }
  // Si falló, el diálogo permanece abierto con el nombre y el error del
  // store (renameError) — no se mueve el foco ni se limpia el elemento.
}

async function handleRenameCancel() {
  isRenameDialogOpen.value = false
  await focusRenameTrigger()
  renamingTargetItem.value = null
  renameTriggerEl.value = null
}

function handleMoveRequest(item: DriveItem, triggerElement: HTMLElement) {
  // `currentFolderId` usa `null` como sentinel de raíz; el flujo de mover
  // necesita el id real que el backend usa como `parentId`, ya conocido
  // tras el primer listado.
  const sourceParentId = driveDocumentsStore.currentFolderId ?? driveDocumentsStore.rootFolderId
  if (!sourceParentId) return

  driveDocumentsStore.resetMoveState()
  movingTargetItem.value = item
  moveSourceParentId.value = sourceParentId
  moveTriggerEl.value = triggerElement
  isMoveDialogOpen.value = true
  driveDestinationStore.open(item.id)
}

async function focusMoveTrigger() {
  await nextTick()
  moveTriggerEl.value?.focus()
}

async function handleMoveSubmit() {
  const item = movingTargetItem.value
  const destinationId = driveDestinationStore.destinationId
  const sourceParentId = moveSourceParentId.value
  if (!item || !destinationId || !sourceParentId) return

  // Repite aquí, en el handler, lo mismo que ya deshabilita el botón en
  // MoveItemDialog — la seguridad no depende solo del `:disabled`: un
  // destino todavía sin resolver, cargando, paginando o tras un fallo de
  // navegación (`isDestinationReady` cubre los cuatro casos) nunca debe
  // llegar a enviarse, ni tampoco un movimiento ya en curso, el padre
  // actual o el propio elemento como destino — estos dos últimos los
  // vuelve a comprobar además `driveDocumentsStore.moveItem` internamente.
  if (!driveDestinationStore.isDestinationReady) return
  if (driveDocumentsStore.isMoving) return
  if (destinationId === sourceParentId) return
  if (destinationId === item.id) return

  const moved = await driveDocumentsStore.moveItem(item, destinationId, sourceParentId)
  if (moved) {
    isMoveDialogOpen.value = false
    movingTargetItem.value = null
    moveSourceParentId.value = null
    moveTriggerEl.value = null
    // La fila del elemento movido desaparece del listado (si seguía siendo
    // el mismo contexto) — se enfoca el breadcrumb actual igual que al
    // navegar, en vez de un botón "Mover" que ya no existe.
    await focusCurrentBreadcrumb()
  }
  // Si falló, el diálogo permanece abierto mostrando moveError — no se
  // mueve el foco ni se limpia el elemento.
}

async function handleMoveCancel() {
  isMoveDialogOpen.value = false
  await focusMoveTrigger()
  movingTargetItem.value = null
  moveSourceParentId.value = null
  moveTriggerEl.value = null
}

// Solo orquesta: pide la descarga al store y, si hay resultado, delega el
// efecto DOM (crear el enlace temporal) en la utilidad. No recarga el
// listado ni mueve el foco al breadcrumb — la descarga no cambia dónde
// está el usuario.
async function handleDownload(item: DriveItem) {
  const result = await driveDocumentsStore.downloadFile(item)
  if (result) {
    saveBlobAsFile(result.blob, result.fileName)
  }
}

onMounted(() => {
  driveDocumentsStore.loadRoot()
  driveDocumentsStore.fetchUploadConfig()
})
</script>

<template>
  <section class="documents-view" aria-labelledby="documents-title">
    <h1 id="documents-title" class="documents-view__title">Documentos</h1>
    <p class="documents-view__subtitle">Explora los archivos guardados en Google Drive.</p>

    <div class="documents-view__toolbar">
      <DriveBreadcrumbs
        ref="breadcrumbsRef"
        :breadcrumbs="driveDocumentsStore.breadcrumbs"
        @select="handleSelectBreadcrumb"
      />
      <div class="documents-view__toolbar-actions">
        <button
          ref="newFolderButtonRef"
          type="button"
          class="documents-view__action-button"
          :disabled="driveDocumentsStore.isLoading"
          @click="handleOpenCreateFolderDialog"
        >
          Nueva carpeta
        </button>
        <button
          ref="uploadButtonRef"
          type="button"
          class="documents-view__action-button"
          :disabled="driveDocumentsStore.isLoading"
          @click="handleOpenUploadDialog"
        >
          Subir archivo
        </button>
      </div>
    </div>

    <LoadingSpinner v-if="driveDocumentsStore.isLoading" label="Cargando documentos…" />

    <div v-else-if="driveDocumentsStore.error" class="documents-view__error">
      <AlertMessage variant="error">{{ driveDocumentsStore.error }}</AlertMessage>
      <button type="button" class="documents-view__retry-button" @click="handleRetry">
        Reintentar
      </button>
    </div>

    <DriveItemsList
      v-else
      :items="driveDocumentsStore.items"
      :next-page-token="driveDocumentsStore.nextPageToken"
      :is-loading-more="driveDocumentsStore.isLoadingMore"
      :load-more-error="driveDocumentsStore.loadMoreError"
      :downloading-file-id="driveDocumentsStore.downloadingFileId"
      :download-error="driveDocumentsStore.downloadError"
      :renaming-item-id="driveDocumentsStore.renamingItemId"
      :moving-item-id="driveDocumentsStore.movingItemId"
      @open-folder="handleOpenFolder"
      @load-more="handleLoadMore"
      @download="handleDownload"
      @rename="handleRenameRequest"
      @move="handleMoveRequest"
    />

    <CreateFolderDialog
      :open="isCreateDialogOpen"
      :is-creating="driveDocumentsStore.isCreatingFolder"
      :error="driveDocumentsStore.createFolderError"
      @submit="handleCreateFolderSubmit"
      @cancel="handleCreateFolderCancel"
    />

    <UploadFileDialog
      :open="isUploadDialogOpen"
      :max-upload-bytes="driveDocumentsStore.maxUploadBytes"
      :is-loading-config="driveDocumentsStore.isLoadingUploadConfig"
      :config-error="driveDocumentsStore.uploadConfigError"
      :is-uploading="driveDocumentsStore.isUploading"
      :upload-error="driveDocumentsStore.uploadError"
      @submit="handleUploadSubmit"
      @cancel="handleUploadCancel"
      @retry-config="handleRetryUploadConfig"
    />

    <RenameItemDialog
      :open="isRenameDialogOpen"
      :item="renamingTargetItem"
      :is-renaming="driveDocumentsStore.isRenaming"
      :error="driveDocumentsStore.renameError"
      @submit="handleRenameSubmit"
      @cancel="handleRenameCancel"
    />

    <MoveItemDialog
      :open="isMoveDialogOpen"
      :item="movingTargetItem"
      :source-parent-id="moveSourceParentId"
      :breadcrumbs="driveDestinationStore.breadcrumbs"
      :folders="driveDestinationStore.folders"
      :destination-id="driveDestinationStore.destinationId"
      :is-destination-ready="driveDestinationStore.isDestinationReady"
      :next-page-token="driveDestinationStore.nextPageToken"
      :is-loading="driveDestinationStore.isLoading"
      :error="driveDestinationStore.error"
      :is-loading-more="driveDestinationStore.isLoadingMore"
      :load-more-error="driveDestinationStore.loadMoreError"
      :is-moving="driveDocumentsStore.isMoving"
      :move-error="driveDocumentsStore.moveError"
      @open-folder="driveDestinationStore.openFolder"
      @select-breadcrumb="driveDestinationStore.goToBreadcrumb"
      @load-more="driveDestinationStore.loadMore"
      @retry="driveDestinationStore.retry"
      @submit="handleMoveSubmit"
      @cancel="handleMoveCancel"
    />
  </section>
</template>

<style scoped>
.documents-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.documents-view__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
}

.documents-view__subtitle {
  margin: -0.5rem 0 0;
  color: var(--text-secondary);
  font-size: 0.92rem;
}

.documents-view__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.documents-view__toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.documents-view__action-button {
  flex-shrink: 0;
  min-height: 44px;
  padding: 0.55rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: var(--accent);
  color: white;
}

.documents-view__action-button:hover:not(:disabled) {
  background: var(--accent-hover);
}

.documents-view__action-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.documents-view__error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.documents-view__retry-button {
  min-height: 44px;
  padding: 0.55rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: var(--accent);
  color: white;
}

.documents-view__retry-button:hover {
  background: var(--accent-hover);
}
</style>
