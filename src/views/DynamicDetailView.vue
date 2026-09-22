<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ArrowLeft, Pencil } from '@lucide/vue'
import { RouterLink, useRoute } from 'vue-router'
import AlertMessage from '@/components/common/AlertMessage.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import DynamicEntriesList from '@/components/dynamics/DynamicEntriesList.vue'
import DynamicEntryFormDialog from '@/components/dynamics/DynamicEntryFormDialog.vue'
import DynamicFormDialog from '@/components/dynamics/DynamicFormDialog.vue'
import DynamicPdfSection from '@/components/dynamics/DynamicPdfSection.vue'
import { useAuthStore } from '@/stores/auth'
import { dynamicsService, type DynamicEntryPayload, type DynamicPayload } from '@/services/dynamics.service'
import { useDynamicsStore } from '@/stores/dynamics'
import { useToastStore } from '@/stores/toast'
import type { DynamicEntry, MeetingCreatedBy } from '@/types'

const route = useRoute()
const authStore = useAuthStore()
const dynamicsStore = useDynamicsStore()
const toastStore = useToastStore()
const isEditOpen = ref(false)
const isEntryFormOpen = ref(false)
const entryBeingEdited = ref<DynamicEntry | null>(null)
const entryToDelete = ref<DynamicEntry | null>(null)
const authorOptions = ref<MeetingCreatedBy[]>([])
const isLoadingAuthors = ref(false)
const authorsError = ref('')

const canManage = computed(() => {
  const dynamic = dynamicsStore.selected
  const user = authStore.user
  return !!dynamic && !!user && (dynamic.createdBy.id === user.id || user.role === 'admin' || user.role === 'superadmin')
})

function currentId(): string | null {
  return typeof route.params.id === 'string' ? route.params.id : null
}

function load() { const id = currentId(); if (id) dynamicsStore.loadOne(id) }
function formatDate(date: string): string { const [year, month, day] = date.split('-').map(Number); return new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(new Date(year, month - 1, day)) }

async function submitDynamic(payload: DynamicPayload) {
  const dynamic = dynamicsStore.selected
  if (!dynamic) return
  const updated = await dynamicsStore.update(dynamic.id, payload)
  if (updated) { isEditOpen.value = false; toastStore.success('La dinámica se ha actualizado.') }
}

function openEntryForm(entry: DynamicEntry | null) {
  dynamicsStore.resetSaveState()
  entryBeingEdited.value = entry
  isEntryFormOpen.value = true
  void loadAuthorOptions()
}

async function loadAuthorOptions() {
  if (isLoadingAuthors.value) return
  isLoadingAuthors.value = true
  authorsError.value = ''
  try {
    authorOptions.value = await dynamicsService.listEntryAuthorOptions()
  } catch {
    authorsError.value = 'No se han podido cargar los usuarios. Inténtalo de nuevo.'
  } finally {
    isLoadingAuthors.value = false
  }
}

async function submitEntry(payload: DynamicEntryPayload) {
  const dynamic = dynamicsStore.selected
  if (!dynamic) return
  const saved = entryBeingEdited.value
    ? await dynamicsStore.updateEntry(dynamic.id, entryBeingEdited.value.id, payload)
    : await dynamicsStore.createEntry(dynamic.id, payload)
  if (saved) { isEntryFormOpen.value = false; toastStore.success(entryBeingEdited.value ? 'El contenido se ha actualizado.' : 'El contenido se ha añadido.') }
}

async function removeEntry() {
  const dynamic = dynamicsStore.selected
  const entry = entryToDelete.value
  if (!dynamic || !entry) return
  if (await dynamicsStore.deleteEntry(dynamic.id, entry.id)) { entryToDelete.value = null; toastStore.success('El contenido se ha eliminado.') }
}

async function exportPdf() {
  const dynamic = dynamicsStore.selected
  if (!dynamic) return
  const pdf = await dynamicsStore.exportPdf(dynamic.id)
  if (pdf) toastStore.success(dynamic.pdf ? 'El PDF se ha actualizado.' : 'El PDF se ha generado.')
}

async function downloadPdf() {
  const dynamic = dynamicsStore.selected
  if (!dynamic) return
  if (await dynamicsStore.downloadPdf(dynamic.id)) toastStore.success('La descarga del PDF ha comenzado.')
}

