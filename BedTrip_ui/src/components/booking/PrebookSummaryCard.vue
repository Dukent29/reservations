<!--
  PrebookSummaryCard
  ==================
  Component to display prebook token, partner order id, hotel name,
  hotel details, and stay summary, similar to the card at the top
  of front/booking.html and front/payment-success.html.

  Responsibilities:
  - Show:
    - Prebook token (code).
    - Partner order id with copy button.
    - Hotel name and details (city, dates, etc.).
    - One or more room summary cards with price and guest info.
  - Emit events for:
    - Refreshing form data.
    - Copying partner order id.
  - Receive prebook summary data via props (instead of reading from DOM).
-->

<template>
  <section class="card booking-panel">
    <!-- Token + refresh button row -->
    <!-- Booking status text -->
    <!-- Booking summary (partner order id, hotel details, stay summary cards) -->
  </section>
</template>

<script setup>
// Future props:
// - token: current prebook token string.
// - partnerOrderId: string or null.
// - hotelSummary: object with name, details text.
// - rooms: array of room summary objects (guests, price, meal, etc.).
// - status: message + type (info/error).
// Future emits:
// - "refresh" when user clicks the refresh button.
// - "copy-partner-id" when user clicks the copy button.
</script>

<style scoped>
/* This component will share `.card`, `.booking-panel`, `.booking-status`,
   `.booking-summary`, `.summary-grid`, `.summary-card` styles from global CSS. */
</style>

