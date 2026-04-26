<!--
  BookingFinishedView
  ===================
  Final confirmation screen shown after the reservation flow has completed.

  Main responsibilities:
  - Show partner and supplier booking references returned by the booking flow.
  - Give the user immediate print and navigation actions.
  - Redirect back to the expected destination after a short countdown.
  - Keep debug details visible while the booking integration is being validated.
-->

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
          class="primary with-icon"
          type="button"
          title="Imprimer la confirmation"
          @click="openPrintConfirmation"
        >
          <i class="pi pi-print" aria-hidden="true"></i>
          <span>Imprimer la confirmation</span>
        </button>
        <button
          class="primary"
          type="button"
          @click="goToNext"
        >
          Retourner maintenant
        </button>
      </div>

      <details class="debug-panel" open>
        <summary>Debug</summary>
        <pre>route.query: {{ formatDebug(debugQuery) }}</pre>
        <pre>partner_order_id: {{ partnerOrderId || '-' }}</pre>
        <pre>supplier_reference: {{ supplierReference || '-' }}</pre>
        <pre>next: {{ nextPath || '-' }}</pre>
        <pre>etg: {{ formatDebug(debugEtg) }}</pre>
      </details>
    </section>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { API_BASE } from '../services/httpClient.js'
import 'primeicons/primeicons.css'

const route = useRoute()
const router = useRouter()
const PREBOOK_SUMMARY_KEY = 'booking:lastPrebook'
const LAST_CUSTOMER_KEY = 'booking:lastCustomer'

const partnerOrderId = ref('')
const supplierReference = ref('')
const countdown = ref(6)
const targetLabel = ref('la page de réservation')
const nextPath = ref('/booking')
const debugEtg = ref(null)

const bookingDetails = ref(null)
const storedPrebookSummary = ref(null)
const storedPrebookPayload = ref(null)
const storedCustomer = ref(null)

let timerId = null

const confirmationMessage = computed(() =>
  supplierReference.value
    ? `Référence fournisseur : ${supplierReference.value}.`
    : 'La référence fournisseur sera disponible prochainement.',
)

const debugQuery = computed(() => route.query || {})

