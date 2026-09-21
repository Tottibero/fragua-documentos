<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { CloudCog, LogOut } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import IconButton from '@/components/common/IconButton.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'

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

    <router-link to="/documents" class="app-header__brand" aria-label="Ir a Documentos">
      <img src="/fragua47docs.png" alt="" class="app-header__logo" />
      <span>Fragua Documentos</span>
    </router-link>

    <div class="app-header__spacer"></div>

    <div v-if="authStore.user" class="app-header__user">
      <span class="app-header__user-info">
        <span class="app-header__nickname">{{ authStore.user.nickname }}</span>
        <span class="app-header__role">{{ authStore.user.role }}</span>
      </span>
      <ThemeToggle />
      <IconButton
        v-if="authStore.isSuperAdmin"
        :icon="CloudCog"
        label="Configurar Google Drive"
        :to="{ name: 'settings-drive' }"
      />
      <IconButton :icon="LogOut" label="Cerrar sesión" @click="handleLogout" />
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
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  text-decoration: none;
}

.app-header__logo {
  width: 38px;
  height: 38px;
  object-fit: contain;
}

.app-header__spacer {
  flex: 1;
}

.app-header__user {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

@media (max-width: 768px) {
  .nav-toggle {
    display: inline-flex;
  }

  .app-header__user-info {
    display: none;
  }

  .app-header__brand span {
    font-size: 0.96rem;
  }
}
</style>
