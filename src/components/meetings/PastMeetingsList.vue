<script setup lang="ts">
import { RouterLink } from 'vue-router'
import EmptyState from '@/components/common/EmptyState.vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import { meetingStatusLabel, meetingTypeLabel } from '@/utils/meeting-labels'
import type { Meeting } from '@/types'

const props = withDefaults(
  defineProps<{
    meetings: Meeting[]
    page: number
    pageSize: number
    total: number
    totalPages: number
    isLoadingPast: boolean
    pastError?: string
  }>(),
  { pastError: '' },
)

const emit = defineEmits<{ 'prev-page': []; 'next-page': []; retry: [] }>()

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

function handlePrev() {
  if (props.isLoadingPast || props.page <= 1) return
  emit('prev-page')
}

function handleNext() {
  if (props.isLoadingPast || props.page >= props.totalPages) return
  emit('next-page')
}
</script>

<template>
  <div class="past-meetings">
    <EmptyState
      v-if="meetings.length === 0 && !pastError"
      title="No hay reuniones anteriores"
      description="Las reuniones ya pasadas aparecerán aquí, de la más reciente a la más antigua."
    />

    <template v-else>
      <ul class="past-meetings__list">
        <li v-for="meeting in meetings" :key="meeting.id" class="past-meetings__row">
          <RouterLink
            :to="{ name: 'meeting-detail', params: { id: meeting.id } }"
            class="past-meetings__link"
            :aria-label="`Ver detalle de la reunión ${meeting.name}`"
          >
            <div class="past-meetings__primary">
              <span class="past-meetings__name">{{ meeting.name }}</span>
            </div>

            <div class="past-meetings__meta">
              <span class="past-meetings__datetime">{{ formatDateTime(meeting.scheduledAt) }}</span>
              <span class="past-meetings__pill">{{ meetingTypeLabel(meeting.type) }}</span>
              <span class="past-meetings__pill" :class="`past-meetings__pill--${meeting.status}`">
                {{ meetingStatusLabel(meeting.status) }}
              </span>
              <span class="past-meetings__creator">Creada por {{ meeting.createdBy.nickname }}</span>
            </div>
          </RouterLink>
        </li>
      </ul>

      <AlertMessage v-if="pastError" variant="error">{{ pastError }}</AlertMessage>

      <div class="past-meetings__pagination">
        <button
          type="button"
          class="past-meetings__page-button"
          :disabled="isLoadingPast || page <= 1"
          @click="handlePrev"
        >
          Anterior
        </button>

        <span class="past-meetings__page-status" role="status" aria-live="polite">
          <template v-if="totalPages > 0">Página {{ page }} de {{ totalPages }}</template>
          <template v-else>Sin reuniones anteriores</template>
          <span v-if="isLoadingPast" class="past-meetings__page-loading"> · Actualizando…</span>
        </span>

        <button
          v-if="pastError"
          type="button"
          class="past-meetings__page-button"
          :disabled="isLoadingPast"
          @click="emit('retry')"
        >
          Reintentar
        </button>
        <button
          v-else
          type="button"
          class="past-meetings__page-button"
          :disabled="isLoadingPast || page >= totalPages"
          @click="handleNext"
        >
          Siguiente
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.past-meetings {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.past-meetings__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.past-meetings__row {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.past-meetings__link {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.65rem 1rem;
  border-radius: inherit;
  color: inherit;
  text-decoration: none;
}

.past-meetings__link:hover {
  background: var(--bg-hover);
}

.past-meetings__link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.past-meetings__primary {
  display: flex;
  align-items: center;
  min-height: 44px;
}

.past-meetings__name {
  font-weight: 600;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.past-meetings__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.past-meetings__datetime {
  font-weight: 600;
  color: var(--text-primary);
}

.past-meetings__pill {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  font-size: 0.78rem;
  white-space: nowrap;
}

.past-meetings__pill--held {
  border-color: color-mix(in srgb, var(--success) 45%, transparent);
  color: var(--success);
}

.past-meetings__pill--closed {
  border-color: color-mix(in srgb, var(--text-muted) 45%, transparent);
  color: var(--text-muted);
}

.past-meetings__creator {
  white-space: nowrap;
}

.past-meetings__pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.past-meetings__page-status {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.past-meetings__page-loading {
  color: var(--text-muted);
}

.past-meetings__page-button {
  min-height: 44px;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
}

.past-meetings__page-button:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.past-meetings__page-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .past-meetings__meta {
    gap: 0.35rem 0.75rem;
  }

  .past-meetings__pagination {
    justify-content: center;
  }
}
</style>
