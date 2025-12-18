<!--
  PaymentErrorView
  =================
  Vue view that will replace front/payment-error.html.

  Responsibilities (to implement later):
  - Show a clear error message when payment fails or is canceled.
  - Optionally display:
    - Partner order id or token if available from query/session.
    - Short explanation of what went wrong, using information from URL or API.
  - Provide navigation actions:
    - Button to go back to the booking form.
    - Link to retry payment or contact support.
  - Maintain visual consistency with other views (AppShell, cards, buttons).
-->

<template>
  <section class="workspace__content payment-error-view">
    <section class="card error-card">
      <div
        class="error-icon"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 48 48"
          fill="none"
          role="img"
          focusable="false"
        >
          <circle
            cx="24"
            cy="24"
            r="20"
            stroke="#b91c1c"
            stroke-width="3"
            fill="#fee2e2"
          />
          <path
            d="M18 18l12 12M30 18L18 30"
            stroke="#b91c1c"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <h2>Erreur de paiement</h2>

      <p class="error-message">
        Votre paiement n’a pas pu être finalisé ou a été annulé.
      </p>
      <p class="muted">
        Vous pouvez réessayer ou revenir au formulaire de réservation
        pour choisir un autre moyen de paiement.
      </p>

      <div class="error-actions">
        <button
          type="button"
          class="primary"
          @click="retryPayment"
        >
          Réessayer le paiement
        </button>
        <button
          type="button"
          class="secondary"
          @click="backToBooking"
        >
          Retourner à la réservation
        </button>
      </div>
    </section>
  </section>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function backToBooking() {
  router.push({ name: 'booking' })
}

function retryPayment() {
  // For now, retry simply returns to the booking page,
  // where the user can relaunch the payment flow.
  backToBooking()
}
</script>

<style scoped>
.payment-error-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 2rem;
}

.error-card {
  text-align: center;
  padding: 2rem;
  gap: 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.error-icon {
  width: 96px;
  height: 96px;
  border-radius: 999px;
  background: #fee2e2;
  border: 1px solid #fecaca;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-message {
  font-size: 1.05rem;
  color: #0f172a;
  margin: 0;
}

.error-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 1rem;
}
</style>
