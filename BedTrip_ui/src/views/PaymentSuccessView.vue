<template>
  <section class="workspace__content payment-success-view">
    <section class="card booking-panel">
      <div class="booking-intro">
        <div>
          <p class="muted" style="margin:0">Reference de commande partenaire</p>
          <code class="booking-token">{{ partnerOrderId || '-' }}</code>
        </div>
      </div>

      <div
        class="booking-status muted"
        :class="{
          error: statusType === 'error',
          success: statusType === 'success',
        }"
      >
        {{ statusMessage }}
      </div>

      <div v-if="isProcessing" class="payment-success-loader" aria-busy="true">
        <div class="payment-success-loader__spinner" aria-hidden="true"></div>
        <p class="muted">Traitement en cours, merci de patienter...</p>
      </div>

      <div
        v-if="hotelSummary || amountText"
        class="booking-summary"
      >
        <div class="summary-row">
          <div>
            <p class="muted" style="margin:0">Hotel</p>
            <strong>{{ hotelSummary?.name || '-' }}</strong>
            <p class="muted" style="margin:4px 0 0 0">
              {{ hotelSummary?.details || '' }}
            </p>
          </div>
        </div>
        <div class="summary-row">
          <div>
            <p class="muted" style="margin:0">Montant paye</p>
            <strong>{{ amountText || '-' }}</strong>
          </div>
        </div>
      </div>

      <p v-if="redirectCountdown > 0 && statusType === 'success'" class="muted redirect-hint">
        Redirection vers l'accueil dans {{ redirectCountdown }}s.
      </p>

      <div class="payment-success-actions">
        <button
          type="button"
          class="primary"
          @click="goHomeNow"
        >
          Retourner a l'accueil
        </button>
      </div>

      <details class="debug-panel" open>
        <summary>Debug</summary>
        <pre>booking/status request: {{ formatDebug(debugBookingStatusReq) }}</pre>
        <pre>booking/status response: {{ formatDebug(debugBookingStatusRes) }}</pre>
        <pre>booking/status error: {{ formatDebug(debugBookingStatusErr) }}</pre>
        <pre>booking/start request: {{ formatDebug(debugBookingStartReq) }}</pre>
        <pre>booking/start response: {{ formatDebug(debugBookingStartRes) }}</pre>
        <pre>booking/start error: {{ formatDebug(debugBookingStartErr) }}</pre>
      </details>
    </section>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { API_BASE } from '../services/httpClient.js'

const route = useRoute()
const router = useRouter()

const PREBOOK_SUMMARY_KEY = 'booking:lastPrebook'
const LAST_PARTNER_KEY = 'booking:lastPartnerOrderId'
const LAST_CUSTOMER_KEY = 'booking:lastCustomer'
const HOME_REDIRECT_DELAY_SECONDS = 6

const partnerOrderId = ref('')
const statusMessage = ref('')
const statusType = ref('info')
const isProcessing = ref(false)

const hotelSummary = ref(null)
const amountText = ref('')

const redirectCountdown = ref(0)
let redirectTimer = null

const contactEmail = ref('')
const contactPhone = ref('')
const contactComment = ref('')
const mainGuest = ref({ firstName: '', lastName: '' })

const debugBookingStartReq = ref(null)
const debugBookingStartRes = ref(null)
const debugBookingStartErr = ref(null)
const debugBookingStatusReq = ref(null)
const debugBookingStatusRes = ref(null)
const debugBookingStatusErr = ref(null)

const storedPrebookSummary = ref(null)
const storedPrebookPayload = ref(null)
const storedCustomer = ref(null)
const currentPaymentInfo = ref(null)
const bookingForm = ref(null)

const rawPartnerParam = computed(() =>
  String(route.query.partner_order_id || '').trim(),
)

const isKotanReturn = computed(() => {
  const provider = String(route.query.provider || route.query.payment_provider || '')
    .trim()
    .toLowerCase()
  return provider.includes('kotan')
})

function setStatus(message, type = 'info') {
  statusMessage.value = message || ''
  statusType.value = type
}

function formatDebug(value) {
  if (value == null) return '-'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatPrice(amount, currency) {
  const num = Number(amount)
  if (!Number.isFinite(num)) return amount || ''
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 2,
    }).format(num)
  } catch {
    return `${num} ${currency || ''}`.trim()
  }
}

function clearRedirectTimer() {
  if (!redirectTimer) return
  clearInterval(redirectTimer)
  redirectTimer = null
}

