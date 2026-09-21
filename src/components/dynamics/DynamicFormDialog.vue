<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import type { Dynamic } from '@/types'
import type { DynamicPayload } from '@/services/dynamics.service'

const props = withDefaults(defineProps<{
  open: boolean
  dynamic: Dynamic | null
  isSubmitting: boolean
  error?: string
}>(), { error: '' })

const emit = defineEmits<{ submit: [payload: DynamicPayload]; cancel: [] }>()
const dialogEl = ref<HTMLDialogElement>()
const titleInput = ref<HTMLInputElement>()
const title = ref('')
const date = ref('')
const titleError = ref('')
const dateError = ref('')
let closingFromPropChange = false

watch(() => props.open, async (open) => {
  if (open) {
    title.value = props.dynamic?.title ?? ''
    date.value = props.dynamic?.date ?? ''
    titleError.value = ''
    dateError.value = ''
    dialogEl.value?.showModal()
    await nextTick()
    titleInput.value?.focus()
    if (props.dynamic) titleInput.value?.select()
  } else if (dialogEl.value?.open) {
    closingFromPropChange = true
    dialogEl.value.close()
  }
})

function validate(): boolean {
  titleError.value = title.value.trim() ? '' : 'El título es obligatorio.'
  dateError.value = /^\d{4}-\d{2}-\d{2}$/.test(date.value) ? '' : 'La fecha es obligatoria.'
  return !titleError.value && !dateError.value
}

async function submit() {
  if (props.isSubmitting || !validate()) {
    if (titleError.value) await nextTick().then(() => titleInput.value?.focus())
    return
  }
  emit('submit', { title: title.value.trim(), date: date.value })
}

function close() {
  if (closingFromPropChange) { closingFromPropChange = false; return }
  emit('cancel')
}
</script>

<template>
  <dialog ref="dialogEl" class="dynamic-form" aria-labelledby="dynamic-form-title" @close="close" @cancel="isSubmitting && $event.preventDefault()" @click="!isSubmitting && $event.target === dialogEl && emit('cancel')">
    <div class="dynamic-form__box" @click.stop>
      <h2 id="dynamic-form-title" class="dynamic-form__title">{{ dynamic ? 'Editar dinámica' : 'Nueva dinámica' }}</h2>
      <form id="dynamic-form" class="dynamic-form__fields" novalidate @submit.prevent="submit">
        <div class="field"><label for="dynamic-title">Título</label><input id="dynamic-title" ref="titleInput" v-model="title" maxlength="160" :disabled="isSubmitting" :aria-invalid="!!titleError" /><span v-if="titleError" class="field-error">{{ titleError }}</span></div>
        <div class="field"><label for="dynamic-date">Fecha</label><input id="dynamic-date" v-model="date" type="date" :disabled="isSubmitting" :aria-invalid="!!dateError" /><span v-if="dateError" class="field-error">{{ dateError }}</span></div>
        <AlertMessage v-if="error" variant="error">{{ error }}</AlertMessage>
      </form>
      <div class="dynamic-form__actions"><button type="button" :disabled="isSubmitting" @click="emit('cancel')">Cancelar</button><button type="submit" form="dynamic-form" class="dynamic-form__submit" :disabled="isSubmitting">{{ isSubmitting ? 'Guardando…' : dynamic ? 'Guardar cambios' : 'Crear dinámica' }}</button></div>
    </div>
  </dialog>
</template>

<style scoped>
.dynamic-form { width: min(90vw, 28rem); padding: 0; border: 0; border-radius: var(--radius-lg); box-shadow: var(--shadow-md); }
.dynamic-form::backdrop { background: rgba(15, 18, 25, .45); }
.dynamic-form__box { padding: 1.5rem; border-radius: var(--radius-lg); background: var(--bg-surface); }
.dynamic-form__title { margin: 0 0 1rem; color: var(--text-primary); font-size: 1.08rem; }
.dynamic-form__fields { display: grid; gap: .9rem; }
.field { display: grid; gap: .35rem; }
.field label { color: var(--text-secondary); font-size: .85rem; font-weight: 600; }
.field input { min-height: 44px; padding: .5rem .65rem; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--bg-elevated); color: var(--text-primary); font: inherit; }
.field-error { color: var(--danger); font-size: .8rem; }
.dynamic-form__actions { display: flex; justify-content: flex-end; gap: .6rem; margin-top: 1.2rem; }
.dynamic-form__actions button { min-height: 44px; padding: .5rem 1rem; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--bg-elevated); color: var(--text-primary); font: inherit; font-weight: 600; cursor: pointer; }
.dynamic-form__actions .dynamic-form__submit { border-color: var(--accent); background: var(--accent); color: white; }
.dynamic-form__actions button:disabled { cursor: wait; opacity: .7; }
</style>
