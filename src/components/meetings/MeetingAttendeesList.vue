<script setup lang="ts">
import { ref } from 'vue'
import { LoaderCircle } from '@lucide/vue'
import { MEETING_ATTENDANCE_OPTIONS, meetingAttendanceLabel } from '@/utils/meeting-labels'
import type { MeetingAttendanceStatus, MeetingAttendee } from '@/types'

const props = defineProps<{
  attendees: MeetingAttendee[]
  /** Ayuda visual: con permiso, cada fila ofrece cambiar el estado de
   * asistencia; sin él, solo se muestra como texto. El backend sigue siendo
   * la única autoridad real. */
  canManage: boolean
  /** `userId` del asistente cuyo estado se está guardando ahora mismo. */
  updatingUserId: string | null
  /** Hay otra mutación en curso (p. ej. guardar la selección completa). */
  isReplacing: boolean
}>()

const emit = defineEmits<{
  'status-change': [userId: string, status: MeetingAttendanceStatus]
}>()

// Valor elegido mientras se guarda: el `<select>` lo muestra hasta que
// termina la petición. Si falla, `updatingUserId` vuelve a `null` y el
// control regresa solo al estado real (el que trae `attendee.status`), sin
// que este componente tenga que saber cómo acabó la operación.
const pendingStatus = ref<MeetingAttendanceStatus | null>(null)

function displayedStatus(attendee: MeetingAttendee): MeetingAttendanceStatus {
  if (props.updatingUserId === attendee.user.id && pendingStatus.value) {
    return pendingStatus.value
  }
  return attendee.status
}

function isRowBusy(attendee: MeetingAttendee): boolean {
  return props.updatingUserId === attendee.user.id
}

function isRowDisabled(attendee: MeetingAttendee): boolean {
  // La fila que se está guardando no se deshabilita (perdería el foco
  // mientras el usuario sigue en ella); se marca `aria-busy` y se ignoran
  // más cambios en `handleChange`.
  if (isRowBusy(attendee)) return false
  return props.updatingUserId !== null || props.isReplacing
}

function handleChange(attendee: MeetingAttendee, event: Event) {
  const select = event.target as HTMLSelectElement
  const status = select.value as MeetingAttendanceStatus

  if (props.updatingUserId !== null || props.isReplacing || status === attendee.status) {
    select.value = displayedStatus(attendee)
    return
  }

  pendingStatus.value = status
  emit('status-change', attendee.user.id, status)
}
</script>

<template>
  <ul class="attendees-list">
    <li v-for="attendee in attendees" :key="attendee.id" class="attendees-list__item">
      <span class="attendees-list__name">{{ attendee.user.nickname }}</span>

      <div v-if="canManage" class="attendees-list__control">
        <label class="attendees-list__label" :for="`attendee-status-${attendee.user.id}`">
          Asistencia de {{ attendee.user.nickname }}
        </label>
        <LoaderCircle
          v-if="isRowBusy(attendee)"
          class="attendees-list__spinner"
          :size="18"
          :stroke-width="1.75"
          aria-hidden="true"
        />
        <select
          :id="`attendee-status-${attendee.user.id}`"
          class="attendees-list__select"
          :value="displayedStatus(attendee)"
          :disabled="isRowDisabled(attendee)"
          :aria-busy="isRowBusy(attendee)"
          @change="handleChange(attendee, $event)"
        >
          <option v-for="option in MEETING_ATTENDANCE_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

      <span v-else class="attendees-list__status" :class="`attendees-list__status--${attendee.status}`">
        {{ meetingAttendanceLabel(attendee.status) }}
      </span>
    </li>
  </ul>
</template>

<style scoped>
.attendees-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.attendees-list__item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 0.55rem 1rem;
  min-height: 52px;
}

.attendees-list__item + .attendees-list__item {
  border-top: 1px solid var(--border);
}

.attendees-list__name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.attendees-list__control {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.attendees-list__label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.attendees-list__spinner {
  color: var(--text-muted);
  animation: attendees-list-spin 0.9s linear infinite;
}

.attendees-list__select {
  min-height: 44px;
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 0.9rem;
  cursor: pointer;
}

.attendees-list__select:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.attendees-list__status {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.attendees-list__status--attended {
  background: var(--success-soft);
  color: var(--success);
}

.attendees-list__status--absent {
  background: var(--danger-soft);
  color: var(--danger);
}

@keyframes attendees-list-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .attendees-list__spinner {
    animation: none;
  }
}
</style>
