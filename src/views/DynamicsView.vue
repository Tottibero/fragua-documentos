<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Plus } from '@lucide/vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import DynamicFormDialog from '@/components/dynamics/DynamicFormDialog.vue'
import DynamicsList from '@/components/dynamics/DynamicsList.vue'
import { useDynamicsStore } from '@/stores/dynamics'
import { useToastStore } from '@/stores/toast'
import type { DynamicPayload } from '@/services/dynamics.service'

const dynamicsStore = useDynamicsStore()
const toastStore = useToastStore()
const isCreateOpen = ref(false)

async function submit(payload: DynamicPayload) {
  const created = await dynamicsStore.create(payload)
  if (created) {
    isCreateOpen.value = false
    toastStore.success(`La dinámica «${created.title}» se ha creado.`)
  }
}

onMounted(() => dynamicsStore.load())
</script>

<template>
  <section class="dynamics-view" aria-labelledby="dynamics-title">
    <div class="dynamics-view__header"><div><h1 id="dynamics-title">Dinámicas</h1><p>Prepara contenidos sencillos y genera su documento PDF.</p></div><button type="button" class="dynamics-view__create" @click="dynamicsStore.resetSaveState(); isCreateOpen = true"><Plus :size="18" aria-hidden="true" /> Nueva dinámica</button></div>
    <LoadingSpinner v-if="dynamicsStore.isLoading" label="Cargando dinámicas…" />
    <div v-else-if="dynamicsStore.loadError" class="dynamics-view__error"><AlertMessage variant="error">{{ dynamicsStore.loadError }}</AlertMessage><button type="button" @click="dynamicsStore.load">Reintentar</button></div>
    <DynamicsList v-else :dynamics="dynamicsStore.items" />
    <DynamicFormDialog :open="isCreateOpen" :dynamic="null" :is-submitting="dynamicsStore.isSaving" :error="dynamicsStore.saveError" @submit="submit" @cancel="isCreateOpen = false" />
  </section>
</template>

<style scoped>
.dynamics-view { display:grid; gap:1.4rem; max-width:72rem; }.dynamics-view__header { display:flex; justify-content:space-between; align-items:flex-end; gap:1rem; }.dynamics-view__header h1 { margin:0; color:var(--text-primary); font-size:1.45rem; }.dynamics-view__header p { margin:.35rem 0 0; color:var(--text-secondary); }.dynamics-view__create { display:inline-flex; align-items:center; gap:.4rem; min-height:44px; padding:.5rem .85rem; border:1px solid var(--accent); border-radius:var(--radius-sm); background:var(--accent); color:white; font:inherit; font-size:.9rem; font-weight:600; white-space:nowrap; cursor:pointer; }.dynamics-view__error { display:grid; justify-items:start; gap:.75rem; }.dynamics-view__error button { min-height:44px; padding:.5rem .85rem; border:1px solid var(--border-strong); border-radius:var(--radius-sm); background:var(--bg-elevated); color:var(--text-primary); font:inherit; font-weight:600; cursor:pointer; } @media (max-width:640px) { .dynamics-view__header { align-items:flex-start; flex-direction:column; }.dynamics-view__create { width:100%; justify-content:center; } }
</style>
