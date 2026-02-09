<!--
  PaymentSuccessView
  ==================
  Vue view that replaces front/payment-success.html + front/payment-success.js.

  Responsibilities:
  - Read the partner_order_id from:
    - Route query parameters, and/or
    - Session storage (LAST_PARTNER_KEY), similar to derivePartnerOrderId().
  - Load prebook summary and customer info from session storage (PREBOOK_SUMMARY_KEY, LAST_CUSTOMER_KEY).
  - Call /api/booking/status to retrieve booking/payment status using API_BASE.
  - Display:
    - Partner order id.
    - Hotel name and stay details.
    - Total amount and currency.
    - List of guest inputs (at least one guest row).
    - Contact email, phone, and comment fields.
  - Handle booking confirmation:
    - Collect guests and contact info.
    - Build request body for /api/booking/start (supplier_data, rooms, payment_type).
    - Submit the finalize request and show success or error status.

  The layout will reuse:
  - Summary cards (.summary-card, .muted, .card).
  - Buttons (.primary, .secondary).
  - Status message elements (.booking-status or similar).
-->

<template>
  <section class="workspace__content payment-success-view">
    <section class="card booking-panel">
      <div class="booking-intro">
        <div>
          <p class="muted" style="margin:0">
            Référence de commande partenaire
          </p>
          <code class="booking-token">
            {{ partnerOrderId || '-' }}
          </code>
        </div>
      </div>
      <div
        class="booking-status muted"
        :class="{ error: statusType === 'error' }"
      >
        {{ statusMessage }}
      </div>

      <div
        v-if="hotelSummary || amountText"
        class="booking-summary"
      >
        <div class="summary-row">
          <div>
            <p class="muted" style="margin:0">Hôtel</p>
            <strong>{{ hotelSummary?.name || '-' }}</strong>
            <p
              class="muted"
              style="margin:4px 0 0 0"
            >
              {{ hotelSummary?.details || '' }}
            </p>
          </div>
        </div>
        <div class="summary-row">
          <div>
            <p class="muted" style="margin:0">Montant payé</p>
            <strong>{{ amountText || '-' }}</strong>
          </div>
        </div>
      </div>

      <section
        class="card booking-form"
        aria-live="polite"
      >
        <h3>Voyageurs</h3>
        <p class="muted">
          Ajoutez les noms de tous les voyageurs pour finaliser la réservation.
        </p>

        <form @submit.prevent="submitBooking">
          <div class="summary-grid">
            <div
              v-for="(guest, idx) in guests"
              :key="idx"
              class="summary-card"
            >
              <p class="muted">
                Voyageur {{ idx + 1 }}
              </p>
              <div class="row">
                <label>
                  Prénom
                  <input
                    v-model="guest.firstName"
                    type="text"
                    required
                  />
                </label>
                <label>
                  Nom
                  <input
                    v-model="guest.lastName"
                    type="text"
                    required
                  />
                </label>
              </div>
            </div>
          </div>
          <button
            type="button"
            class="secondary mini add-guest-btn"
            style="margin-top:0.75rem;"
            @click="addGuest"
          >
            <i
              class="pi pi-plus"
              aria-hidden="true"
            ></i>
            <i
              class="pi pi-users"
              aria-hidden="true"
            ></i>
            <span>Ajouter un voyageur</span>
          </button>

          <h3 style="margin-top:1.5rem;">
            Contact principal
          </h3>
          <div class="row">
            <label>
              Email de contact
              <input
                v-model="contactEmail"
                type="email"
                required
                placeholder="client@example.com"
              />
            </label>
            <label>
              Téléphone de contact
              <input
                v-model="contactPhone"
                type="tel"
                required
                placeholder="+33 6 00 00 00 00"
              />
            </label>
          </div>
          <div class="row">
            <label>
              Commentaire (optionnel)
              <input
                v-model="contactComment"
                type="text"
                placeholder="Arrivée tardive, demandes spéciales, …"
              />
            </label>
          </div>

          <div class="row" style="margin-top:1.5rem;">
            <button
              type="submit"
              class="primary"
              :disabled="submitLoading"
            >
              {{ submitLoading ? 'Finalisation…' : 'Confirmer la réservation' }}
            </button>
          </div>
          <p
            class="booking-status muted"
            :class="{ error: finalizeStatusType === 'error' }"
            style="margin-top:.5rem;"
          >
            {{ finalizeStatus }}
          </p>
        </form>
      </section>

      <details class="debug-panel" open>
        <summary>Debug</summary>
        <pre>booking/status request: {{ formatDebug(debugBookingStatusReq) }}</pre>
        <pre>booking/status response: {{ formatDebug(debugBookingStatusRes) }}</pre>
        <pre>booking/status error: {{ formatDebug(debugBookingStatusErr) }}</pre>
        <pre>booking/start request: {{ formatDebug(debugBookingStartReq) }}</pre>
        <pre>booking/start response: {{ formatDebug(debugBookingStartRes) }}</pre>
        <pre>booking/start etg: {{ formatDebug(debugBookingStartEtg) }}</pre>
        <pre>booking/start error: {{ formatDebug(debugBookingStartErr) }}</pre>
      </details>

    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { API_BASE } from '../services/httpClient.js'

