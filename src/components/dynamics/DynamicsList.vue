<script setup lang="ts">
import { RouterLink } from 'vue-router'
import EmptyState from '@/components/common/EmptyState.vue'
import type { Dynamic } from '@/types'

defineProps<{ dynamics: Dynamic[] }>()

function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(new Date(year, month - 1, day))
}
</script>

<template>
  <EmptyState v-if="dynamics.length === 0" title="Aún no hay dinámicas" description="Crea una dinámica para reunir su contenido y exportarlo a PDF." />
  <ul v-else class="dynamics-list">
    <li v-for="dynamic in dynamics" :key="dynamic.id" class="dynamics-list__item">
      <RouterLink :to="{ name: 'dynamic-detail', params: { id: dynamic.id } }" class="dynamics-list__link" :aria-label="`Abrir dinámica ${dynamic.title}`">
        <span class="dynamics-list__date">{{ formatDate(dynamic.date) }}</span>
        <span class="dynamics-list__title">{{ dynamic.title }}</span>
        <span class="dynamics-list__creator">Creada por {{ dynamic.createdBy.nickname }}</span>
      </RouterLink>
    </li>
  </ul>
</template>

<style scoped>
.dynamics-list { display:grid; grid-template-columns:repeat(auto-fill,minmax(17rem,1fr)); gap:.75rem; padding:0; margin:0; list-style:none; }.dynamics-list__item { border:1px solid var(--border); border-radius:var(--radius-md); background:var(--bg-surface); }.dynamics-list__link { display:grid; gap:.35rem; min-height:7.5rem; padding:1rem; border-radius:inherit; color:inherit; text-decoration:none; }.dynamics-list__link:hover { background:var(--bg-hover); }.dynamics-list__link:focus-visible { outline:2px solid var(--accent); outline-offset:-2px; }.dynamics-list__date { color:var(--accent-text); font-size:.82rem; font-weight:700; text-transform:capitalize; }.dynamics-list__title { color:var(--text-primary); font-size:1rem; font-weight:700; overflow-wrap:anywhere; }.dynamics-list__creator { margin-top:auto; color:var(--text-muted); font-size:.8rem; }
</style>
