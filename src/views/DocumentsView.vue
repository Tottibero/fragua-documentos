<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useDriveDocumentsStore } from '@/stores/drive-documents'
import { useDriveDestinationStore } from '@/stores/drive-destination'
import { useDriveVersionsStore } from '@/stores/drive-versions'
import { useToastStore } from '@/stores/toast'
import AlertMessage from '@/components/common/AlertMessage.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import DriveBreadcrumbs from '@/components/documents/DriveBreadcrumbs.vue'
import DriveItemsList from '@/components/documents/DriveItemsList.vue'
import CreateFolderDialog from '@/components/documents/CreateFolderDialog.vue'
import UploadFileDialog from '@/components/documents/UploadFileDialog.vue'
import RenameItemDialog from '@/components/documents/RenameItemDialog.vue'
import MoveItemDialog from '@/components/documents/MoveItemDialog.vue'
import ReplaceFileDialog from '@/components/documents/ReplaceFileDialog.vue'
import FileVersionsDialog from '@/components/documents/FileVersionsDialog.vue'
import TrashItemDialog from '@/components/documents/TrashItemDialog.vue'
import { FolderPlus, Upload } from '@lucide/vue'
import { saveBlobAsFile } from '@/utils/download-file'
import type { DriveConflictOutcome } from '@/stores/drive-documents'
import type { DriveItem } from '@/types'

// Mismo tamaño y grosor que fija internamente IconButton — estos dos
// botones conservan texto (son acciones principales, no deben leerse como
// iconos ambiguos) pero su icono debe pertenecer a la misma familia visual.
const ACTION_ICON_SIZE = 18
const ACTION_ICON_STROKE_WIDTH = 1.75

const driveDocumentsStore = useDriveDocumentsStore()
const driveDestinationStore = useDriveDestinationStore()
const driveVersionsStore = useDriveVersionsStore()
const toastStore = useToastStore()

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

const isReplaceDialogOpen = ref(false)
// Igual que en renombrado: elemento cuyo contenido se reemplaza y control
// que abrió el diálogo, estables mientras el diálogo está abierto (incluido
// durante un fallo) y solo se limpian una vez cerrado, al devolver el foco.
const replacingTargetItem = ref<DriveItem | null>(null)
const replaceTriggerEl = ref<HTMLElement | null>(null)

const isVersionsDialogOpen = ref(false)
// A diferencia de renombrado/mover/reemplazar, el archivo cuyo historial se
// muestra no se guarda aquí: `useDriveVersionsStore().selectedItem` ya es
// su única fuente de verdad (el propio store lo fija en `open()` y lo
// mantiene actualizado tras una restauración). Solo se conserva el control
// que abrió el diálogo, para devolverle el foco al cerrar.
const versionsTriggerEl = ref<HTMLElement | null>(null)

