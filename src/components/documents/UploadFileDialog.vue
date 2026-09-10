<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

// Mismas reglas de nombre que el backend (`DRIVE_SAFE_NAME_PATTERN`, sobre
// el valor recortado): obligatorio, distinto de "." / "..", máximo 255
// caracteres, sin "/", "\" ni caracteres de control.
const MAX_NAME_LENGTH = 255
// eslint-disable-next-line no-control-regex -- se excluyen deliberadamente los caracteres de control
const CONTROL_CHAR_PATTERN = /[\x00-\x1F]/

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  const formatted = new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: exponent === 0 ? 0 : 1,
  }).format(value)
  return `${formatted} ${units[exponent]}`
}

function validateFileName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'El nombre del archivo es obligatorio.'
  if (trimmed === '.' || trimmed === '..') {
    return 'El nombre del archivo no puede ser «.» ni «..».'
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return `El nombre no puede superar los ${MAX_NAME_LENGTH} caracteres.`
  }
  if (trimmed.includes('/') || trimmed.includes('\\') || CONTROL_CHAR_PATTERN.test(trimmed)) {
    return 'El nombre no puede contener "/", "\\" ni caracteres de control.'
  }
  return ''
}

const props = withDefaults(
  defineProps<{
    open: boolean
    maxUploadBytes: number | null
    isLoadingConfig: boolean
    configError?: string
    isUploading: boolean
    uploadError?: string
  }>(),
  { configError: '', uploadError: '' },
)

const emit = defineEmits<{ submit: [file: File]; cancel: []; 'retry-config': [] }>()

// Fuente única de verdad de si el formulario puede mostrarse: un
// `maxUploadBytes` nulo, no finito o no positivo se trata igual que un
// fallo de configuración, exista o no un `configError` explícito.
const hasValidUploadLimit = computed(
  () =>
    props.maxUploadBytes !== null &&
    Number.isFinite(props.maxUploadBytes) &&
    props.maxUploadBytes > 0,
)

const showConfigUnavailable = computed(() => !props.isLoadingConfig && !hasValidUploadLimit.value)

const configErrorMessage = computed(
  () => props.configError || 'No se ha podido obtener el límite de subida.',
)

function validateFile(file: File): string {
  if (file.size === 0) return 'El archivo está vacío.'
  const nameError = validateFileName(file.name)
  if (nameError) return nameError
  if (hasValidUploadLimit.value && file.size > (props.maxUploadBytes as number)) {
    return `El archivo supera el límite de ${formatBytes(props.maxUploadBytes as number)}.`
  }
  return ''
}

const dialogEl = ref<HTMLDialogElement>()
const fileInput = ref<HTMLInputElement>()
const chooseFileButton = ref<HTMLButtonElement>()
const cancelButton = ref<HTMLButtonElement>()
const retryConfigButton = ref<HTMLButtonElement>()
const selectedFile = ref<File | null>(null)
const fieldError = ref('')
const isDragOver = ref(false)

// Mismo mecanismo que ConfirmDialog/CreateFolderDialog: distingue un cierre
// provocado por nosotros mismos (al reaccionar a `open` pasando a false) de
// uno iniciado por el usuario (Escape) — solo este último debe emitir
// "cancel".
let closingFromPropChange = false

/** Punto de foco inicial según el estado en el que se abre el diálogo: si
 * el formulario ya está disponible, "Seleccionar archivo"; si la
 * configuración está cargando, "Cancelar" (el único control estable en ese
 * estado); si ya falló, "Reintentar". */
function focusInitialControl() {
  if (hasValidUploadLimit.value) {
    chooseFileButton.value?.focus()
  } else if (props.isLoadingConfig) {
    cancelButton.value?.focus()
  } else {
    retryConfigButton.value?.focus()
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      selectedFile.value = null
      fieldError.value = ''
      isDragOver.value = false
      dialogEl.value?.showModal()
      await nextTick()
      focusInitialControl()
    } else if (dialogEl.value?.open) {
      closingFromPropChange = true
      dialogEl.value.close()
    }
  },
)

// El formulario puede pasar a estar disponible con el diálogo ya abierto
// (la configuración termina de cargar, o un reintento tiene éxito): el
// control que tuviera el foco (el spinner no es focusable, o "Reintentar")
// ya no existe, así que el foco avanza a "Seleccionar archivo".
watch(hasValidUploadLimit, async (isValid, wasValid) => {
  if (props.open && isValid && !wasValid) {
    await nextTick()
    chooseFileButton.value?.focus()
  }
})

