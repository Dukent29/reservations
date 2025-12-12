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
/* This component will rely on global `.app-header`, `.brand`, `.eyebrow`, `.badge` styles
   defined in a shared stylesheet for consistent look and feel. */
</style>
