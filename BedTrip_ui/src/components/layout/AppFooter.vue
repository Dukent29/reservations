<template>
  <footer class="app-footer">
    <div class="app-footer__inner">
      <div class="footer-navigation">
        <div class="app-footer__brand">
          <div class="app-footer__brand-title">
            <img
              class="app-footer__logo"
              src="/images/bedtrip-white-logo.png"
              alt=""
              aria-hidden="true"
            />
            <strong>BedTrip</strong>
          </div>
          <span class="app-footer__tagline">
            Hôtels pour particuliers et professionnels, avec paiement flexible.
          </span>
        </div>

        <div class="footer-links-group">
          <nav class="footer-column" aria-label="Navigation principale">
            <h3>Liens rapides</h3>
            <RouterLink class="footer-link" to="/">Accueil</RouterLink>
            <RouterLink class="footer-link" to="/blog">Blog</RouterLink>
            <RouterLink class="footer-link" to="/contact">Contact</RouterLink>
            <a
              class="footer-link"
              href="https://kotan-voyages.com"
              target="_blank"
              rel="noreferrer"
            >
              Acheter un billet
            </a>
          </nav>

          <nav class="footer-column" aria-label="Informations légales">
            <h3>Informations</h3>
            <RouterLink class="footer-link" to="/conditions">Conditions</RouterLink>
            <RouterLink class="footer-link" to="/mentions-legales">Mentions légales</RouterLink>
            <RouterLink class="footer-link" to="/politique-de-confidentialite">Confidentialité</RouterLink>
            <button
              class="footer-link footer-link--button"
              type="button"
              @click="cookieConsent.openPreferences"
            >
              Préférences cookies
            </button>
          </nav>
        </div>
      </div>

      <div class="footer-bottom">
        <span>© BedTrip 2026. Tous droits réservés.</span>
        <div class="footer-bottom__links" aria-label="Contact rapide">
          <a href="tel:+33235082249" aria-label="Téléphone BedTrip">
            <i class="pi pi-phone" aria-hidden="true"></i>
          </a>
          <a href="mailto:kotanvoyages@outlook.com" aria-label="Email BedTrip">
            <i class="pi pi-envelope" aria-hidden="true"></i>
          </a>
          <RouterLink to="/contact" aria-label="Page contact BedTrip">
            <i class="pi pi-send" aria-hidden="true"></i>
          </RouterLink>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { useCookieConsentStore } from '../../stores/cookieConsent'

const cookieConsent = useCookieConsentStore()
</script>

<style scoped>
.app-footer {
  background: #101010;
  color: #f9fafb;
  padding: clamp(1.5rem, 3vw, 2.4rem) 0 1rem;
  border-radius: 0;
  width: 100vw;
  margin-left: calc(50% - 50vw);
}

.app-footer__inner {
  width: min(1440px, calc(100% - (var(--shell-pad, 1rem) * 2)));
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.footer-navigation {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: clamp(2rem, 7vw, 7rem);
}

.app-footer__brand {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  max-width: 22rem;
}

.app-footer__brand-title {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  color: #ffffff;
  font-size: 1.05rem;
}

.app-footer__logo {
  width: 2rem;
  height: 1.95rem;
  object-fit: contain;
  flex: 0 0 auto;
}

.app-footer__tagline {
  font-size: 0.84rem;
  line-height: 1.65;
  color: #cbd5e1;
}

.footer-links-group {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: clamp(2.5rem, 7vw, 6rem);
  flex: 1 1 auto;
}

.footer-column {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.footer-column h3 {
  margin: 0 0 0.45rem;
  color: #fca5a5;
  font-size: 0.74rem;
  line-height: 1.2;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.footer-link {
  width: fit-content;
  border: 0;
  background: transparent;
  color: #e5e7eb;
  font-size: 0.86rem;
  line-height: 1.35;
  text-align: left;
  text-decoration: none;
  padding: 0.1rem 0;
  transition: color 0.18s ease, transform 0.18s ease;
}

.footer-link--button {
  font-family: inherit;
  cursor: pointer;
}

.footer-link:hover,
.footer-link:focus-visible {
  color: #ffffff;
  transform: translateX(3px);
}

.footer-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(248, 250, 252, 0.12);
  color: #9ca3af;
  font-size: 0.78rem;
}

.footer-bottom__links {
  display: flex;
  gap: 0.55rem;
  align-items: center;
}

.footer-bottom__links a {
  width: 2rem;
  height: 2rem;
  border-radius: 8px;
  border: 1px solid rgba(248, 250, 252, 0.18);
  color: #f9fafb;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.footer-bottom__links a:hover,
.footer-bottom__links a:focus-visible {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(248, 250, 252, 0.42);
}

@media (max-width: 900px) {
  .footer-navigation {
    flex-direction: column;
    gap: 1.7rem;
  }

  .footer-links-group {
    width: 100%;
    justify-content: space-between;
    gap: 2rem;
  }
}

@media (max-width: 640px) {
  .footer-bottom {
    align-items: flex-start;
    flex-direction: column;
  }

  .footer-links-group {
    flex-direction: column;
    gap: 1.6rem;
  }
}
</style>
