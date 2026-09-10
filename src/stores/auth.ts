import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authService } from '@/services/auth.service'
import type { LoginPayload, User, UserRole } from '@/types'

const TOKEN_KEY = 'fragua_documentos_token'
const USER_KEY = 'fragua_documentos_user'

const USER_ROLES: UserRole[] = ['superadmin', 'admin', 'user']

function isValidToken(value: string | null): value is string {
  return typeof value === 'string' && value.length > 0
}

function isValidUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.nickname === 'string' &&
    candidate.nickname.length > 0 &&
    typeof candidate.role === 'string' &&
    USER_ROLES.includes(candidate.role as UserRole)
  )
}

/**
 * Lee token y usuario de localStorage. La sesión solo se considera válida si
 * ambos están presentes y son coherentes con el contrato esperado; si uno de
 * los dos falta o está corrupto, se descartan ambos para evitar un estado
 * de autenticación a medias.
 */
function loadStoredSession(): { token: string | null; user: User | null } {
  const storedToken = localStorage.getItem(TOKEN_KEY)

  let storedUser: unknown = null
  const rawUser = localStorage.getItem(USER_KEY)
  if (rawUser) {
    try {
      storedUser = JSON.parse(rawUser)
    } catch {
      storedUser = null
    }
  }

  if (isValidToken(storedToken) && isValidUser(storedUser)) {
    return { token: storedToken, user: storedUser }
  }

  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  return { token: null, user: null }
}

export const useAuthStore = defineStore('auth', () => {
  const initialSession = loadStoredSession()
  const token = ref<string | null>(initialSession.token)
  const user = ref<User | null>(initialSession.user)

  const isAuthenticated = computed(() => isValidToken(token.value) && isValidUser(user.value))
  const isSuperAdmin = computed(() => user.value?.role === 'superadmin')

  function setSession(newToken: string, newUser: User) {
    token.value = newToken
    user.value = newUser
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(newUser))
  }

  async function login(payload: LoginPayload) {
    const { token: newToken, user: newUser } = await authService.login(payload)
    setSession(newToken, newUser)
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  return { token, user, isAuthenticated, isSuperAdmin, login, logout }
})
