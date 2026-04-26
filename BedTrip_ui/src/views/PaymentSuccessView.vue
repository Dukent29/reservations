<!--
  PaymentSuccessView
  ==================
  Payment provider return page for successful or pending payment callbacks.

  Main responsibilities:
  - Read partner order information from the payment return route.
  - Verify booking/payment status with the backend.
  - Continue booking finalization when payment is confirmed.
  - Show a clear reservation confirmation or error state to the traveller.
-->

<template>
  <section class="workspace__content payment-success-view">
    <section
      class="card payment-state-card"
      :class="`payment-state-card--${statusType}`"
    >
      <div
        class="payment-state-hero"
        :class="`payment-state-hero--${statusType}`"
      >
        <div
          class="payment-state-icon"
          :class="`payment-state-icon--${statusType}`"
          aria-hidden="true"
        >
          <svg
            v-if="statusType === 'success'"
            viewBox="0 0 48 48"
            fill="none"
            role="img"
            focusable="false"
          >
            <circle
              cx="24"
              cy="24"
              r="20"
              stroke="#15803d"
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
          <svg
            v-else-if="statusType === 'error'"
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
          <div
            v-else
            class="payment-state-spinner"
          ></div>
        </div>

        <div class="payment-state-copy">
          <p class="payment-state-eyebrow">{{ statusEyebrow }}</p>
          <h1>{{ statusTitle }}</h1>
          <p class="payment-state-message">
            {{ statusMessage }}
          </p>
        </div>
      </div>

      <div v-if="isProcessing" class="payment-processing-note" aria-busy="true">
        Vérification en cours, merci de patienter quelques instants...
      </div>

      <div class="payment-details-grid">
        <div class="payment-detail-card">
          <p class="muted">Référence de commande partenaire</p>
          <code class="booking-token">{{ partnerOrderId || '-' }}</code>
        </div>

        <div v-if="supplierReference" class="payment-detail-card">
          <p class="muted">Référence fournisseur</p>
          <strong>{{ supplierReference }}</strong>
        </div>

        <div class="payment-detail-card">
          <p class="muted">Hôtel</p>
          <strong>{{ hotelSummary?.name || 'Hôtel en cours d\'identification' }}</strong>
          <p v-if="hotelSummary?.details" class="muted payment-detail-subline">
            {{ hotelSummary.details }}
          </p>
        </div>

        <div v-if="amountText" class="payment-detail-card">
          <p class="muted">Montant payé</p>
          <strong>{{ amountText }}</strong>
        </div>
      </div>

      <p v-if="redirectCountdown > 0 && statusType === 'success'" class="muted redirect-hint">
        Redirection vers l'accueil dans {{ redirectCountdown }}s.
      </p>

      <div class="payment-success-actions">
        <button
          v-if="statusType === 'success'"
          type="button"
          class="status-action-button status-action-button--print"
          @click="openPrintConfirmation"
        >
          Imprimer la confirmation / PDF
        </button>
        <button
          type="button"
          class="status-action-button"
          :class="`status-action-button--${statusType}`"
          @click="goHomeNow"
        >
          Retourner à l'accueil
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
const supplierReference = ref('')
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

const statusTitle = computed(() => {
  if (statusType.value === 'success') return 'Réservation confirmée'
  if (statusType.value === 'error') return 'Confirmation de réservation interrompue'
  return 'Confirmation de réservation en cours'
})

const statusEyebrow = computed(() => {
  if (statusType.value === 'success') return 'Paiement validé'
  if (statusType.value === 'error') return 'Action requise'
  return 'Traitement en cours'
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

function normalizeText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function firstNonEmptyText(...values) {
  for (const value of values) {
    const normalized = normalizeText(value)
    if (normalized) return normalized
  }
  return null
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const num = Number(value)
    if (Number.isFinite(num)) return num
  }
  return null
}

function formatPrice(amount, currency) {
  const num = Number(amount)
  if (!Number.isFinite(num)) return ''
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 2,
    }).format(num)
  } catch {
    return `${num} ${currency || ''}`.trim()
  }
}

function formatDisplayDate(value) {
  const raw = normalizeText(value)
  if (!raw) return null
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return raw
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date)
  } catch {
    return raw
  }
}