function startRedirectHome(delaySeconds = HOME_REDIRECT_DELAY_SECONDS) {
  clearRedirectTimer()
  redirectCountdown.value = Math.max(1, Number(delaySeconds) || HOME_REDIRECT_DELAY_SECONDS)
  redirectTimer = setInterval(() => {
    if (redirectCountdown.value <= 1) {
      clearRedirectTimer()
      router.push({ path: '/' })
      return
    }
    redirectCountdown.value -= 1
  }, 1000)
}

function goHomeNow() {
  clearRedirectTimer()
  router.push({ path: '/' })
}

function loadSessionData() {
  try {
    if (typeof window === 'undefined') return
    const ss = window.sessionStorage
    if (!ss) return

    const rawSummary = ss.getItem(PREBOOK_SUMMARY_KEY)
    if (rawSummary) {
      const parsed = JSON.parse(rawSummary)
      if (parsed?.summary || parsed?.payload) {
        storedPrebookSummary.value = parsed.summary || null
        storedPrebookPayload.value = parsed.payload || null
      } else {
        storedPrebookSummary.value = parsed
        storedPrebookPayload.value = parsed?.payload || null
      }
    }

    const rawCustomer = ss.getItem(LAST_CUSTOMER_KEY)
    if (rawCustomer) {
      storedCustomer.value = JSON.parse(rawCustomer)
    }
  } catch {
    storedPrebookSummary.value = storedPrebookSummary.value || null
    storedPrebookPayload.value = storedPrebookPayload.value || null
    storedCustomer.value = storedCustomer.value || null
  }
}

function derivePartnerOrderId() {
  const fromQuery = rawPartnerParam.value
  if (fromQuery) return fromQuery
  try {
    if (typeof window !== 'undefined') {
      const ss = window.sessionStorage
      if (!ss) return null
      const stored = ss.getItem(LAST_PARTNER_KEY)
      if (stored) return stored
    }
  } catch {
    // ignore
  }
  return null
}

function deriveSummaryFromBookingForm(form) {
  if (!form || storedPrebookSummary.value) return
  const hotel = form.hotel || form.hotel_info || form.hotel_data || form.item?.hotel || null

  const name = hotel?.name || form.hotel_name || form.hotelName || form.name || null
  const city = hotel?.city || hotel?.city_name || form.city || null
  const address = hotel?.address || hotel?.address_full || form.address || null
  const country = hotel?.country || hotel?.country_name || form.country || null

  const checkin = form.checkin || form.check_in || form.arrival_date || form.stay?.checkin || null
  const checkout = form.checkout || form.check_out || form.departure_date || form.stay?.checkout || null

  const paymentType = (Array.isArray(form.payment_types) && form.payment_types[0]) || form.payment_type || null
  const amount = paymentType?.amount || form.total_amount || form.order_amount || null
  const currency = paymentType?.currency_code || form.currency_code || form.currency || null

  if (name || city || address || country || checkin || checkout) {
    storedPrebookSummary.value = {
      hotel: { name, city, address, country },
      stay: { checkin, checkout, currency },
      room: { price: amount, currency },
    }
  }
}

function deriveHotelSummary() {
  if (!storedPrebookSummary.value && !storedPrebookPayload.value) return
  const summary = storedPrebookSummary.value || {}
  const hotel = summary.hotel || {}
  const stay = summary.stay || {}
  const room = summary.room || {}

  const name = hotel.name || 'Hotel non specifie'
  const city = hotel.city || null
  const address = hotel.address || null
  const country = hotel.country || null

  const checkin = stay.checkin || null
  const checkout = stay.checkout || null

  const parts = []
  if (address || city) {
    const locParts = [address, city].filter(Boolean)
    parts.push(locParts.join(', '))
  }
  if (checkin || checkout) {
    parts.push(`Sejour ${checkin || '?'} -> ${checkout || '?'}`)
  }
  if (!parts.length && country) {
    parts.push(country)
  }

  hotelSummary.value = {
    name,
    details: parts.join(' · '),
  }

  let amount = null
  let currency = null
  if (room && room.price) {
    amount = room.price
    currency = room.currency || stay.currency || null
  }
  if (
    currentPaymentInfo.value &&
    Number.isFinite(currentPaymentInfo.value.amount)
  ) {
    amount = currentPaymentInfo.value.amount
    currency =
      currentPaymentInfo.value.currency_code ||
      currentPaymentInfo.value.currencyCode ||
      currency
  }

  amountText.value = amount != null ? formatPrice(amount, currency || 'EUR') : ''
}

