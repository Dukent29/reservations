<!--
  CookieBanner
  ============
  First-load consent prompt for BedTrip.

  Responsibilities:
  - Ask for necessary/preference cookie consent when no consent cookie exists.
  - Keep the choice actions close to the banner, without loading analytics or marketing scripts.
  - Delegate persistence to the Pinia cookie consent store and backend signed cookie.
-->

<template>
  <section
    v-if="cookieConsent.showBanner"
    class="cookie-banner"
    role="dialog"
    aria-label="Gestion des cookies"
  >
    <div class="cookie-banner__copy">
      <p class="cookie-banner__eyebrow">Confidentialité</p>
      <h2>Cookies BedTrip</h2>
      <p>
        Nous utilisons les cookies nécessaires au fonctionnement du site. Les cookies de
        préférence servent uniquement à retenir votre devise et votre langue.
      </p>
      <p v-if="cookieConsent.error" class="cookie-banner__error">
        Impossible de vérifier votre choix pour le moment. Vous pouvez réessayer.
      </p>
    </div>

    <div class="cookie-banner__actions" aria-label="Choix des cookies">
      <button
        class="cookie-banner__button cookie-banner__button--ghost"
        type="button"
        :disabled="cookieConsent.saving"
        @click="cookieConsent.rejectNonEssential"
      >
        Refuser le non essentiel
      </button>
      <button
        class="cookie-banner__button cookie-banner__button--ghost"
        type="button"
        :disabled="cookieConsent.saving"
        @click="cookieConsent.openPreferences"
      >
        Personnaliser
      </button>
      <button
        class="cookie-banner__button cookie-banner__button--primary"
        type="button"
        :disabled="cookieConsent.saving"
        @click="cookieConsent.acceptAll"
      >
        Tout accepter
      </button>
    </div>
  </section>
</template>

<script setup>
import { onMounted } from 'vue'
import { useCookieConsentStore } from '../../stores/cookieConsent'

const cookieConsent = useCookieConsentStore()

onMounted(() => {
  cookieConsent.loadConsent()
})
</script>

<style scoped>
.cookie-banner {
  position: fixed;
  right: clamp(1rem, 3vw, 2rem);
  bottom: clamp(1rem, 3vw, 2rem);
  z-index: 80;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: center;
  width: min(920px, calc(100vw - 2rem));
  padding: 1rem;
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 24px 70px -28px rgba(15, 23, 42, 0.55);
}

.cookie-banner__copy {
  display: grid;
  gap: 0.35rem;
}

.cookie-banner__eyebrow,
.cookie-banner__copy h2,
.cookie-banner__copy p {
  margin: 0;
}

.cookie-banner__eyebrow {
  color: #a5141e;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.cookie-banner__copy h2 {
  color: #111827;
  font-size: 1.05rem;
}

.cookie-banner__copy p {
  color: #475569;
  font-size: 0.85rem;
}

.cookie-banner__error {
  color: #991b1b;
  font-weight: 700;
}

.cookie-banner__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

.cookie-banner__button {
  width: auto;
  min-height: 2.35rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 800;
  white-space: nowrap;
}

.cookie-banner__button:disabled {
  cursor: wait;
  opacity: 0.68;
}

.cookie-banner__button--ghost {
  border-color: rgba(148, 163, 184, 0.65);
  background: #ffffff;
  color: #111827;
}

.cookie-banner__button--primary {
  border-color: #8c0f17;
  background: #a5141e;
  color: #ffffff;
}

@media (max-width: 760px) {
  .cookie-banner {
    left: 1rem;
    right: 1rem;
    grid-template-columns: 1fr;
  }

  .cookie-banner__actions {
    justify-content: stretch;
  }

  .cookie-banner__button {
    flex: 1 1 100%;
  }
}
</style>
