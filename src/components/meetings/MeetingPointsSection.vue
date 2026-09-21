<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useMeetingPointsStore } from '@/stores/meeting-points'
import { useToastStore } from '@/stores/toast'
import AlertMessage from '@/components/common/AlertMessage.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import MeetingPointsList from './MeetingPointsList.vue'
import MeetingPointFormDialog from './MeetingPointFormDialog.vue'
import DeleteMeetingPointDialog from './DeleteMeetingPointDialog.vue'
import { Plus } from '@lucide/vue'
import type { Meeting, MeetingPoint } from '@/types'
import type {
  CreateMeetingPointPayload,
  UpdateMeetingPointPayload,
} from '@/services/meetings.service'

const props = defineProps<{
  meeting: Meeting
  /** Ayuda visual (fase 3.2): derivada aparte de `canEdit`
   * (`MeetingDetailView`) — reunión en `draft`/`held` y usuario creador,
   * `admin` o `superadmin`. El backend sigue siendo la única autoridad
   * real. */
  canManagePoints: boolean
}>()

const store = useMeetingPointsStore()
const toastStore = useToastStore()

const headingRef = ref<HTMLHeadingElement>()
const addButtonRef = ref<HTMLButtonElement>()
const listRef = ref<InstanceType<typeof MeetingPointsList>>()

const isFormOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingPoint = ref<MeetingPoint | null>(null)
// Elemento que abrió el formulario de edición (el botón "Editar" de su
// fila) — capturado en el propio evento de clic, igual que el resto de
// acciones de icono de la app (ver `DriveItemsList`). Se reutiliza para
// devolver el foco tanto al cancelar como tras un guardado correcto.
let editTriggerEl: HTMLElement | null = null

const isDeleteOpen = ref(false)
const deletingPoint = ref<MeetingPoint | null>(null)
let deleteTriggerEl: HTMLElement | null = null

const formError = computed(() => (formMode.value === 'create' ? store.createError : store.updateError))
const isFormSubmitting = computed(() =>
  formMode.value === 'create' ? store.isCreating : store.updatingPointId === editingPoint.value?.id,
)
const isDeleting = computed(() => store.deletingPointId !== null)
// "Añadir punto" abre un diálogo modal, así que en la práctica ya queda
// inalcanzable mientras otro diálogo está abierto — este flag cubre además
// una mutación de fila en curso sin diálogo (subir/bajar), para no permitir
// abrir una creación mientras una reordenación sigue en vuelo.
const isAnyMutationActive = computed(
  () => store.updatingPointId !== null || store.deletingPointId !== null || store.isReordering,
)

async function focusAddButton() {
  await nextTick()
  addButtonRef.value?.focus()
}

async function focusEditTrigger() {
  await nextTick()
  editTriggerEl?.focus()
}

async function focusDeleteTrigger() {
  await nextTick()
  deleteTriggerEl?.focus()
}

function handleOpenCreate() {
  store.resetCreateState()
  formMode.value = 'create'
  editingPoint.value = null
  isFormOpen.value = true
}

function handleEditRequest(point: MeetingPoint, triggerElement: HTMLElement) {
  store.resetUpdateState()
  formMode.value = 'edit'
  editingPoint.value = point
  editTriggerEl = triggerElement
  isFormOpen.value = true
}

async function handleFormSubmit(payload: CreateMeetingPointPayload | UpdateMeetingPointPayload) {
  if (formMode.value === 'create') {
    const created = await store.createPoint(payload as CreateMeetingPointPayload)
    if (created) {
      toastStore.success(`El punto «${created.title}» se ha añadido.`)
      isFormOpen.value = false
      // Tras crear, el nuevo punto queda contraído (nunca se añade a los
      // expandidos) — el listado se mantiene compacto.
      await focusAddButton()
    } else if (store.createError) {
      // Único punto de publicación: el diálogo ya muestra el mismo mensaje
      // como texto contextual. Un 409 MEETING_NOT_EDITABLE cae aquí igual
      // que cualquier otro fallo real — el diálogo permanece abierto.
      toastStore.error(store.createError)
    }
    return
  }

  const point = editingPoint.value
  if (!point) return

  const updated = await store.updatePoint(point.id, payload as UpdateMeetingPointPayload)
  if (updated) {
    toastStore.success(`El punto «${updated.title}» se ha actualizado.`)
    isFormOpen.value = false
    await focusEditTrigger()
    editTriggerEl = null
  } else if (store.updateError) {
    toastStore.error(store.updateError)
  }
  // Si falló, el diálogo permanece abierto con los valores y el error del
  // store — no se mueve el foco.
}

async function handleFormCancel() {
  const wasEdit = formMode.value === 'edit'
  isFormOpen.value = false
  if (wasEdit) {
    await focusEditTrigger()
    editTriggerEl = null
  } else {
    await focusAddButton()
  }
}

function handleDeleteRequest(point: MeetingPoint, triggerElement: HTMLElement) {
  store.resetDeleteState()
  deletingPoint.value = point
  deleteTriggerEl = triggerElement
  isDeleteOpen.value = true
}

