<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { CalendarDays, Folder, Sparkles, Trash2, type LucideIcon } from '@lucide/vue'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

// Mismo tamaño y grosor que fija internamente IconButton — coherente con el
// resto de iconos de la aplicación.
const NAV_ICON_SIZE = 18
const NAV_ICON_STROKE_WIDTH = 1.75

const props = defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()

// La configuración de Google Drive (antes "Google Drive" aquí, solo para
// superadmin) vive ahora como acceso de icono junto al usuario en el
// encabezado — este menú solo enumera secciones de navegación, iguales para
// cualquier rol. "Papelera" (fase 2.5) es una lista plana de elementos
// eliminados dentro de `rootFolderId`, sin ningún acceso a niveles de Drive
// por encima de la raíz gestionada. "Reuniones" (fase 3.1a) no depende de
// Drive: vive en PostgreSQL y no tiene restricción de rol en frontend.
const navItems: NavItem[] = [
  { to: '/documents', label: 'Documentos', icon: Folder },
  { to: '/meetings', label: 'Reuniones', icon: CalendarDays },
  { to: '/dynamics', label: 'Dinámicas', icon: Sparkles },
  { to: '/trash', label: 'Papelera', icon: Trash2 },
]

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
          <component
            :is="item.icon"
            class="app-sidebar__icon"
            :size="NAV_ICON_SIZE"
            :stroke-width="NAV_ICON_STROKE_WIDTH"
            aria-hidden="true"
          />
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
  gap: 0.6rem;
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

.app-sidebar__icon {
  flex-shrink: 0;
}

.app-sidebar__link:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.app-sidebar__link.router-link-active {
  background: var(--accent-soft);
  color: var(--accent-text);
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
