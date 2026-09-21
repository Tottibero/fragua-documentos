<script setup lang="ts">
import { computed } from 'vue'
import { Moon, Sun } from '@lucide/vue'
import IconButton from '@/components/common/IconButton.vue'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()

const toggleLabel = computed(() =>
  themeStore.isDark ? 'Activar modo claro' : 'Activar modo oscuro',
)
const toggleIcon = computed(() => (themeStore.isDark ? Sun : Moon))
</script>

<template>
  <IconButton :icon="toggleIcon" :label="toggleLabel" @click="themeStore.toggle" />
</template>
