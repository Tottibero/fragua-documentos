<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useMeetingMinutesStore } from '@/stores/meeting-minutes'
import { useMeetingsStore } from '@/stores/meetings'
import { useToastStore } from '@/stores/toast'
import AlertMessage from '@/components/common/AlertMessage.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import FileVersionsDialog from '@/components/documents/FileVersionsDialog.vue'
import RegenerateMeetingMinutesDialog from './RegenerateMeetingMinutesDialog.vue'
import { CloudUpload, Download, History, RefreshCw } from '@lucide/vue'
import { saveBlobAsFile } from '@/utils/download-file'
import { formatMeetingDateTime } from '@/utils/meeting-labels'
import type { Meeting } from '@/types'

const props = defineProps<{
  meeting: Meeting
  /** Ayuda visual (fase 3.4): solo `admin`/`superadmin` exportan el acta. Ver
   * el acta y descargarla es para cualquier usuario autenticado. El backend
   * sigue siendo la única autoridad real. */
  canExport: boolean
}>()

const store = useMeetingMinutesStore()
const meetingsStore = useMeetingsStore()
const toastStore = useToastStore()

const downloadButtonRef = ref<HTMLButtonElement>()
const regenerateButtonRef = ref<HTMLButtonElement>()
const historyButtonRef = ref<HTMLButtonElement>()
const isRegenerateDialogOpen = ref(false)
const isVersionsDialogOpen = ref(false)

// La sección solo tiene sentido con la reunión cerrada (para poder exportar)
// o si ya existe un acta (para descargarla, aunque la reunión se haya
// reabierto después). En cualquier otro caso no se muestra.
const isVisible = computed(() => props.meeting.status === 'closed' || store.minutes !== null)

/** El acta refleja la reunión tal como estaba al exportarla. Si después se
 * reabrió (y quizá se volvió a cerrar con cambios), puede no coincidir —
 * regenerarla es una fase aparte, así que solo se avisa. */
const outdatedNote = computed(() => {
  const minutes = store.minutes
  if (!minutes) return ''
  if (props.meeting.status !== 'closed') {
    return 'La reunión se ha reabierto después de exportar el acta: puede estar desactualizada.'
  }
  if (props.meeting.closedAt && new Date(props.meeting.closedAt) > new Date(minutes.exportedAt)) {
    return 'La reunión se ha vuelto a cerrar después de exportar el acta: puede estar desactualizada.'
  }
  return ''
})

async function focusDownloadButton() {
  await nextTick()
  downloadButtonRef.value?.focus()
}

async function handleExport() {
  store.resetExportState()
  const outcome = await store.exportMinutes()

  if (outcome === 'success') {
    toastStore.success('El acta se ha exportado a Drive.')
    await focusDownloadButton()
  } else if (outcome === 'already-exported') {
    // No es un fallo: alguien la exportó antes y ya se muestra la que existe.
    toastStore.info('El acta ya estaba exportada. Se muestra la existente.')
    await focusDownloadButton()
  } else if (outcome === 'not-closed') {
    // Único punto de publicación: el mismo mensaje ya se ve dentro de la
    // sección. La reunión cambió de estado, así que se relee para reflejarlo.
    toastStore.error(store.exportError)
    await meetingsStore.refreshMeeting(props.meeting.id)
  } else if (outcome === 'error') {
    toastStore.error(store.exportError)
  }
  // 'blocked': ya había una operación en curso, no se hace nada.
}

async function handleDownload() {
  store.resetDownloadState()
  const result = await store.downloadMinutes()
  if (result) {
    saveBlobAsFile(result.blob, result.fileName)
    toastStore.success('Acta descargada.')
  } else if (store.downloadError) {
    toastStore.error(store.downloadError)
  }
}

function handleRegenerateRequest() {
  store.resetRegenerateState()
  isRegenerateDialogOpen.value = true
}

