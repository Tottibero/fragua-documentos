<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useMeetingsStore } from '@/stores/meetings'
import { useToastStore } from '@/stores/toast'
import AlertMessage from '@/components/common/AlertMessage.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import CurrentMeetingsList from '@/components/meetings/CurrentMeetingsList.vue'
import PastMeetingsList from '@/components/meetings/PastMeetingsList.vue'
import CreateMeetingDialog from '@/components/meetings/CreateMeetingDialog.vue'
import { CalendarPlus } from '@lucide/vue'
import { MEETING_STATUS_OPTIONS, MEETING_TYPE_OPTIONS } from '@/utils/meeting-labels'
import type { CreateMeetingPayload } from '@/services/meetings.service'
import type { MeetingStatus, MeetingType } from '@/types'

const ACTION_ICON_SIZE = 18
const ACTION_ICON_STROKE_WIDTH = 1.75

const meetingsStore = useMeetingsStore()
const toastStore = useToastStore()

const newMeetingButtonRef = ref<HTMLButtonElement>()
const isCreateDialogOpen = ref(false)

function handleRetry() {
  meetingsStore.retry()
}

// Los filtros y el cambio de página histórica nunca mueven el foco: solo
// cambian qué datos se piden, no la posición del usuario en la página.
function handleTypeFilterChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  meetingsStore.setTypeFilter(value ? (value as MeetingType) : null)
}

function handleStatusFilterChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  meetingsStore.setStatusFilter(value ? (value as MeetingStatus) : null)
}

function handlePrevPastPage() {
  meetingsStore.goToPastPage(meetingsStore.pastPage - 1)
}

function handleNextPastPage() {
  meetingsStore.goToPastPage(meetingsStore.pastPage + 1)
}

function handleRetryPastPage() {
  meetingsStore.goToPastPage(meetingsStore.pastPage)
}

function handleOpenCreateDialog() {
  meetingsStore.resetCreateState()
  isCreateDialogOpen.value = true
}

async function focusNewMeetingButton() {
  await nextTick()
  newMeetingButtonRef.value?.focus()
}

async function handleCreateSubmit(payload: CreateMeetingPayload) {
  const created = await meetingsStore.createMeeting(payload)
  if (created) {
    toastStore.success(`La reunión «${payload.name}» se ha creado.`)
    isCreateDialogOpen.value = false
    await focusNewMeetingButton()
  } else if (meetingsStore.createError) {
    // Único punto de publicación de este error: el diálogo ya lo muestra
    // como texto contextual (para corregir/reintentar); el toast lo
    // complementa con el mismo mensaje, nunca con texto crudo del backend.
    // Si `created` es `false` por un envío duplicado bloqueado, createError
    // sigue vacío y no se publica nada.
    toastStore.error(meetingsStore.createError)
  }
  // Si falló, el diálogo permanece abierto con los valores y el error del
  // store (createError) — no se mueve el foco.
}

async function handleCreateCancel() {
  isCreateDialogOpen.value = false
  await focusNewMeetingButton()
}

onMounted(() => {
  meetingsStore.load()
})

// Al abandonar la vista, invalida de inmediato cualquier load/página/filtro/
// creación que siguiera en vuelo — no espera a una próxima entrada a
// `/meetings` para descartar su resultado (ver el comentario de `close()`
// en el store).
onUnmounted(() => {
  meetingsStore.close()
})
</script>

<template>
  <section class="meetings-view" aria-labelledby="meetings-title">
    <div class="meetings-view__header">
      <div class="meetings-view__heading">
        <h1 id="meetings-title" class="meetings-view__title">Reuniones</h1>
        <p class="meetings-view__subtitle">
          Crea y consulta las reuniones gestionadas desde Fragua, con su histórico paginado.
        </p>
      </div>

      <button
        ref="newMeetingButtonRef"
        type="button"
        class="meetings-view__action-button"
        @click="handleOpenCreateDialog"
      >
        <CalendarPlus
          :size="ACTION_ICON_SIZE"
          :stroke-width="ACTION_ICON_STROKE_WIDTH"
          aria-hidden="true"
        />
        Nueva reunión
      </button>
    </div>

    <div class="meetings-view__filters">
      <div class="meetings-view__filter">
        <label for="meetings-filter-type">Tipo</label>
        <select
          id="meetings-filter-type"
          :value="meetingsStore.typeFilter ?? ''"
          @change="handleTypeFilterChange"
        >
          <option value="">Todos</option>
          <option v-for="option in MEETING_TYPE_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="meetings-view__filter">
        <label for="meetings-filter-status">Estado</label>
        <select
          id="meetings-filter-status"
          :value="meetingsStore.statusFilter ?? ''"
          @change="handleStatusFilterChange"
        >
          <option value="">Todos</option>
          <option
            v-for="option in MEETING_STATUS_OPTIONS"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>
    </div>

    <LoadingSpinner v-if="meetingsStore.isLoading" label="Cargando reuniones…" />

    <div v-else-if="meetingsStore.loadError" class="meetings-view__error">
      <AlertMessage variant="error">{{ meetingsStore.loadError }}</AlertMessage>
      <button type="button" class="meetings-view__retry-button" @click="handleRetry">
        Reintentar
      </button>
    </div>

    <template v-else>
      <section class="meetings-view__section" aria-labelledby="meetings-current-title">
        <h2 id="meetings-current-title" class="meetings-view__section-title">
          Próximas reuniones
        </h2>
        <CurrentMeetingsList :meetings="meetingsStore.currentMeetings" />
      </section>

      <section class="meetings-view__section" aria-labelledby="meetings-past-title">
        <h2 id="meetings-past-title" class="meetings-view__section-title">Reuniones anteriores</h2>
        <PastMeetingsList
          :meetings="meetingsStore.pastMeetings"
          :page="meetingsStore.pastPage"
          :page-size="meetingsStore.pastPageSize"
          :total="meetingsStore.pastTotal"
          :total-pages="meetingsStore.pastTotalPages"
          :is-loading-past="meetingsStore.isLoadingPast"
          :past-error="meetingsStore.pastError"
          @prev-page="handlePrevPastPage"
          @next-page="handleNextPastPage"
          @retry="handleRetryPastPage"
        />
      </section>
    </template>

    <CreateMeetingDialog
      :open="isCreateDialogOpen"
      :is-creating="meetingsStore.isCreating"
      :error="meetingsStore.createError"
      @submit="handleCreateSubmit"
      @cancel="handleCreateCancel"
    />
  </section>
</template>

<style scoped>
.meetings-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.meetings-view__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.meetings-view__heading {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.meetings-view__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
}

.meetings-view__subtitle {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.meetings-view__action-button {
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

.meetings-view__action-button:hover {
  background: var(--accent-hover);
}

.meetings-view__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.meetings-view__filter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.meetings-view__filter label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.meetings-view__filter select {
  min-height: 44px;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  font-size: 0.88rem;
  font-family: inherit;
  background: var(--bg-surface);
  color: var(--text-primary);
}

.meetings-view__filter select:focus {
  border-color: var(--accent);
}

.meetings-view__error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.meetings-view__retry-button {
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

.meetings-view__retry-button:hover {
  background: var(--accent-hover);
}

.meetings-view__section {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.meetings-view__section-title {
  margin: 0;
  font-size: 1.02rem;
  font-weight: 700;
  color: var(--text-primary);
}
</style>
