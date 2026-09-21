<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import ToastContainer from '@/components/common/ToastContainer.vue'

const isNavOpen = ref(false)

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isNavOpen.value) {
    isNavOpen.value = false
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="app-shell">
    <AppHeader :nav-open="isNavOpen" @toggle-nav="isNavOpen = !isNavOpen" />
    <div class="app-shell__body">
      <AppSidebar :open="isNavOpen" @close="isNavOpen = false" />
      <main class="app-shell__content">
        <router-view />
      </main>
    </div>
    <ToastContainer />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-shell__body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.app-shell__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  min-width: 0;
}

@media (max-width: 768px) {
  .app-shell__content {
    padding: 1rem;
  }
}
</style>