const route = useRoute()
const router = useRouter()

const PREBOOK_SUMMARY_KEY = 'booking:lastPrebook'
const LAST_PARTNER_KEY = 'booking:lastPartnerOrderId'
const LAST_CUSTOMER_KEY = 'booking:lastCustomer'

const partnerOrderId = ref('')
const statusMessage = ref('')
const statusType = ref('info')

const hotelSummary = ref(null)
const amountText = ref('')

const guests = ref([])
const contactEmail = ref('')
const contactPhone = ref('')
const contactComment = ref('')

const finalizeStatus = ref('')
const finalizeStatusType = ref('info')
const submitLoading = ref(false)

const debugBookingStartReq = ref(null)
const debugBookingStartRes = ref(null)
const debugBookingStartErr = ref(null)
const debugBookingStartEtg = ref(null)
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

function redirectToFinishedPage({
  supplierReference,
  partnerId,
  delaySeconds = 6,
} = {}) {
  router.push({
    name: 'booking-finished',
    query: {
      partner_order_id: partnerId || undefined,
      supplier_reference: supplierReference || undefined,
      delay: String(delaySeconds),
      next: '/',
      next_label: "la page d'accueil",
    },
  })
}

function setStatus(message, type = 'info') {
  statusMessage.value = message || ''
  statusType.value = type
}