async function closeRegenerateDialog() {
  isRegenerateDialogOpen.value = false
  await nextTick()
  regenerateButtonRef.value?.focus()
}

async function handleRegenerateConfirm() {
  const outcome = await store.regenerateMinutes()
  if (outcome === 'success') {
    toastStore.success(
      'El acta se ha regenerado. La versión anterior continúa disponible en el historial.',
    )
    await closeRegenerateDialog()
  } else if (outcome === 'not-closed') {
    toastStore.error(store.regenerateError)
    isRegenerateDialogOpen.value = false
    await meetingsStore.refreshMeeting(props.meeting.id)
  } else if (outcome === 'not-exported') {
    toastStore.info('El acta ya no figura como exportada. Puedes volver a exportarla.')
    isRegenerateDialogOpen.value = false
  } else if (outcome !== 'blocked') {
    toastStore.error(store.regenerateError)
  }
}

async function handleVersionsRequest() {
  store.clearVersions()
  isVersionsDialogOpen.value = true
  await store.loadVersions()
}

async function handleVersionsCancel() {
  isVersionsDialogOpen.value = false
  store.clearVersions()
  await nextTick()
  historyButtonRef.value?.focus()
}

async function handleVersionDownload(versionId: string) {
  const result = await store.downloadVersion(versionId)
  if (result) {
    saveBlobAsFile(result.blob, result.fileName)
    toastStore.success('Versión del acta descargada.')
  } else if (store.versionDownloadError) {
    toastStore.error(store.versionDownloadError)
  }
}

async function handleVersionRestore(versionId: string) {
  const restored = await store.restoreVersion(versionId)
  if (restored) {
    toastStore.success('La versión seleccionada se ha restaurado como versión actual.')
  } else if (store.restoreError) {
    toastStore.error(store.restoreError)
  }
}

async function handleVersionToggleKeepForever(versionId: string, keepForever: boolean) {
  const updated = await store.updateKeepForever(versionId, keepForever)
  if (updated) {
    toastStore.success(keepForever ? 'La versión se ha protegido.' : 'La versión ya no está protegida.')
  } else if (store.keepForeverError) {
    toastStore.error(store.keepForeverError)
  }
}
</script>

