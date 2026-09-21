<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import type { DynamicEntry } from '@/types'
import type { DynamicEntryPayload } from '@/services/dynamics.service'

const props = withDefaults(defineProps<{ open: boolean; entry: DynamicEntry | null; isSubmitting: boolean; error?: string }>(), { error: '' })
const emit = defineEmits<{ submit: [payload: DynamicEntryPayload]; cancel: [] }>()
const dialogEl = ref<HTMLDialogElement>()
const titleInput = ref<HTMLInputElement>()
const title = ref('')
const description = ref('')
const titleError = ref('')
const descriptionError = ref('')
let closingFromPropChange = false

watch(() => props.open, async (open) => {
  if (open) {
    title.value = props.entry?.title ?? ''
    description.value = props.entry?.description ?? ''
    titleError.value = ''; descriptionError.value = ''
    dialogEl.value?.showModal(); await nextTick(); titleInput.value?.focus()
  } else if (dialogEl.value?.open) { closingFromPropChange = true; dialogEl.value.close() }
})

function submit() {
  titleError.value = title.value.trim() ? '' : 'El título es obligatorio.'
  descriptionError.value = description.value.trim() ? '' : 'La explicación es obligatoria.'
  if (titleError.value || descriptionError.value || props.isSubmitting) return
  emit('submit', { title: title.value.trim(), description: description.value.trim() })
}
function close() { if (closingFromPropChange) { closingFromPropChange = false; return }; emit('cancel') }
</script>

<template>
  <dialog ref="dialogEl" class="entry-form" aria-labelledby="entry-form-title" @close="close" @cancel="isSubmitting && $event.preventDefault()" @click="!isSubmitting && $event.target === dialogEl && emit('cancel')">
    <div class="entry-form__box" @click.stop>
      <h2 id="entry-form-title" class="entry-form__title">{{ entry ? 'Editar contenido' : 'Añadir contenido' }}</h2>
      <form id="entry-form" class="entry-form__fields" novalidate @submit.prevent="submit">
        <div class="field"><label for="entry-title">Título</label><input id="entry-title" ref="titleInput" v-model="title" maxlength="200" :disabled="isSubmitting" /><span v-if="titleError" class="field-error">{{ titleError }}</span></div>
        <div class="field"><label for="entry-description">Explicación</label><textarea id="entry-description" v-model="description" rows="6" maxlength="4000" :disabled="isSubmitting"></textarea><span v-if="descriptionError" class="field-error">{{ descriptionError }}</span></div>
        <AlertMessage v-if="error" variant="error">{{ error }}</AlertMessage>
      </form>
      <div class="entry-form__actions"><button type="button" :disabled="isSubmitting" @click="emit('cancel')">Cancelar</button><button type="submit" form="entry-form" class="entry-form__submit" :disabled="isSubmitting">{{ isSubmitting ? 'Guardando…' : 'Guardar' }}</button></div>
    </div>
  </dialog>
</template>

<style scoped>
.entry-form { width: min(92vw, 36rem); padding: 0; border: 0; border-radius: var(--radius-lg); box-shadow: var(--shadow-md); }.entry-form::backdrop { background: rgba(15,18,25,.45); }.entry-form__box { padding: 1.5rem; border-radius: var(--radius-lg); background: var(--bg-surface); }.entry-form__title { margin: 0 0 1rem; color: var(--text-primary); font-size: 1.08rem; }.entry-form__fields { display: grid; gap: .9rem; }.field { display:grid; gap:.35rem; }.field label { color:var(--text-secondary); font-size:.85rem; font-weight:600; }.field input,.field textarea { width:100%; box-sizing:border-box; padding:.55rem .65rem; border:1px solid var(--border-strong); border-radius:var(--radius-sm); background:var(--bg-elevated); color:var(--text-primary); font:inherit; resize:vertical; }.field input { min-height:44px; }.field-error { color:var(--danger); font-size:.8rem; }.entry-form__actions { display:flex; justify-content:flex-end; gap:.6rem; margin-top:1.2rem; }.entry-form__actions button { min-height:44px; padding:.5rem 1rem; border:1px solid var(--border-strong); border-radius:var(--radius-sm); background:var(--bg-elevated); color:var(--text-primary); font:inherit; font-weight:600; cursor:pointer; }.entry-form__actions .entry-form__submit { border-color:var(--accent); background:var(--accent); color:white; }.entry-form__actions button:disabled { cursor:wait; opacity:.7; }
</style>