function setFinalizeStatus(message, type = 'info') {
  finalizeStatus.value = message || ''
  finalizeStatusType.value = type
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
    storedPrebookSummary.value =
      storedPrebookSummary.value || null
    storedPrebookPayload.value =
      storedPrebookPayload.value || null
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

function deriveHotelSummary() {
  if (!storedPrebookSummary.value && !storedPrebookPayload.value) return
  const summary = storedPrebookSummary.value || {}
  const hotel = summary.hotel || {}
  const stay = summary.stay || {}
  const room = summary.room || {}

  const payload =
    storedPrebookPayload.value && typeof storedPrebookPayload.value === 'object'
      ? storedPrebookPayload.value
      : null
  const payloadHotels =
    payload?.data?.hotels ||
    payload?.hotels ||
    payload?.prebook_token?.hotels ||
    []
  const payloadHotel = Array.isArray(payloadHotels)
    ? payloadHotels[0] || null
    : null
  const payloadRate = payloadHotel?.rates?.[0] || null
  const payloadLegalHotel =
    payloadRate?.legal_info?.hotel || payloadHotel?.legal_info?.hotel || null

  const normalizeText = (value) =>
    typeof value === 'string' && value.trim().length ? value.trim() : null

  const payloadName = normalizeText(
    payloadHotel?.name ||
      payloadHotel?.hotel_name ||
      payloadHotel?.hotel_name_trans ||
      payloadLegalHotel?.name,
  )
  const payloadCity = normalizeText(
    payloadHotel?.city ||
      payloadHotel?.city_name ||
      payloadLegalHotel?.city,
  )
  const payloadAddress = normalizeText(
    payloadHotel?.address ||
      payloadHotel?.address_full ||
      payloadLegalHotel?.address,
  )
  const payloadCountry = normalizeText(
    payloadHotel?.country ||
      payloadHotel?.country_name ||
      payloadLegalHotel?.country,
  )

  const name = hotel.name || payloadName || null
  const fallbackId =
    hotel.id || payloadHotel?.id || payloadHotel?.hid || null
  const fallbackName = fallbackId
    ? String(fallbackId).replace(/_/g, ' ').trim()
    : null
  const city = hotel.city || payloadCity || null
  const address = hotel.address || payloadAddress || null
  const country = hotel.country || payloadCountry || null

  const checkin = stay.checkin || null
  const checkout = stay.checkout || null

  const hotelName =
    name || fallbackName || city || country || 'Hôtel non spécifié'

  const parts = []
  if (address || city) {
    const locParts = [address, city].filter(Boolean)
    parts.push(locParts.join(', '))
  }
  if (checkin || checkout) {
    parts.push(`Séjour ${checkin || '?'} → ${checkout || '?'}`)
  }
  if (!parts.length && country) {
    parts.push(country)
  }

  hotelSummary.value = {
    name: hotelName,
    details: parts.join(' · '),
  }

  let amount = null
  let currency = null
  if (room && room.price) {
    amount = room.price
    currency = room.currency || stay.currency || null
  }
  if (amount == null && payloadRate) {
    const payloadPayment =
      payloadRate?.payment_options?.payment_types?.[0] || null
    if (payloadPayment) {
      amount = payloadPayment.show_amount || payloadPayment.amount || amount
      currency =
        payloadPayment.show_currency_code ||
        payloadPayment.currency_code ||
        currency
    }
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

  amountText.value =
    amount != null
      ? formatPrice(amount, currency || 'EUR')
      : ''
}

function ensureAtLeastOneGuest() {
  if (guests.value.length) return
  let initial = null
  if (storedCustomer.value) {
    const full = storedCustomer.value.fullName || ''
    const parts = full.split(' ')
    const firstName = parts.shift() || ''
    const lastName = parts.join(' ') || ''
    initial = { firstName, lastName }
  }
  guests.value.push({
    firstName: (initial && initial.firstName) || '',
    lastName: (initial && initial.lastName) || '',
  })
}

function applyCustomerDefaults(customer) {
  if (!customer) return
  const firstName =
    (customer.firstName || customer.first_name || '').trim()
  const lastName =
    (customer.lastName || customer.last_name || '').trim()
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()

  if (fullName) {
    storedCustomer.value = {
      ...(storedCustomer.value || {}),
      fullName,
      email: customer.email || storedCustomer.value?.email || '',
      phone:
        customer.mobilePhoneNumber ||
        customer.phone ||
        storedCustomer.value?.phone || '',
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

  if (!guests.value.length) {
    guests.value.push({ firstName, lastName })
    return
  }
  const firstGuest = guests.value[0]
  if (
    firstGuest &&
    !firstGuest.firstName &&
    !firstGuest.lastName &&
    (firstName || lastName)
  ) {
    firstGuest.firstName = firstName
    firstGuest.lastName = lastName
  }
}

function deriveSummaryFromBookingForm(form) {
  if (!form || storedPrebookSummary.value) return
  const hotel =
    form.hotel ||
    form.hotel_info ||
    form.hotel_data ||
    form.item?.hotel ||
    null

  const name =
    hotel?.name ||
    form.hotel_name ||
    form.hotelName ||
    form.name ||
    null
  const city =
    hotel?.city ||
    hotel?.city_name ||
    form.city ||
    null
  const address =
    hotel?.address ||
    hotel?.address_full ||
    form.address ||
    null
  const country =
    hotel?.country ||
    hotel?.country_name ||
    form.country ||
    null

  const checkin =
    form.checkin ||
    form.check_in ||
    form.arrival_date ||
    form.stay?.checkin ||
    null
  const checkout =
    form.checkout ||
    form.check_out ||
    form.departure_date ||
    form.stay?.checkout ||
    null

  const paymentType =
    (Array.isArray(form.payment_types) && form.payment_types[0]) ||
    form.payment_type ||
    null

  const amount =
    paymentType?.amount ||
    form.total_amount ||
    form.order_amount ||
    null
  const currency =
    paymentType?.currency_code ||
    form.currency_code ||
    form.currency ||
    null

  if (name || city || address || country || checkin || checkout) {
    storedPrebookSummary.value = {
      hotel: { name, city, address, country },
      stay: { checkin, checkout, currency },
      room: { price: amount, currency },
    }
  }
}

function addGuest() {
  guests.value.push({ firstName: '', lastName: '' })
}

function collectGuestsPayload() {
  return guests.value
    .map((g) => ({
      first_name: (g.firstName || '').trim(),
      last_name: (g.lastName || '').trim(),
    }))
    .filter((g) => g.first_name || g.last_name)
}

async function fetchBookingStatus(partnerId) {
  try {
    setStatus('Récupération des informations de réservation…', 'info')
    const endpoint = `${API_BASE}/api/booking/status?partner_order_id=${encodeURIComponent(
      partnerId,
    )}`
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
      throw new Error(
        payload?.error || payload?.message || res.status,
      )
    }
    currentPaymentInfo.value = payload.payment || null
    bookingForm.value =
      payload.booking_form && payload.booking_form.form
        ? payload.booking_form.form
        : null
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
    deriveHotelSummary()
    setStatus(
      'Paiement confirmé. Merci de confirmer les voyageurs pour finaliser la réservation.',
      'info',
    )
  } catch (err) {
    debugBookingStatusErr.value = {
      message: err?.message || String(err || ''),
    }
    setStatus(
      `Impossible de récupérer le statut de réservation : ${
        err?.message || String(err || '')
      }`,
      'error',
    )
  }
}

async function submitBooking() {
  if (!partnerOrderId.value) {
    setFinalizeStatus(
      'partner_order_id manquant. Retournez au formulaire de réservation.',
      'error',
    )
    return
  }

  const email = (contactEmail.value || '').trim()
  const phone = (contactPhone.value || '').trim()
  const comment = (contactComment.value || '').trim() || null

  if (!email || !phone) {
    setFinalizeStatus(
      'Merci de renseigner l’email et le téléphone de contact.',
      'error',
    )
    return
  }

  const guestsPayload = collectGuestsPayload()
  if (!guestsPayload.length) {
    setFinalizeStatus(
      'Ajoutez au moins un voyageur pour finaliser la réservation.',
      'error',
    )
    return
  }

  const mainGuest = guestsPayload[0]
  const bookingFormPayment =
    bookingForm.value &&
    Array.isArray(bookingForm.value.payment_types) &&
    bookingForm.value.payment_types.length > 0
      ? bookingForm.value.payment_types[0]
      : null
  const amount =
    (currentPaymentInfo.value &&
      currentPaymentInfo.value.amount) ||
    (bookingFormPayment && bookingFormPayment.amount) ||
    (storedPrebookSummary.value &&
      storedPrebookSummary.value.room &&
      storedPrebookSummary.value.room.price) ||
    null
  const currency =
    (currentPaymentInfo.value &&
      (currentPaymentInfo.value.currency_code ||
        currentPaymentInfo.value.currencyCode)) ||
    (bookingFormPayment && bookingFormPayment.currency_code) ||
    (storedPrebookSummary.value &&
      storedPrebookSummary.value.stay &&
      storedPrebookSummary.value.stay.currency) ||
    'EUR'

  const paymentType = {
    type: bookingFormPayment?.type || 'deposit',
    amount:
      bookingFormPayment && bookingFormPayment.amount != null
        ? String(bookingFormPayment.amount)
        : amount != null
          ? String(amount)
          : '0',
    currency_code:
      bookingFormPayment?.currency_code || currency || 'EUR',
  }

  const body = {
    partner_order_id: partnerOrderId.value,
    language: 'fr',
    user: {
      email,
      phone,
      comment,
    },
    supplier_data: {
      first_name_original: mainGuest.first_name || '',
      last_name_original: mainGuest.last_name || '',
      phone,
      email,
    },
    rooms: [
      {
        guests: guestsPayload,
      },
    ],
    payment_type: paymentType,
  }

  try {
    debugBookingStartReq.value = body
    debugBookingStartErr.value = null
    setFinalizeStatus(
      'Finalisation de la réservation auprès du fournisseur…',
      'info',
    )
    submitLoading.value = true
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
    debugBookingStartEtg.value =
      payload && payload._debug && payload._debug.etg ? payload._debug.etg : null
    try {
      if (typeof window !== 'undefined') {
        const ss = window.sessionStorage
        if (ss) {
          ss.setItem(
            'booking:lastEtgDebug',
            JSON.stringify(debugBookingStartEtg.value || null),
          )
        }
      }
    } catch {
      // best-effort only
    }
    if (!res.ok || payload?.status !== 'ok') {
      const baseMessage =
        payload?.error ||
        payload?.message ||
        (payload?.debug &&
          (payload.debug.error || payload.debug.reason)) ||
        `HTTP ${res.status}`
      const detail =
        payload && typeof payload === 'object'
          ? JSON.stringify(payload, null, 2)
          : String(baseMessage)
      const error = new Error(baseMessage)
      error._detail = detail
      throw error
    }
    const start = payload.start || {}
    const etgOrderId =
      start.order_id || start.id || null
    const successMessage = etgOrderId
      ? `Réservation confirmée (référence fournisseur : ${etgOrderId}).`
      : 'Réservation confirmée. La référence fournisseur sera disponible prochainement.'
    setFinalizeStatus(successMessage, 'info')
    redirectToFinishedPage({
      supplierReference: etgOrderId || '',
      partnerId: partnerOrderId.value,
    })
  } catch (err) {
    debugBookingStartErr.value = {
      message: err?.message || String(err || ''),
      detail: err?._detail || null,
    }
    const detail =
      err && err._detail
        ? err._detail
        : err?.message || String(err || '')
    const errorMessage =
      'Erreur lors de la finalisation de la réservation :\n' +
      detail
    setFinalizeStatus(errorMessage, 'error')
    try {
      // eslint-disable-next-line no-alert
      alert(errorMessage)
    } catch {
      // ignore
    }
  } finally {
    submitLoading.value = false
  }
}

onMounted(() => {
  loadSessionData()
  partnerOrderId.value = derivePartnerOrderId()

  if (!partnerOrderId.value) {
    setStatus(
      'Impossible de retrouver la référence de commande partenaire. Retournez au formulaire de réservation.',
      'error',
    )
  } else {
    fetchBookingStatus(partnerOrderId.value)
  }

  if (storedCustomer.value) {
    if (storedCustomer.value.email) {
      contactEmail.value = storedCustomer.value.email
    }
    if (storedCustomer.value.phone) {
      contactPhone.value = storedCustomer.value.phone
    }
  }

  ensureAtLeastOneGuest()
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

.add-guest-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.add-guest-btn i {
  font-size: 0.85rem;
}
</style>