function applyCustomerDefaults(customer) {
  if (!customer) return
  const firstName = String(customer.firstName || customer.first_name || '').trim()
  const lastName = String(customer.lastName || customer.last_name || '').trim()
  const fullName = String(customer.fullName || '').trim()

  if (!mainGuest.value.firstName && !mainGuest.value.lastName) {
    if (firstName || lastName) {
      mainGuest.value.firstName = firstName
      mainGuest.value.lastName = lastName
    } else if (fullName) {
      const parts = fullName.split(' ')
      mainGuest.value.firstName = parts.shift() || ''
      mainGuest.value.lastName = parts.join(' ') || ''
    }
  }

  if (!contactEmail.value && customer.email) {
    contactEmail.value = customer.email
  }
  if (!contactPhone.value && customer.mobilePhoneNumber) {
    contactPhone.value = customer.mobilePhoneNumber
  }
  if (!contactPhone.value && customer.phone) {
    contactPhone.value = customer.phone
  }
}

function ensureFallbackCustomerDefaults() {
  if (!storedCustomer.value) return
  const full = String(storedCustomer.value.fullName || '').trim()
  if (!mainGuest.value.firstName && !mainGuest.value.lastName && full) {
    const parts = full.split(' ')
    mainGuest.value.firstName = parts.shift() || ''
    mainGuest.value.lastName = parts.join(' ') || ''
  }
  if (!contactEmail.value && storedCustomer.value.email) {
    contactEmail.value = storedCustomer.value.email
  }
  if (!contactPhone.value && storedCustomer.value.phone) {
    contactPhone.value = storedCustomer.value.phone
  }
}

async function syncKotanPaymentStatus(partnerId) {
  if (!partnerId || !isKotanReturn.value) return
  const endpoint = `${API_BASE}/api/payments/kotan/extern/info?ref=${encodeURIComponent(partnerId)}`
  try {
    const res = await fetch(endpoint)
    const payload = await res.json().catch(() => ({}))
    if (payload != null && typeof payload.redirect_to === 'string' && payload.redirect_to) {
      window.location.href = payload.redirect_to
    }
  } catch {
    // best-effort only
  }
}

function bookingAlreadyFinalized(statusPayload) {
  const booking = statusPayload?.booking || null
  const combined = String(statusPayload?.combined_status || '').toLowerCase()
  if (booking?.etg_order_id) return booking.etg_order_id
  if (combined === 'confirmed' || combined === 'completed' || combined === 'booked') {
    return booking?.etg_order_id || ''
  }
  return null
}

async function fetchBookingStatus(partnerId) {
  setStatus('Verification du paiement et du dossier de reservation...', 'info')
  const endpoint = `${API_BASE}/api/booking/status?partner_order_id=${encodeURIComponent(partnerId)}`
  debugBookingStatusReq.value = { partner_order_id: partnerId }
  debugBookingStatusErr.value = null
  const res = await fetch(endpoint)
  const payload = await res.json()
  debugBookingStatusRes.value = {
    status: res.status,
    ok: res.ok,
    payload,
  }
  if (!res.ok || payload?.status !== 'ok') {
    throw new Error(payload?.error || payload?.message || res.status)
  }

  currentPaymentInfo.value = payload.payment || null
  bookingForm.value = payload.booking_form && payload.booking_form.form ? payload.booking_form.form : null

  if (!storedPrebookSummary.value && payload.prebook_summary) {
    const prebook = payload.prebook_summary
    if (prebook.summary || prebook.payload) {
      storedPrebookSummary.value = prebook.summary || null
      storedPrebookPayload.value = prebook.payload || null
    } else {
      storedPrebookSummary.value = prebook
    }
  }

  deriveSummaryFromBookingForm(bookingForm.value)
  if (payload.customer) {
    applyCustomerDefaults(payload.customer)
  }
  ensureFallbackCustomerDefaults()
  deriveHotelSummary()

  return payload
}