const isTrashDialogOpen = ref(false)
// Igual que en renombrado/mover/reemplazar: elemento que se envía a la
// papelera y control que abrió el diálogo, estables mientras el diálogo está
// abierto (incluido durante un fallo, para poder reintentar) y solo se
// limpian una vez cerrado.
const trashingTargetItem = ref<DriveItem | null>(null)
const trashTriggerEl = ref<HTMLElement | null>(null)

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
    toastStore.success(`Carpeta «${name}» creada.`)
    isCreateDialogOpen.value = false
    await focusNewFolderButton()
  } else if (driveDocumentsStore.createFolderError) {
    // Único punto de publicación de este error: el diálogo ya lo muestra
    // como texto contextual (para corregir/reintentar); el toast lo
    // complementa con el mismo mensaje, nunca con el texto crudo del
    // backend. Si `created` es `false` por un envío duplicado bloqueado
    // (sin haber llegado a intentar la petición), `createFolderError` sigue
    // vacío y no se publica nada.
    toastStore.error(driveDocumentsStore.createFolderError)
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

// Punto único de resolución para las tres formas de terminar una subida
// (primer intento, "conservar ambos", "reemplazar existente"): decide el
// toast y el cierre según el desenlace, nunca al revés. `'conflict'` no es
// un fallo — el diálogo permanece abierto mostrando `uploadConflict` (ya
// escrito por el store), sin ningún toast; `'blocked'` tampoco hace nada,
// no llegó a intentarse ninguna petición.
async function handleUploadOutcome(outcome: DriveConflictOutcome, successMessage: string) {
  if (outcome === 'success') {
    toastStore.success(successMessage)
    isUploadDialogOpen.value = false
    await focusUploadButton()
  } else if (outcome === 'error' && driveDocumentsStore.uploadError) {
    toastStore.error(driveDocumentsStore.uploadError)
  }
  // Si falló, el diálogo permanece abierto con el archivo elegido y el
  // error del store (uploadError) — no se mueve el foco.
}

async function handleUploadSubmit(file: File) {
  const outcome = await driveDocumentsStore.uploadFile(file)
  await handleUploadOutcome(outcome, `Archivo «${file.name}» subido.`)
}

async function handleUploadKeepBoth(file: File) {
  const outcome = await driveDocumentsStore.uploadFile(file, 'keep_both')
  await handleUploadOutcome(outcome, `Archivo «${file.name}» subido conservando ambos nombres.`)
}

async function handleUploadReplace(file: File, conflictItemId: string) {
  const outcome = await driveDocumentsStore.uploadFile(file, 'replace', conflictItemId)
  await handleUploadOutcome(outcome, `Archivo «${file.name}» subido, reemplazando el existente.`)
}

// "Volver" del resolver: limpia únicamente el conflicto (nunca el error, que
// ya está vacío en este camino) — el diálogo vuelve a mostrar el formulario
// con el archivo elegido intacto.
function handleUploadConflictBack() {
  driveDocumentsStore.resetUploadState()
}

async function handleUploadCancel() {
  // Cerrar el diálogo entero invalida cualquier conflicto pendiente — no
  // debe reaparecer si se vuelve a abrir sobre otro archivo o carpeta.
  driveDocumentsStore.resetUploadState()
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

// Igual que `handleUploadOutcome`: punto único de resolución para el primer
// intento y para "conservar ambos" (renombrar solo admite esa resolución).
async function handleRenameOutcome(outcome: DriveConflictOutcome, item: DriveItem, name: string) {
  if (outcome === 'success') {
    // Construcción impersonal a propósito: `item` puede ser una carpeta o
    // un archivo (géneros distintos en español) y el participio de un
    // adjetivo tras el nombre tendría que concordar con uno de los dos.
    toastStore.success(`Se ha renombrado «${item.name}» a «${name}».`)
    isRenameDialogOpen.value = false
    await focusRenameTrigger()
    renamingTargetItem.value = null
    renameTriggerEl.value = null
  } else if (outcome === 'error' && driveDocumentsStore.renameError) {
    toastStore.error(driveDocumentsStore.renameError)
  }
  // Si falló, el diálogo permanece abierto con el nombre y el error del
  // store (renameError) — no se mueve el foco ni se limpia el elemento. Si
  // hubo conflicto, permanece abierto mostrando renameConflict, sin toast.
}

async function handleRenameSubmit(name: string) {
  const item = renamingTargetItem.value
  if (!item) return
  const outcome = await driveDocumentsStore.renameItem(item, name)
  await handleRenameOutcome(outcome, item, name)
}

async function handleRenameKeepBoth(name: string) {
  const item = renamingTargetItem.value
  if (!item) return
  const outcome = await driveDocumentsStore.renameItem(item, name, 'keep_both')
  await handleRenameOutcome(outcome, item, name)
}

function handleRenameConflictBack() {
  driveDocumentsStore.resetRenameState()
}

async function handleRenameCancel() {
  driveDocumentsStore.resetRenameState()
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
  driveDestinationStore.open(item.id, sourceParentId)
}

async function focusMoveTrigger() {
  await nextTick()
  moveTriggerEl.value?.focus()
}

/** Contexto necesario para (re)intentar el movimiento — el mismo en el
 * primer envío y en "conservar ambos": elemento, destino elegido y carpeta
 * de origen capturada al abrir el diálogo. `null` si falta cualquiera de
 * los tres (defensivo, igual que las comprobaciones que ya hacía
 * `handleMoveSubmit` antes de esta fase). */
function currentMoveContext(): { item: DriveItem; destinationId: string; sourceParentId: string } | null {
  const item = movingTargetItem.value
  const destinationId = driveDestinationStore.selectedDestinationId
  const sourceParentId = moveSourceParentId.value
  if (!item || !destinationId || !sourceParentId) return null
  return { item, destinationId, sourceParentId }
}

// Igual que `handleUploadOutcome`/`handleRenameOutcome`: punto único de
// resolución para el primer intento y para "conservar ambos" (mover solo
// admite esa resolución).
async function handleMoveOutcome(outcome: DriveConflictOutcome, item: DriveItem, destinationName: string) {
  if (outcome === 'success') {
    // Construcción impersonal a propósito: `item` puede ser una carpeta o
    // un archivo (géneros distintos en español).
    toastStore.success(
      destinationName
        ? `Se ha movido «${item.name}» a «${destinationName}».`
        : `Se ha movido «${item.name}».`,
    )
    // Cierre real del selector de destino: invalida de inmediato cualquier
    // carga de rama que siguiera en vuelo y limpia el árbol — una respuesta
    // tardía ya no puede repoblarlo tras cerrarse.
    driveDestinationStore.close()
    isMoveDialogOpen.value = false
    movingTargetItem.value = null
    moveSourceParentId.value = null
    moveTriggerEl.value = null
    // La fila del elemento movido desaparece del listado (si seguía siendo
    // el mismo contexto) — se enfoca el breadcrumb actual igual que al
    // navegar, en vez de un botón "Mover" que ya no existe.
    await focusCurrentBreadcrumb()
  } else if (outcome === 'error' && driveDocumentsStore.moveError) {
    toastStore.error(driveDocumentsStore.moveError)
  }
  // Si falló, el diálogo permanece abierto mostrando moveError — no se
  // mueve el foco ni se limpia el elemento, y el árbol del selector de
  // destino tampoco: no es un cierre real. Si hubo conflicto, permanece
  // abierto mostrando moveConflict, sin toast — el árbol y el destino
  // elegido tampoco se tocan.
}

async function handleMoveSubmit() {
  const context = currentMoveContext()
  if (!context) return
  const { item, destinationId, sourceParentId } = context

  // Repite aquí, en el handler, lo mismo que ya deshabilita el botón en
  // MoveItemDialog — la seguridad no depende solo del `:disabled`: un
  // movimiento ya en curso, el padre actual o el propio elemento como
  // destino nunca deben llegar a enviarse, aunque `selectDestination` del
  // store ya impida seleccionarlos en primer lugar y
  // `driveDocumentsStore.moveItem` los vuelva a comprobar internamente.
  if (driveDocumentsStore.isMoving) return
  if (destinationId === sourceParentId) return
  if (destinationId === item.id) return

  // Se lee antes de cerrar el selector (que vacía `selectedPath`): es el
  // único momento en que el nombre de la carpeta de destino sigue disponible
  // para el mensaje de éxito.
  const destinationName = driveDestinationStore.selectedPath.at(-1)?.name ?? ''

  const outcome = await driveDocumentsStore.moveItem(item, destinationId, sourceParentId)
  await handleMoveOutcome(outcome, item, destinationName)
}

async function handleMoveKeepBoth() {
  const context = currentMoveContext()
  if (!context) return
  const { item, destinationId, sourceParentId } = context
  if (driveDocumentsStore.isMoving) return

  const destinationName = driveDestinationStore.selectedPath.at(-1)?.name ?? ''
  const outcome = await driveDocumentsStore.moveItem(item, destinationId, sourceParentId, 'keep_both')
  await handleMoveOutcome(outcome, item, destinationName)
}

function handleMoveConflictBack() {
  driveDocumentsStore.resetMoveState()
}

// Cubre a la vez cancelar, Escape y backdrop — MoveItemDialog los reduce a
// un único evento "cancel" (y los bloquea mientras `isMoving`), así que este
// es el único punto donde cerrar de verdad el selector de destino.
async function handleMoveCancel() {
  // Cerrar el diálogo entero invalida cualquier conflicto pendiente — no
  // debe reaparecer si se vuelve a abrir sobre otro elemento.
  driveDocumentsStore.resetMoveState()
  driveDestinationStore.close()
  isMoveDialogOpen.value = false
  await focusMoveTrigger()
  movingTargetItem.value = null
  moveSourceParentId.value = null
  moveTriggerEl.value = null
}

function handleReplaceRequest(item: DriveItem, triggerElement: HTMLElement) {
  driveDocumentsStore.resetReplaceState()
  replacingTargetItem.value = item
  replaceTriggerEl.value = triggerElement
  isReplaceDialogOpen.value = true
}

async function focusReplaceTrigger() {
  await nextTick()
  replaceTriggerEl.value?.focus()
}

async function handleReplaceSubmit(file: File) {
  const item = replacingTargetItem.value
  if (!item) return
  const replaced = await driveDocumentsStore.replaceFileContent(item, file)
  if (replaced) {
    toastStore.success(`Nueva versión de «${item.name}» subida.`)
    isReplaceDialogOpen.value = false
    await focusReplaceTrigger()
    replacingTargetItem.value = null
    replaceTriggerEl.value = null
  } else if (driveDocumentsStore.replaceError) {
    toastStore.error(driveDocumentsStore.replaceError)
  }
  // Si falló, el diálogo permanece abierto con el archivo elegido y el
  // error del store (replaceError) — no se mueve el foco ni se limpia el
  // elemento.
}

async function handleReplaceCancel() {
  isReplaceDialogOpen.value = false
  await focusReplaceTrigger()
  replacingTargetItem.value = null
  replaceTriggerEl.value = null
}

function handleVersionsRequest(item: DriveItem, triggerElement: HTMLElement) {
  versionsTriggerEl.value = triggerElement
  isVersionsDialogOpen.value = true
  driveVersionsStore.open(item)
}

async function focusVersionsTrigger() {
  await nextTick()
  versionsTriggerEl.value?.focus()
}

// Cubre a la vez cancelar, Escape y backdrop — FileVersionsDialog los
// reduce a un único evento "cancel" (y los bloquea mientras se restaura una
// versión), así que este es el único punto donde cerrar de verdad el
// historial.
async function handleVersionsCancel() {
  driveVersionsStore.close()
  isVersionsDialogOpen.value = false
  await focusVersionsTrigger()
  versionsTriggerEl.value = null
}

function handleVersionsRetry() {
  driveVersionsStore.retryLoad()
}

// Mismo patrón que handleDownload: solo orquesta, delega el efecto DOM en
// la utilidad. No cierra el historial ni mueve el foco — descargar una
// versión anterior no cambia qué archivo se está consultando.
async function handleVersionDownload(versionId: string) {
  const itemName = driveVersionsStore.selectedItem?.name ?? ''
  const result = await driveVersionsStore.downloadVersion(versionId)
  if (result) {
    saveBlobAsFile(result.blob, result.fileName)
    toastStore.success(itemName ? `Versión de «${itemName}» descargada.` : 'Versión descargada.')
  } else if (driveVersionsStore.downloadError) {
    toastStore.error(driveVersionsStore.downloadError)
  }
}

// El contexto de navegación se captura antes de restaurar (no después),
// igual que `renameItem`/`moveItem`/`replaceFileContent` capturan
// `navigationSeq` al empezar — así una navegación que ocurriera *durante*
// la restauración (no debería: el diálogo bloquea el resto de la página
// mientras está abierto, pero esto es la misma defensa que ya aplican esos
// otros flujos) no hace que el resultado se aplique a la carpeta nueva.
async function handleVersionRestore(versionId: string) {
  const navigationId = driveDocumentsStore.currentNavigationContext()
  const itemName = driveVersionsStore.selectedItem?.name ?? ''
  const restored = await driveVersionsStore.restoreVersion(versionId)
  if (restored) {
    driveDocumentsStore.applyItemUpdate(restored, navigationId)
    toastStore.success(itemName ? `Versión de «${itemName}» restaurada.` : 'Versión restaurada.')
    // Restauración con éxito: la fila permanece (ya actualizada por
    // applyItemUpdate), se cierra el historial entero — no solo la
    // confirmación — y el foco vuelve al botón "Historial de versiones".
    driveVersionsStore.close()
    isVersionsDialogOpen.value = false
    await focusVersionsTrigger()
    versionsTriggerEl.value = null
  } else if (driveVersionsStore.restoreError) {
    toastStore.error(driveVersionsStore.restoreError)
  }
  // Si falló, el historial permanece abierto mostrando restoreError — no se
  // mueve el foco ni se cierra nada.
}

async function handleVersionToggleKeepForever(versionId: string, nextKeepForever: boolean) {
  const itemName = driveVersionsStore.selectedItem?.name ?? ''
  const suffix = itemName ? ` de «${itemName}»` : ''
  const updated = await driveVersionsStore.updateKeepForever(versionId, nextKeepForever)
  if (updated) {
    toastStore.success(
      nextKeepForever ? `Versión${suffix} protegida.` : `Protección retirada de la versión${suffix}.`,
    )
  } else if (driveVersionsStore.keepForeverError) {
    toastStore.error(driveVersionsStore.keepForeverError)
  }
}

// Solo orquesta: pide la descarga al store y, si hay resultado, delega el
// efecto DOM (crear el enlace temporal) en la utilidad. No recarga el
// listado ni mueve el foco al breadcrumb — la descarga no cambia dónde
// está el usuario.
async function handleDownload(item: DriveItem) {
  const result = await driveDocumentsStore.downloadFile(item)
  if (result) {
    saveBlobAsFile(result.blob, result.fileName)
    toastStore.success(`Se ha descargado «${item.name}».`)
  } else if (driveDocumentsStore.downloadError) {
    // Si `result` es `null` por un envío duplicado bloqueado (sin haber
    // llegado a intentar la petición) o por una respuesta obsoleta
    // descartada por `navigationSeq`, `downloadError` sigue vacío y no se
    // publica nada — solo un fallo real de esta descarga lo deja escrito.
    toastStore.error(driveDocumentsStore.downloadError)
  }
}

function handleTrashRequest(item: DriveItem, triggerElement: HTMLElement) {
  driveDocumentsStore.resetTrashState()
  trashingTargetItem.value = item
  trashTriggerEl.value = triggerElement
  isTrashDialogOpen.value = true
}

async function focusTrashTrigger() {
  await nextTick()
  trashTriggerEl.value?.focus()
}

async function handleTrashConfirm() {
  const item = trashingTargetItem.value
  if (!item) return
  const trashed = await driveDocumentsStore.trashItem(item)
  if (trashed) {
    // Construcción impersonal a propósito, igual que en renombrar/mover:
    // `item` puede ser una carpeta o un archivo (géneros distintos).
    toastStore.success(`Se ha enviado «${item.name}» a la papelera.`)
    isTrashDialogOpen.value = false
    trashingTargetItem.value = null
    trashTriggerEl.value = null
    // La fila del elemento enviado a la papelera desaparece del listado (si
    // seguía siendo el mismo contexto) — se enfoca el breadcrumb actual,
    // nunca el botón "Enviar a la papelera" que ya no existe.
    await focusCurrentBreadcrumb()
  } else if (driveDocumentsStore.trashError) {
    toastStore.error(driveDocumentsStore.trashError)
  }
  // Si falló, el diálogo permanece abierto mostrando trashError, con el
  // elemento seleccionado — no se mueve el foco ni se limpia el elemento.
}

async function handleTrashCancel() {
  isTrashDialogOpen.value = false
  await focusTrashTrigger()
  trashingTargetItem.value = null
  trashTriggerEl.value = null
}

onMounted(() => {
  driveDocumentsStore.loadRoot()
  driveDocumentsStore.fetchUploadConfig()
})
</script>

<template>
  <section class="documents-view" aria-labelledby="documents-title">
    <h1 id="documents-title" class="documents-view__title">Documentos</h1>

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
          <FolderPlus
            class="documents-view__action-icon"
            :size="ACTION_ICON_SIZE"
            :stroke-width="ACTION_ICON_STROKE_WIDTH"
            aria-hidden="true"
          />
          Nueva carpeta
        </button>
        <button
          ref="uploadButtonRef"
          type="button"
          class="documents-view__action-button"
          :disabled="driveDocumentsStore.isLoading"
          @click="handleOpenUploadDialog"
        >
          <Upload
            class="documents-view__action-icon"
            :size="ACTION_ICON_SIZE"
            :stroke-width="ACTION_ICON_STROKE_WIDTH"
            aria-hidden="true"
          />
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
      :replacing-file-id="driveDocumentsStore.replacingFileId"
      :trashing-item-id="driveDocumentsStore.trashingItemId"
      @open-folder="handleOpenFolder"
      @load-more="handleLoadMore"
      @download="handleDownload"
      @rename="handleRenameRequest"
      @move="handleMoveRequest"
      @replace="handleReplaceRequest"
      @versions="handleVersionsRequest"
      @trash="handleTrashRequest"
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
      :upload-conflict="driveDocumentsStore.uploadConflict"
      @submit="handleUploadSubmit"
      @cancel="handleUploadCancel"
      @retry-config="handleRetryUploadConfig"
      @resolve-keep-both="handleUploadKeepBoth"
      @resolve-replace="handleUploadReplace"
      @conflict-back="handleUploadConflictBack"
    />

    <RenameItemDialog
      :open="isRenameDialogOpen"
      :item="renamingTargetItem"
      :is-renaming="driveDocumentsStore.isRenaming"
      :error="driveDocumentsStore.renameError"
      :conflict="driveDocumentsStore.renameConflict"
      @submit="handleRenameSubmit"
      @cancel="handleRenameCancel"
      @resolve-keep-both="handleRenameKeepBoth"
      @conflict-back="handleRenameConflictBack"
    />

    <MoveItemDialog
      :open="isMoveDialogOpen"
      :item="movingTargetItem"
      :source-parent-id="moveSourceParentId"
      :root-node="driveDestinationStore.tree"
      :is-loading-root="driveDestinationStore.isLoadingRoot"
      :root-error="driveDestinationStore.rootError"
      :selected-destination-id="driveDestinationStore.selectedDestinationId"
      :selected-path="driveDestinationStore.selectedPath"
      :is-moving="driveDocumentsStore.isMoving"
      :move-error="driveDocumentsStore.moveError"
      :conflict="driveDocumentsStore.moveConflict"
      @toggle="driveDestinationStore.toggleNode"
      @select="driveDestinationStore.selectDestination"
      @load-more="driveDestinationStore.loadMoreNode"
      @retry="driveDestinationStore.retryNode"
      @retry-root="driveDestinationStore.retryRoot"
      @submit="handleMoveSubmit"
      @cancel="handleMoveCancel"
      @resolve-keep-both="handleMoveKeepBoth"
      @conflict-back="handleMoveConflictBack"
    />

    <ReplaceFileDialog
      :open="isReplaceDialogOpen"
      :item="replacingTargetItem"
      :max-upload-bytes="driveDocumentsStore.maxUploadBytes"
      :is-loading-config="driveDocumentsStore.isLoadingUploadConfig"
      :config-error="driveDocumentsStore.uploadConfigError"
      :is-replacing="driveDocumentsStore.isReplacing"
      :replace-error="driveDocumentsStore.replaceError"
      @submit="handleReplaceSubmit"
      @cancel="handleReplaceCancel"
      @retry-config="handleRetryUploadConfig"
    />

    <FileVersionsDialog
      :open="isVersionsDialogOpen"
      :file-name="driveVersionsStore.selectedItem?.name ?? ''"
      :versions="driveVersionsStore.versions"
      :is-loading="driveVersionsStore.isLoading"
      :load-error="driveVersionsStore.loadError"
      :downloading-version-id="driveVersionsStore.downloadingVersionId"
      :download-error="driveVersionsStore.downloadError"
      :restoring-version-id="driveVersionsStore.restoringVersionId"
      :restore-error="driveVersionsStore.restoreError"
      :updating-keep-forever-version-id="driveVersionsStore.updatingKeepForeverVersionId"
      :keep-forever-error="driveVersionsStore.keepForeverError"
      @download="handleVersionDownload"
      @restore="handleVersionRestore"
      @toggle-keep-forever="handleVersionToggleKeepForever"
      @retry="handleVersionsRetry"
      @cancel="handleVersionsCancel"
    />

    <TrashItemDialog
      :open="isTrashDialogOpen"
      :item="trashingTargetItem"
      :is-trashing="driveDocumentsStore.isTrashing"
      :trash-error="driveDocumentsStore.trashError"
      @confirm="handleTrashConfirm"
      @cancel="handleTrashCancel"
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
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
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

.documents-view__action-icon {
  flex-shrink: 0;
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
