<script setup lang="ts">
import { Download, FileDown } from '@lucide/vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import type { DynamicPdf } from '@/types'

defineProps<{ pdf: DynamicPdf | null; canManage: boolean; isExporting: boolean; error?: string }>()
const emit = defineEmits<{ export: []; download: [] }>()

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}
</script>

<template>
  <section class="dynamic-pdf" aria-labelledby="dynamic-pdf-title"><div><h2 id="dynamic-pdf-title">Documento PDF</h2><p v-if="pdf">Actualizado el {{ formatDateTime(pdf.exportedAt) }} por {{ pdf.exportedBy.nickname }}.</p><p v-else>Cuando lo exportes, se guardará en Dinamicas / Año / Título.</p></div><div class="dynamic-pdf__actions"><button v-if="pdf" type="button" class="dynamic-pdf__download" @click="emit('download')"><Download :size="18" aria-hidden="true" /> Descargar</button><button v-if="canManage" type="button" class="dynamic-pdf__export" :disabled="isExporting" @click="emit('export')"><FileDown :size="18" aria-hidden="true" /> {{ isExporting ? 'Generando…' : pdf ? 'Actualizar PDF' : 'Exportar PDF' }}</button></div><AlertMessage v-if="error" variant="error">{{ error }}</AlertMessage></section>
</template>

<style scoped>
.dynamic-pdf { display:grid; grid-template-columns:1fr auto; align-items:center; gap:1rem; padding:1rem; border:1px solid var(--border); border-radius:var(--radius-md); background:var(--bg-surface); }.dynamic-pdf h2 { margin:0; color:var(--text-primary); font-size:1rem; }.dynamic-pdf p { margin:.25rem 0 0; color:var(--text-secondary); font-size:.86rem; }.dynamic-pdf__actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:.55rem; }.dynamic-pdf__actions button { display:inline-flex; align-items:center; gap:.4rem; min-height:44px; padding:.5rem .85rem; border:1px solid var(--border-strong); border-radius:var(--radius-sm); background:var(--bg-elevated); color:var(--text-primary); font:inherit; font-size:.88rem; font-weight:600; cursor:pointer; }.dynamic-pdf__actions .dynamic-pdf__export { border-color:var(--accent); background:var(--accent); color:white; }.dynamic-pdf__actions button:disabled { cursor:wait; opacity:.7; }.dynamic-pdf > :last-child { grid-column:1 / -1; } @media (max-width:640px) { .dynamic-pdf { grid-template-columns:1fr; }.dynamic-pdf__actions { justify-content:flex-start; } }
</style>
