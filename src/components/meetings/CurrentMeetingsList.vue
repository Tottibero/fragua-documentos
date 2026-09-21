<script setup lang="ts">
import { RouterLink } from 'vue-router'
import EmptyState from '@/components/common/EmptyState.vue'
import { meetingStatusLabel, meetingTypeLabel } from '@/utils/meeting-labels'
import type { Meeting } from '@/types'

defineProps<{ meetings: Meeting[] }>()

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

function formatCreatedAt(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}
</script>

<template>
  <div class="current-meetings">
    <EmptyState
      v-if="meetings.length === 0"
      title="No hay reuniones previstas"
      description="Las reuniones de hoy o futuras aparecerán aquí en cuanto se creen."
    />

    <ul v-else class="current-meetings__list">
      <li
        v-for="(meeting, index) in meetings"
        :key="meeting.id"
        class="current-meetings__row"
        :class="{ 'current-meetings__row--next': index === 0 }"
      >
        <RouterLink
          :to="{ name: 'meeting-detail', params: { id: meeting.id } }"
          class="current-meetings__link"
          :aria-label="`Ver detalle de la reunión ${meeting.name}`"
        >
          <div class="current-meetings__primary">
            <span v-if="index === 0" class="current-meetings__badge">Próxima</span>
            <span class="current-meetings__name">{{ meeting.name }}</span>
          </div>

          <div class="current-meetings__meta">
            <span class="current-meetings__datetime">{{ formatDateTime(meeting.scheduledAt) }}</span>
            <span class="current-meetings__pill">{{ meetingTypeLabel(meeting.type) }}</span>
            <span class="current-meetings__pill" :class="`current-meetings__pill--${meeting.status}`">
              {{ meetingStatusLabel(meeting.status) }}
            </span>
            <span class="current-meetings__creator">Creada por {{ meeting.createdBy.nickname }}</span>
          </div>

          <p class="current-meetings__created-at">
            Creada el {{ formatCreatedAt(meeting.createdAt) }}
          </p>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.current-meetings {
  display: flex;
  flex-direction: column;
}

.current-meetings__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.current-meetings__row {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.current-meetings__row--next {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.current-meetings__link {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.75rem 1rem;
  border-radius: inherit;
  color: inherit;
  text-decoration: none;
}

.current-meetings__link:hover {
  background: var(--bg-hover);
}

.current-meetings__link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.current-meetings__primary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-height: 44px;
}

.current-meetings__badge {
  flex-shrink: 0;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: var(--accent);
  color: white;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.current-meetings__name {
  font-weight: 600;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.current-meetings__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.current-meetings__datetime {
  font-weight: 600;
  color: var(--text-primary);
}

.current-meetings__pill {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  font-size: 0.78rem;
  white-space: nowrap;
}

.current-meetings__pill--held {
  border-color: color-mix(in srgb, var(--success) 45%, transparent);
  color: var(--success);
}

.current-meetings__pill--closed {
  border-color: color-mix(in srgb, var(--text-muted) 45%, transparent);
  color: var(--text-muted);
}

.current-meetings__creator {
  white-space: nowrap;
}

.current-meetings__created-at {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .current-meetings__meta {
    gap: 0.35rem 0.75rem;
  }
}
</style>
