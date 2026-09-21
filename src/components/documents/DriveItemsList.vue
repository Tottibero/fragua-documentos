<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import IconButton from '@/components/common/IconButton.vue'
import { Download, Pencil, FolderInput, FileUp, History, Trash2 } from '@lucide/vue'
import { isGoogleNative as isGoogleNativeMimeType, readableDriveItemType } from '@/utils/drive-item-type'
import type { DriveItem } from '@/types'

/** Documentos/hojas/presentaciones... nativos de Google no tienen contenido
 * binario propio — `GET /drive/files/:id/download` los rechaza con 400. No
 * se ofrece un botón que solo podría fallar. */
function isGoogleNative(item: DriveItem): boolean {
  return isGoogleNativeMimeType(item.mimeType)
}

function readableType(item: DriveItem): string {
  return readableDriveItemType(item)
}

function formatSize(size: number | null): string {
  if (size === null) return '—'
  if (size === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1)
  const value = size / 1024 ** exponent
  const formatted = new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: exponent === 0 ? 0 : 1,
  }).format(value)
  return `${formatted} ${units[exponent]}`
}

function formatDate(item: DriveItem): string {
  const raw = item.modifiedTime ?? item.createdTime
  if (!raw) return '—'
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(raw))
}

const props = withDefaults(
  defineProps<{
    items: DriveItem[]
    nextPageToken: string | null
    isLoadingMore: boolean
    loadMoreError?: string
    downloadingFileId: string | null
    downloadError?: string
    renamingItemId: string | null
    movingItemId: string | null
    replacingFileId: string | null
    trashingItemId: string | null
  }>(),
  { loadMoreError: '', downloadError: '' },
)

const emit = defineEmits<{
  'open-folder': [item: DriveItem]
  'load-more': []
  download: [item: DriveItem]
  rename: [item: DriveItem, triggerElement: HTMLElement]
  move: [item: DriveItem, triggerElement: HTMLElement]
  replace: [item: DriveItem, triggerElement: HTMLElement]
  versions: [item: DriveItem, triggerElement: HTMLElement]
  trash: [item: DriveItem, triggerElement: HTMLElement]
}>()

function handleDownloadClick(item: DriveItem) {
  // Defensa además del `:disabled` del botón: mientras haya una descarga en
  // curso (de este archivo o de cualquier otro), no se inicia otra.
  if (props.downloadingFileId) return
  emit('download', item)
}

function handleRenameClick(item: DriveItem, event: MouseEvent) {
  // Defensa además del `:disabled` del botón: mientras haya un renombrado en
  // curso (de este elemento o de cualquier otro), no se inicia otro.
  if (props.renamingItemId) return
  emit('rename', item, event.currentTarget as HTMLElement)
}

function handleMoveClick(item: DriveItem, event: MouseEvent) {
  // Defensa además del `:disabled` del botón: mientras haya un movimiento en
  // curso (de este elemento o de cualquier otro), no se inicia otro.
  if (props.movingItemId) return
  emit('move', item, event.currentTarget as HTMLElement)
}

function handleReplaceClick(item: DriveItem, event: MouseEvent) {
  // Defensa además del `:disabled` del botón: mientras haya un reemplazo en
  // curso (de este archivo o de cualquier otro), no se inicia otro.
  if (props.replacingFileId) return
  emit('replace', item, event.currentTarget as HTMLElement)
}

function handleVersionsClick(item: DriveItem, event: MouseEvent) {
  emit('versions', item, event.currentTarget as HTMLElement)
}

function handleTrashClick(item: DriveItem, event: MouseEvent) {
  // Defensa además del `:disabled` del botón: mientras haya un envío a la
  // papelera en curso (de este elemento o de cualquier otro), no se inicia
  // otro.
  if (props.trashingItemId) return
  emit('trash', item, event.currentTarget as HTMLElement)
}
</script>

