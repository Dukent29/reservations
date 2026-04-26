<!--
  CookiePreferencesModal
  ======================
  Detailed cookie controls for BedTrip.

  Responsibilities:
  - Let users reopen and update their consent from the footer.
  - Persist only necessary and preference categories for now.
  - Keep analytics and marketing disabled until those systems are intentionally added.
-->

<template>
  <Teleport to="body">
    <div
      v-if="cookieConsent.showPreferences"
      class="cookie-modal"
      role="presentation"
      @click.self="cookieConsent.closePreferences"
    >
      <section
        class="cookie-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-preferences-title"
      >
        <header class="cookie-modal__header">
          <div>
            <p class="cookie-modal__eyebrow">Préférences</p>
            <h2 id="cookie-preferences-title">Gérer les cookies</h2>
          </div>
          <button
            class="cookie-modal__close"
            type="button"
            aria-label="Fermer les préférences cookies"
            @click="cookieConsent.closePreferences"
          >
            ×
          </button>
        </header>

        <div class="cookie-modal__body">
          <label class="cookie-choice">
            <span>
              <strong>Cookies nécessaires</strong>
              <small>Session, sécurité, réservation et protection CSRF.</small>
            </span>
            <input type="checkbox" checked disabled />
          </label>

          <label class="cookie-choice">
            <span>
              <strong>Cookies de préférence</strong>
              <small>Devise et langue utilisées pendant votre navigation.</small>
            </span>
            <input v-model="preferences" type="checkbox" />
          </label>

          <label class="cookie-choice cookie-choice--disabled">
            <span>
              <strong>Cookies analytiques</strong>
              <small>Non utilisés actuellement.</small>
            </span>
            <input type="checkbox" disabled />
          </label>

          <label class="cookie-choice cookie-choice--disabled">
            <span>
              <strong>Cookies marketing</strong>
              <small>Non utilisés actuellement.</small>
            </span>
            <input type="checkbox" disabled />
          </label>

          <p v-if="cookieConsent.error" class="cookie-modal__error">
            Votre choix n'a pas pu être enregistré. Réessayez dans un instant.
          </p>
        </div>

        <footer class="cookie-modal__footer">
          <button
            class="cookie-modal__button cookie-modal__button--ghost"
            type="button"
            :disabled="cookieConsent.saving"
            @click="cookieConsent.rejectNonEssential"
          >
            Refuser le non essentiel
          </button>
          <button
            class="cookie-modal__button cookie-modal__button--ghost"
            type="button"
            :disabled="cookieConsent.saving"
            @click="savePreferences"
          >
            Enregistrer
          </button>
          <button
            class="cookie-modal__button cookie-modal__button--primary"
            type="button"
            :disabled="cookieConsent.saving"
            @click="cookieConsent.acceptAll"
          >
            Tout accepter
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useCookieConsentStore } from '../../stores/cookieConsent'

const cookieConsent = useCookieConsentStore()
const preferences = ref(false)

watch(
  () => cookieConsent.showPreferences,
  (isOpen) => {
    if (isOpen) preferences.value = cookieConsent.preferencesEnabled
  },
)

function savePreferences() {
  return cookieConsent.saveConsent({ preferences: preferences.value })
}
</script>

<style scoped>
.cookie-modal {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.55);
}

.cookie-modal__panel {
  width: min(620px, 100%);
  max-height: min(720px, calc(100vh - 2rem));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 34px 90px -30px rgba(15, 23, 42, 0.65);
}

.cookie-modal__header,
.cookie-modal__footer {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
}

.cookie-modal__header {
  border-bottom: 1px solid rgba(148, 163, 184, 0.28);
}

.cookie-modal__footer {
  flex-wrap: wrap;
  border-top: 1px solid rgba(148, 163, 184, 0.28);
}

.cookie-modal__eyebrow,
.cookie-modal__header h2 {
  margin: 0;
}

.cookie-modal__eyebrow {
  color: #a5141e;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.cookie-modal__header h2 {
  color: #111827;
  font-size: 1.2rem;
}

.cookie-modal__close {
  width: 2.25rem;
  height: 2.25rem;
  display: inline-grid;
  place-items: center;
  padding: 0;
  border-radius: 8px;
  border-color: rgba(148, 163, 184, 0.55);
  background: #ffffff;
  cursor: pointer;
  color: #111827;
  font-size: 1.45rem;
  line-height: 1;
}

.cookie-modal__body {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  overflow: auto;
}

.cookie-choice {
  display: flex;
  gap: 0.85rem;
  align-items: center;
  justify-content: space-between;
  margin: 0;
  padding: 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.34);
  border-radius: 8px;
  color: #111827;
  cursor: pointer;
}

.cookie-choice span {
  display: grid;
  gap: 0.2rem;
}

.cookie-choice small {
  color: #64748b;
  font-size: 0.78rem;
}

.cookie-choice input {
  width: 1.2rem;
  height: 1.2rem;
  flex: 0 0 auto;
  accent-color: #a5141e;
  cursor: pointer;
}

.cookie-choice--disabled {
  color: #64748b;
  cursor: not-allowed;
}

.cookie-choice--disabled input {
  cursor: not-allowed;
}

.cookie-modal__error {
  margin: 0;
  color: #991b1b;
  font-size: 0.85rem;
  font-weight: 700;
}

.cookie-modal__button {
  width: auto;
  min-height: 2.35rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 800;
}

.cookie-modal__button:disabled {
  cursor: wait;
  opacity: 0.68;
}

.cookie-modal__button--ghost {
  border-color: rgba(148, 163, 184, 0.65);
  background: #ffffff;
  color: #111827;
}

.cookie-modal__button--primary {
  border-color: #8c0f17;
  background: #a5141e;
  color: #ffffff;
}

@media (max-width: 560px) {
  .cookie-modal__footer {
    display: grid;
  }

  .cookie-modal__button {
    width: 100%;
  }
}
</style>
