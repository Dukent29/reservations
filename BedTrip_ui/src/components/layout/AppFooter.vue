<!--
  AppFooter
  =========
  Shared footer for BedTrip UI.

  Responsibilities:
  - Show environment information (e.g. "Intégration", "Recette", "Production").
  - Display technical links (API documentation, support).
  - Remain visually light to not distract from main flows.
-->

<template>
  <footer class="app-footer">
    <div class="app-footer__inner">
      <div class="app-footer__brand">
        <strong>BedTrip</strong>
        <span class="app-footer__tagline">Particuliers et professionnels</span>
      </div>
      <nav class="app-footer__links" aria-label="Navigation du pied de page">
        <RouterLink class="footer-link" to="/">Accueil</RouterLink>
        <span class="footer-link footer-link--active" aria-current="page">BedTrip</span>
        <a
          class="footer-link"
          href="https://kotan-voyages.com"
          target="_blank"
          rel="noreferrer"
        >
          Acheter un billet (Gatefly)
        </a>
        <RouterLink class="footer-link" to="/mentions-legales">Mentions légales</RouterLink>
        <RouterLink class="footer-link" to="/politique-de-confidentialite">Confidentialité</RouterLink>
        <RouterLink class="footer-link" to="/conditions">Conditions</RouterLink>
        <RouterLink class="footer-link" to="/blog">Blog</RouterLink>
      </nav>
      <nav class="app-footer__links app-footer__links--destinations" aria-label="Destinations">
        <RouterLink
          v-for="item in destinationSeoItems"
          :key="item.slug"
          class="footer-link footer-link--destination"
          :to="`/destinations/${item.slug}`"
        >
          {{ item.country }}
        </RouterLink>
      </nav>
    </div>
    <div class="app-footer__meta">
      <small>Environnement de test · BedTrip UI</small>
    </div>
  </footer>
</template>

<script setup>
import { DESTINATION_SEO_ITEMS } from '../../data/seoDestinations'

const destinationSeoItems = DESTINATION_SEO_ITEMS
</script>

<style scoped>
.app-footer {
  background: #000814;
  color: #f9fafb;
  padding: 1rem 1.25rem;
  border-radius: 0;
  width: 100vw;
  margin-left: calc(50% - 50vw);
}

.app-footer__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.app-footer__brand {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.app-footer__tagline {
  font-size: 0.72rem;
  color: rgba(248, 250, 252, 0.7);
}

.app-footer__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: flex-end;
}

.app-footer__links--destinations {
  width: 100%;
  justify-content: flex-start;
}

.footer-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(226, 232, 240, 0.35);
  background: transparent;
  color: #f8fafc;
  font-size: 0.7rem;
  text-decoration: none;
  white-space: nowrap;
}

.footer-link:hover,
.footer-link:focus-visible {
  border-color: rgba(248, 250, 252, 0.75);
  background: rgba(248, 250, 252, 0.08);
}

.footer-link--active {
  border-color: rgba(248, 250, 252, 0.85);
  background: rgba(248, 250, 252, 0.15);
}

.footer-link--destination {
  border-color: rgba(226, 232, 240, 0.26);
  font-size: 0.68rem;
}

.app-footer__meta {
  margin-top: 0.75rem;
  font-size: 0.7rem;
  color: rgba(248, 250, 252, 0.65);
}

@media (max-width: 720px) {
  .app-footer__inner {
    align-items: flex-start;
  }

  .app-footer__links {
    justify-content: flex-start;
  }
}
</style>
