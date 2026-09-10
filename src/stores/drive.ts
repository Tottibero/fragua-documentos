import { ref } from 'vue'
import { defineStore } from 'pinia'
import { driveService } from '@/services/drive.service'
import type { DriveStatus } from '@/types'

export const useDriveStore = defineStore('drive', () => {
  const status = ref<DriveStatus | null>(null)
  const isLoadingStatus = ref(false)
  const statusError = ref('')

  const isConnecting = ref(false)
  const connectError = ref('')

  const isDisconnecting = ref(false)
  const disconnectError = ref('')

  async function fetchStatus() {
    isLoadingStatus.value = true
    statusError.value = ''
    try {
      status.value = await driveService.getStatus()
    } catch {
      statusError.value = 'No se ha podido obtener el estado de Google Drive.'
    } finally {
      isLoadingStatus.value = false
    }
  }

  /**
   * Pide a la API la URL de consentimiento de Google y navega a ella en la
   * misma pestaña. Sirve tanto para la primera conexión como para reconectar
   * — el backend expone un único endpoint para ambos casos. Si la petición
   * falla no llega a navegar y se puede mostrar el error.
   */
  async function connect() {
    isConnecting.value = true
    connectError.value = ''
    try {
      const { url } = await driveService.createConnectUrl()
      window.location.href = url
    } catch {
      connectError.value = 'No se ha podido iniciar la conexión con Google Drive.'
      isConnecting.value = false
    }
  }

  async function disconnect() {
    isDisconnecting.value = true
    disconnectError.value = ''
    try {
      await driveService.disconnect()
      await fetchStatus()
    } catch {
      disconnectError.value = 'No se ha podido desconectar Google Drive.'
    } finally {
      isDisconnecting.value = false
    }
  }

  return {
    status,
    isLoadingStatus,
    statusError,
    isConnecting,
    connectError,
    isDisconnecting,
    disconnectError,
    fetchStatus,
    connect,
    disconnect,
  }
})