<template>
  <div class="drive-items">
    <EmptyState
      v-if="items.length === 0"
      title="Esta carpeta está vacía"
      description="Todavía no hay archivos ni carpetas aquí."
    />

    <template v-else>
      <AlertMessage v-if="downloadError" variant="error" class="drive-items__download-error">
        {{ downloadError }}
      </AlertMessage>

      <ul class="drive-items__list">
        <li v-for="item in items" :key="item.id" class="drive-items__row">
          <div
            class="drive-items__entry"
            :class="item.isFolder ? 'drive-items__entry--folder' : 'drive-items__entry--file'"
          >
            <!-- Control primario: en carpetas es el botón que abre la
            carpeta; en archivos es solo el icono/nombre, sin interacción
            propia (la acción de archivo es "Descargar"). Es hermano, nunca
            contenedor, del botón "Renombrar" — dos controles no pueden
            anidarse. -->
            <button
              v-if="item.isFolder"
              type="button"
              class="drive-items__primary"
              :aria-label="`Abrir carpeta ${item.name}`"
              @click="emit('open-folder', item)"
            >
              <span class="drive-items__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path
                    d="M4 7a1.5 1.5 0 0 1 1.5-1.5h3.75l1.5 1.75h7.75A1.5 1.5 0 0 1 20 8.75v8.75A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5V7z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span class="drive-items__name" aria-hidden="true">{{ item.name }}</span>
            </button>

            <div v-else class="drive-items__primary drive-items__primary--static">
              <span class="drive-items__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path
                    d="M6 3.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V5A1.5 1.5 0 0 1 5.5 3.5H6z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path d="M14 3.5V8h4" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="drive-items__name">{{ item.name }}</span>
            </div>

            <div class="drive-items__meta" :aria-hidden="item.isFolder || undefined">
              <span class="drive-items__type">{{ readableType(item) }}</span>
              <span class="drive-items__size">{{ item.isFolder ? '—' : formatSize(item.size) }}</span>
              <span class="drive-items__date">{{ formatDate(item) }}</span>
            </div>

            <div class="drive-items__actions">
              <template v-if="!item.isFolder">
                <span v-if="isGoogleNative(item)" class="drive-items__no-action">
                  Descarga directa no disponible
                </span>
                <template v-else>
                  <IconButton
                    :icon="Download"
                    :label="`Descargar ${item.name}`"
                    :busy="downloadingFileId === item.id"
                    :disabled="downloadingFileId !== null"
                    @click="handleDownloadClick(item)"
                  />
                  <IconButton
                    :icon="FileUp"
                    :label="`Subir nueva versión de ${item.name}`"
                    :busy="replacingFileId === item.id"
                    :disabled="replacingFileId !== null"
                    @click="handleReplaceClick(item, $event)"
                  />
                  <IconButton
                    :icon="History"
                    :label="`Historial de versiones de ${item.name}`"
                    @click="handleVersionsClick(item, $event)"
                  />
                </template>
              </template>
              <IconButton
                :icon="Pencil"
                :label="`Renombrar ${item.name}`"
                :busy="renamingItemId === item.id"
                :disabled="renamingItemId !== null"
                @click="handleRenameClick(item, $event)"
              />
              <IconButton
                :icon="FolderInput"
                :label="`Mover ${item.name}`"
                :busy="movingItemId === item.id"
                :disabled="movingItemId !== null"
                @click="handleMoveClick(item, $event)"
              />
              <IconButton
                :icon="Trash2"
                :label="`Enviar ${item.name} a la papelera`"
                :busy="trashingItemId === item.id"
                :disabled="trashingItemId !== null"
                @click="handleTrashClick(item, $event)"
              />
            </div>
          </div>
        </li>
      </ul>

      <AlertMessage v-if="loadMoreError" variant="error">{{ loadMoreError }}</AlertMessage>

      <button
        v-if="nextPageToken"
        type="button"
        class="drive-items__load-more"
        :disabled="isLoadingMore"
        :aria-busy="isLoadingMore"
        @click="emit('load-more')"
      >
        {{ isLoadingMore ? 'Cargando…' : 'Cargar más' }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.drive-items {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.drive-items__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.drive-items__row {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  /* Sin `overflow: hidden`: el tooltip de los IconButton de acciones se
   * posiciona fuera de esta caja (debajo del botón) y no debe recortarse.
   * El fondo propio de la fila y del control primario ya respeta su propio
   * `border-radius` sin necesidad de recortar contenido. */
  transition: background-color 0.15s ease;
}

.drive-items__row:hover,
.drive-items__row:focus-within {
  background: var(--bg-hover);
}

.drive-items__entry {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 44px;
  padding: 0.5rem 0.75rem;
}

/* Control primario (icono + nombre): en carpetas es un <button> que abre la
   carpeta; en archivos, un <div> sin interacción propia. Hermano, no
   contenedor, del botón "Renombrar" — así nunca hay botones anidados. */
.drive-items__primary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  min-height: 44px;
  padding: 0;
  border: none;
  background: transparent;
  font: inherit;
  color: var(--text-primary);
  text-align: left;
  border-radius: var(--radius-sm);
}

button.drive-items__primary {
  cursor: pointer;
}

button.drive-items__primary:hover {
  background: var(--bg-hover);
}

.drive-items__icon {
  width: 22px;
  height: 22px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.drive-items__icon svg {
  width: 100%;
  height: 100%;
}

.drive-items__entry--folder .drive-items__icon {
  color: var(--accent-text);
}

.drive-items__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.drive-items__meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.drive-items__type {
  min-width: 6rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.drive-items__size {
  min-width: 4.5rem;
  text-align: right;
  font-size: 0.82rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.drive-items__date {
  min-width: 7rem;
  text-align: right;
  font-size: 0.82rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.drive-items__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
}

.drive-items__no-action {
  font-size: 0.78rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.drive-items__load-more {
  align-self: flex-start;
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

.drive-items__load-more:hover:not(:disabled) {
  background: var(--accent-hover);
}

.drive-items__load-more:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .drive-items__entry {
    grid-template-columns: 1fr;
    grid-template-areas:
      'primary'
      'meta'
      'actions';
    row-gap: 0.35rem;
  }

  .drive-items__primary {
    grid-area: primary;
  }

  .drive-items__name {
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .drive-items__meta {
    grid-area: meta;
    flex-wrap: wrap;
    gap: 0.35rem 1rem;
  }

  .drive-items__type,
  .drive-items__size,
  .drive-items__date {
    min-width: 0;
    text-align: left;
  }

  .drive-items__actions {
    grid-area: actions;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .drive-items__no-action {
    white-space: normal;
  }
}
</style>
