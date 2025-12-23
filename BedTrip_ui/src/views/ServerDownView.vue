<template>
  <section class="workspace__content server-down-view">
    <section class="card server-down-card">
      <p class="eyebrow">Connexion interrompue</p>
      <h2>Le serveur fait une pause</h2>
      <p class="muted">
        Pas de panique. Respirez un instant: votre prochaine reservation
        est en chemin. Essayez a nouveau dans quelques minutes.
      </p>
      <div class="server-down-actions">
        <button class="primary" type="button" @click="reloadPage">
          Reessayer
        </button>
        <RouterLink class="secondary-link" to="/">Retour a l'accueil</RouterLink>
      </div>
    </section>
  </section>
</template>

<script setup>
import { RouterLink } from 'vue-router'

function reloadPage() {
  window.location.reload()
}
</script>

<style scoped>
.server-down-view {
  align-items: center;
  justify-content: center;
  min-height: 50vh;
}

.server-down-card {
  max-width: 680px;
  width: min(100%, 680px);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.server-down-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.secondary-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
  padding: 0.65rem 1rem;
  text-decoration: none;
  font-size: 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.4);
  color: #e2e8f0;
  background: rgba(15, 23, 42, 0.6);
}
</style>
