<!--
  AppShell
  ========
  Root layout component for BedTrip UI.

  Responsibilities:
  - Wrap all pages in a consistent shell similar to `.app-shell` in front/public/style.css.
  - Render the main header (<AppHeader>) and optional footer (<AppFooter>).
  - Expose slots:
    - default: main content (views like BookingView, ReservationView, etc.).
    - header-extra: optional actions (language switch, environment badge).
  - Apply background effects and global padding as seen in the legacy front pages.
-->

<template>
  <div class="app-shell">
    <!-- App header (brand, navigation, environment info) -->
    <!-- Header is kept simple for now; can be expanded later. -->
    <AppHeader />

    <!-- Main content slot for current route/view -->
    <main class="workspace">
      <slot />
    </main>

    <!-- Optional footer with environment / legal information -->
    <AppFooter />
  </div>
</template>

<script setup>
import AppHeader from '../components/layout/AppHeader.vue'
import AppFooter from '../components/layout/AppFooter.vue'
</script>

<style scoped>
/* This component will adopt the global `.app-shell` and `.workspace` styles
   from a shared stylesheet; scoped rules here will be minimal. */
</style>
