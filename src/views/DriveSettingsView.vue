<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDriveStore } from '@/stores/drive'
import AlertMessage from '@/components/common/AlertMessage.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import DriveStatusCard from '@/components/drive/DriveStatusCard.vue'

interface CallbackNotice {
  variant: 'error' | 'info'
  message: string
}

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Has cancelado la autorización en Google.',
  invalid_state: 'La solicitud de conexión ha caducado. Inténtalo de nuevo.',
  missing_code: 'Google no ha devuelto un código de autorización válido.',
  not_configured: 'La integración con Google Drive no está disponible en este momento.',
  token_exchange_failed: 'No se ha podido completar la autenticación con Google.',
  missing_refresh_token:
    'Google no ha concedido acceso permanente. Vuelve a intentarlo aceptando todos los permisos solicitados.',
  drive_setup_failed: 'No se ha podido preparar la carpeta de Google Drive.',
  storage_failed: 'No se ha podido guardar la conexión con Google Drive. Inténtalo de nuevo.',
}

const route = useRoute()
const router = useRouter()
const driveStore = useDriveStore()

const callbackNotice = ref<CallbackNotice | null>(null)
const isConfirmOpen = ref(false)

function handleConnect() {
  driveStore.connect()
}

function handleRetry() {
  driveStore.fetchStatus()
}

function openDisconnectConfirm() {
  isConfirmOpen.value = true
}

function cancelDisconnect() {
  isConfirmOpen.value = false
}

async function confirmDisconnect() {
  await driveStore.disconnect()
  if (!driveStore.disconnectError) {
    isConfirmOpen.value = false
  }
}

onMounted(async () => {
  const driveParam = route.query.drive

  if (driveParam === 'success') {
    callbackNotice.value = { variant: 'info', message: 'Google Drive se ha conectado correctamente.' }
  } else if (driveParam === 'error') {
    const reason = typeof route.query.reason === 'string' ? route.query.reason : ''
    callbackNotice.value = {
      variant: 'error',
      message: CALLBACK_ERROR_MESSAGES[reason] ?? 'No se ha podido conectar Google Drive.',
    }
  }

  // Limpia los parámetros del callback de la URL para no reprocesarlos
  // al recargar o volver atrás.
  if (driveParam) {
    router.replace({ name: 'settings-drive' })
  }

  await driveStore.fetchStatus()
})
</script>

<template>
  <section class="drive-settings" aria-labelledby="drive-settings-title">
    <h1 id="drive-settings-title" class="drive-settings__title">Google Drive</h1>
    <p class="drive-settings__subtitle">
      Conecta la cuenta de Google Drive que usará Fragua para guardar los documentos.
    </p>

    <AlertMessage v-if="callbackNotice" :variant="callbackNotice.variant" class="drive-settings__notice">
      {{ callbackNotice.message }}
    </AlertMessage>

    <LoadingSpinner v-if="driveStore.isLoadingStatus" label="Comprobando la conexión…" />

    <div v-else-if="driveStore.statusError" class="drive-settings__status-error">
      <AlertMessage variant="error">{{ driveStore.statusError }}</AlertMessage>
      <button
        type="button"
        class="drive-settings__retry-button"
        :disabled="driveStore.isLoadingStatus"
        :aria-busy="driveStore.isLoadingStatus"
        @click="handleRetry"
      >
        Reintentar comprobación
      </button>
    </div>

    <DriveStatusCard
      v-else-if="driveStore.status"
      :status="driveStore.status"
      :is-connecting="driveStore.isConnecting"
      :is-disconnecting="driveStore.isDisconnecting"
      :connect-error="driveStore.connectError"
      :disconnect-error="driveStore.disconnectError"
      @connect="handleConnect"
      @retry="handleRetry"
      @disconnect="openDisconnectConfirm"
    />

    <ConfirmDialog
      :open="isConfirmOpen"
      title="Desconectar Google Drive"
      description="Fragua dejará de tener acceso a esta cuenta de Google Drive. Los documentos ya guardados en Drive no se eliminarán."
      confirm-label="Sí, desconectar"
      cancel-label="Cancelar"
      danger
      :is-confirming="driveStore.isDisconnecting"
      @confirm="confirmDisconnect"
      @cancel="cancelDisconnect"
    />
  </section>
</template>

<style scoped>
.drive-settings {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 34rem;
}

.drive-settings__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
}

.drive-settings__subtitle {
  margin: -0.5rem 0 0;
  color: var(--text-secondary);
  font-size: 0.92rem;
}

.drive-settings__status-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.drive-settings__retry-button {
  min-height: 44px;
  padding: 0.55rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: var(--accent);
  color: white;
}

.drive-settings__retry-button:hover:not(:disabled) {
  background: var(--accent-hover);
}

.drive-settings__retry-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