// Al empezar (o reintentar) la carga de configuración con el diálogo ya
// abierto, el control enfocado (p. ej. "Reintentar") va a desaparecer del
// DOM — se ancla en "Cancelar", presente en los tres estados, así el foco
// nunca se pierde aunque el reintento vuelva a fallar (el error se vuelve a
// mostrar sin mover el foco de donde ya estaba).
watch(
  () => props.isLoadingConfig,
  async (isLoadingConfig) => {
    if (props.open && isLoadingConfig) {
      await nextTick()
      cancelButton.value?.focus()
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
// se bloquea mientras se está subiendo para no dejar la subida huérfana.
function handleNativeCancel(event: Event) {
  if (props.isUploading) {
    event.preventDefault()
  }
}

function handleBackdropClick(event: MouseEvent) {
  if (!props.isUploading && event.target === dialogEl.value) {
    emit('cancel')
  }
}

function setSelectedFile(file: File) {
  selectedFile.value = file
  fieldError.value = ''
}

function handleChooseFileClick() {
  if (props.isUploading) return
  fileInput.value?.click()
}

function handleFileInputChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) setSelectedFile(file)
  // Permite volver a elegir el mismo archivo tras un error de validación.
  target.value = ''
}

function handleDragOver(event: DragEvent) {
  if (props.isUploading) return
  event.preventDefault()
  isDragOver.value = true
}

function handleDragLeave() {
  isDragOver.value = false
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = false
  if (props.isUploading) return
  const file = event.dataTransfer?.files?.[0]
  if (file) setSelectedFile(file)
}

async function handleSubmit() {
  if (props.isUploading || !hasValidUploadLimit.value) return

  if (!selectedFile.value) {
    fieldError.value = 'Selecciona un archivo.'
    await nextTick()
    chooseFileButton.value?.focus()
    return
  }

  const message = validateFile(selectedFile.value)
  if (message) {
    fieldError.value = message
    return
  }

  fieldError.value = ''
  emit('submit', selectedFile.value)
}
</script>

<template>
  <dialog
    ref="dialogEl"
    class="upload-file-dialog"
    aria-labelledby="upload-file-title"
    @close="handleClose"
    @cancel="handleNativeCancel"
    @click="handleBackdropClick"
  >
    <div class="upload-file-dialog__box" @click.stop>
      <h2 id="upload-file-title" class="upload-file-dialog__title">Subir archivo</h2>

      <LoadingSpinner v-if="isLoadingConfig" label="Comprobando el límite de subida…" />

      <div v-else-if="showConfigUnavailable" class="upload-file-dialog__config-error">
        <AlertMessage variant="error">{{ configErrorMessage }}</AlertMessage>
        <button
          ref="retryConfigButton"
          type="button"
          class="upload-file-dialog__retry-config"
          @click="emit('retry-config')"
        >
          Reintentar
        </button>
      </div>

      <form
        v-else
        id="upload-file-form"
        class="upload-file-dialog__form"
        novalidate
        @submit.prevent="handleSubmit"
      >
        <p class="upload-file-dialog__limit">
          Límite por archivo: {{ formatBytes(maxUploadBytes ?? 0) }}
        </p>

        <div
          class="upload-file-dialog__dropzone"
          :class="{ 'upload-file-dialog__dropzone--active': isDragOver }"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
        >
          <p class="upload-file-dialog__dropzone-hint">Arrastra un archivo aquí o</p>
          <button
            ref="chooseFileButton"
            type="button"
            class="upload-file-dialog__choose-button"
            :disabled="isUploading"
            @click="handleChooseFileClick"
          >
            Seleccionar archivo
          </button>
          <input
            ref="fileInput"
            type="file"
            tabindex="-1"
            class="visually-hidden"
            :disabled="isUploading"
            @change="handleFileInputChange"
          />
        </div>

        <p v-if="selectedFile" class="upload-file-dialog__selected">
          <span class="upload-file-dialog__selected-name">{{ selectedFile.name }}</span>
          <span class="upload-file-dialog__selected-size">{{ formatBytes(selectedFile.size) }}</span>
        </p>

        <span v-if="fieldError" role="alert" class="field-error">{{ fieldError }}</span>

        <AlertMessage v-if="uploadError" variant="error">{{ uploadError }}</AlertMessage>
      </form>

      <div class="upload-file-dialog__actions">
        <button
          ref="cancelButton"
          type="button"
          class="upload-file-dialog__cancel"
          :disabled="isUploading"
          @click="emit('cancel')"
        >
          Cancelar
        </button>
        <button
          v-if="!isLoadingConfig && !showConfigUnavailable"
          type="submit"
          form="upload-file-form"
          class="upload-file-dialog__confirm"
          :disabled="isUploading"
          :aria-busy="isUploading"
        >
          {{ isUploading ? 'Subiendo…' : 'Subir' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.upload-file-dialog {
  border: none;
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: var(--shadow-md);
  max-width: min(90vw, 28rem);
  width: 100%;
}

.upload-file-dialog::backdrop {
  background: rgba(15, 18, 25, 0.45);
}

.upload-file-dialog__box {
  padding: 1.5rem;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
}

.upload-file-dialog__title {
  margin: 0 0 1rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
}

.upload-file-dialog__config-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.upload-file-dialog__retry-config {
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

.upload-file-dialog__retry-config:hover {
  background: var(--accent-hover);
}

.upload-file-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.upload-file-dialog__limit {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.upload-file-dialog__dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 1.5rem 1rem;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--bg-base);
  text-align: center;
}

.upload-file-dialog__dropzone--active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.upload-file-dialog__dropzone-hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.upload-file-dialog__choose-button {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-primary);
}

.upload-file-dialog__choose-button:hover:not(:disabled) {
  background: var(--bg-hover);
}

.upload-file-dialog__choose-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.upload-file-dialog__selected {
  margin: 0;
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.88rem;
}

.upload-file-dialog__selected-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: var(--text-primary);
}

.upload-file-dialog__selected-size {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.field-error {
  font-size: 0.8rem;
  color: var(--danger);
}

.upload-file-dialog__actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.upload-file-dialog__cancel,
.upload-file-dialog__confirm {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.upload-file-dialog__cancel {
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.upload-file-dialog__cancel:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.upload-file-dialog__confirm {
  border: none;
  background: var(--accent);
  color: white;
}

.upload-file-dialog__confirm:hover:not(:disabled) {
  background: var(--accent-hover);
}

.upload-file-dialog__cancel:disabled,
.upload-file-dialog__confirm:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