/** El punto eliminado desaparece de la fila, así que nunca se puede
 * devolver el foco a su propio disparador: se calcula, sobre el índice que
 * ocupaba en el orden previo al borrado, cuál punto ocupa ahora esa misma
 * posición (o la anterior, si el eliminado era el último) y se enfoca su
 * botón de expansión; si ya no queda ningún punto, se enfoca el título de
 * la sección.
 *
 * `remaining` se lee de `store.points` *después* de que `deletePoint()` se
 * haya resuelto — nunca de un filtrado propio sobre el snapshot previo al
 * borrado — para usar siempre la lista ya compactada (localmente por el
 * store en cuanto el backend confirma el `DELETE`, o ya sustituida por la
 * recarga si esta llegó a tiempo). */
async function focusAfterDelete(deletedId: string, orderedIdsBeforeDelete: string[]) {
  const indexBeforeDelete = orderedIdsBeforeDelete.indexOf(deletedId)
  const remaining = store.points.map((point) => point.id)

  await nextTick()

  if (remaining.length === 0) {
    headingRef.value?.focus()
    return
  }

  const nextId = remaining[Math.min(indexBeforeDelete, remaining.length - 1)]
  const focused = listRef.value?.focusToggleButton(nextId) ?? false
  if (!focused) headingRef.value?.focus()
}

async function handleDeleteConfirm() {
  const point = deletingPoint.value
  if (!point) return

  const orderedIdsBeforeDelete = store.points.map((current) => current.id)
  const success = await store.deletePoint(point.id)
  if (success) {
    toastStore.success(`El punto «${point.title}» se ha eliminado.`)
    isDeleteOpen.value = false
    deletingPoint.value = null
    deleteTriggerEl = null
    await focusAfterDelete(point.id, orderedIdsBeforeDelete)
  } else if (store.deleteError) {
    toastStore.error(store.deleteError)
  }
  // Si falló, el diálogo permanece abierto con el título y `deleteError`.
}

async function handleDeleteCancel() {
  isDeleteOpen.value = false
  deletingPoint.value = null
  await focusDeleteTrigger()
  deleteTriggerEl = null
}

async function handleMoveUp(pointId: string) {
  const success = await store.movePointUp(pointId)
  if (success) {
    toastStore.success('El punto se ha movido.')
  } else if (store.reorderError) {
    toastStore.error(store.reorderError)
  }
}

async function handleMoveDown(pointId: string) {
  const success = await store.movePointDown(pointId)
  if (success) {
    toastStore.success('El punto se ha movido.')
  } else if (store.reorderError) {
    toastStore.error(store.reorderError)
  }
}
</script>

<template>
  <section class="meeting-points-section" aria-labelledby="meeting-points-title">
    <div class="meeting-points-section__header">
      <h2
        id="meeting-points-title"
        ref="headingRef"
        tabindex="-1"
        class="meeting-points-section__title"
      >
        Puntos de la reunión
      </h2>

      <button
        v-if="canManagePoints"
        ref="addButtonRef"
        type="button"
        class="meeting-points-section__add-button"
        :disabled="isAnyMutationActive"
        @click="handleOpenCreate"
      >
        <Plus :size="18" :stroke-width="1.75" aria-hidden="true" />
        Añadir punto
      </button>
    </div>

    <p v-if="meeting.status === 'closed'" class="meeting-points-section__locked">
      Esta reunión está cerrada: sus puntos ya no admiten cambios.
    </p>

    <LoadingSpinner v-if="store.isLoading && store.points.length === 0" label="Cargando puntos…" />

    <div v-else-if="store.loadError" class="meeting-points-section__error">
      <AlertMessage variant="error">{{ store.loadError }}</AlertMessage>
      <button type="button" class="meeting-points-section__retry-button" @click="store.retry()">
        Reintentar
      </button>
    </div>

    <p v-else-if="store.points.length === 0" class="meeting-points-section__empty">
      Esta reunión todavía no tiene puntos.
    </p>

    <MeetingPointsList
      v-else
      ref="listRef"
      :points="store.points"
      :can-manage="canManagePoints"
      :updating-point-id="store.updatingPointId"
      :deleting-point-id="store.deletingPointId"
      :is-reordering="store.isReordering"
      @edit-request="handleEditRequest"
      @delete-request="handleDeleteRequest"
      @move-up="handleMoveUp"
      @move-down="handleMoveDown"
    />

    <MeetingPointFormDialog
      :open="isFormOpen"
      :mode="formMode"
      :point="editingPoint"
      :is-submitting="isFormSubmitting"
      :error="formError"
      @submit="handleFormSubmit"
      @cancel="handleFormCancel"
    />

    <DeleteMeetingPointDialog
      :open="isDeleteOpen"
      :point="deletingPoint"
      :is-deleting="isDeleting"
      :delete-error="store.deleteError"
      @confirm="handleDeleteConfirm"
      @cancel="handleDeleteCancel"
    />
  </section>
</template>

<style scoped>
.meeting-points-section {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.meeting-points-section__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.meeting-points-section__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.meeting-points-section__title:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.meeting-points-section__add-button {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 44px;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: var(--accent);
  color: white;
}

.meeting-points-section__add-button:hover:not(:disabled) {
  background: var(--accent-hover);
}

.meeting-points-section__add-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.meeting-points-section__locked {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.meeting-points-section__error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.meeting-points-section__retry-button {
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

.meeting-points-section__retry-button:hover {
  background: var(--accent-hover);
}

.meeting-points-section__empty {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
}
</style>
