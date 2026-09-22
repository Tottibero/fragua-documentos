<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{
  title: string
  updatedAt: string
}>()
</script>

<template>
  <main class="legal-page">
    <header class="legal-page__header">
      <RouterLink class="legal-page__brand" :to="{ name: 'login' }" aria-label="Ir al acceso de Fragua Documentos">
        <img src="/fragua47docs.png" alt="Fragua 47" class="legal-page__logo" />
        <span>Fragua Documentos</span>
      </RouterLink>
    </header>

    <article class="legal-page__article" aria-labelledby="legal-page-title">
      <p class="legal-page__context">Información legal</p>
      <h1 id="legal-page-title" class="legal-page__title">{{ title }}</h1>
      <p class="legal-page__updated">Última actualización: {{ updatedAt }}</p>
      <div class="legal-page__content">
        <slot />
      </div>
    </article>

    <footer class="legal-page__footer">
      <nav class="legal-page__links" aria-label="Enlaces legales">
        <RouterLink :to="{ name: 'privacy' }">Privacidad</RouterLink>
        <RouterLink :to="{ name: 'terms' }">Condiciones de uso</RouterLink>
      </nav>
      <p>Asociación Cultural Fragua 47</p>
    </footer>
  </main>
</template>

<style scoped>
.legal-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: clamp(1.25rem, 4vw, 3.5rem);
  background: var(--bg-base);
}

.legal-page__header,
.legal-page__article,
.legal-page__footer {
  width: min(100%, 46rem);
  margin-inline: auto;
}

.legal-page__brand {
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  color: var(--text-primary);
  font-size: 0.95rem;
  font-weight: 700;
  text-decoration: none;
}

.legal-page__logo {
  width: 2.15rem;
  height: 2.15rem;
  object-fit: contain;
}

.legal-page__article {
  flex: 1;
  margin-top: clamp(3.75rem, 10vw, 7rem);
  margin-bottom: 4rem;
}

.legal-page__context {
  margin: 0 0 0.8rem;
  color: var(--accent-text);
  font-size: 0.83rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.legal-page__title {
  margin: 0;
  color: var(--text-primary);
  font-size: clamp(2.25rem, 7vw, 4.4rem);
  letter-spacing: -0.04em;
  line-height: 0.98;
}

.legal-page__updated {
  margin: 1.25rem 0 0;
  color: var(--text-muted);
  font-size: 0.92rem;
}

.legal-page__content {
  margin-top: 3.5rem;
  color: var(--text-secondary);
  font-size: 1rem;
  line-height: 1.75;
}

.legal-page__content :deep(h2) {
  margin: 3rem 0 0.8rem;
  color: var(--text-primary);
  font-size: 1.35rem;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.legal-page__content :deep(h2:first-child) {
  margin-top: 0;
}

.legal-page__content :deep(p),
.legal-page__content :deep(ul) {
  margin: 0 0 1.1rem;
}

.legal-page__content :deep(ul) {
  padding-left: 1.25rem;
}

.legal-page__content :deep(a) {
  color: var(--accent-text);
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
}

.legal-page__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.85rem;
}

.legal-page__footer p {
  margin: 0;
}

.legal-page__links {
  display: flex;
  gap: 1.1rem;
}

.legal-page__links a {
  color: inherit;
  text-underline-offset: 0.18em;
}

@media (max-width: 520px) {
  .legal-page__footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
