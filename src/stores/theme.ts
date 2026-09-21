import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'

export type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'fragua-documentos-theme'

function getInitialTheme(): Theme {
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Preferencia visual del usuario, persistida localmente y reflejada en el
 * atributo raíz que consumen todos los tokens CSS. */
export const useThemeStore = defineStore('theme', () => {
  const theme = shallowRef<Theme>('light')
  const isDark = computed(() => theme.value === 'dark')

  function apply(nextTheme: Theme) {
    theme.value = nextTheme
    document.documentElement.dataset.theme = nextTheme
    document.documentElement.style.colorScheme = nextTheme
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
  }

  function initialize() {
    apply(getInitialTheme())
  }

  function toggle() {
    apply(isDark.value ? 'light' : 'dark')
  }

  return { theme, isDark, initialize, toggle }
})
