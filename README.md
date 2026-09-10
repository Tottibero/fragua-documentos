# fragua-documentos

Frontend independiente del gestor documental de Fragua47. Reutiliza únicamente la
autenticación del backend de `fragua-gestion/back`; no comparte código con
`fragua-gestion/front`.

Stack: Vue 3 (Composition API, `<script setup lang="ts">`), TypeScript, Vite, Pinia,
Vue Router, Axios.

## Comandos

```bash
pnpm install      # instalar dependencias
pnpm dev          # servidor de desarrollo (Vite)
pnpm build        # type-check (vue-tsc) + build de producción
pnpm preview      # previsualizar el build de producción
```

## Configuración

Copia `.env.example` a `.env` y ajusta si hace falta:

```bash
VITE_API_URL=http://localhost:3003/api
```

Por defecto apunta a la API de `fragua-gestion/back` (`http://localhost:3003/api`).

## Estado (Fase 1)

- Login contra `POST /auth/login` (`{ identifier, password }`), con persistencia de
  JWT y usuario, interceptor Bearer y cierre de sesión automático ante 401.
- Guard de rutas: `/documents` requiere sesión; `/login` redirige a `/documents` si ya
  hay sesión activa.
- App shell (cabecera + navegación lateral) y vista `/documents` con estado vacío —
  la conexión con Google Drive llegará en una fase posterior.
