<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
  }>(),
  { description: '' },
)
</script>

<template>
  <div class="empty-state">
    <div class="empty-state__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path
          d="M6 3.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V5A1.5 1.5 0 0 1 5.5 3.5H6z"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path d="M14 3.5V8h4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <h2 class="empty-state__title">{{ title }}</h2>
    <p v-if="description" class="empty-state__description">{{ description }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
  padding: 3.5rem 1.5rem;
  margin: auto;
  max-width: 28rem;
}

.empty-state__icon {
  width: 48px;
  height: 48px;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.empty-state__icon svg {
  width: 100%;
  height: 100%;
}

.empty-state__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-state__description {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.92rem;
  line-height: 1.5;
}
</style>
