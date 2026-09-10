<script setup lang="ts">
import { computed } from 'vue'
import AlertMessage from '@/components/common/AlertMessage.vue'
import type { DriveConnectionState, DriveStatus } from '@/types'

type BadgeVariant = 'success' | 'neutral' | 'danger'
type PrimaryAction = 'connect' | 'retry'

interface StateConfig {
  badgeLabel: string
  badgeVariant: BadgeVariant
  description: string
  showDetails: boolean
  primaryAction: PrimaryAction
  connectLabel: string
  showDisconnect: boolean
}

// Único punto de mapeo estado → presentación. Todo lo que se muestra (badge,
// texto, qué acciones aparecen) sale de aquí a partir de `status.state` — no
// se deriva de `status.connected` en ningún sitio.
const STATE_CONFIG: Record<DriveConnectionState, StateConfig> = {
  not_connected: {
    badgeLabel: 'No conectado',
    badgeVariant: 'neutral',
    description: 'Todavía no hay ninguna cuenta de Google Drive conectada.',
    showDetails: false,
    primaryAction: 'connect',
    connectLabel: 'Conectar con Google Drive',
    showDisconnect: false,
  },
  connected: {
    badgeLabel: 'Conectado',
    badgeVariant: 'success',
    description: '',
    showDetails: true,
    primaryAction: 'connect',
    connectLabel: 'Reconectar',
    showDisconnect: true,
  },
  revoked: {
    badgeLabel: 'Acceso revocado',
    badgeVariant: 'danger',
    description:
      'Google ha revocado el acceso o la carpeta de Drive ya no está disponible. Vuelve a conectar la cuenta para restablecer el acceso.',
    showDetails: false,
    primaryAction: 'connect',
    connectLabel: 'Reconectar',
    showDisconnect: false,
  },
  unreadable_token: {
    badgeLabel: 'Configuración dañada',
    badgeVariant: 'danger',
    description:
      'No se ha podido leer la configuración local de la conexión con Google Drive. Vuelve a conectar la cuenta para solucionarlo.',
    showDetails: false,
    primaryAction: 'connect',
    connectLabel: 'Reconectar',
    showDisconnect: false,
  },
  google_unavailable: {
    badgeLabel: 'Comprobación no disponible',
    badgeVariant: 'neutral',
    description:
      'No se ha podido comprobar el estado de Google Drive en este momento. Puede ser un problema temporal de conexión — no significa que el acceso se haya perdido.',
    showDetails: false,
    primaryAction: 'retry',
    connectLabel: '',
    showDisconnect: false,
  },
}

const props = withDefaults(
  defineProps<{
    status: DriveStatus
    isConnecting: boolean
    isDisconnecting: boolean
    connectError?: string
    disconnectError?: string
  }>(),
  {
    connectError: '',
    disconnectError: '',
  },
)

const emit = defineEmits<{ connect: []; retry: []; disconnect: [] }>()

const config = computed(() => STATE_CONFIG[props.status.state])

const connectActionLabel = computed(() => {
  if (props.isConnecting) return 'Redirigiendo a Google…'
  return config.value.connectLabel
})

const formattedConnectedAt = computed(() => {
  if (!props.status.connectedAt) return ''
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' }).format(
    new Date(props.status.connectedAt),
  )
})
</script>

<template>
  <div class="drive-status-card">
    <span
      class="drive-status-card__badge"
      :class="`drive-status-card__badge--${config.badgeVariant}`"
    >
      {{ config.badgeLabel }}
    </span>

    <dl v-if="config.showDetails" class="drive-status-card__details">
      <div class="drive-status-card__detail">
        <dt>Conectado desde</dt>
        <dd>{{ formattedConnectedAt }}</dd>
      </div>
      <div class="drive-status-card__detail">
        <dt>Carpeta raíz</dt>
        <dd class="drive-status-card__mono">{{ status.rootFolderId }}</dd>
      </div>
    </dl>
    <p v-else class="drive-status-card__hint">{{ config.description }}</p>

    <AlertMessage v-if="connectError" variant="error">{{ connectError }}</AlertMessage>
    <AlertMessage v-if="disconnectError" variant="error">{{ disconnectError }}</AlertMessage>

    <div class="drive-status-card__actions">
      <button
        v-if="config.primaryAction === 'connect'"
        type="button"
        class="drive-action drive-action--primary"
        :disabled="isConnecting || isDisconnecting"
        :aria-busy="isConnecting"
        @click="emit('connect')"
      >
        {{ connectActionLabel }}
      </button>

      <button
        v-else
        type="button"
        class="drive-action drive-action--primary"
        @click="emit('retry')"
      >
        Reintentar comprobación
      </button>

      <button
        v-if="config.showDisconnect"
        type="button"
        class="drive-action drive-action--danger"
        :disabled="isDisconnecting || isConnecting"
        :aria-busy="isDisconnecting"
        @click="emit('disconnect')"
      >
        Desconectar
      </button>
    </div>
  </div>
</template>

<style scoped>
.drive-status-card {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 1.25rem;
}

.drive-status-card__badge {
  align-self: flex-start;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

/* Fondos con un tinte muy suave (6%) para que el texto del propio color
   semántico mantenga un contraste AA (>=4.5:1) sobre el badge. */
.drive-status-card__badge--success {
  background: color-mix(in srgb, var(--success) 6%, white);
  color: var(--success);
}

.drive-status-card__badge--danger {
  background: color-mix(in srgb, var(--danger) 6%, white);
  color: var(--danger);
}

.drive-status-card__badge--neutral {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.drive-status-card__hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.drive-status-card__details {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.drive-status-card__detail {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.88rem;
}

.drive-status-card__detail dt {
  color: var(--text-secondary);
}

.drive-status-card__detail dd {
  margin: 0;
  color: var(--text-primary);
  text-align: right;
}

.drive-status-card__mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8rem;
  word-break: break-all;
}

.drive-status-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.drive-action {
  min-height: 44px;
  padding: 0.55rem 1.1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
}

.drive-action--primary {
  background: var(--accent);
  color: white;
}

.drive-action--primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.drive-action--danger {
  background: var(--bg-surface);
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
}

.drive-action--danger:hover:not(:disabled) {
  background: var(--danger-soft);
}

.drive-action:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
