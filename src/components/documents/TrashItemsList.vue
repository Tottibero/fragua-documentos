<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import IconButton from '@/components/common/IconButton.vue'
import { RotateCcw } from '@lucide/vue'
import type { DriveTrashItem } from '@/types'

// Mismas etiquetas legibles y misma lógica que `DriveItemsList` — deliberada-
// mente duplicadas aquí (igual que ya duplica `FileVersionsList`) en vez de
// reutilizar ese componente: la papelera no tiene "abrir carpeta" ni el
// resto de acciones del listado principal, solo "Restaurar", así que
// importarlo forzaría ramas y props que no pertenecen a esta vista.
const MIME_TYPE_LABELS: Record<string, string> = {
  'application/vnd.google-apps.document': 'Documento de Google',
  'application/vnd.google-apps.spreadsheet': 'Hoja de cálculo de Google',
  'application/vnd.google-apps.presentation': 'Presentación de Google',
  'application/vnd.google-apps.form': 'Formulario de Google',
  'application/vnd.google-apps.drawing': 'Dibujo de Google',
  'application/pdf': 'PDF',
  'application/msword': 'Documento de Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Documento de Word',
  'application/vnd.ms-excel': 'Hoja de cálculo de Excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Hoja de cálculo de Excel',
  'application/vnd.ms-powerpoint': 'Presentación de PowerPoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'Presentación de PowerPoint',
  'text/plain': 'Texto',
  'text/csv': 'CSV',
  'application/zip': 'Archivo comprimido',
  'application/json': 'JSON',
}

function readableType(item: DriveTrashItem): string {
  if (item.isFolder) return 'Carpeta'
  const known = MIME_TYPE_LABELS[item.mimeType]
  if (known) return known
  if (item.mimeType.startsWith('image/')) return 'Imagen'
  if (item.mimeType.startsWith('video/')) return 'Vídeo'
  if (item.mimeType.startsWith('audio/')) return 'Audio'
  const subtype = item.mimeType.split('/')[1]
  return subtype ? subtype.toUpperCase() : 'Archivo'
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

/** Fallback neutro cuando Google no informa `trashedTime` — nunca una fecha
 * inventada ni un campo en blanco sin explicación. */
function formatTrashedDate(trashedTime: string | null): string {
  if (!trashedTime) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(trashedTime),
  )
}

const props = withDefaults(
  defineProps<{
    items: DriveTrashItem[]
    nextPageToken: string | null
    isLoadingMore: boolean
    loadMoreError?: string
    restoringItemId: string | null
  }>(),
  { loadMoreError: '' },
)

const emit = defineEmits<{
  'load-more': []
  restore: [item: DriveTrashItem, triggerElement: HTMLElement]
}>()

function handleRestoreClick(item: DriveTrashItem, event: MouseEvent) {
  // Defensa además del `:disabled` del botón: mientras haya una
  // restauración en curso (de este elemento o de cualquier otro), no se
  // inicia otra.
  if (props.restoringItemId) return
  emit('restore', item, event.currentTarget as HTMLElement)
}
</script>

<template>
  <div class="trash-items">
    <EmptyState
      v-if="items.length === 0"
      title="La papelera está vacía"
      description="Los archivos y carpetas que envíes a la papelera aparecerán aquí."
    />

    <template v-else>
      <ul class="trash-items__list">
        <li v-for="item in items" :key="item.id" class="trash-items__row">
          <div
            class="trash-items__entry"
            :class="item.isFolder ? 'trash-items__entry--folder' : 'trash-items__entry--file'"
          >
            <div class="trash-items__primary">
              <span class="trash-items__icon" aria-hidden="true">
                <svg v-if="item.isFolder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path
                    d="M4 7a1.5 1.5 0 0 1 1.5-1.5h3.75l1.5 1.75h7.75A1.5 1.5 0 0 1 20 8.75v8.75A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5V7z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path
                    d="M6 3.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V5A1.5 1.5 0 0 1 5.5 3.5H6z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path d="M14 3.5V8h4" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="trash-items__name">{{ item.name }}</span>
            </div>

            <div class="trash-items__meta">
              <span class="trash-items__type">{{ readableType(item) }}</span>
              <span class="trash-items__size">{{ item.isFolder ? '—' : formatSize(item.size) }}</span>
              <span class="trash-items__date">{{ formatTrashedDate(item.trashedTime) }}</span>
            </div>

            <div class="trash-items__actions">
              <IconButton
                :icon="RotateCcw"
                :label="`Restaurar ${item.name}`"
                :busy="restoringItemId === item.id"
                :disabled="restoringItemId !== null"
                @click="handleRestoreClick(item, $event)"
              />
            </div>
          </div>
        </li>
      </ul>

      <AlertMessage v-if="loadMoreError" variant="error">{{ loadMoreError }}</AlertMessage>

      <button
        v-if="nextPageToken"
        type="button"
        class="trash-items__load-more"
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
.trash-items {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.trash-items__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.trash-items__row {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  /* Sin `overflow: hidden`: el tooltip del IconButton de "Restaurar" se
   * posiciona fuera de esta caja (debajo del botón) y no debe recortarse. */
  transition: background-color 0.15s ease;
}

.trash-items__row:hover,
.trash-items__row:focus-within {
  background: var(--bg-hover);
}

.trash-items__entry {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 44px;
  padding: 0.5rem 0.75rem;
}

.trash-items__primary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  min-height: 44px;
}

.trash-items__icon {
  width: 22px;
  height: 22px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.trash-items__icon svg {
  width: 100%;
  height: 100%;
}

.trash-items__entry--folder .trash-items__icon {
  color: var(--accent-text);
}

.trash-items__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: var(--text-primary);
}

.trash-items__meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.trash-items__type {
  min-width: 6rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.trash-items__size {
  min-width: 4.5rem;
  text-align: right;
  font-size: 0.82rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.trash-items__date {
  min-width: 9.5rem;
  text-align: right;
  font-size: 0.82rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.trash-items__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.trash-items__load-more {
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

.trash-items__load-more:hover:not(:disabled) {
  background: var(--accent-hover);
}

.trash-items__load-more:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .trash-items__entry {
    grid-template-columns: 1fr;
    grid-template-areas:
      'primary'
      'meta'
      'actions';
    row-gap: 0.35rem;
  }

  .trash-items__primary {
    grid-area: primary;
  }

  .trash-items__name {
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .trash-items__meta {
    grid-area: meta;
    flex-wrap: wrap;
    gap: 0.35rem 1rem;
  }

  .trash-items__type,
  .trash-items__size,
  .trash-items__date {
    min-width: 0;
    text-align: left;
  }

  .trash-items__actions {
    grid-area: actions;
    justify-content: flex-start;
  }
}
</style>
