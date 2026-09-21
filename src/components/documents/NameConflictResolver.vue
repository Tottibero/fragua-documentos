<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Folder, File as FileIcon } from '@lucide/vue'
import { isReplaceableDriveItem, readableDriveItemType } from '@/utils/drive-item-type'
import type { DriveItem } from '@/types'

/**
 * Presentacional y reutilizado por `UploadFileDialog`, `RenameItemDialog` y
 * `MoveItemDialog` (fase 2.6): no conoce ningún store ni hace ninguna
 * petición — solo muestra el conflicto ya detectado por el backend
 * (`409 DRIVE_NAME_CONFLICT`) y traduce la decisión del usuario en uno de
 * sus tres emits. El diálogo que lo usa es quien vuelve a llamar al store
 * con esa decisión.
 */
export type NameConflictOperation = 'upload' | 'rename' | 'move'

const props = defineProps<{
  conflicts: DriveItem[]
  allowedResolutions: Array<'keep_both' | 'replace'>
  operation: NameConflictOperation
  /** Igual que en el resto de diálogos: mientras se reenvía la decisión
   * elegida, todos los controles de este bloque quedan bloqueados — el
   * diálogo que lo contiene aplica el mismo bloqueo al resto de sus propios
   * controles (Cancelar, Escape, backdrop). */
  busy: boolean
}>()

const emit = defineEmits<{
  'keep-both': []
  replace: [conflictItemId: string]
  cancel: []
}>()

const canKeepBoth = computed(() => props.allowedResolutions.includes('keep_both'))

// `replace` solo tiene sentido en una subida: es la única operación que
// lleva contenido nuevo que escribir sobre el archivo existente elegido.
// Renombrar y mover nunca lo ofrecen (el backend tampoco lo incluiría en
// `allowedResolutions`), pero se repite aquí la comprobación en vez de
// confiar solo en lo que llega del backend.
const canReplace = computed(() => props.operation === 'upload' && props.allowedResolutions.includes('replace'))

// Carpetas y documentos nativos de Google (Docs, Sheets, Slides...) nunca
// pueden elegirse como destino de "Reemplazar existente" — ni tienen
// contenido binario propio, ni el backend los aceptaría como
// `conflictItemId`.
const replaceableConflicts = computed(() => props.conflicts.filter(isReplaceableDriveItem))

// La selección de a cuál de los conflictos reemplazar es estado propio de
// este bloque: el emit `replace` ya lleva el `id` elegido, así que el
// diálogo padre no necesita conocerlo antes de ese momento. Con un único
// candidato reemplazable se preselecciona automáticamente (no hace falta
// pedir una elección que no existe); con varios, se exige una selección
// explícita mediante controles nativos antes de poder activar "Reemplazar
// existente".
const selectedReplaceId = ref<string | null>(null)

watch(
  () => props.conflicts,
  () => {
    selectedReplaceId.value =
      replaceableConflicts.value.length === 1 ? replaceableConflicts.value[0].id : null
  },
  { immediate: true },
)

const requiresExplicitReplaceSelection = computed(() => replaceableConflicts.value.length > 1)

const canActivateReplace = computed(
  () => canReplace.value && !props.busy && selectedReplaceId.value !== null,
)

function handleKeepBoth() {
  if (props.busy || !canKeepBoth.value) return
  emit('keep-both')
}

function handleReplace() {
  if (!canActivateReplace.value || !selectedReplaceId.value) return
  emit('replace', selectedReplaceId.value)
}

function handleBack() {
  if (props.busy) return
  emit('cancel')
}

const titleEl = ref<HTMLHeadingElement>()

// Al aparecer el conflicto, el foco se lleva al título del bloque — primer
// control lógico de este contenido nuevo, igual que el resto de la app
// mueve el foco al aparecer una vista o un bloque distinto.
defineExpose({
  focusTitle: async () => {
    await nextTick()
    titleEl.value?.focus()
  },
})
</script>

