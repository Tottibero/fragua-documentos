<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { isAxiosError } from 'axios'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AlertMessage from '@/components/common/AlertMessage.vue'

interface FieldErrors {
  identifier?: string
  password?: string
}

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const identifier = ref('')
const password = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')
const fieldErrors = ref<FieldErrors>({})

const identifierInput = ref<HTMLInputElement>()
const passwordInput = ref<HTMLInputElement>()

function validate(): boolean {
  const errors: FieldErrors = {}
  if (!identifier.value.trim()) {
    errors.identifier = 'Indica tu usuario o email.'
  }
  if (!password.value) {
    errors.password = 'Indica tu contraseña.'
  }
  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

async function handleSubmit() {
  if (isSubmitting.value) return
  errorMessage.value = ''

  if (!validate()) {
    await nextTick()
    if (fieldErrors.value.identifier) {
      identifierInput.value?.focus()
    } else if (fieldErrors.value.password) {
      passwordInput.value?.focus()
    }
    return
  }

  isSubmitting.value = true
  try {
    await authStore.login({ identifier: identifier.value.trim(), password: password.value })
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/documents'
    await router.replace(redirect)
  } catch (error) {
    if (isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 400)) {
      errorMessage.value = 'Usuario o contraseña incorrectos.'
    } else {
      errorMessage.value = 'No se ha podido conectar con el servidor. Inténtalo de nuevo.'
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <form class="login-card" novalidate @submit.prevent="handleSubmit">
      <h1 class="login-card__title">Fragua Documentos</h1>
      <p class="login-card__subtitle">Accede con tu cuenta de Fragua</p>

      <div class="field">
        <label for="identifier">Usuario o email</label>
        <input
          id="identifier"
          ref="identifierInput"
          v-model="identifier"
          type="text"
          autocomplete="username"
          required
          :aria-invalid="!!fieldErrors.identifier"
          :aria-describedby="fieldErrors.identifier ? 'identifier-error' : undefined"
          :disabled="isSubmitting"
        />
        <span v-if="fieldErrors.identifier" id="identifier-error" class="field-error">
          {{ fieldErrors.identifier }}
        </span>
      </div>

      <div class="field">
        <label for="password">Contraseña</label>
        <input
          id="password"
          ref="passwordInput"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          :aria-invalid="!!fieldErrors.password"
          :aria-describedby="fieldErrors.password ? 'password-error' : undefined"
          :disabled="isSubmitting"
        />
        <span v-if="fieldErrors.password" id="password-error" class="field-error">
          {{ fieldErrors.password }}
        </span>
      </div>

      <AlertMessage v-if="errorMessage" variant="error">{{ errorMessage }}</AlertMessage>

      <button type="submit" class="submit-button" :disabled="isSubmitting">
        {{ isSubmitting ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: var(--bg-base);
}

.login-card {
  width: 100%;
  max-width: 22rem;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 2rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.login-card__title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  text-align: center;
}

.login-card__subtitle {
  margin: -0.6rem 0 0;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.88rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.field input {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  font-size: 0.95rem;
  background: var(--bg-surface);
  color: var(--text-primary);
}

.field input:focus {
  border-color: var(--accent);
}

.field input:disabled {
  background: var(--bg-hover);
  color: var(--text-muted);
}

.field input[aria-invalid='true'] {
  border-color: var(--danger);
}

.field-error {
  font-size: 0.8rem;
  color: var(--danger);
}

.submit-button {
  margin-top: 0.25rem;
  padding: 0.65rem 1rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: white;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.submit-button:hover:not(:disabled) {
  background: var(--accent-hover);
}

.submit-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
