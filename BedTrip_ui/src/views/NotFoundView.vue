<!--
  NotFoundView
  ============
  Public fallback page for unmatched routes.

  Main responsibilities:
  - Explain that the requested URL does not exist or is no longer available.
  - Offer safe navigation back to the home page or blog.
  - Keep a branded error state instead of leaving users on a blank route.
  - Avoid making API calls for unknown routes.
-->

<template>
  <section class="not-found">
    <div class="not-found__frame">
      <div class="not-found__backdrop"></div>
      <div class="not-found__orb not-found__orb--left"></div>
      <div class="not-found__orb not-found__orb--right"></div>

      <div class="not-found__content">
        <p class="not-found__eyebrow">Error 404</p>
        <h1>Cette page s'est perdue en route.</h1>
        <p class="not-found__lead">
          L'adresse demandee n'existe pas ou n'est plus disponible. Retournez a la recherche
          d'hotels ou explorez les derniers contenus BedTrip.
        </p>

        <div class="not-found__actions">
          <RouterLink class="not-found__button not-found__button--primary" to="/">
            Revenir a l'accueil
          </RouterLink>
          <RouterLink class="not-found__button not-found__button--ghost" to="/blog">
            Ouvrir le blog
          </RouterLink>
        </div>

        <div class="not-found__hint">
          <span class="not-found__code">/404</span>
          <span>Verifiez l'URL ou repartez depuis la page d'accueil.</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.not-found {
  display: grid;
  min-height: calc(100vh - 12rem);
}

.not-found__frame {
  position: relative;
  overflow: hidden;
  border-radius: 2rem;
  min-height: clamp(28rem, 72vh, 44rem);
  padding: clamp(1.4rem, 3vw, 2.8rem);
  display: flex;
  align-items: center;
  background:
    linear-gradient(140deg, rgba(5, 10, 24, 0.88) 0%, rgba(9, 18, 38, 0.78) 38%, rgba(15, 23, 42, 0.58) 100%),
    url('/images/404.jpg') center center / cover no-repeat;
  box-shadow: 0 40px 90px -32px rgba(15, 23, 42, 0.45);
  isolation: isolate;
}

.not-found__backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 22% 84%, rgba(253, 126, 20, 0.7) 0%, rgba(253, 126, 20, 0) 18rem),
    radial-gradient(circle at 92% 24%, rgba(255, 109, 61, 0.72) 0%, rgba(255, 109, 61, 0) 14rem),
    radial-gradient(circle at 78% 48%, rgba(148, 163, 184, 0.16) 0%, rgba(148, 163, 184, 0) 28rem);
  z-index: -3;
}

.not-found__orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(2px);
  z-index: -2;
}

.not-found__orb--left {
  width: clamp(6rem, 10vw, 9rem);
  height: clamp(6rem, 10vw, 9rem);
  left: clamp(-1rem, 1vw, 1rem);
  bottom: clamp(4rem, 10vw, 7rem);
  background: radial-gradient(circle at 35% 35%, #ffb16a 0%, #ff6b35 58%, rgba(255, 107, 53, 0.2) 100%);
}

.not-found__orb--right {
  width: clamp(4rem, 7vw, 6rem);
  height: clamp(4rem, 7vw, 6rem);
  right: clamp(-1rem, 1vw, 1rem);
  top: clamp(7rem, 16vw, 10rem);
  background: radial-gradient(circle at 35% 35%, #ffc778 0%, #ff7b42 58%, rgba(255, 123, 66, 0.2) 100%);
}

.not-found__content {
  width: min(34rem, 100%);
  padding: clamp(1rem, 2vw, 1.4rem);
  border-radius: 1.75rem;
  background: linear-gradient(180deg, rgba(7, 11, 23, 0.6) 0%, rgba(7, 11, 23, 0.34) 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 20px 60px rgba(3, 7, 18, 0.26);
  backdrop-filter: blur(8px);
}

.not-found__eyebrow {
  margin: 0 0 0.8rem;
  color: #ffb36c;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.not-found h1 {
  margin: 0;
  max-width: 10ch;
  color: #f8fafc;
  font-size: clamp(2.2rem, 5vw, 4.3rem);
  line-height: 0.95;
  letter-spacing: -0.05em;
}

.not-found__lead {
  margin: 1rem 0 0;
  max-width: 34rem;
  color: rgba(241, 245, 249, 0.85);
  font-size: clamp(0.98rem, 2vw, 1.12rem);
}

.not-found__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-top: 1.6rem;
}

.not-found__button {
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

.not-found__button:hover,
.not-found__button:focus-visible {
  transform: translateY(-1px);
}

.not-found__button--primary {
  color: #111827;
  background: linear-gradient(135deg, #ffc978 0%, #ff8b4d 100%);
  box-shadow: 0 18px 40px -22px rgba(255, 139, 77, 0.9);
}

.not-found__button--ghost {
  color: #f8fafc;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.not-found__hint {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.7rem;
  margin-top: 1.5rem;
  color: rgba(226, 232, 240, 0.72);
  font-size: 0.92rem;
}

.not-found__code {
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
  .not-found__frame {
    min-height: 34rem;
    align-items: flex-end;
  }

  .not-found__content {
    width: 100%;
  }

  .not-found__actions {
    flex-direction: column;
  }

  .not-found__button {
    width: 100%;
  }
}
</style>