<template>
  <section v-if="isVisible" class="minutes-section" aria-labelledby="minutes-section-title">
    <h2 id="minutes-section-title" class="minutes-section__title">Acta</h2>

    <LoadingSpinner v-if="store.isLoading && !store.isLoaded" label="Consultando el acta…" />

    <div v-else-if="store.loadError" class="minutes-section__error">
      <AlertMessage variant="error">{{ store.loadError }}</AlertMessage>
      <button type="button" class="minutes-section__secondary" @click="store.retry()">
        Reintentar
      </button>
    </div>

    <template v-else-if="store.minutes">
      <dl class="minutes-section__fields">
        <div class="minutes-section__field">
          <dt>Archivo</dt>
          <dd>{{ store.minutes.fileName }}</dd>
        </div>
        <div class="minutes-section__field">
          <dt>Última generación</dt>
          <dd>{{ formatMeetingDateTime(store.minutes.exportedAt) }}</dd>
        </div>
        <div class="minutes-section__field">
          <dt>Generada por</dt>
          <dd>{{ store.minutes.exportedBy.nickname }}</dd>
        </div>
      </dl>

      <p v-if="outdatedNote" class="minutes-section__note">{{ outdatedNote }}</p>

      <div class="minutes-section__actions">
        <button
          ref="downloadButtonRef"
          type="button"
          class="minutes-section__primary"
          :disabled="store.isDownloading"
          :aria-busy="store.isDownloading"
          @click="handleDownload"
        >
          <Download :size="18" :stroke-width="1.75" aria-hidden="true" />
          {{ store.isDownloading ? 'Descargando…' : 'Descargar acta' }}
        </button>
        <button
          ref="historyButtonRef"
          type="button"
          class="minutes-section__secondary"
          :disabled="store.isLoadingVersions || store.isRegenerating"
          @click="handleVersionsRequest"
        >
          <History :size="18" :stroke-width="1.75" aria-hidden="true" />
          Ver historial
        </button>
        <button
          v-if="canExport && meeting.status === 'closed'"
          ref="regenerateButtonRef"
          type="button"
          class="minutes-section__primary"
          :disabled="store.isRegenerating || store.isDownloading"
          @click="handleRegenerateRequest"
        >
          <RefreshCw :size="18" :stroke-width="1.75" aria-hidden="true" />
          Regenerar acta
        </button>
      </div>

      <AlertMessage v-if="store.downloadError" variant="error">{{ store.downloadError }}</AlertMessage>
    </template>

    <template v-else-if="store.isLoaded">
      <p class="minutes-section__empty">
        El acta todavía no se ha exportado. Al exportarla se guarda como PDF en Google Drive, con
        los datos de la reunión, quién la cerró y cuándo, los asistentes y los puntos.
      </p>

      <div v-if="canExport" class="minutes-section__actions">
        <button
          type="button"
          class="minutes-section__primary"
          :disabled="store.isExporting"
          :aria-busy="store.isExporting"
          @click="handleExport"
        >
          <CloudUpload :size="18" :stroke-width="1.75" aria-hidden="true" />
          {{ store.isExporting ? 'Exportando…' : 'Exportar acta a Drive' }}
        </button>
      </div>
      <p v-else class="minutes-section__hint">Solo un administrador puede exportar el acta.</p>

      <AlertMessage v-if="store.exportError" variant="error">{{ store.exportError }}</AlertMessage>
    </template>

    <RegenerateMeetingMinutesDialog
      :open="isRegenerateDialogOpen"
      :file-name="store.minutes?.fileName ?? ''"
      :is-regenerating="store.isRegenerating"
      :error="store.regenerateError"
      @confirm="handleRegenerateConfirm"
      @cancel="closeRegenerateDialog"
    />

    <FileVersionsDialog
      :open="isVersionsDialogOpen"
      :file-name="store.minutes?.fileName ?? ''"
      :versions="store.versions"
      :is-loading="store.isLoadingVersions"
      :load-error="store.versionsLoadError"
      :downloading-version-id="store.downloadingVersionId"
      :download-error="store.versionDownloadError"
      :restoring-version-id="store.restoringVersionId"
      :restore-error="store.restoreError"
      :updating-keep-forever-version-id="store.updatingKeepForeverVersionId"
      :keep-forever-error="store.keepForeverError"
      :can-restore="canExport"
      :can-protect="canExport"
      @download="handleVersionDownload"
      @restore="handleVersionRestore"
      @toggle-keep-forever="handleVersionToggleKeepForever"
      @retry="store.loadVersions"
      @cancel="handleVersionsCancel"
    />
  </section>
</template>

<style scoped>
.minutes-section {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.minutes-section__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.minutes-section__error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.minutes-section__fields {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.minutes-section__field {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.35rem 1rem;
}

.minutes-section__field dt {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.minutes-section__field dd {
  margin: 0;
  font-size: 0.92rem;
  color: var(--text-primary);
  text-align: right;
  overflow-wrap: anywhere;
}

.minutes-section__note {
  margin: 0;
  padding: 0.6rem 0.8rem;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  font-size: 0.88rem;
  line-height: 1.4;
  color: var(--text-primary);
}

.minutes-section__empty,
.minutes-section__hint {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--text-secondary);
}

.minutes-section__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.minutes-section__primary,
.minutes-section__secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.minutes-section__primary {
  border: none;
  background: var(--accent);
  color: white;
}

.minutes-section__primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.minutes-section__secondary {
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.minutes-section__secondary:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.minutes-section__primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .minutes-section__field {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
  }

  .minutes-section__field dd {
    text-align: left;
  }
}
</style>
