<template>
  <section class="workspace__content booking-finished-view">
    <section class="card confirmation-card">
      <div
        class="confirmation-icon"
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
            stroke="#16a34a"
            stroke-width="3"
            fill="#dcfce7"
          />
          <path
            d="M16 24.5l6 6L34 18"
            stroke="#15803d"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <h2>Réservation confirmée</h2>
      <p class="confirmation-message">
        {{ confirmationMessage }}
      </p>

      <div class="confirmation-details">
        <div class="summary-card">
          <p class="muted" style="margin:0;">Référence partenaire</p>
          <strong>{{ partnerOrderId || '-' }}</strong>
        </div>
        <div class="summary-card">
          <p class="muted" style="margin:0;">Référence fournisseur</p>
          <strong>{{ supplierReference || 'Disponible prochainement' }}</strong>
        </div>
      </div>

      <p class="muted redirect-hint">
        Redirection dans
        <span class="redirect-countdown">{{ countdown }}</span>s
        vers {{ targetLabel }}.
      </p>

      <div class="confirmation-actions">
        <button
          class="primary"
          type="button"
          @click="goToNext"
        >
          Retourner maintenant
        </button>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const partnerOrderId = ref('')
const supplierReference = ref('')
const countdown = ref(6)
const targetLabel = ref('la page de réservation')
const nextPath = ref('/booking')

let timerId = null

const confirmationMessage = computed(() =>
  supplierReference.value
    ? `Référence fournisseur : ${supplierReference.value}.`
    : 'La référence fournisseur sera disponible prochainement.',
)

function hydrateFromQuery() {
  const query = route.query || {}
  partnerOrderId.value = String(
    query.partner_order_id || query.partnerOrderId || '',
  ).trim()
  supplierReference.value = String(
    query.supplier_reference || query.supplierReference || '',
  ).trim()
  targetLabel.value = String(
    query.next_label || 'la page de réservation',
  ).trim()
  const rawDelay = Number(query.delay)
  countdown.value =
    Number.isFinite(rawDelay) && rawDelay > 0
      ? Math.min(Math.round(rawDelay), 60)
      : 6
  const hintedNext = query.next
  nextPath.value =
    typeof hintedNext === 'string' && hintedNext
      ? hintedNext
      : '/booking'
}

function goToNext() {
  if (typeof window !== 'undefined' && timerId) {
    window.clearTimeout(timerId)
    timerId = null
  }
  const target = nextPath.value && nextPath.value.startsWith('/')
    ? nextPath.value
    : '/booking'
  router.push(target)
}

function tickCountdown() {
  if (typeof window === 'undefined') return
  timerId = window.setTimeout(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      goToNext()
      return
    }
    tickCountdown()
  }, 1000)
}

onMounted(() => {
  hydrateFromQuery()
  tickCountdown()
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined' && timerId) {
    window.clearTimeout(timerId)
  }
})
</script>

<style scoped>
.confirmation-card {
  text-align: center;
  padding: 2rem;
  gap: 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.confirmation-icon {
  width: 96px;
  height: 96px;
  border-radius: 999px;
  background: #dcfce7;
  border: 1px solid #86efac;
  display: flex;
  align-items: center;
  justify-content: center;
}

.confirmation-message {
  font-size: 1.05rem;
  color: #0f172a;
  margin: 0;
}

.confirmation-details {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-top: 0.5rem;
}

.confirmation-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}

.redirect-hint {
  margin-top: 1rem;
}

.redirect-countdown {
  font-weight: 600;
  color: #0f172a;
}
</style>
