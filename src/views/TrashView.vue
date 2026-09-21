<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useDriveTrashStore } from '@/stores/drive-trash'
import { useToastStore } from '@/stores/toast'
import AlertMessage from '@/components/common/AlertMessage.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import TrashItemsList from '@/components/documents/TrashItemsList.vue'
import RestoreItemDialog from '@/components/documents/RestoreItemDialog.vue'
import type { DriveTrashItem } from '@/types'

const driveTrashStore = useDriveTrashStore()
const toastStore = useToastStore()

const titleRef = ref<HTMLHeadingElement>()
const isRestoreDialogOpen = ref(false)
// Elemento que se restaura y control que abrió el diálogo — estables
// mientras el diálogo está abierto (incluido durante un fallo, para poder
// reintentar) y solo se limpian una vez cerrado.
const restoringTargetItem = ref<DriveTrashItem | null>(null)
const restoreTriggerEl = ref<HTMLElement | null>(null)

function handleRetry() {
  driveTrashStore.retry()
}

function handleLoadMore() {
  driveTrashStore.loadMore()
}

function handleRestoreRequest(item: DriveTrashItem, triggerElement: HTMLElement) {
  driveTrashStore.resetRestoreState()
  restoringTargetItem.value = item
  restoreTriggerEl.value = triggerElement
  isRestoreDialogOpen.value = true
}

async function focusRestoreTrigger() {
  await nextTick()
  restoreTriggerEl.value?.focus()
}

// Tras una restauración con éxito la fila del elemento desaparece del
// listado — no hay ya ningún botón "Restaurar" al que devolver el foco, así
// que se lleva al título de la vista (destino lógico estable, igual que
// `focusCurrentBreadcrumb` en DocumentsView tras mover o enviar a la
// papelera un elemento).
async function focusTitle() {
  await nextTick()
  titleRef.value?.focus()
}

async function handleRestoreConfirm() {
  const item = restoringTargetItem.value
  if (!item) return
  const result = await driveTrashStore.restoreItem(item)
  if (result) {
    // Construcción impersonal a propósito ("se ha restaurado", nunca un
    // participio pegado al nombre): `item` puede ser una carpeta o un
    // archivo, géneros distintos en español. Único punto de publicación de
    // este resultado.
    const message = result.restoredToRoot
      ? `«${item.name}» se ha restaurado en Fragua Documentos porque su carpeta anterior no estaba disponible.`
      : `«${item.name}» se ha restaurado en su ubicación anterior.`
    toastStore.success(message)
    isRestoreDialogOpen.value = false
    restoringTargetItem.value = null
    restoreTriggerEl.value = null
    await focusTitle()
  } else if (driveTrashStore.restoreError) {
    // El diálogo ya muestra `restoreError` como texto contextual (para
    // reintentar); el toast lo complementa con el mismo mensaje, nunca con
    // el texto crudo del backend. Si `result` es `null` por un envío
    // duplicado bloqueado (sin haber llegado a intentar la petición),
    // `restoreError` sigue vacío y no se publica nada.
    toastStore.error(driveTrashStore.restoreError)
  }
  // Si falló, el diálogo permanece abierto mostrando restoreError, con el
  // elemento seleccionado — no se mueve el foco ni se limpia el elemento.
}

async function handleRestoreCancel() {
  isRestoreDialogOpen.value = false
  await focusRestoreTrigger()
  restoringTargetItem.value = null
  restoreTriggerEl.value = null
}

onMounted(() => {
  driveTrashStore.load()
})

// Al abandonar la vista, invalida de inmediato cualquier load/loadMore/
// restore que siguiera en vuelo — no espera a una próxima entrada a
// `/trash` para descartar su resultado (ver el comentario de `close()` en
// el store).
onUnmounted(() => {
  driveTrashStore.close()
})
</script>

<template>
  <section class="trash-view" aria-labelledby="trash-title">
    <h1 id="trash-title" ref="titleRef" class="trash-view__title" tabindex="-1">Papelera</h1>
    <p class="trash-view__subtitle">
      Aquí solo aparecen los archivos y carpetas eliminados dentro del espacio gestionado
      por Fragua — no toda la papelera de la cuenta de Google Drive conectada.
    </p>

    <LoadingSpinner v-if="driveTrashStore.isLoading" label="Cargando la papelera…" />

    <div v-else-if="driveTrashStore.loadError" class="trash-view__error">
      <AlertMessage variant="error">{{ driveTrashStore.loadError }}</AlertMessage>
      <button type="button" class="trash-view__retry-button" @click="handleRetry">
        Reintentar
      </button>
    </div>

    <TrashItemsList
      v-else
      :items="driveTrashStore.items"
      :next-page-token="driveTrashStore.nextPageToken"
      :is-loading-more="driveTrashStore.isLoadingMore"
      :load-more-error="driveTrashStore.loadMoreError"
      :restoring-item-id="driveTrashStore.restoringItemId"
      @load-more="handleLoadMore"
      @restore="handleRestoreRequest"
    />

    <RestoreItemDialog
      :open="isRestoreDialogOpen"
      :item="restoringTargetItem"
      :is-restoring="driveTrashStore.restoringItemId !== null"
      :restore-error="driveTrashStore.restoreError"
      @confirm="handleRestoreConfirm"
      @cancel="handleRestoreCancel"
    />
  </section>
</template>

<style scoped>
.trash-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.trash-view__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
}

.trash-view__subtitle {
  margin: -0.5rem 0 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.trash-view__error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.trash-view__retry-button {
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

.trash-view__retry-button:hover {
  background: var(--accent-hover);
}
</style>
