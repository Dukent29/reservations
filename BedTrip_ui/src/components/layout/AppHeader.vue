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
  <header class="app-header">
    <div class="brand">
      <p class="eyebrow">BedTrip · Sandbox</p>
      <h1>
        Console hôtelière B2B
        <span class="badge">interne</span>
      </h1>
      <p class="sub">
        Recherchez, consultez les détails et gérez les réservations dans un seul espace.
      </p>
    </div>

    <div class="header-actions">
      <nav
        class="header-links"
        aria-label="Navigation produits"
      >
        <RouterLink
          class="header-link"
          to="/"
          aria-label="Retour accueil"
          title="Retour accueil"
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

      <div class="language-switch">
        <span>Langue</span>
        <select>
          <option value="fr" selected>Français</option>
          <option value="en">English</option>
        </select>
      </div>
    </div>
  </header>
</template>

<script setup>
// Static header for now; can be made dynamic (props/slots) later.
</script>

<style scoped>
.header-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.75rem;
}

.header-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

.header-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: rgba(15, 23, 42, 0.8);
  color: #e2e8f0;
  font-size: 0.75rem;
  text-decoration: none;
  white-space: nowrap;
}

.header-link--active {
  border-color: rgba(34, 197, 94, 0.65);
  background: rgba(22, 163, 74, 0.12);
  color: #bbf7d0;
}

.header-link__icon {
  font-size: 0.9rem;
}

.header-link__icon--active {
  color: #4ade80;
}

.header-link__label {
  font-weight: 500;
}

.language-switch {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: #94a3b8;
}

.language-switch select {
  min-width: 140px;
}
</style>
