import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/AppShell.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: { name: 'documents' } },
        {
          path: 'documents',
          name: 'documents',
          component: () => import('@/views/DocumentsView.vue'),
        },
        {
          path: 'meetings',
          name: 'meetings',
          component: () => import('@/views/MeetingsView.vue'),
        },
        {
          path: 'meetings/:id',
          name: 'meeting-detail',
          component: () => import('@/views/MeetingDetailView.vue'),
        },
        {
          path: 'dynamics',
          name: 'dynamics',
          component: () => import('@/views/DynamicsView.vue'),
        },
        {
          path: 'dynamics/:id',
          name: 'dynamic-detail',
          component: () => import('@/views/DynamicDetailView.vue'),
        },
        {
          path: 'trash',
          name: 'trash',
          component: () => import('@/views/TrashView.vue'),
        },
        {
          path: 'settings/drive',
          name: 'settings-drive',
          component: () => import('@/views/DriveSettingsView.vue'),
          meta: { requiresSuperAdmin: true },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: { name: 'documents' } },
  ],
})

router.beforeEach((to) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresSuperAdmin && !authStore.isSuperAdmin) {
    return { name: 'documents' }
  }

  if (to.name === 'login' && authStore.isAuthenticated) {
    return { name: 'documents' }
  }

  return true
})

export default router
