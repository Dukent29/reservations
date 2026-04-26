<!--
  UnauthorizedView
  ================
  Public 401 page shown when authentication is missing or access is denied.

  Main responsibilities:
  - Explain that the requested area is not available to the current session.
  - Route users back to public pages instead of exposing protected UI.
  - Support failed admin access attempts with a clear status page.
  - Keep unauthorized states visually consistent with other error pages.
-->

<template>
  <section class="status-page status-page--unauthorized">
    <div class="status-page__frame">
      <div class="status-page__backdrop"></div>
      <div class="status-page__orb status-page__orb--left"></div>
      <div class="status-page__orb status-page__orb--right"></div>

      <div class="status-page__content">
        <p class="status-page__eyebrow">Error 401</p>
        <h1>Acces non autorise.</h1>
        <p class="status-page__lead">
          Cette zone n'est pas disponible pour votre session actuelle. Si vous cherchez le
          back-office, l'adresse publique ne vous y donnera pas acces directement.
        </p>

        <div class="status-page__actions">
          <RouterLink class="status-page__button status-page__button--primary" to="/">
            Revenir a l'accueil
          </RouterLink>
          <RouterLink class="status-page__button status-page__button--ghost" to="/blog">
            Ouvrir le blog
          </RouterLink>
        </div>

        <div class="status-page__hint">
          <span class="status-page__code">/401</span>
          <span>Authentification requise ou acces refuse pour cette ressource.</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.status-page {
  display: grid;
  min-height: calc(100vh - 12rem);
}

.status-page__frame {
  position: relative;
  overflow: hidden;
  border-radius: 2rem;
  min-height: clamp(28rem, 72vh, 44rem);
  padding: clamp(1.4rem, 3vw, 2.8rem);
  display: flex;
  align-items: center;
  background:
    linear-gradient(140deg, rgba(10, 6, 22, 0.9) 0%, rgba(22, 11, 36, 0.78) 42%, rgba(15, 23, 42, 0.62) 100%),
    url('/images/404.jpg') center center / cover no-repeat;
  box-shadow: 0 40px 90px -32px rgba(15, 23, 42, 0.45);
  isolation: isolate;
}

.status-page__backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 18% 82%, rgba(255, 120, 120, 0.56) 0%, rgba(255, 120, 120, 0) 16rem),
    radial-gradient(circle at 88% 20%, rgba(252, 165, 165, 0.44) 0%, rgba(252, 165, 165, 0) 12rem),
    radial-gradient(circle at 74% 48%, rgba(196, 181, 253, 0.18) 0%, rgba(196, 181, 253, 0) 28rem);
  z-index: -3;
}

.status-page__orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(2px);
  z-index: -2;
}

.status-page__orb--left {
  width: clamp(6rem, 10vw, 9rem);
  height: clamp(6rem, 10vw, 9rem);
  left: clamp(-1rem, 1vw, 1rem);
  bottom: clamp(4rem, 10vw, 7rem);
  background: radial-gradient(circle at 35% 35%, #ffb2b2 0%, #ef4444 58%, rgba(239, 68, 68, 0.2) 100%);
}

.status-page__orb--right {
  width: clamp(4rem, 7vw, 6rem);
  height: clamp(4rem, 7vw, 6rem);
  right: clamp(-1rem, 1vw, 1rem);
  top: clamp(7rem, 16vw, 10rem);
  background: radial-gradient(circle at 35% 35%, #f9a8d4 0%, #e11d48 58%, rgba(225, 29, 72, 0.2) 100%);
}

.status-page__content {
  width: min(34rem, 100%);
  padding: clamp(1rem, 2vw, 1.4rem);
  border-radius: 1.75rem;
  background: linear-gradient(180deg, rgba(14, 8, 23, 0.64) 0%, rgba(14, 8, 23, 0.36) 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 20px 60px rgba(3, 7, 18, 0.26);
  backdrop-filter: blur(8px);
}

.status-page__eyebrow {
  margin: 0 0 0.8rem;
  color: #fda4af;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.status-page h1 {
  margin: 0;
  max-width: 10ch;
  color: #f8fafc;
  font-size: clamp(2.2rem, 5vw, 4.3rem);
  line-height: 0.95;
  letter-spacing: -0.05em;
}

.status-page__lead {
  margin: 1rem 0 0;
  max-width: 34rem;
  color: rgba(241, 245, 249, 0.85);
  font-size: clamp(0.98rem, 2vw, 1.12rem);
}

.status-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-top: 1.6rem;
}

.status-page__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 11rem;
  padding: 0.82rem 1.15rem;
  border-radius: 999px;
  text-decoration: none;
  font-weight: 700;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.status-page__button:hover,
.status-page__button:focus-visible {
  transform: translateY(-1px);
}

.status-page__button--primary {
  color: #111827;
  background: linear-gradient(135deg, #fecaca 0%, #fb7185 100%);
  box-shadow: 0 18px 40px -22px rgba(251, 113, 133, 0.9);
}

.status-page__button--ghost {
  color: #f8fafc;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.status-page__hint {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.7rem;
  margin-top: 1.5rem;
  color: rgba(226, 232, 240, 0.72);
  font-size: 0.92rem;
}

.status-page__code {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 4.4rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  color: #f8fafc;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-weight: 700;
  letter-spacing: 0.06em;
}

@media (max-width: 720px) {
  .status-page__frame {
    min-height: 34rem;
    align-items: flex-end;
  }

  .status-page__content {
    width: 100%;
  }

  .status-page__actions {
    flex-direction: column;
  }

  .status-page__button {
    width: 100%;
  }
}
</style>
