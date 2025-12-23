<template>
  <section class="workspace__content not-found-view">
    <section class="card not-found-card">
      <p class="eyebrow">Navigation protegee</p>
      <h2>Page introuvable</h2>
      <p class="muted">
        Cette route n'existe pas ou n'est pas disponible dans cette interface.
      </p>
      <div class="not-found-actions">
        <RouterLink class="primary-link" to="/">Retour a l'accueil</RouterLink>
        <RouterLink class="secondary-link" to="/results">Voir les recherches</RouterLink>
      </div>
    </section>
  </section>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.not-found-view {
  align-items: center;
  justify-content: center;
  min-height: 50vh;
}

.not-found-card {
  max-width: 640px;
  width: min(100%, 640px);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.not-found-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.primary-link,
.secondary-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
  padding: 0.65rem 1rem;
  text-decoration: none;
  font-size: 0.85rem;
}

.primary-link {
  background-color: rgba(37, 99, 235, 0.2);
  border: 1px solid rgba(96, 165, 250, 0.6);
  color: #ffffff;
  font-weight: 600;
}

.secondary-link {
  border: 1px solid rgba(148, 163, 184, 0.4);
  color: #e2e8f0;
  background: rgba(15, 23, 42, 0.6);
}
</style>