function formatDebug(value) {
  if (value == null) return '-'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

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

function hydrateEtgDebug() {
  try {
    if (typeof window === 'undefined') return
    const ss = window.sessionStorage
    if (!ss) return
    const raw = ss.getItem('booking:lastEtgDebug')
    debugEtg.value = raw ? JSON.parse(raw) : null
  } catch {
    debugEtg.value = debugEtg.value || null
  }
}

function hydrateSessionData() {
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

async function fetchBookingDetails() {
  const pid = partnerOrderId.value
  if (!pid) return
  try {
    const res = await fetch(
      `${API_BASE}/api/booking/status?partner_order_id=${encodeURIComponent(pid)}`
    )
    const data = await res.json()
    if (data && data.status === 'ok') {
      bookingDetails.value = data
    }
  } catch {
    bookingDetails.value = null
  }
}

function escapeHtml(str) {
  if (str == null) return ''
  const s = String(str)
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function joinNameParts(...parts) {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim()
}

function formatDisplayDate(value) {
  const raw = String(value || '').trim()
  if (!raw) return '-'
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

function resolveGuestName(booking, form) {
  const bookingRaw = booking?.raw && typeof booking.raw === 'object' ? booking.raw : {}
  const formCustomer = form?.customer || form?.user || form?.traveller || {}

  return (
    String(booking?.user_name || '').trim() ||
    joinNameParts(bookingRaw?.user?.first_name, bookingRaw?.user?.last_name) ||
    joinNameParts(formCustomer?.firstName, formCustomer?.lastName) ||
    joinNameParts(formCustomer?.first_name, formCustomer?.last_name) ||
    String(storedCustomer.value?.fullName || '').trim() ||
    joinNameParts(storedCustomer.value?.firstName, storedCustomer.value?.lastName) ||
    '-'
  )
}

function resolveStayDates(form) {
  const hotel = form?.hotel || form?.hotel_info || form?.hotel_data || form?.item?.hotel || {}
  const payloadHotel =
    storedPrebookPayload.value?.hotel ||
    storedPrebookPayload.value?.offer?.hotel ||
    {}
  const summaryStay = storedPrebookSummary.value?.stay || {}

  const checkIn =
    form?.checkin ||
    form?.check_in ||
    form?.arrival_date ||
    form?.order?.checkin ||
    form?.stay?.checkin ||
    hotel?.checkin ||
    payloadHotel?.checkin ||
    summaryStay?.checkin ||
    '-'

  const checkOut =
    form?.checkout ||
    form?.check_out ||
    form?.departure_date ||
    form?.order?.checkout ||
    form?.stay?.checkout ||
    hotel?.checkout ||
    payloadHotel?.checkout ||
    summaryStay?.checkout ||
    '-'

  return {
    checkIn: formatDisplayDate(checkIn),
    checkOut: formatDisplayDate(checkOut),
  }
}

function openPrintConfirmation() {
  const d = bookingDetails.value
  const form = d?.booking_form?.form || {}
  const hotel = form.hotel || form.hotel_info || form.hotel_data || form.item?.hotel || {}
  const paymentType = Array.isArray(form.payment_types) && form.payment_types[0] ? form.payment_types[0] : null
  const booking = d?.booking || {}
  const payment = d?.payment || {}
  const hotelName = hotel.name || form.hotel_name || form.hotelName || form.name || 'Hébergement'
  const address = hotel.address || hotel.address_full || form.address || ''
  const city = hotel.city || hotel.city_name || form.city || ''
  const country = hotel.country || hotel.country_name || form.country || ''
  const fullAddress = [address, city, country].filter(Boolean).join(', ').trim() || '-'

  const { checkIn, checkOut } = resolveStayDates(form)

  const amount = payment.amount ?? paymentType?.amount ?? booking.amount ?? form.total_amount ?? '-'
  const currency = payment.currency_code || paymentType?.currency_code || booking.currency_code || form.currency_code || 'EUR'
  const amountNumber = Number(amount)
  const amountFormatted = Number.isFinite(amountNumber)
    ? `${amountNumber.toFixed(2).replace('.', ',')} ${currency}`
    : '-'

  const guestName = resolveGuestName(booking, form)
  const refPartenaire = partnerOrderId.value || '-'
  const refFournisseur = supplierReference.value || '-'

  const printHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Confirmation de réservation - bedtrip.fr</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #222; max-width: 800px; margin: 0 auto; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
    .logo { font-size: 24px; font-weight: 700; color: #003580; }
    .confirmation-title { text-align: right; }
    .confirmation-title h1 { margin: 0; font-size: 18px; font-weight: 700; }
    .confirmation-title p { margin: 4px 0 0 0; font-size: 13px; color: #555; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 14px; font-weight: 700; margin: 0 0 12px 0; color: #003580; text-transform: uppercase; letter-spacing: 0.02em; }
    .property-name { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
    .detail-row { margin: 6px 0; }
    .detail-label { color: #555; }
    .dates-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px; }
    .date-box { padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
    .date-box strong { display: block; margin-bottom: 4px; }
    .price-total { font-size: 20px; font-weight: 700; margin-top: 12px; color: #003580; }
    .guest-block { padding: 12px; background: #f8fafc; border-radius: 8px; margin-top: 8px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #666; }
    .footer a { color: #003580; }
    @media print { body { padding: 16px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">bedtrip.fr</div>
    <div class="confirmation-title">
      <h1>CONFIRMATION DE RÉSERVATION</h1>
      <p>Référence partenaire : ${refPartenaire}</p>
      <p>Référence fournisseur : ${refFournisseur}</p>
    </div>
  </div>

  <div class="section">
    <h2>Hébergement et séjour</h2>
    <div class="property-name">${escapeHtml(hotelName)}</div>
    <div class="detail-row"><span class="detail-label">Adresse :</span> ${escapeHtml(fullAddress)}</div>
    <div class="dates-grid">
      <div class="date-box">
        <strong>Arrivée</strong>
        ${escapeHtml(checkIn)}
      </div>
      <div class="date-box">
        <strong>Départ</strong>
        ${escapeHtml(checkOut)}
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Prix</h2>
    <p>Montant total à payer à l'établissement : <span class="price-total">${escapeHtml(amountFormatted)}</span></p>
  </div>

  <div class="section">
    <h2>Voyageur(s)</h2>
    <div class="guest-block">
      <strong>Nom du voyageur</strong><br>
      ${escapeHtml(guestName)}
    </div>
  </div>

  <div class="footer">
    <p>Vous pouvez consulter ou modifier votre réservation en ligne : <a href="https://bedtrip.fr">bedtrip.fr</a></p>
    <p>Ce document constitue votre confirmation de réservation bedtrip.fr.</p>
  </div>

  <scr` + `ipt>
    window.onload = function() { window.print(); };
  </scr` + `ipt>
</body>
</html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(printHtml)
    win.document.close()
  }
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
  hydrateEtgDebug()
  hydrateSessionData()
  fetchBookingDetails()
  tickCountdown()
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined' && timerId) {
    window.clearTimeout(timerId)
  }
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
  width: 100%;
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

.confirmation-actions .with-icon {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.confirmation-actions .with-icon .pi {
  font-size: 1.1rem;
}

.redirect-hint {
  margin-top: 1rem;
}

.redirect-countdown {
  font-weight: 600;
  color: #0f172a;
}
</style>
