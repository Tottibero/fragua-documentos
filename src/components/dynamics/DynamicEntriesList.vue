<script setup lang="ts">
import { Pencil, Plus, Trash2 } from '@lucide/vue'
import EmptyState from '@/components/common/EmptyState.vue'
import IconButton from '@/components/common/IconButton.vue'
import type { DynamicEntry } from '@/types'

defineProps<{ entries: DynamicEntry[]; canManage: boolean }>()
const emit = defineEmits<{ add: []; edit: [entry: DynamicEntry]; remove: [entry: DynamicEntry] }>()
</script>

<template>
  <section class="dynamic-entries" aria-labelledby="dynamic-entries-title">
    <div class="dynamic-entries__header"><div><h2 id="dynamic-entries-title">Contenido</h2><p>Cada punto explica una parte de la dinámica.</p></div><button v-if="canManage" type="button" class="dynamic-entries__add" @click="emit('add')"><Plus :size="18" aria-hidden="true" /> Añadir contenido</button></div>
    <EmptyState v-if="entries.length === 0" title="Sin contenido todavía" description="Añade el primer título y su explicación." />
    <ol v-else class="dynamic-entries__list"><li v-for="entry in entries" :key="entry.id" class="dynamic-entries__item"><article><h3>{{ entry.title }}</h3><p>{{ entry.description }}</p></article><div v-if="canManage" class="dynamic-entries__actions"><IconButton :icon="Pencil" label="Editar contenido" @click="emit('edit', entry)" /><IconButton :icon="Trash2" label="Eliminar contenido" @click="emit('remove', entry)" /></div></li></ol>
  </section>
</template>

<style scoped>
.dynamic-entries { display:grid; gap:1rem; }.dynamic-entries__header { display:flex; align-items:flex-end; justify-content:space-between; gap:1rem; }.dynamic-entries__header h2 { margin:0; color:var(--text-primary); font-size:1.05rem; }.dynamic-entries__header p { margin:.2rem 0 0; color:var(--text-secondary); font-size:.88rem; }.dynamic-entries__add { display:inline-flex; align-items:center; gap:.4rem; min-height:44px; padding:.5rem .85rem; border:1px solid var(--accent); border-radius:var(--radius-sm); background:var(--accent); color:white; font:inherit; font-size:.9rem; font-weight:600; white-space:nowrap; cursor:pointer; }.dynamic-entries__list { display:grid; gap:.65rem; margin:0; padding-left:2rem; }.dynamic-entries__item { padding:.9rem 1rem; border:1px solid var(--border); border-radius:var(--radius-md); background:var(--bg-surface); }.dynamic-entries__item { display:flex; justify-content:space-between; gap:1rem; }.dynamic-entries__item h3 { margin:0; color:var(--text-primary); font-size:.98rem; }.dynamic-entries__item p { margin:.35rem 0 0; color:var(--text-secondary); white-space:pre-wrap; line-height:1.5; }.dynamic-entries__actions { display:flex; align-self:flex-start; gap:.25rem; }.dynamic-entries__actions :deep(button:last-child) { color:var(--danger); } @media (max-width:640px) { .dynamic-entries__header { align-items:flex-start; flex-direction:column; }.dynamic-entries__item { flex-direction:column; }.dynamic-entries__actions { align-self:flex-end; } }
</style>