function buildBookingStartBody() {
  const email = String(contactEmail.value || '').trim()
  const phone = String(contactPhone.value || '').trim()
  const comment = String(contactComment.value || '').trim() || null

  if (!email || !phone) {
    throw new Error('Informations client manquantes (email/telephone).')
  }

  const first_name = String(mainGuest.value.firstName || '').trim()
  const last_name = String(mainGuest.value.lastName || '').trim()
  const bookingFormPayment =
    bookingForm.value &&
    Array.isArray(bookingForm.value.payment_types) &&
    bookingForm.value.payment_types.length > 0
      ? bookingForm.value.payment_types[0]
      : null

  const amount =
    (currentPaymentInfo.value && currentPaymentInfo.value.amount) ||
    (bookingFormPayment && bookingFormPayment.amount) ||
    (storedPrebookSummary.value && storedPrebookSummary.value.room && storedPrebookSummary.value.room.price) ||
    null

  const currency =
    (currentPaymentInfo.value &&
      (currentPaymentInfo.value.currency_code || currentPaymentInfo.value.currencyCode)) ||
    (bookingFormPayment && bookingFormPayment.currency_code) ||
    (storedPrebookSummary.value && storedPrebookSummary.value.stay && storedPrebookSummary.value.stay.currency) ||
    'EUR'

  const paymentType = {
    type: bookingFormPayment?.type || 'deposit',
    amount:
      bookingFormPayment && bookingFormPayment.amount != null
        ? String(bookingFormPayment.amount)
        : amount != null
          ? String(amount)
          : '0',
    currency_code: bookingFormPayment?.currency_code || currency || 'EUR',
  }

  return {
    partner_order_id: partnerOrderId.value,
    language: 'fr',
    user: {
      email,
      phone,
      comment,
    },
    supplier_data: {
      first_name_original: first_name,
      last_name_original: last_name,
      phone,
      email,
    },
    rooms: [
      {
        guests: [
          {
            first_name,
            last_name,
          },
        ],
      },
    ],
    payment_type: paymentType,
  }
}

async function finalizeBookingAutomatically() {
  const body = buildBookingStartBody()
  debugBookingStartReq.value = body
  debugBookingStartErr.value = null

  setStatus('Paiement confirme. Finalisation de la reservation en cours...', 'info')

  const res = await fetch(`${API_BASE}/api/booking/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await res.json()
  debugBookingStartRes.value = {
    status: res.status,
    ok: res.ok,
    payload,
  }

  if (!res.ok || payload?.status !== 'ok') {
    const baseMessage = payload?.error || payload?.message || `HTTP ${res.status}`
    throw new Error(baseMessage)
  }
}

async function runPaymentSuccessFlow() {
  loadSessionData()
  ensureFallbackCustomerDefaults()
  partnerOrderId.value = derivePartnerOrderId() || ''

  if (!partnerOrderId.value) {
    setStatus(
      'Impossible de retrouver la reference de commande partenaire. Retournez au formulaire de reservation.',
      'error',
    )
    return
  }

  isProcessing.value = true
  try {
    await syncKotanPaymentStatus(partnerOrderId.value)

    const statusPayload = await fetchBookingStatus(partnerOrderId.value)
    const existingSupplierRef = bookingAlreadyFinalized(statusPayload)

    if (!existingSupplierRef) {
      await finalizeBookingAutomatically()
    }

    setStatus(
      'Paiement réussi. Vous allez recevoir un e-mail de confirmation de réservation.',
      'success',
    )
    startRedirectHome(HOME_REDIRECT_DELAY_SECONDS)
  } catch (err) {
    debugBookingStartErr.value = {
      message: err?.message || String(err || ''),
    }
    setStatus(
      `Erreur lors du traitement final de la reservation : ${
        err?.message || String(err || '')
      }`,
      'error',
    )
  } finally {
    isProcessing.value = false
  }
}

onMounted(() => {
  runPaymentSuccessFlow()
})

onBeforeUnmount(() => {
  clearRedirectTimer()
})
</script>

<style scoped>
.debug-panel {
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 12px;
  padding: 1rem;
  font-size: 0.85rem;
  overflow: auto;
  margin-top: 1.5rem;
  display: none;
}

.debug-panel summary {
  cursor: pointer;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.debug-panel pre {
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0.5rem 0 0 0;
}

.payment-success-view {
  margin-top: 2rem;
}

.booking-status.success {
  color: #166534;
}

.payment-success-loader {
  margin-top: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.payment-success-loader__spinner {
  width: 1rem;
  height: 1rem;
  border-radius: 999px;
  border: 2px solid rgba(55, 107, 176, 0.2);
  border-top-color: #376bb0;
  animation: payment-success-spin 0.75s linear infinite;
}

@keyframes payment-success-spin {
  to {
    transform: rotate(360deg);
  }
}

.redirect-hint {
  margin-top: 0.8rem;
}

.payment-success-actions {
  margin-top: 0.85rem;
  display: flex;
  justify-content: flex-start;
}
</style>
