<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'error' | 'info'
  }>(),
  { variant: 'error' },
)
</script>

<template>
  <p class="alert" :class="`alert--${variant}`" role="alert">
    <slot />
  </p>
</template>

<style scoped>
.alert {
  margin: 0;
  padding: 0.65rem 0.9rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  line-height: 1.4;
}

.alert--error {
  background: var(--danger-soft);
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent);
}

.alert--info {
  background: var(--accent-soft);
  color: var(--accent-hover);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
}
</style>
