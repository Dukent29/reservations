<!--
  AppHeader
  =========
  Shared header component for all views.

  Responsibilities:
  - Display brand information similar to front/booking.html + reservation hero:
    - Brand name ("Kotan Voyages · RateHawk sandbox" / "BedTrip").
    - Page title and subtitle, passed via props or slots.
    - Optional environment badge (e.g. "Sandbox", "Integration", "Production").
  - Provide a place for language selector and small header actions.
  - Remain visually consistent with `.app-header`, `.brand`, `.eyebrow`, `.badge`.
-->

<template>
  <header :class="['app-header', { 'app-header--compact': isCompact, 'app-header--menu-open': isMenuOpen }]">
    <div
      v-if="isMenuOpen"
      class="menu-backdrop"
      @click="closeMenu"
    ></div>
    <div class="header-actions">
      <div class="header-title">
        <h1>
          Console hôtelière B2B
          <span class="badge">interne</span>
        </h1>
      </div>
      <div class="header-right">
        <button
          type="button"
          class="menu-toggle"
          :aria-expanded="isMenuOpen"
          aria-label="Ouvrir le menu"
          @click="toggleMenu"
        >
          <i :class="isMenuOpen ? 'pi pi-times' : 'pi pi-bars'" aria-hidden="true"></i>
        </button>
        <nav
          class="header-links header-menu"
          aria-label="Navigation produits"
        >
          <div class="menu-header">
            <span>Menu</span>
            <button
              type="button"
              class="menu-close"
              aria-label="Fermer le menu"
              @click="closeMenu"
            >
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </div>
          <RouterLink
            class="header-link"
            to="/"
            aria-label="Retour accueil"
            title="Retour accueil"
            @click="closeMenu"
          >
            <i
              class="pi pi-home header-link__icon"
              aria-hidden="true"
            ></i>
            <span class="header-link__label">Accueil</span>
          </RouterLink>

          <span
            class="header-link header-link--active"
            aria-current="page"
          >
            <i
              class="pi pi-moon header-link__icon header-link__icon--active"
              aria-hidden="true"
            ></i>
            <span class="header-link__label">BedTrip</span>
          </span>

          <a
            class="header-link"
            href="https://kotan-voyages.com"
            target="_blank"
            rel="noreferrer"
            @click="closeMenu"
          >
            <i
              class="pi pi-send header-link__icon"
              aria-hidden="true"
            ></i>
            <span class="header-link__label">
              Acheter un billet (Gatefly)
            </span>
          </a>
        </nav>

        <button
          type="button"
          class="language-icon"
          aria-label="Langue"
          title="Langue"
        >
          <i class="pi pi-globe" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const isCompact = ref(false)
const isMenuOpen = ref(false)

const COMPACT_ON_SCROLL = 48
const COMPACT_OFF_SCROLL = 12
let isTicking = false

const updateCompactState = () => {
  const scrollY = window.scrollY || document.documentElement.scrollTop || 0
  if (!isCompact.value && scrollY > COMPACT_ON_SCROLL) {
    isCompact.value = true
  } else if (isCompact.value && scrollY < COMPACT_OFF_SCROLL) {
    isCompact.value = false
  }
}

const handleScroll = () => {
  if (isTicking) return
  isTicking = true
  window.requestAnimationFrame(() => {
    updateCompactState()
    isTicking = false
  })
}

const setBodyLock = (locked) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = locked ? 'hidden' : ''
}

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
  setBodyLock(isMenuOpen.value)
}

const closeMenu = () => {
  isMenuOpen.value = false
  setBodyLock(false)
}

onMounted(() => {
  updateCompactState()
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  setBodyLock(false)
})
</script>

<style scoped>
.header-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1rem;
  flex-wrap: nowrap;
  justify-content: space-between;
  width: 100%;
}

.header-title h1 {
  color: #a5141e;
  margin: 0;
  font-size: 1.2rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.header-links {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.5rem;
  justify-content: flex-end;
  align-items: center;
}

.header-title {
  flex: 0 0 auto;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: nowrap;
}



.header-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: transparent;
  color: #0f172a;
  font-size: 0.75rem;
  text-decoration: none;
  white-space: nowrap;
}

.header-link--active {
  border-color: #a5141e;
  background: rgba(165, 20, 30, 0.12);
  color: #a5141e;
}

.header-link__icon {
  font-size: 0.9rem;
}

.header-link__icon--active {
  color: #a5141e;
}

.header-link__label {
  font-weight: 500;
}

.language-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: #fff;
  color: #0f172a;
  font-size: 1rem;
}

.menu-toggle {
  display: none;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: #fff;
  color: #0f172a;
  border-radius: 0.8rem;
  padding: 0.35rem 0.5rem;
  font-size: 1rem;
}

.menu-header {
  display: none;
}

.menu-backdrop {
  display: none;
}

.app-header--compact .header-actions {
  gap: 0.4rem;
}

.app-header--compact .header-title h1 {
  font-size: 1.1rem;
  color: #ffffff;
}

.app-header--compact .brand .sub {
  display: none;
}

@media (max-width: 900px) {
  .menu-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .menu-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
    z-index: 10;
  }

  .app-header--menu-open .menu-backdrop {
    opacity: 1;
    pointer-events: auto;
  }

  .header-actions {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  .header-menu {
    position: fixed;
    top: 0;
    right: 0;
    height: 100vh;
    width: min(320px, 82vw);
    padding: calc(env(safe-area-inset-top) + 1rem) 1rem 1rem;
    background: #ffffff;
    border-left: 1px solid rgba(148, 163, 184, 0.3);
    box-shadow: -16px 0 40px -24px rgba(15, 23, 42, 0.5);
    transform: translateX(100%);
    transition: transform 0.25s ease;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    align-content: flex-start;
    gap: 0.6rem;
    z-index: 20;
    opacity: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 0.5rem;
  }

  .menu-close {
    border: 1px solid rgba(148, 163, 184, 0.45);
    background: #fff;
    color: #0f172a;
    border-radius: 0.75rem;
    padding: 0.3rem 0.5rem;
    font-size: 0.9rem;
  }

  .app-header--menu-open .header-menu {
    transform: translateX(0);
    opacity: 1;
    pointer-events: auto;
  }

  .header-link {
    justify-content: flex-start;
  }

  .language-icon {
    display: none;
  }

  .header-title h1 {
    font-size: 1.1rem;
  }

  .brand .sub {
    display: none;
  }
}
</style>