<template>
  <div class="name-conflict-resolver" :aria-busy="busy">
    <h3 ref="titleEl" class="name-conflict-resolver__title" tabindex="-1">
      Ya existe un elemento con ese nombre
    </h3>
    <p class="name-conflict-resolver__explainer">
      Google Drive permite nombres duplicados, pero Fragua necesita que decidas qué hacer antes
      de continuar.
    </p>

    <ul class="name-conflict-resolver__list">
      <li v-for="conflict in conflicts" :key="conflict.id" class="name-conflict-resolver__item">
        <component
          :is="conflict.isFolder ? Folder : FileIcon"
          class="name-conflict-resolver__icon"
          :size="18"
          :stroke-width="1.75"
          aria-hidden="true"
        />
        <span class="name-conflict-resolver__name">{{ conflict.name }}</span>
        <span class="name-conflict-resolver__type">{{ readableDriveItemType(conflict) }}</span>
      </li>
    </ul>

    <fieldset
      v-if="canReplace && requiresExplicitReplaceSelection"
      class="name-conflict-resolver__replace-picker"
      :disabled="busy"
    >
      <legend>Elige qué archivo reemplazar</legend>
      <label
        v-for="candidate in replaceableConflicts"
        :key="candidate.id"
        class="name-conflict-resolver__replace-option"
      >
        <input
          type="radio"
          name="name-conflict-replace-target"
          :value="candidate.id"
          v-model="selectedReplaceId"
        />
        <span>{{ candidate.name }}</span>
        <span class="name-conflict-resolver__type">{{ readableDriveItemType(candidate) }}</span>
      </label>
    </fieldset>

    <div class="name-conflict-resolver__actions">
      <button
        type="button"
        class="name-conflict-resolver__back"
        :disabled="busy"
        @click="handleBack"
      >
        Volver
      </button>
      <button
        v-if="canReplace"
        type="button"
        class="name-conflict-resolver__replace"
        :disabled="!canActivateReplace"
        :aria-busy="busy"
        @click="handleReplace"
      >
        {{ busy ? 'Reemplazando…' : 'Reemplazar existente' }}
      </button>
      <button
        v-if="canKeepBoth"
        type="button"
        class="name-conflict-resolver__keep-both"
        :disabled="busy"
        :aria-busy="busy"
        @click="handleKeepBoth"
      >
        {{ busy ? 'Guardando…' : 'Conservar ambos' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.name-conflict-resolver {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.name-conflict-resolver__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.name-conflict-resolver__explainer {
  margin: 0;
  font-size: 0.88rem;
  color: var(--text-secondary);
}

.name-conflict-resolver__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 12rem;
  overflow-y: auto;
}

.name-conflict-resolver__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-base);
}

.name-conflict-resolver__icon {
  flex-shrink: 0;
  color: var(--text-muted);
}

.name-conflict-resolver__name {
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.name-conflict-resolver__type {
  flex-shrink: 0;
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.name-conflict-resolver__replace-picker {
  margin: 0;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.name-conflict-resolver__replace-picker legend {
  padding: 0 0.3rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.name-conflict-resolver__replace-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.88rem;
  color: var(--text-primary);
  cursor: pointer;
}

.name-conflict-resolver__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.6rem;
}

.name-conflict-resolver__back,
.name-conflict-resolver__replace,
.name-conflict-resolver__keep-both {
  min-height: 44px;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.name-conflict-resolver__back {
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.name-conflict-resolver__back:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.name-conflict-resolver__replace {
  border: 1px solid var(--danger);
  background: transparent;
  color: var(--danger);
}

.name-conflict-resolver__replace:hover:not(:disabled) {
  background: var(--danger-soft);
}

.name-conflict-resolver__keep-both {
  border: none;
  background: var(--accent);
  color: white;
}

.name-conflict-resolver__keep-both:hover:not(:disabled) {
  background: var(--accent-hover);
}

.name-conflict-resolver__back:disabled,
.name-conflict-resolver__replace:disabled,
.name-conflict-resolver__keep-both:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