function escapeHtml(value) {
  if (value == null) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatGuestFullName() {
  const parts = [
    String(mainGuest.value.firstName || '').trim(),
    String(mainGuest.value.lastName || '').trim(),
  ].filter(Boolean)
  if (parts.length) return parts.join(' ')

  const storedFullName = String(storedCustomer.value?.fullName || '').trim()
  if (storedFullName) return storedFullName

  const storedParts = [
    String(storedCustomer.value?.firstName || '').trim(),
    String(storedCustomer.value?.lastName || '').trim(),
  ].filter(Boolean)
  if (storedParts.length) return storedParts.join(' ')

  return '-'
}

function resolveCurrentStayDates() {
  const form = bookingForm.value || {}
  const hotel = form.hotel || form.hotel_info || form.hotel_data || form.item?.hotel || {}
  const payloadHotel = resolvePayloadHotelCandidate() || {}
  const summaryStay = storedPrebookSummary.value?.stay || {}

  const checkIn = firstNonEmptyText(
    form.checkin,
    form.check_in,
    form.arrival_date,
    form.order?.checkin,
    form.stay?.checkin,
    hotel?.checkin,
    payloadHotel?.checkin,
    summaryStay?.checkin,
  )
  const checkOut = firstNonEmptyText(
    form.checkout,
    form.check_out,
    form.departure_date,
    form.order?.checkout,
    form.stay?.checkout,
    hotel?.checkout,
    payloadHotel?.checkout,
    summaryStay?.checkout,
  )

  return {
    checkIn: formatDisplayDate(checkIn) || '-',
    checkOut: formatDisplayDate(checkOut) || '-',
  }
}

function openPrintConfirmation() {
  if (typeof window === 'undefined') return

  clearRedirectTimer()
  redirectCountdown.value = 0

  const hotelName = hotelSummary.value?.name || 'Hotel'
  const hotelDetails = hotelSummary.value?.details || '-'
  const roomName = firstNonEmptyText(
    storedPrebookSummary.value?.room?.name,
    bookingForm.value?.room_name,
    bookingForm.value?.room?.name,
  ) || '-'
  const guestName = formatGuestFullName()
  const guestEmail = String(contactEmail.value || storedCustomer.value?.email || '').trim() || '-'
  const guestPhone = String(contactPhone.value || storedCustomer.value?.phone || '').trim() || '-'
  const customerComment = String(contactComment.value || '').trim() || '-'
  const { checkIn, checkOut } = resolveCurrentStayDates()
  const amountPaid = amountText.value || '-'
  const partnerReference = partnerOrderId.value || '-'
  const providerReference = supplierReference.value || 'En cours d attribution'

  const printHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Confirmation de réservation BedTrip</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #ffffff; }
    .sheet { max-width: 820px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 2px solid #15803d; padding-bottom: 18px; margin-bottom: 24px; }
    .brand { font-size: 28px; font-weight: 700; color: #15803d; }
    .title h1 { margin: 0; font-size: 22px; }
    .title p { margin: 6px 0 0 0; color: #475569; }
    .badge { display: inline-block; margin-top: 10px; padding: 6px 10px; border-radius: 999px; background: #dcfce7; color: #166534; font-weight: 700; font-size: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; background: #f8fafc; }
    .card h2 { margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; }
    .value { font-size: 18px; font-weight: 700; color: #0f172a; }
    .line { margin: 6px 0; }
    .label { color: #64748b; }
    .section { margin-bottom: 20px; }
    .section h3 { margin: 0 0 10px 0; font-size: 15px; color: #0f172a; }
    .info-list { margin: 0; padding-left: 18px; color: #334155; }
    .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #475569; font-size: 12px; }
    @media print { body { padding: 0; } .sheet { max-width: none; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <div class="brand">BedTrip</div>
        <div class="badge">Reservation confirmee</div>
      </div>
      <div class="title">
        <h1>Confirmation de reservation</h1>
        <p>Document a conserver et a presenter si necessaire.</p>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>References BedTrip</h2>
        <div class="line"><span class="label">Reference partenaire :</span> <strong>${escapeHtml(partnerReference)}</strong></div>
        <div class="line"><span class="label">Reference fournisseur :</span> <strong>${escapeHtml(providerReference)}</strong></div>
        <div class="line"><span class="label">Montant paye :</span> <strong>${escapeHtml(amountPaid)}</strong></div>
      </div>
      <div class="card">
        <h2>Coordonnees BedTrip</h2>
        <div class="line"><span class="label">Agence :</span> <strong>02 35 08 22 49</strong></div>
        <div class="line"><span class="label">Site :</span> <strong>bedtrip.fr</strong></div>
        <div class="line"><span class="label">Usage :</span> <strong>Support reservation</strong></div>
      </div>
    </div>

    <div class="section card">
      <h2>Voyageur principal</h2>
      <div class="line"><span class="label">Nom :</span> <strong>${escapeHtml(guestName)}</strong></div>
      <div class="line"><span class="label">E-mail :</span> <strong>${escapeHtml(guestEmail)}</strong></div>
      <div class="line"><span class="label">Telephone :</span> <strong>${escapeHtml(guestPhone)}</strong></div>
      <div class="line"><span class="label">Commentaire :</span> <strong>${escapeHtml(customerComment)}</strong></div>
    </div>

    <div class="section card">
      <h2>Sejour</h2>
      <div class="value">${escapeHtml(hotelName)}</div>
      <div class="line">${escapeHtml(hotelDetails)}</div>
      <div class="line"><span class="label">Chambre / offre :</span> <strong>${escapeHtml(roomName)}</strong></div>
      <div class="line"><span class="label">Arrivee :</span> <strong>${escapeHtml(checkIn)}</strong></div>
      <div class="line"><span class="label">Depart :</span> <strong>${escapeHtml(checkOut)}</strong></div>
    </div>

    <div class="section card">
      <h2>Informations utiles</h2>
      <ul class="info-list">
        <li>Conservez ce document avec vos references BedTrip.</li>
        <li>Gardez la reference fournisseur pour tout echange avec l'etablissement.</li>
        <li>En cas de besoin, contactez BedTrip avec la reference partenaire ${escapeHtml(partnerReference)}.</li>
      </ul>
    </div>

    <div class="footer">
      Ce document est une confirmation BedTrip generee depuis la page de confirmation de reservation.
    </div>
  </div>
  <scr` + `ipt>
    window.onload = function () { window.print(); };
  </scr` + `ipt>
</body>
</html>`

  const popup = window.open('', '_blank')
  if (!popup) return
  popup.document.write(printHtml)
  popup.document.close()
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
        storedPrebookSummary.value = parsed || null
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

function resolvePayloadHotelCandidate() {
  const payload = storedPrebookPayload.value || {}
  const firstHotel =
    (Array.isArray(payload?.data?.hotels) && payload.data.hotels[0]) ||
    (Array.isArray(payload?.hotels) && payload.hotels[0]) ||
    null

  return (
    payload?.hotel ||
    payload?.offer?.hotel ||
    firstHotel ||
    null
  )
}

function mergeSummaryPatch(existing, patch) {
  const next = existing ? { ...existing } : {}
  const nextHotel = { ...(existing?.hotel || {}) }
  const nextStay = { ...(existing?.stay || {}) }
  const nextRoom = { ...(existing?.room || {}) }

  for (const [key, value] of Object.entries(patch.hotel || {})) {
    if (value != null && value !== '') nextHotel[key] = value
  }
  for (const [key, value] of Object.entries(patch.stay || {})) {
    if (value != null && value !== '') nextStay[key] = value
  }
  for (const [key, value] of Object.entries(patch.room || {})) {
    if (value != null && value !== '') nextRoom[key] = value
  }

  next.hotel = nextHotel
  next.stay = nextStay
  next.room = nextRoom
  return next
}

function deriveSummaryFromBookingForm(form) {
  if (!form) return

  const hotel = form.hotel || form.hotel_info || form.hotel_data || form.item?.hotel || {}
  const payloadHotel = resolvePayloadHotelCandidate() || {}
  const pricing = form.pricing || {}
  const paymentType = (Array.isArray(form.payment_types) && form.payment_types[0]) || form.payment_type || null

  storedPrebookSummary.value = mergeSummaryPatch(storedPrebookSummary.value, {
    hotel: {
      id: hotel?.id || payloadHotel?.id || null,
      hid: hotel?.hid || payloadHotel?.hid || null,
      name: firstNonEmptyText(
        hotel?.name,
        form.hotel_name,
        form.hotelName,
        form.name,
        payloadHotel?.name,
        payloadHotel?.hotel_name,
        payloadHotel?.hotel_name_trans,
      ),
      city: firstNonEmptyText(
        hotel?.city,
        hotel?.city_name,
        form.city,
        payloadHotel?.city,
        payloadHotel?.city_name,
      ),
      address: firstNonEmptyText(
        hotel?.address,
        hotel?.address_full,
        form.address,
        payloadHotel?.address,
        payloadHotel?.address_full,
      ),
      country: firstNonEmptyText(
        hotel?.country,
        hotel?.country_name,
        form.country,
        payloadHotel?.country,
        payloadHotel?.country_name,
      ),
    },
    stay: {
      checkin: firstNonEmptyText(
        form.checkin,
        form.check_in,
        form.arrival_date,
        form.stay?.checkin,
      ),
      checkout: firstNonEmptyText(
        form.checkout,
        form.check_out,
        form.departure_date,
        form.stay?.checkout,
      ),
      currency: firstNonEmptyText(
        pricing.currency,
        paymentType?.show_currency_code,
        paymentType?.currency_code,
        form.currency_code,
        form.currency,
      ),
    },
    room: {
      name: firstNonEmptyText(
        form.room_name,
        form.room?.name,
      ),
      price: firstFiniteNumber(
        pricing.total_amount,
        pricing.final_amount,
        pricing.marked_amount,
      ),
      currency: firstNonEmptyText(
        pricing.currency,
        paymentType?.show_currency_code,
        paymentType?.currency_code,
        form.currency_code,
        form.currency,
      ),
    },
  })
}

function resolveHotelSummary() {
  const summary = storedPrebookSummary.value || {}
  const hotel = summary.hotel || {}
  const stay = summary.stay || {}

  const payloadHotel = resolvePayloadHotelCandidate() || {}
  const name = firstNonEmptyText(
    hotel?.name,
    payloadHotel?.name,
    payloadHotel?.hotel_name,
    payloadHotel?.hotel_name_trans,
  )

  const address = firstNonEmptyText(
    hotel?.address,
    payloadHotel?.address,
    payloadHotel?.address_full,
  )
  const city = firstNonEmptyText(
    hotel?.city,
    payloadHotel?.city,
    payloadHotel?.city_name,
  )
  const country = firstNonEmptyText(
    hotel?.country,
    payloadHotel?.country,
    payloadHotel?.country_name,
  )

  const checkin = formatDisplayDate(stay?.checkin)
  const checkout = formatDisplayDate(stay?.checkout)

  const parts = []
  const location = [address, city, country].filter(Boolean).join(', ')
  if (location) parts.push(location)
  if (checkin || checkout) {
    parts.push(`Séjour du ${checkin || '?'} au ${checkout || '?'}`)
  }

  hotelSummary.value = {
    name: name || 'Hôtel en cours d\'identification',
    details: parts.join(' · '),
  }
}

function resolveDisplayAmount() {
  const summary = storedPrebookSummary.value || {}
  const pricing = bookingForm.value?.pricing || {}
  const trustedAmount = firstFiniteNumber(
    currentPaymentInfo.value?.amount,
    summary?.room?.price,
    summary?.pricing?.total_amount,
    pricing?.total_amount,
    pricing?.final_amount,
    pricing?.marked_amount,
  )

  if (!Number.isFinite(trustedAmount)) {
    amountText.value = ''
    return
  }

  const currency = firstNonEmptyText(
    currentPaymentInfo.value?.currency_code,
    currentPaymentInfo.value?.currencyCode,
    summary?.room?.currency,
    summary?.pricing?.currency,
    pricing?.currency,
    bookingForm.value?.currency_code,
    bookingForm.value?.currency,
  )

  amountText.value = formatPrice(trustedAmount, currency || 'EUR')
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

function refreshDisplaySummary() {
  resolveHotelSummary()
  resolveDisplayAmount()
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
    // best effort only
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

function applyStatusPayload(payload) {
  currentPaymentInfo.value = payload?.payment || null
  bookingForm.value = payload?.booking_form?.form ? payload.booking_form.form : null

  if (payload?.booking?.etg_order_id) {
    supplierReference.value = String(payload.booking.etg_order_id)
  }

  if (payload?.prebook_summary) {
    const prebook = payload.prebook_summary
    if (prebook.summary || prebook.payload) {
      storedPrebookSummary.value = prebook.summary || storedPrebookSummary.value
      storedPrebookPayload.value = prebook.payload || storedPrebookPayload.value
    } else {
      storedPrebookSummary.value = prebook || storedPrebookSummary.value
    }
  }

  deriveSummaryFromBookingForm(bookingForm.value)
  if (payload?.customer) {
    applyCustomerDefaults(payload.customer)
  }
  ensureFallbackCustomerDefaults()
  refreshDisplaySummary()
}

async function fetchBookingStatus(partnerId) {
  setStatus('Nous vérifions votre paiement et la confirmation de votre réservation.', 'info')
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

  applyStatusPayload(payload)
  return payload
}

function buildBookingStartBody() {
  const email = String(contactEmail.value || '').trim()
  const phone = String(contactPhone.value || '').trim()
  const comment = String(contactComment.value || '').trim() || null

  if (!email || !phone) {
    throw new Error('Informations client manquantes : e-mail ou téléphone indisponible.')
  }

  const firstName = String(mainGuest.value.firstName || '').trim()
  const lastName = String(mainGuest.value.lastName || '').trim()
  const bookingFormPayment =
    bookingForm.value &&
    Array.isArray(bookingForm.value.payment_types) &&
    bookingForm.value.payment_types.length > 0
      ? bookingForm.value.payment_types[0]
      : null

  const amount = firstFiniteNumber(
    currentPaymentInfo.value?.amount,
    bookingForm.value?.pricing?.total_amount,
    bookingForm.value?.pricing?.final_amount,
    bookingForm.value?.pricing?.marked_amount,
    bookingFormPayment?.amount,
    storedPrebookSummary.value?.room?.price,
  )

  const currency = firstNonEmptyText(
    currentPaymentInfo.value?.currency_code,
    currentPaymentInfo.value?.currencyCode,
    bookingForm.value?.pricing?.currency,
    bookingFormPayment?.show_currency_code,
    bookingFormPayment?.currency_code,
    storedPrebookSummary.value?.room?.currency,
    storedPrebookSummary.value?.stay?.currency,
  ) || 'EUR'

  const paymentType = {
    type: bookingFormPayment?.type || 'deposit',
    amount: amount != null ? String(amount) : '0',
    currency_code: currency,
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
      first_name_original: firstName,
      last_name_original: lastName,
      phone,
      email,
    },
    rooms: [
      {
        guests: [
          {
            first_name: firstName,
            last_name: lastName,
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

  setStatus('Paiement validé. Nous finalisons maintenant votre réservation.', 'info')

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

  supplierReference.value = firstNonEmptyText(
    payload?.start?.order_id,
    payload?.start?.id,
    supplierReference.value,
  ) || ''

  return payload
}

function buildFriendlyErrorMessage(error) {
  const raw = String(error?.message || error || '').trim()
  if (!raw) {
    return 'Une erreur technique est survenue lors de la confirmation de votre réservation.'
  }

  const lower = raw.toLowerCase()
  if (lower.includes('paymenttype is not defined')) {
    return 'Une erreur technique a empêché la confirmation automatique de votre réservation.'
  }
  if (
    lower.includes('booking_form_not_found') ||
    lower.includes('no booking form found') ||
    lower.includes('booking_form_expired') ||
    lower.includes('has expired')
  ) {
    return 'Votre session de réservation a expiré. Merci de relancer une recherche et de recommencer la réservation.'
  }
  if (lower.includes('order_not_found')) {
    return 'Nous n’avons pas retrouvé la session de réservation. Merci de relancer votre réservation.'
  }
  if (lower.includes('payment_required_before_booking_finish')) {
    return 'Le paiement est en attente de validation. La réservation sera confirmée dès que le paiement sera validé.'
  }
  if (
    lower.includes('is not defined') ||
    lower.includes('unexpected') ||
    lower.includes('failed') ||
    lower.startsWith('http ')
  ) {
    return 'Une erreur technique est survenue lors de la confirmation de votre réservation. Merci de contacter l’agence avec votre référence partenaire.'
  }
  return raw
}

async function runPaymentSuccessFlow() {
  loadSessionData()
  ensureFallbackCustomerDefaults()
  refreshDisplaySummary()
  partnerOrderId.value = derivePartnerOrderId() || ''

  if (!partnerOrderId.value) {
    setStatus(
      'Impossible de retrouver votre référence de commande. Merci de revenir au formulaire de réservation.',
      'error',
    )
    return
  }

  isProcessing.value = true
  try {
    await syncKotanPaymentStatus(partnerOrderId.value)

    const statusPayload = await fetchBookingStatus(partnerOrderId.value)
    const existingSupplierRef = bookingAlreadyFinalized(statusPayload)
    if (existingSupplierRef) {
      supplierReference.value = String(existingSupplierRef)
    }

    if (!existingSupplierRef) {
      await finalizeBookingAutomatically()
    }

    setStatus(
      supplierReference.value
        ? `Votre réservation est confirmée. Référence fournisseur : ${supplierReference.value}. Un e-mail de confirmation vous sera envoyé.`
        : 'Votre réservation est confirmée. Un e-mail de confirmation vous sera envoyé.',
      'success',
    )
    startRedirectHome(HOME_REDIRECT_DELAY_SECONDS)
  } catch (err) {
    debugBookingStartErr.value = {
      message: err?.message || String(err || ''),
    }
    setStatus(buildFriendlyErrorMessage(err), 'error')
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
.payment-success-view {
  margin-top: 2rem;
}

.payment-state-card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.4rem;
  border: 1px solid #e5e7eb;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.payment-state-card--info {
  border-color: #bfdbfe;
  background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
}

.payment-state-card--success {
  border-color: #86efac;
  background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%);
}

.payment-state-card--error {
  border-color: #fecaca;
  background: linear-gradient(180deg, #fef2f2 0%, #ffffff 100%);
}

.payment-state-hero {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  border-radius: 20px;
}

.payment-state-hero--info {
  background: rgba(219, 234, 254, 0.72);
}

.payment-state-hero--success {
  background: rgba(220, 252, 231, 0.92);
}

.payment-state-hero--error {
  background: rgba(254, 226, 226, 0.92);
}

.payment-state-icon {
  width: 72px;
  height: 72px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.payment-state-icon svg {
  width: 72px;
  height: 72px;
}

.payment-state-icon--info {
  background: #dbeafe;
  border: 1px solid #93c5fd;
}

.payment-state-icon--success {
  background: #dcfce7;
  border: 1px solid #86efac;
}

.payment-state-icon--error {
  background: #fee2e2;
  border: 1px solid #fca5a5;
}

.payment-state-spinner {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 3px solid rgba(37, 99, 235, 0.2);
  border-top-color: #2563eb;
  animation: payment-success-spin 0.75s linear infinite;
}

.payment-state-copy h1 {
  margin: 0.2rem 0 0 0;
  font-size: clamp(1.4rem, 2.8vw, 2rem);
  line-height: 1.1;
  color: #0f172a;
}

.payment-state-eyebrow {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #475569;
}

.payment-state-message {
  margin: 0.55rem 0 0 0;
  color: #334155;
}

.payment-processing-note {
  padding: 0.9rem 1rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.28);
  color: #334155;
}

.payment-details-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.payment-detail-card {
  padding: 1rem;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(226, 232, 240, 0.92);
}

.payment-detail-card strong,
.payment-detail-card code {
  display: block;
  margin-top: 0.3rem;
  color: #0f172a;
  font-size: 1rem;
}

.payment-detail-subline {
  margin: 0.45rem 0 0 0;
}

.booking-token {
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.redirect-hint {
  margin: 0;
}

.payment-success-actions {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.status-action-button {
  width: 100%;
  max-width: 360px;
  border: none;
  border-radius: 14px;
  padding: 0.95rem 1.2rem;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.status-action-button:hover {
  transform: translateY(-1px);
}

.status-action-button--info {
  background: #1d4ed8;
  box-shadow: 0 10px 24px rgba(29, 78, 216, 0.22);
}

.status-action-button--success {
  background: #15803d;
  box-shadow: 0 10px 24px rgba(21, 128, 61, 0.22);
}

.status-action-button--error {
  background: #b91c1c;
  box-shadow: 0 10px 24px rgba(185, 28, 28, 0.22);
}

.status-action-button--print {
  background: #0f172a;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.2);
}

.debug-panel {
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 12px;
  padding: 1rem;
  font-size: 0.85rem;
  overflow: auto;
  margin-top: 0.25rem;
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

@keyframes payment-success-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 720px) {
  .payment-state-card {
    padding: 1rem;
  }

  .payment-state-hero {
    grid-template-columns: 1fr;
    text-align: center;
    justify-items: center;
  }

  .payment-details-grid {
    grid-template-columns: 1fr;
  }
}
</style>
