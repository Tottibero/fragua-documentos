import { ref } from 'vue'
import { defineStore } from 'pinia'
import { isAxiosError } from 'axios'
import { dynamicsService, type DynamicEntryPayload, type DynamicPayload } from '@/services/dynamics.service'
import { saveBlobAsFile } from '@/utils/download-file'
import type { Dynamic, DynamicDetail, DynamicEntry, DynamicPdf } from '@/types'

function describeError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const status = err.response?.status
    if (status === 400) return 'Los datos de la dinámica no son válidos.'
    if (status === 403) return 'No tienes permiso para realizar esta acción.'
    if (status === 404) return 'La dinámica o su PDF ya no existe.'
    if (status !== undefined && status >= 500) {
      return 'Ha ocurrido un problema temporal en el servidor. Inténtalo de nuevo en unos segundos.'
    }
    if (!err.response) return 'No se ha podido conectar con el servidor. Comprueba tu conexión.'
  }
  return fallback
}

export const useDynamicsStore = defineStore('dynamics', () => {
  const items = ref<Dynamic[]>([])
  const selected = ref<DynamicDetail | null>(null)
  const isLoading = ref(false)
  const loadError = ref('')
  const isSaving = ref(false)
  const saveError = ref('')
  const isExporting = ref(false)
  const exportError = ref('')

  async function load(): Promise<void> {
    isLoading.value = true
    loadError.value = ''
    try {
      items.value = await dynamicsService.list()
    } catch (err) {
      loadError.value = describeError(err, 'No se han podido cargar las dinámicas.')
    } finally {
      isLoading.value = false
    }
  }

  async function loadOne(id: string): Promise<void> {
    isLoading.value = true
    loadError.value = ''
    selected.value = null
    try {
      selected.value = await dynamicsService.get(id)
    } catch (err) {
      loadError.value = describeError(err, 'No se ha podido cargar la dinámica.')
    } finally {
      isLoading.value = false
    }
  }

  async function create(payload: DynamicPayload): Promise<Dynamic | null> {
    isSaving.value = true
    saveError.value = ''
    try {
      const created = await dynamicsService.create(payload)
      items.value = [created, ...items.value]
      return created
    } catch (err) {
      saveError.value = describeError(err, 'No se ha podido crear la dinámica.')
      return null
    } finally {
      isSaving.value = false
    }
  }

  async function update(id: string, payload: Partial<DynamicPayload>): Promise<Dynamic | null> {
    isSaving.value = true
    saveError.value = ''
    try {
      const updated = await dynamicsService.update(id, payload)
      updateListItem(updated)
      if (selected.value?.id === id) selected.value = { ...selected.value, ...updated }
      return updated
    } catch (err) {
      saveError.value = describeError(err, 'No se ha podido actualizar la dinámica.')
      return null
    } finally {
      isSaving.value = false
    }
  }

  async function createEntry(id: string, payload: DynamicEntryPayload): Promise<DynamicEntry | null> {
    return withSaving(async () => {
      const entry = await dynamicsService.createEntry(id, payload)
      if (selected.value?.id === id) selected.value.entries = [...selected.value.entries, entry]
      return entry
    }, 'No se ha podido añadir el contenido.')
  }

  async function updateEntry(
    id: string,
    entryId: string,
    payload: Partial<DynamicEntryPayload>,
  ): Promise<DynamicEntry | null> {
    return withSaving(async () => {
      const entry = await dynamicsService.updateEntry(id, entryId, payload)
      if (selected.value?.id === id) {
        selected.value.entries = selected.value.entries.map((item) => item.id === entry.id ? entry : item)
      }
      return entry
    }, 'No se ha podido actualizar el contenido.')
  }

  async function deleteEntry(id: string, entryId: string): Promise<boolean> {
    const deleted = await withSaving(async () => {
      await dynamicsService.deleteEntry(id, entryId)
      if (selected.value?.id === id) {
        selected.value.entries = selected.value.entries
          .filter((entry) => entry.id !== entryId)
          .map((entry, index) => ({ ...entry, position: index + 1 }))
      }
      return true
    }, 'No se ha podido eliminar el contenido.')
    return deleted === true
  }

  async function exportPdf(id: string): Promise<DynamicPdf | null> {
    isExporting.value = true
    exportError.value = ''
    try {
      const pdf = await dynamicsService.exportPdf(id)
      if (selected.value?.id === id) selected.value = { ...selected.value, pdf }
      return pdf
    } catch (err) {
      exportError.value = describeError(err, 'No se ha podido generar el PDF.')
      return null
    } finally {
      isExporting.value = false
    }
  }

  async function downloadPdf(id: string): Promise<boolean> {
    exportError.value = ''
    try {
      const result = await dynamicsService.downloadPdf(id)
      saveBlobAsFile(result.blob, result.fileName ?? 'dinamica.pdf')
      return true
    } catch (err) {
      exportError.value = describeError(err, 'No se ha podido descargar el PDF.')
      return false
    }
  }

  function resetSaveState(): void {
    saveError.value = ''
  }

  function resetExportState(): void {
    exportError.value = ''
  }

  function close(): void {
    selected.value = null
    loadError.value = ''
  }

  async function withSaving<T>(action: () => Promise<T>, fallback: string): Promise<T | null> {
    isSaving.value = true
    saveError.value = ''
    try {
      return await action()
    } catch (err) {
      saveError.value = describeError(err, fallback)
      return null
    } finally {
      isSaving.value = false
    }
  }

  function updateListItem(updated: Dynamic): void {
    items.value = items.value.map((item) => item.id === updated.id ? updated : item)
  }

  return {
    items, selected, isLoading, loadError, isSaving, saveError, isExporting, exportError,
    load, loadOne, create, update, createEntry, updateEntry, deleteEntry, exportPdf, downloadPdf,
    resetSaveState, resetExportState, close,
  }
})
