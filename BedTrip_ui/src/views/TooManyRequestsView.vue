<!--
  TooManyRequestsView
  ===================
  Public 429 page shown when request rate limiting blocks an action.

  Main responsibilities:
  - Explain that the current session or IP has sent too many requests.
  - Give users safe navigation away from the blocked action.
  - Avoid retry loops that would immediately hit the rate limiter again.
  - Keep the error state consistent with other public status pages.
-->

<template>
  <section class="status-page status-page--limit">
    <div class="status-page__frame">
      <div class="status-page__backdrop"></div>
      <div class="status-page__orb status-page__orb--left"></div>
      <div class="status-page__orb status-page__orb--right"></div>

      <div class="status-page__content">
        <p class="status-page__eyebrow">Error 429</p>
        <h1>Trop de tentatives.</h1>
        <p class="status-page__lead">
          Le systeme a temporairement bloque les requetes pour proteger le back-office.
          Patientez quelques minutes avant de reessayer.
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
          <span class="status-page__code">/429</span>
          <span>Rate limit active. Attendez avant une nouvelle tentative.</span>
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
    linear-gradient(140deg, rgba(20, 10, 8, 0.9) 0%, rgba(35, 16, 10, 0.78) 42%, rgba(15, 23, 42, 0.62) 100%),
    url('/images/404.jpg') center center / cover no-repeat;
  box-shadow: 0 40px 90px -32px rgba(15, 23, 42, 0.45);
  isolation: isolate;
}

.status-page__backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 18% 82%, rgba(251, 191, 36, 0.56) 0%, rgba(251, 191, 36, 0) 16rem),
    radial-gradient(circle at 88% 20%, rgba(251, 146, 60, 0.5) 0%, rgba(251, 146, 60, 0) 12rem),
    radial-gradient(circle at 74% 48%, rgba(250, 204, 21, 0.18) 0%, rgba(250, 204, 21, 0) 28rem);
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
  background: radial-gradient(circle at 35% 35%, #fde68a 0%, #f59e0b 58%, rgba(245, 158, 11, 0.2) 100%);
}

.status-page__orb--right {
  width: clamp(4rem, 7vw, 6rem);
  height: clamp(4rem, 7vw, 6rem);
  right: clamp(-1rem, 1vw, 1rem);
  top: clamp(7rem, 16vw, 10rem);
  background: radial-gradient(circle at 35% 35%, #fdba74 0%, #f97316 58%, rgba(249, 115, 22, 0.2) 100%);
}

.status-page__content {
  width: min(34rem, 100%);
  padding: clamp(1rem, 2vw, 1.4rem);
  border-radius: 1.75rem;
  background: linear-gradient(180deg, rgba(26, 14, 7, 0.64) 0%, rgba(26, 14, 7, 0.36) 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 20px 60px rgba(3, 7, 18, 0.26);
  backdrop-filter: blur(8px);
}

.status-page__eyebrow {
  margin: 0 0 0.8rem;
  color: #fdba74;
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
  background: linear-gradient(135deg, #fde68a 0%, #fb923c 100%);
  box-shadow: 0 18px 40px -22px rgba(249, 115, 22, 0.9);
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