watch(() => route.params.id, load)
onMounted(load)
onUnmounted(() => dynamicsStore.close())
</script>

<template>
  <section class="dynamic-detail" aria-labelledby="dynamic-detail-title">
    <RouterLink :to="{ name: 'dynamics' }" class="dynamic-detail__back"><ArrowLeft :size="18" aria-hidden="true" /> Volver a dinámicas</RouterLink>
    <LoadingSpinner v-if="dynamicsStore.isLoading" label="Cargando dinámica…" />
    <div v-else-if="dynamicsStore.loadError" class="dynamic-detail__error"><AlertMessage variant="error">{{ dynamicsStore.loadError }}</AlertMessage><button type="button" @click="load">Reintentar</button></div>
    <template v-else-if="dynamicsStore.selected"><header class="dynamic-detail__header"><div><p class="dynamic-detail__date">{{ formatDate(dynamicsStore.selected.date) }}</p><h1 id="dynamic-detail-title">{{ dynamicsStore.selected.title }}</h1><p class="dynamic-detail__creator">Creada por {{ dynamicsStore.selected.createdBy.nickname }}</p></div><button v-if="canManage" type="button" class="dynamic-detail__edit" @click="dynamicsStore.resetSaveState(); isEditOpen = true"><Pencil :size="18" aria-hidden="true" /> Editar</button></header>
      <DynamicPdfSection :pdf="dynamicsStore.selected.pdf" :can-manage="canManage" :is-exporting="dynamicsStore.isExporting" :error="dynamicsStore.exportError" @export="exportPdf" @download="downloadPdf" />
      <DynamicEntriesList :entries="dynamicsStore.selected.entries" :can-manage="canManage" @add="openEntryForm(null)" @edit="openEntryForm" @remove="entryToDelete = $event" />
      <DynamicFormDialog :open="isEditOpen" :dynamic="dynamicsStore.selected" :is-submitting="dynamicsStore.isSaving" :error="dynamicsStore.saveError" @submit="submitDynamic" @cancel="isEditOpen = false" />
      <DynamicEntryFormDialog :open="isEntryFormOpen" :entry="entryBeingEdited" :authors="authorOptions" :is-loading-authors="isLoadingAuthors" :authors-error="authorsError" :is-submitting="dynamicsStore.isSaving" :error="dynamicsStore.saveError" @submit="submitEntry" @cancel="isEntryFormOpen = false" @retry-authors="loadAuthorOptions" />
      <ConfirmDialog :open="!!entryToDelete" title="Eliminar contenido" :description="`Se eliminará «${entryToDelete?.title ?? ''}» de esta dinámica.`" confirm-label="Eliminar" danger :is-confirming="dynamicsStore.isSaving" @confirm="removeEntry" @cancel="entryToDelete = null" />
    </template>
  </section>
</template>

<style scoped>
.dynamic-detail { display:grid; gap:1.4rem; max-width:72rem; }.dynamic-detail__back { display:inline-flex; width:max-content; align-items:center; gap:.4rem; color:var(--accent-text); font-size:.9rem; font-weight:600; text-decoration:none; }.dynamic-detail__back:hover { text-decoration:underline; text-underline-offset:.18em; }.dynamic-detail__header { display:flex; justify-content:space-between; align-items:flex-end; gap:1rem; }.dynamic-detail__date { margin:0; color:var(--accent-text); font-size:.88rem; font-weight:700; text-transform:capitalize; }.dynamic-detail__header h1 { margin:.25rem 0 0; color:var(--text-primary); font-size:1.5rem; overflow-wrap:anywhere; }.dynamic-detail__creator { margin:.35rem 0 0; color:var(--text-secondary); font-size:.88rem; }.dynamic-detail__edit,.dynamic-detail__error button { display:inline-flex; align-items:center; gap:.4rem; min-height:44px; padding:.5rem .85rem; border:1px solid var(--border-strong); border-radius:var(--radius-sm); background:var(--bg-elevated); color:var(--text-primary); font:inherit; font-size:.9rem; font-weight:600; cursor:pointer; }.dynamic-detail__error { display:grid; justify-items:start; gap:.75rem; } @media (max-width:640px) { .dynamic-detail__header { align-items:flex-start; flex-direction:column; }.dynamic-detail__edit { width:100%; justify-content:center; } }
</style>
