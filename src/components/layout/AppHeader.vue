<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ navOpen: boolean }>()
const emit = defineEmits<{ 'toggle-nav': [] }>()

const authStore = useAuthStore()
const router = useRouter()

const navToggleLabel = computed(() =>
  props.navOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación',
)

function handleLogout() {
  authStore.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="app-header">
    <button
      type="button"
      class="nav-toggle"
      :aria-expanded="navOpen"
      aria-controls="app-sidebar-nav"
      :aria-label="navToggleLabel"
      @click="emit('toggle-nav')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" />
      </svg>
    </button>

    <span class="app-header__brand">Fragua Documentos</span>

    <div class="app-header__spacer"></div>

    <div v-if="authStore.user" class="app-header__user">
      <span class="app-header__user-info">
        <span class="app-header__nickname">{{ authStore.user.nickname }}</span>
        <span class="app-header__role">{{ authStore.user.role }}</span>
      </span>
      <button type="button" class="logout-button" @click="handleLogout">Cerrar sesión</button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1.25rem;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
}

.nav-toggle {
  display: none;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.nav-toggle svg {
  width: 18px;
  height: 18px;
}

.app-header__brand {
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: -0.01em;
}

.app-header__spacer {
  flex: 1;
}

.app-header__user {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.app-header__user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.25;
}

.app-header__nickname {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
}

.app-header__role {
  font-size: 0.72rem;
  color: var(--text-muted);
  text-transform: capitalize;
}

.logout-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-secondary);
  padding: 0.4rem 0.9rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.logout-button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .nav-toggle {
    display: inline-flex;
  }

  .app-header__user-info {
    display: none;
  }
}
</style>
