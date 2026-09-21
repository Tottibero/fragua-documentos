<script setup lang="ts">
import IconButton from '@/components/common/IconButton.vue'
import { Download, Undo2, Shield, ShieldOff, ShieldCheck } from '@lucide/vue'
import type { DriveFileVersion } from '@/types'

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

function formatDate(modifiedTime: string | null): string {
  if (!modifiedTime) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(modifiedTime),
  )
}

/** Identificador legible de una versión para los `aria-label` de sus
 * acciones — la fecha cuando existe, si no un ordinal estable sobre la
 * posición recibida (nunca el `id` opaco de Drive). */
function versionLabel(version: DriveFileVersion, index: number): string {
  if (version.modifiedTime) return formatDate(version.modifiedTime)
  return `la versión nº ${index + 1}`
}

const props = withDefaults(
  defineProps<{
    versions: DriveFileVersion[]
    downloadingVersionId: string | null
    restoringVersionId: string | null
    updatingKeepForeverVersionId: string | null
    canRestore?: boolean
    canProtect?: boolean
  }>(),
  { canRestore: true, canProtect: true },
)

const emit = defineEmits<{
  download: [versionId: string]
  'restore-request': [version: DriveFileVersion]
  'toggle-keep-forever': [versionId: string, nextKeepForever: boolean]
}>()

function handleDownloadClick(version: DriveFileVersion) {
  if (props.downloadingVersionId) return
  emit('download', version.id)
}

function handleRestoreClick(version: DriveFileVersion) {
  if (version.isCurrent) return
  if (props.restoringVersionId) return
  emit('restore-request', version)
}

function handleToggleKeepForeverClick(version: DriveFileVersion) {
  if (props.updatingKeepForeverVersionId) return
  if (props.restoringVersionId) return
  emit('toggle-keep-forever', version.id, !version.keepForever)
}
</script>

<template>
  <ul class="file-versions-list">
    <li v-for="(version, index) in versions" :key="version.id" class="file-versions-list__row">
      <div class="file-versions-list__main">
        <div class="file-versions-list__heading">
          <span class="file-versions-list__date">{{ formatDate(version.modifiedTime) }}</span>
          <span v-if="version.isCurrent" class="file-versions-list__badge">Versión actual</span>
          <span v-if="version.keepForever" class="file-versions-list__badge file-versions-list__badge--protected">
            <ShieldCheck :size="14" :stroke-width="2" aria-hidden="true" />
            Protegida
          </span>
        </div>

        <div class="file-versions-list__meta">
          <span class="file-versions-list__author">
            {{ version.author?.displayName ?? 'Autor desconocido' }}
          </span>
          <span class="file-versions-list__size">{{ formatSize(version.size) }}</span>
          <span v-if="version.originalFilename" class="file-versions-list__filename">
            {{ version.originalFilename }}
          </span>
        </div>
      </div>

      <div class="file-versions-list__actions">
        <IconButton
          :icon="Download"
          :label="`Descargar ${versionLabel(version, index)}`"
          :busy="downloadingVersionId === version.id"
          :disabled="downloadingVersionId !== null"
          @click="handleDownloadClick(version)"
        />
        <IconButton
          v-if="canRestore && !version.isCurrent"
          :icon="Undo2"
          :label="`Restaurar ${versionLabel(version, index)}`"
          :busy="restoringVersionId === version.id"
          :disabled="restoringVersionId !== null"
          @click="handleRestoreClick(version)"
        />
        <IconButton
          v-if="canProtect"
          :icon="version.keepForever ? ShieldOff : Shield"
          :label="
            version.keepForever
              ? `Dejar de proteger ${versionLabel(version, index)}`
              : `Proteger ${versionLabel(version, index)}`
          "
          :busy="updatingKeepForeverVersionId === version.id"
          :disabled="updatingKeepForeverVersionId !== null || restoringVersionId !== null"
          @click="handleToggleKeepForeverClick(version)"
        />
      </div>
    </li>
  </ul>
</template>

<style scoped>
.file-versions-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.file-versions-list__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.file-versions-list__main {
  min-width: 0;
  flex: 1 1 14rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.file-versions-list__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.file-versions-list__date {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.file-versions-list__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  background: var(--accent-soft);
  color: var(--accent-text);
  white-space: nowrap;
}

.file-versions-list__badge--protected {
  background: color-mix(in srgb, var(--success) 15%, transparent);
  color: var(--success);
}

.file-versions-list__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 0.9rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.file-versions-list__filename {
  min-width: 0;
  overflow-wrap: anywhere;
}

.file-versions-list__actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.15rem;
}
</style>
