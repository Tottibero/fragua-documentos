<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

interface NavItem {
  to: string
  label: string
}

const props = defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()

const authStore = useAuthStore()

const navItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [{ to: '/documents', label: 'Documentos' }]
  if (authStore.isSuperAdmin) {
    items.push({ to: '/settings/drive', label: 'Google Drive' })
  }
  return items
})

// El sidebar solo se convierte en panel off-canvas (y por tanto necesita
// quedar "inert" cuando está cerrado) por debajo de este ancho; en escritorio
// permanece siempre visible e interactivo, coincidiendo con la media query.
const MOBILE_QUERY = '(max-width: 768px)'
const isMobile = ref(false)
let mediaQuery: MediaQueryList | undefined

function handleMediaChange(event: MediaQueryListEvent) {
  isMobile.value = event.matches
}

onMounted(() => {
  mediaQuery = window.matchMedia(MOBILE_QUERY)
  isMobile.value = mediaQuery.matches
  mediaQuery.addEventListener('change', handleMediaChange)
})

onUnmounted(() => {
  mediaQuery?.removeEventListener('change', handleMediaChange)
})

const isInert = computed(() => isMobile.value && !props.open)
</script>

<template>
  <div v-if="open" class="sidebar-backdrop" @click="$emit('close')"></div>

  <nav
    id="app-sidebar-nav"
    class="app-sidebar"
    :class="{ 'app-sidebar--open': open }"
    :inert="isInert"
    aria-label="Navegación principal"
  >
    <ul class="app-sidebar__list">
      <li v-for="item in navItems" :key="item.to">
        <router-link :to="item.to" class="app-sidebar__link" @click="$emit('close')">
          {{ item.label }}
        </router-link>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.app-sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  padding: 1rem 0.75rem;
}

.app-sidebar__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.app-sidebar__link {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.92rem;
  font-weight: 500;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.app-sidebar__link:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.app-sidebar__link.router-link-active {
  background: var(--accent-soft);
  color: var(--accent-hover);
}

.sidebar-backdrop {
  display: none;
}

@media (max-width: 768px) {
  .app-sidebar {
    position: fixed;
    top: var(--header-height);
    left: 0;
    bottom: 0;
    z-index: 30;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: var(--shadow-md);
  }

  .app-sidebar--open {
    transform: translateX(0);
  }

  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: var(--header-height) 0 0 0;
    background: rgba(15, 18, 25, 0.35);
    z-index: 20;
  }
}
</style>
