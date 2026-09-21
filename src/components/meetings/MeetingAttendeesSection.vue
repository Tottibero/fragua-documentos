<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useMeetingAttendeesStore } from '@/stores/meeting-attendees'
import { useToastStore } from '@/stores/toast'
import AlertMessage from '@/components/common/AlertMessage.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import MeetingAttendeesList from './MeetingAttendeesList.vue'
import MeetingAttendeesDialog from './MeetingAttendeesDialog.vue'
import { Users } from '@lucide/vue'
import { meetingAttendanceLabel } from '@/utils/meeting-labels'
import type { Meeting, MeetingAttendanceStatus } from '@/types'

defineProps<{
  meeting: Meeting
  /** Ayuda visual (fase 3.3a): reunión en `draft`/`held` y usuario creador,
   * `admin` o `superadmin` — la misma regla que los puntos. El backend sigue
   * siendo la única autoridad real. */
  canManageAttendees: boolean
}>()

const store = useMeetingAttendeesStore()
const toastStore = useToastStore()

const manageButtonRef = ref<HTMLButtonElement>()
const isDialogOpen = ref(false)

const isAnyMutationActive = computed(() => store.isReplacing || store.updatingUserId !== null)

// Sin asistentes cargados el diálogo no puede calcular sus cambios ni el
// aviso de asistencia registrada, así que no se ofrece hasta tenerlos.
const canOpenDialog = computed(
  () => !store.isLoading && !store.loadError && !isAnyMutationActive.value,
)

const summary = computed(() => {
  const counts: Record<MeetingAttendanceStatus, number> = { planned: 0, attended: 0, absent: 0 }
  for (const attendee of store.attendees) counts[attendee.status]++
  return counts
})

async function focusManageButton() {
  await nextTick()
  manageButtonRef.value?.focus()
}

function handleOpenDialog() {
  store.resetReplaceState()
  store.loadOptions()
  isDialogOpen.value = true
}

async function handleSubmit(userIds: string[]) {
  const replaced = await store.replaceAttendees(userIds)
  if (replaced) {
    toastStore.success('Los asistentes de la reunión se han guardado.')
    isDialogOpen.value = false
    await focusManageButton()
  } else if (store.replaceError) {
    // Único punto de publicación: el diálogo ya muestra el mismo mensaje
    // como texto contextual. Un 409 MEETING_NOT_EDITABLE cae aquí igual que
    // cualquier otro fallo real — el diálogo permanece abierto.
    toastStore.error(store.replaceError)
  }
}

async function handleCancel() {
  isDialogOpen.value = false
  await focusManageButton()
}

async function handleStatusChange(userId: string, status: MeetingAttendanceStatus) {
  store.resetStatusState()
  const nickname = store.attendees.find((attendee) => attendee.user.id === userId)?.user.nickname
  const updated = await store.setStatus(userId, status)
  if (updated) {
    toastStore.success(
      `Asistencia de «${nickname ?? updated.user.nickname}»: ${meetingAttendanceLabel(updated.status)}.`,
    )
  } else if (store.statusError) {
    toastStore.error(store.statusError)
  }
}
</script>

<template>
  <section class="attendees-section" aria-labelledby="attendees-section-title">
    <div class="attendees-section__header">
      <h2 id="attendees-section-title" class="attendees-section__title">Asistentes</h2>

      <button
        v-if="canManageAttendees"
        ref="manageButtonRef"
        type="button"
        class="attendees-section__manage-button"
        :disabled="!canOpenDialog"
        @click="handleOpenDialog"
      >
        <Users :size="18" :stroke-width="1.75" aria-hidden="true" />
        Gestionar asistentes
      </button>
    </div>

    <p v-if="meeting.status === 'closed'" class="attendees-section__locked">
      Esta reunión está cerrada: sus asistentes ya no admiten cambios.
    </p>

    <LoadingSpinner v-if="store.isLoading && store.attendees.length === 0" label="Cargando asistentes…" />

    <div v-else-if="store.loadError" class="attendees-section__error">
      <AlertMessage variant="error">{{ store.loadError }}</AlertMessage>
      <button type="button" class="attendees-section__retry-button" @click="store.retry()">
        Reintentar
      </button>
    </div>

    <p v-else-if="store.attendees.length === 0" class="attendees-section__empty">
      Esta reunión todavía no tiene asistentes.
    </p>

    <template v-else>
      <p class="attendees-section__summary">
        {{ summary.planned }} previstos · {{ summary.attended }} asistieron ·
        {{ summary.absent }} ausentes
      </p>

      <MeetingAttendeesList
        :attendees="store.attendees"
        :can-manage="canManageAttendees"
        :updating-user-id="store.updatingUserId"
        :is-replacing="store.isReplacing"
        @status-change="handleStatusChange"
      />
    </template>

    <MeetingAttendeesDialog
      :open="isDialogOpen"
      :attendees="store.attendees"
      :options="store.options"
      :is-loading-options="store.isLoadingOptions"
      :options-error="store.optionsError"
      :is-submitting="store.isReplacing"
      :error="store.replaceError"
      @submit="handleSubmit"
      @cancel="handleCancel"
      @retry-options="store.loadOptions()"
    />
  </section>
</template>

<style scoped>
.attendees-section {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.attendees-section__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.attendees-section__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.attendees-section__manage-button {
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

.attendees-section__manage-button:hover:not(:disabled) {
  background: var(--accent-hover);
}

.attendees-section__manage-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.attendees-section__locked,
.attendees-section__empty,
.attendees-section__summary {
  margin: 0;
  font-size: 0.88rem;
  color: var(--text-secondary);
}

.attendees-section__locked {
  color: var(--text-muted);
}

.attendees-section__error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.attendees-section__retry-button {
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

.attendees-section__retry-button:hover {
  background: var(--accent-hover);
}
</style>
