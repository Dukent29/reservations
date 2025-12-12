<!--
  TravellerForm
  =============
  Component for the traveler details and payment method section
  from front/booking.html + front/booking.js.

  Responsibilities:
  - Render a form with:
    - Civility, full name, email.
    - Phone, notes.
    - Address line1, zip+city, country code.
    - Payment method radio buttons (Floa vs Systempay).
    - Floa product select dropdown (BC1XF, BC3XF, BC4XF).
  - Manage its own local form model using v-model.
  - Expose the full form data to the parent via:
    - v-model binding, or
    - emit("update:modelValue", payload) / emit("submit", payload).
  - Control visibility of Floa options depending on selected method.
-->

<template>
  <form class="card booking-form">
    <!-- Form fields for traveler and payment details will be implemented here. -->
  </form>
</template>

<script setup>
// Future props:
// - modelValue or initialTravelerData.
// - availableFloaProducts (codes and labels).
// Future emits:
// - "update:modelValue" or "change" with updated form data.
// - "submit" when the user clicks the main action button (e.g. "Payer").
</script>

<style scoped>
/* Form layout will reuse `.card`, `.row`, `label`, input styles from global CSS. */
</style>

