<!--
  BookingView
  ===========
  Vue view that replaces front/booking.html + front/booking.js.

  Responsibilities (to implement later):
  - Render the booking form shell (header + workspace) using layout components.
  - Show the prebook token and allow refreshing the form via API.
  - Display booking summary: partner order ID, hotel name, hotel details, stay summary cards.
  - Render traveler details form:
    - Civility, name, email, phone, notes.
    - Address (line1, zip+city, country code).
    - Payment method selection (Floa vs Systempay).
    - Floa product selection when Floa is chosen.
  - Connect to booking API helpers (`requestBookingForm`, `createFloaHotelDeal`, `finalizeFloaDeal`)
    via a dedicated composable / store in `../composables` or `../stores`.
  - Manage local state instead of direct DOM (`document.querySelector`) used in front/booking.js:
    - Booking status message and error state.
    - Prebook summary data (hotel, stay, rooms, payment).
    - Customer data and last used values from session storage.
  - Invoke API on user actions:
    - Call /api/booking/form to retrieve ETG booking form data.
    - Call /api/payments/floa/hotel/deal and /api/payments/floa/deal/{reference}/finalize
      when the user confirms the Floa payment.
  - Show loading states and disabled buttons while requests are in progress.

  Styling:
  - Reuse class names from front/public/style.css where possible:
    .app-shell, .app-header, .booking-app, .workspace--booking,
    .card, .booking-panel, .booking-status, .booking-summary,
    .summary-grid, .summary-card, .muted, button.primary/secondary.
  - The CSS will live in a shared stylesheet or in layout/components
    to keep a consistent design across views.

  This file will primarily orchestrate child components:
  - <AppShell> / layout wrapper.
  - <BookingHeader> for the top brand + title.
  - <PrebookSummaryCard> for token + partner order summary.
  - <StaySummaryList> for room cards.
  - <TravellerForm> for traveler + payment info.
-->

<template>
  <section class="workspace__content booking-view">
    <section class="card booking-panel">
      <div class="booking-intro">
        <div>
          <p class="muted" style="margin:0">Jeton de pré‑réservation</p>
          <code class="booking-token">{{ tokenDisplay }}</code>
        </div>
        <button
          class="secondary mini"
          type="button"
          @click="fetchBookingForm"
        >
          Rafraîchir le formulaire
        </button>
      </div>
      <div
        class="booking-status muted"
        :class="{ error: statusType === 'error' }"
      >
        {{ statusMessage }}
      </div>

      <div
        v-if="partnerOrderId || hotelSummary || stayCards.length"
        class="booking-summary"
      >
        <div class="summary-row">
          <div>
            <p class="muted" style="margin:0">ID de commande partenaire</p>
            <code class="booking-token">
              {{ partnerOrderId || '-' }}
            </code>
          </div>
        </div>
        <div class="summary-row">
          <div>
            <p class="muted" style="margin:0">Hôtel</p>
            <strong class="booking-hotel-title">{{ hotelSummary?.name || '-' }}</strong>
            <p class="muted" style="margin:4px 0 0 0">
              {{ hotelSummary?.details || '' }}
            </p>
          </div>
        </div>
        <div class="summary-grid">
          <div
            v-for="(card, idx) in stayCards"
            :key="idx"
            class="summary-card"
          >
            <p class="muted">Chambre {{ idx + 1 }}</p>
            <strong>{{ card.title }}</strong>
            <p>{{ card.meal }}</p>
            <p class="muted">Voyageurs : {{ card.guests }}</p>
            <p class="muted">{{ card.price }}</p>
          </div>
        </div>
      </div>

      <section class="card booking-form" aria-live="polite">
        <h3>Récapitulatif & paiement</h3>
        <form class="booking-details-form" @submit.prevent>
          <div class="booking-payment-layout">
            <div class="booking-payment-layout__left">
              <div class="payment-summary-card">
                <p class="muted" style="margin:0;">
                  Vous êtes sur le point de payer le produit suivant :
                </p>
                <p class="payment-summary-card__amount">
                  {{ primaryPriceText || 'Montant à définir' }}
                </p>
                <p class="muted payment-summary-card__meta">
                  {{ hotelSummary?.name || 'Hôtel non spécifié' }}
                  <span v-if="hotelSummary?.details">
                    · {{ hotelSummary.details }}
                  </span>
                </p>
                <p
                  v-if="primaryStayCard"
                  class="muted payment-summary-card__meta"
                  style="margin-top:.25rem;"
                >
                  {{ primaryStayCard.title }}
                  <span v-if="primaryStayCard.meal">
                    · {{ primaryStayCard.meal }}
                  </span>
                  <span v-if="primaryStayCard.guests">
                    · {{ primaryStayCard.guests }}
                  </span>
                </p>
                <p class="payment-summary-card__hint">
                  Vérifiez bien les dates, le nombre de voyageurs et le montant avant
                  de poursuivre le paiement.
                </p>
              </div>
              <div class="payment-and-client__column">
                  <h4 class="payment-and-client__title">Méthode de paiement</h4>
                  <div class="payment-methods">
                    <button
                      type="button"
                      class="payment-method-card"
                      :class="{
                        'payment-method-card--active':
                          paymentMethod === 'systempay',
                      }"
                      @click="paymentMethod = 'systempay'"
                    >
                      <div class="payment-method-card__header">
                        <span class="payment-method-card__title">
                          <i
                            class="pi pi-credit-card payment-method-card__icon"
                            aria-hidden="true"
                          ></i>
                          Paiement par carte (Systempay)
                        </span>
                        <span class="payment-method-card__right">
                          <span class="payment-method-card__brands">
                            <span
                              class="card-brand card-brand--visa"
                              aria-hidden="true"
                            >
                              VISA
                            </span>
                          </span>
                          <span class="payment-method-card__radio"></span>
                        </span>
                      </div>
                      <p class="muted payment-method-card__hint">
                        Redirection immédiate vers Systempay pour effectuer un paiement
                        par carte bancaire classique.
                      </p>
                    </button>

                    <div
                      class="payment-method-card"
                      :class="{
                        'payment-method-card--active':
                          paymentMethod === 'floa',
                      }"
                    >
                      <button
                        type="button"
                        class="floa-accordion__header"
                        @click="selectFloa"
                      >
                        <span class="payment-method-card__title">
                          <i
                            class="pi pi-percentage payment-method-card__icon"
                            aria-hidden="true"
                          ></i>
                          Paiement en plusieurs fois (Floa)
                        </span>
                        <span class="floa-accordion__header-right">
                          <span class="payment-method-card__radio"></span>
                        </span>
                      </button>

                      <div
                        v-if="paymentMethod === 'floa'"
                        class="floa-plans"
                      >
                        <p class="muted floa-plans__label">
                          Choisissez un plan de paiement Floa
                          <span class="required-asterisk">*</span> :
                        </p>
                        <div class="floa-plans__options">
                          <button
                            type="button"
                            class="floa-plan"
                            :class="{ 'floa-plan--active': floaProduct === 'BC3XF' }"
                            @click="floaProduct = 'BC3XF'"
                          >
                            <span class="floa-plan__title">3x</span>
                            <span class="floa-plan__meta">Paiement en 3 mensualités</span>
                          </button>
                          <button
                            type="button"
                            class="floa-plan"
                            :class="{ 'floa-plan--active': floaProduct === 'BC4XF' }"
                            @click="floaProduct = 'BC4XF'"
                          >
                            <span class="floa-plan__title">4x</span>
                            <span class="floa-plan__meta">Paiement en 4 mensualités</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="payment-primary-action">
                    <button
                      type="button"
                      class="primary"
                      @click="handlePrimaryAction"
                      :disabled="isPrimaryDisabled"
                    >
                      {{ primaryActionLabel }}
                    </button>
                  </div>
                </div>
            </div>

            <aside class="booking-payment-layout__right">
              <div class="payment-and-client">

                <div class="payment-and-client__column">
                  <h4 class="payment-and-client__title">Informations client</h4>
                  <div class="row">
                    <label>
                      Civilité
                      <span class="required-asterisk">*</span>
                      <select
                        v-model="traveller.civility"
                        required
                      >
                        <option value="">Sélectionner…</option>
                        <option value="MR">M.</option>
                        <option value="MRS">Mme</option>
                        <option value="MS">Mlle</option>
                      </select>
                    </label>
                    <label>
                      Prénom
                      <span class="required-asterisk">*</span>
                      <input
                        v-model="traveller.firstName"
                        type="text"
                        placeholder="John"
                        required
                      />
                    </label>
                    <label>
                      Nom
                      <span class="required-asterisk">*</span>
                      <input
                        v-model="traveller.lastName"
                        type="text"
                        placeholder="Doe"
                        required
                      />
                    </label>
                  </div>
                  <div class="row">
                    <label>
                      Société (optionnel)
                      <input
                        v-model="traveller.company"
                        type="text"
                        placeholder="Nom de la société"
                      />
                    </label>
                  </div>
                  <div class="row">
                    <label>
                      Adresse
                      <input
                        v-model="traveller.addressLine1"
                        type="text"
                        placeholder="1 Rue de la Paix"
                      />
                    </label>
                    <label>
                      Code postal
                      <input
                        v-model="traveller.postalCode"
                        type="text"
                        placeholder="33000"
                      />
                    </label>
                    <label>
                      Ville
                      <input
                        v-model="traveller.city"
                        type="text"
                        placeholder="Bordeaux"
                      />
                    </label>
                  </div>
                  <div class="row">
                    <label>
                      Email
                      <span class="required-asterisk">*</span>
                      <input
                        v-model="traveller.email"
                        type="email"
                        placeholder="john@example.com"
                        required
                      />
                    </label>
                    <label>
                      Numéro de téléphone
                      <span class="required-asterisk">*</span>
                      <input
                        v-model="traveller.phone"
                        type="tel"
                        placeholder="+33 6 00 00 00 00"
                        required
                      />
                    </label>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </form>
      </section>

      <details class="debug-panel" open>
        <summary>Debug</summary>
        <pre>booking/form request: {{ formatDebug(debugBookingFormReq) }}</pre>
        <pre>booking/form response: {{ formatDebug(debugBookingFormRes) }}</pre>
        <pre>booking/form etg: {{ formatDebug(debugBookingFormEtg) }}</pre>
        <pre>booking/form error: {{ formatDebug(debugBookingFormErr) }}</pre>
        <pre>systempay redirect: {{ formatDebug(debugSystempay) }}</pre>
        <pre>floa deal request: {{ formatDebug(debugFloaReq) }}</pre>
        <pre>floa deal response: {{ formatDebug(debugFloaRes) }}</pre>
        <pre>floa deal error: {{ formatDebug(debugFloaErr) }}</pre>
      </details>

    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  requestBookingForm,
  createFloaHotelDeal,
  finalizeFloaDeal,
} from '../services/bookingApi.js'
import { API_BASE } from '../services/httpClient.js'

const route = useRoute()
const router = useRouter()

const PREBOOK_SUMMARY_KEY = 'booking:lastPrebook'
const MARKUP_PERCENT = 10

const statusMessage = ref('')
const statusType = ref('info')
const loading = ref(false)

const partnerOrderId = ref('')
const hotelSummary = ref(null)
const stayCards = ref([])

const traveller = ref({
  civility: '',
  firstName: '',
  lastName: '',
  company: '',
  email: '',
  phone: '',
  addressLine1: '',
  postalCode: '',
  city: '',
  zipCity: '',
  notes: '',
})

const paymentMethod = ref('floa')
const floaProduct = ref('')
const payLoading = ref(false)

const debugBookingFormReq = ref(null)
const debugBookingFormRes = ref(null)
const debugBookingFormErr = ref(null)
const debugBookingFormEtg = ref(null)
const debugSystempay = ref(null)
const debugFloaReq = ref(null)
const debugFloaRes = ref(null)
const debugFloaErr = ref(null)

const storedPrebookSummary = ref(null)
const storedPrebookPayload = ref(null)

const token = computed(
  () =>
    route.query.token ||
    route.query.book_hash ||
    route.query.prebook_token ||
    '',
)

const tokenDisplay = computed(() => token.value || '-')

const primaryPriceText = computed(() => {
  if (!stayCards.value.length) return ''
  return stayCards.value[0]?.price || ''
})

const primaryStayCard = computed(() =>
  stayCards.value.length ? stayCards.value[0] : null,
)

const isFloaPayment = computed(
  () => paymentMethod.value === 'floa',
)

const primaryActionLabel = computed(() => {
  if (payLoading.value) return 'Traitement du paiement…'
  return isFloaPayment.value
    ? 'Continuer avec Floa'
    : 'Payer avec Systempay'
})

const isPrimaryDisabled = computed(
  () =>
    payLoading.value ||
    (isFloaPayment.value && !floaProduct.value),
)

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

function loadPrebookSummaryFromSession() {
  try {
    if (typeof window === 'undefined') return
    const ss = window.sessionStorage
    if (!ss) return
    const rawSummary = ss.getItem(PREBOOK_SUMMARY_KEY)
    if (!rawSummary) return
    const parsed = JSON.parse(rawSummary)
    const payloadToken = parsed?.token || parsed?.summary?.token
    const currentToken = token.value
    if (currentToken && payloadToken && payloadToken !== currentToken) {
      return
    }
    if (parsed?.summary || parsed?.payload) {
      storedPrebookSummary.value = parsed.summary || null
      storedPrebookPayload.value = parsed.payload || null
    } else {
      storedPrebookSummary.value = parsed
      storedPrebookPayload.value = parsed?.payload || null
    }
  } catch {
    storedPrebookSummary.value =
      storedPrebookSummary.value || null
    storedPrebookPayload.value =
      storedPrebookPayload.value || null
  }
}

function selectFloa() {
  paymentMethod.value = 'floa'
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

function applyMarkupAmount(amount) {
  const num = Number(amount)
  if (!Number.isFinite(num)) return amount
  return Math.round(num * (1 + MARKUP_PERCENT / 100) * 100) / 100
}

function resolveMarkedUpAmount(amount, baseReference) {
  const num = Number(amount)
  if (!Number.isFinite(num)) return amount
  const base = Number(baseReference)
  if (Number.isFinite(base) && base > 0) {
    const expected = applyMarkupAmount(base)
    return num >= expected * 0.99 ? num : expected
  }
  return applyMarkupAmount(num)
}

function deriveHotelFromPayload(payload) {
  if (!payload) return null
  const hotels =
    (Array.isArray(payload?.data?.hotels) && payload.data.hotels) ||
    (Array.isArray(payload?.hotels) && payload.hotels) ||
    (Array.isArray(payload?.prebook_token?.hotels) &&
      payload.prebook_token.hotels) ||
    []
  if (!hotels.length) return null
  const hotel = hotels[0]
  return {
    id: hotel?.id || null,
    hid: hotel?.hid || null,
    name:
      hotel?.name ||
      hotel?.hotel_name ||
      hotel?.legal_info?.hotel?.name ||
      null,
    city:
      hotel?.city ||
      hotel?.city_name ||
      hotel?.legal_info?.hotel?.city ||
      null,
    address:
      hotel?.address ||
      hotel?.legal_info?.hotel?.address ||
      null,
    country:
      hotel?.country ||
      hotel?.country_name ||
      hotel?.legal_info?.hotel?.country ||
      null,
  }
}

function computeHotelSummary(form = {}) {
  const rooms = Array.isArray(form.rooms) ? form.rooms : []
  const hotelPayload = form.hotel || form.order?.hotel || {}
  const roomSample = rooms[0] || {}
  const payloadHotel = deriveHotelFromPayload(
    storedPrebookPayload.value,
  )
  const fallbackId =
    storedPrebookSummary.value?.hotel?.id || payloadHotel?.id || null
  const fallbackHid =
    storedPrebookSummary.value?.hotel?.hid ||
    payloadHotel?.hid ||
    null
  const fallbackName =
    fallbackId && typeof fallbackId === 'string'
      ? fallbackId.replace(/_/g, ' ').trim()
      : null
  const hotelName =
    hotelPayload.name ||
    hotelPayload.hotel_name ||
    form.hotel_name ||
    form.order?.hotel_name ||
    roomSample.hotel_name ||
    roomSample.name ||
    storedPrebookSummary.value?.hotel?.name ||
    payloadHotel?.name ||
    fallbackName ||
    (fallbackHid ? `Hotel #${fallbackHid}` : null)

  const checkin =
    form.checkin ||
    form.order?.checkin ||
    hotelPayload.checkin ||
    form.arrival_date ||
    storedPrebookSummary.value?.stay?.checkin ||
    null
  const checkout =
    form.checkout ||
    form.order?.checkout ||
    hotelPayload.checkout ||
    form.departure_date ||
    storedPrebookSummary.value?.stay?.checkout ||
    null
  const city =
    hotelPayload.city ||
    hotelPayload.location_city ||
    form.city ||
    form.destination_name ||
    storedPrebookSummary.value?.hotel?.city ||
    payloadHotel?.city ||
    null
  const address =
    hotelPayload.address ||
    storedPrebookSummary.value?.hotel?.address ||
    payloadHotel?.address ||
    null
  const detailParts = []
  if (city || address) {
    const locParts = [address, city].filter(Boolean)
    detailParts.push(locParts.join(', '))
  }
  if (checkin || checkout) {
    detailParts.push(
      `Séjour ${checkin || '?'} → ${checkout || '?'}`,
    )
  }
  const country =
    storedPrebookSummary.value?.hotel?.country ||
    payloadHotel?.country ||
    null
  if (!detailParts.length && country) {
    detailParts.push(country)
  }

  hotelSummary.value = {
    name: hotelName || 'Hôtel non spécifié',
    details: detailParts.join(' · ') || '',
  }
}

function formatGuestsLabel(guests) {
  if (!Array.isArray(guests) || !guests.length) return ''
  let adults = 0
  let children = 0
  guests.forEach((group) => {
    const adultCount = Number(group?.adults)
    if (Number.isFinite(adultCount)) adults += adultCount
    if (Array.isArray(group?.children)) {
      children += group.children.length
    } else {
      const childCount = Number(group?.children)
      if (Number.isFinite(childCount)) children += childCount
    }
  })
  const parts = []
  if (adults) parts.push(`${adults} adulte${adults > 1 ? 's' : ''}`)
  if (children)
    parts.push(`${children} enfant${children > 1 ? 's' : ''}`)
  return parts.join(', ')
}

function computeStayCards(form = {}) {
  const cards = []
  const rooms = Array.isArray(form.rooms) ? form.rooms : []
  const pricing = form.pricing || null
  const pricingAmount =
    pricing && Number.isFinite(Number(pricing.total_amount))
      ? Number(pricing.total_amount)
      : null
  const pricingCurrency =
    pricing && pricing.currency ? pricing.currency : null

  if (!rooms.length && storedPrebookSummary.value?.room) {
    const fallback = storedPrebookSummary.value
    const payloadHotels =
      storedPrebookPayload.value?.data?.hotels ||
      storedPrebookPayload.value?.hotels ||
      storedPrebookPayload.value?.prebook_token?.hotels ||
      []
    const payloadHotel = payloadHotels[0] || null
    const payloadRate = payloadHotel?.rates?.[0] || null
    const payloadPayment =
      payloadRate?.payment_options?.payment_types?.[0] || null
    const guests =
      fallback?.stay?.guest_label ||
      fallback?.room?.guests_label ||
      formatGuestsLabel(fallback?.stay?.guests) ||
      ''
    let price = ''
    if (fallback.room.price) {
      const resolved =
        pricingAmount != null
          ? pricingAmount
          : resolveMarkedUpAmount(
              fallback.room.price,
              payloadPayment?.show_amount || payloadPayment?.amount,
            )
      price = formatPrice(resolved, pricingCurrency || fallback.room.currency)
    }
    cards.push({
      title: fallback.room.name || 'Room',
      meal: fallback.room.meal || '',
      guests: guests || '-',
      price: price || '',
    })
    stayCards.value = cards
    return
  }

  if (!rooms.length && storedPrebookPayload.value) {
    const payloadHotels =
      storedPrebookPayload.value?.data?.hotels ||
      storedPrebookPayload.value?.hotels ||
      storedPrebookPayload.value?.prebook_token?.hotels ||
      []
    const payloadHotel = payloadHotels[0] || null
    const payloadRate = payloadHotel?.rates?.[0] || null
    const payloadPayment =
      payloadRate?.payment_options?.payment_types?.[0] || null
    if (payloadRate) {
      const rawAmount =
        payloadPayment?.show_amount || payloadPayment?.amount
      const resolved =
        pricingAmount != null
          ? pricingAmount
          : applyMarkupAmount(rawAmount)
      const price =
        resolved != null
          ? formatPrice(
              resolved,
              pricingCurrency ||
                payloadPayment?.show_currency_code ||
                payloadPayment?.currency_code,
            )
          : ''
      const guestsLabel =
        storedPrebookSummary.value?.stay?.guest_label ||
        storedPrebookSummary.value?.room?.guests_label ||
        formatGuestsLabel(storedPrebookSummary.value?.stay?.guests) ||
        '-'
      cards.push({
        title:
          payloadRate.room_name ||
          payloadRate.room_data_trans?.main_name ||
          'Room',
        meal: payloadRate.meal || '',
        guests: guestsLabel,
        price: price || '',
      })
      stayCards.value = cards
      return
    }
  }

  rooms.forEach((room) => {
    const guests = Array.isArray(room.guests)
      ? room.guests
          .map((g) =>
            `${g.type || 'guest'} ${g.name || ''}`.trim(),
          )
          .join(', ')
      : '-'
    const payment =
      room.payment_options?.payment_types?.[0] ||
      form.payment_type ||
      {}
    const rawAmount = payment.show_amount || payment.amount
    const resolved =
      pricingAmount != null ? pricingAmount : applyMarkupAmount(rawAmount)
    const price = formatPrice(
      resolved,
      pricingCurrency || payment.show_currency_code || payment.currency_code,
    )
    cards.push({
      title: room.name || room.room_name || 'Room',
      meal: room.rate_name || room.board_name || '',
      guests: guests || '-',
      price: price || '',
    })
  })

  stayCards.value = cards
}

async function fetchBookingForm() {
  if (!token.value) {
    setStatus(
      'Missing prebook token. Append ?token=p-... to the URL.',
      'error',
    )
    return
  }
  setStatus('Chargement du formulaire de réservation…', 'info')
  loading.value = true
  try {
    debugBookingFormReq.value = { prebook_token: String(token.value) }
    debugBookingFormErr.value = null
    console.log('[Debug][BookingView] booking/form request', {
      prebook_token: String(token.value),
    })
    const data = await requestBookingForm(String(token.value))
    console.log('[Debug][BookingView] booking/form response', data)
    debugBookingFormRes.value = data
    debugBookingFormEtg.value =
      data && data._debug && data._debug.etg ? data._debug.etg : null

    partnerOrderId.value = data.partner_order_id || ''
    const form = data.form || {}

    computeHotelSummary(form)
    computeStayCards(form)

    setStatus(
      'Formulaire de réservation récupéré. Complétez les détails du voyageur.',
      'info',
    )
  } catch (err) {
    debugBookingFormErr.value = {
      message: err?.message || String(err || ''),
      detail: err?._detail || null,
    }
    setStatus(
      `Impossible de récupérer le formulaire de réservation : ${
        err?.message || String(err || '')
      }`,
      'error',
    )
  } finally {
    loading.value = false
  }
}

function buildCustomerContext() {
  const partnerId = partnerOrderId.value?.trim()
  if (!partnerId) {
    return {
      ok: false,
      error:
        "ID de commande partenaire manquant. Chargez d'abord le formulaire.",
    }
  }

  const method = paymentMethod.value
  if (!method) {
    return {
      ok: false,
      error: 'Choisissez un moyen de paiement.',
    }
  }

  const civility = (traveller.value.civility || '').trim()
  const firstName = (traveller.value.firstName || '').trim()
  const lastName = (traveller.value.lastName || '').trim()
  const email = (traveller.value.email || '').trim()
  const phone = (traveller.value.phone || '').trim()
  const company = (traveller.value.company || '').trim()

  if (!civility || !firstName || !lastName || !email || !phone) {
    return {
      ok: false,
      error:
        'Veuillez renseigner civilité, prénom, nom, email et téléphone avant le paiement.',
    }
  }

  const fullName = `${firstName} ${lastName}`.trim()

  const addrLine1 = (traveller.value.addressLine1 || '').trim()
  const postalCode = (traveller.value.postalCode || '').trim()
  const cityInput = (traveller.value.city || '').trim()
  const zipCity = (traveller.value.zipCity || '').trim()

  let zipCode = postalCode || ''
  let city = cityInput || ''

  if ((!zipCode || !city) && zipCity) {
    const parts = zipCity.split(' ')
    const guessedZip = parts.shift() || ''
    const guessedCity = parts.join(' ') || ''
    if (!zipCode) zipCode = guessedZip
    if (!city) city = guessedCity
  }

  const countryCode = 'FR'

  const customer = {
    civility,
    firstName,
    lastName,
    email,
    mobilePhoneNumber: phone,
    homeAddress: {
      line1: company || addrLine1,
      zipCode: zipCode || '',
      city: city || '',
      countryCode,
    },
  }

  return {
    ok: true,
    partnerId,
    method,
    civility,
    firstName,
    lastName,
    fullName,
    email,
    phone,
    customer,
  }
}

async function startPayment(forcedMethod) {
  const context = buildCustomerContext()
  if (!context.ok) {
    setStatus(context.error, 'error')
    return
  }

  const {
    partnerId,
    method: currentMethod,
    civility,
    firstName,
    lastName,
    fullName,
    email,
    phone,
    customer,
  } = context

  const method = forcedMethod || currentMethod

  // Systempay path: redirect to Systempay test page
  if (method === 'systempay') {
    try {
          if (typeof window !== 'undefined') {
            const ss = window.sessionStorage
            if (ss) {
              ss.setItem('booking:lastPartnerOrderId', partnerId)
              ss.setItem(
                'booking:lastCustomer',
                JSON.stringify({ civility, fullName, email, phone }),
          )
        }
      router.push({
        name: 'systempay-test',
        query: {
          partner_order_id: partnerId,
          email,
          first_name: firstName,
          last_name: lastName,
          phone,
          civility,
        },
      })
      debugSystempay.value = {
        partner_order_id: partnerId,
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        civility,
      }
      console.log('[Debug][BookingView] systempay redirect params', {
        partner_order_id: partnerId,
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        civility,
      })
      }
    } catch (err) {
      setStatus(
        `Erreur lors de la préparation du paiement Systempay : ${
          err?.message || String(err || '')
        }`,
        'error',
      )
    }
    return
  }

  // Floa path
  if (method === 'floa') {
    const productCode = floaProduct.value || ''
    if (!productCode) {
      setStatus(
        'Choisissez un produit Floa avant de démarrer le paiement.',
        'error',
      )
      return
    }

    // Persist partner order + customer info for success page
    try {
      if (typeof window !== 'undefined') {
        const ss = window.sessionStorage
        if (ss) {
          ss.setItem('booking:lastPartnerOrderId', partnerId)
          ss.setItem(
            'booking:lastCustomer',
            JSON.stringify({ civility, fullName, email, phone }),
          )
        }
      }
    } catch {
      // best-effort only
    }

    const body = {
      partner_order_id: partnerId,
      productCode,
      device: 'Desktop',
      customer,
    }

    try {
      debugFloaReq.value = body
      debugFloaErr.value = null
      console.log('[Debug][BookingView] floa deal request', body)
      setStatus(
        'Contact de FloaBank pour éligibilité et création du deal…',
        'info',
      )
      payLoading.value = true
      const payload = await createFloaHotelDeal(body)
      debugFloaRes.value = payload
      console.log('[Debug][BookingView] floa deal response', payload)

      const deal = payload.deal || payload
      const dealReference =
        deal?.dealReference ||
        deal?.reference ||
        deal?.deal_reference ||
        null
      const dealMerchantReference =
        deal?.merchantReference ||
        deal?.merchant_reference ||
        deal?.merchantreference ||
        partnerId

      if (!dealReference) {
        setStatus(
          'Deal Floa créé mais aucun dealReference retourné. Consultez le panneau debug.',
          'error',
        )
        return
      }

      setStatus('Deal Floa créé. Finalisation avec Floa…', 'info')

      const finalizeBody = {
        merchantReference: dealMerchantReference,
        configuration: {
          culture: 'fr-FR',
        },
      }
      if (finalizeBody.configuration && !finalizeBody.configuration.returnUrl) {
        const base =
          API_BASE && API_BASE.length
            ? API_BASE.replace(/\/$/, '')
            : window.location.origin.replace(/\/$/, '')
        finalizeBody.configuration.returnUrl = `${base}/floa-return`
      }

      const finalizePayload = await finalizeFloaDeal(
        dealReference,
        finalizeBody,
      )

      if (
        finalizePayload?.error ||
        finalizePayload?.status === 'nok'
      ) {
        const reason =
          finalizePayload?.reason ||
          finalizePayload?.error ||
          finalizePayload?._raw ||
          'Unknown error'
        setStatus(
          `Impossible de finaliser le deal Floa : ${reason}`,
          'error',
        )
        return
      }

      const result = finalizePayload.result || finalizePayload
      let redirectUrl = null

      if (typeof result.redirectUrl === 'string') {
        redirectUrl = result.redirectUrl
      } else if (typeof result.redirectURL === 'string') {
        redirectUrl = result.redirectURL
      } else if (typeof result.url === 'string') {
        redirectUrl = result.url
      } else if (Array.isArray(result.links)) {
        const link =
          result.links.find(
            (l) =>
              l &&
              typeof l.href === 'string' &&
              (l.rel === 'payment-page' ||
                l.rel === 'redirect' ||
                l.rel === 'webpage'),
          ) ||
          result.links.find(
            (l) => l && typeof l.href === 'string',
          )
        if (link && link.href) {
          redirectUrl = link.href
        }
      }

      if (redirectUrl) {
        setStatus(
          'Redirection vers la page de paiement Floa…',
          'info',
        )
        if (typeof window !== 'undefined') {
          window.location.href = redirectUrl
        }
      } else {
        setStatus(
          "Deal Floa finalisé. Consultez la réponse dans le panneau debug pour le lien de paiement.",
          'info',
        )
      }
    } catch (err) {
      debugFloaErr.value = {
        message: err?.message || String(err || ''),
        detail: err?._detail || null,
      }
      setStatus(
        `Erreur de paiement Floa : ${
          err?.message || String(err || '')
        }`,
        'error',
      )
    } finally {
      payLoading.value = false
    }
  }
}

function handlePrimaryAction() {
  if (isFloaPayment.value) {
    startPayment()
  } else {
    startPayment('systempay')
  }
}

onMounted(() => {
  loadPrebookSummaryFromSession()
  if (token.value) {
    fetchBookingForm()
  } else {
    setStatus(
      'Fournissez un token de pré‑réservation dans l’URL pour charger le formulaire.',
      'error',
    )
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

.booking-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 2rem;
}

.booking-panel {
  display: grid;
  gap: 1rem;
}

.booking-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.booking-token {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
  font-size: 0.8rem;
}

.booking-status.error {
  color: #fca5a5;
}

.booking-summary {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.booking-hotel-title {
  font-size: 1.05rem;
  text-transform: capitalize;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.summary-card {
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.75rem;
  background: #4b78be;
  color: rgba(255, 255, 255, 0.88);
}

.summary-card strong {
  color: #ffffff;
}

.summary-card .muted {
  color: rgba(255, 255, 255, 0.7);
}

.booking-form .row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.booking-raw__pre {
  margin: 0;
  font-size: 0.75rem;
}

.booking-payment-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 1rem;
}

.booking-payment-layout__right {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.payment-methods {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0.75rem 0 0.5rem;
}

.payment-method-card {
  width: 100%;
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: transparent;
  padding: 0.7rem 0.85rem;
  text-align: left;
  cursor: pointer;
  color: #0f172a;
}

.payment-method-card .muted {
  color: #475569;
}

.payment-method-card--active {
  border-color: rgba(55, 107, 176, 0.6);
  background: rgba(55, 107, 176, 0.08);
  box-shadow: 0 16px 40px -24px rgba(15, 23, 42, 0.12);
}

.payment-method-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.payment-method-card__title {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  color: #0f172a;
}

.payment-method-card__right {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.payment-method-card__brands {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.card-brand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.1rem 0.45rem;
  border-radius: 0.35rem;
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.card-brand--visa {
  background: #1a1f71;
  color: #f9fafb;
}

.payment-method-card__icon {
  font-size: 1rem;
}

.payment-method-card__radio {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid rgba(148, 163, 184, 0.6);
  box-shadow: inset 0 0 0 2px rgba(15, 23, 42, 0.15);
}

.payment-method-card--active .payment-method-card__radio {
  border-color: #376bb0;
  background: #376bb0;
}

.payment-method-card__hint {
  margin: 0.4rem 0 0;
  font-size: 0.75rem;
}

.payment-summary-card {
  border-radius: 0.9rem;
  border: 1px solid rgba(55, 107, 176, 0.3);
  background: radial-gradient(circle at 0 0, rgba(55, 107, 176, 0.12), transparent 55%),
    radial-gradient(circle at 100% 0, rgba(59, 130, 246, 0.14), transparent 55%),
    #f8fafc;
  padding: 0.9rem 1rem;
}

.payment-summary-card__amount {
  margin: 0.35rem 0 0.25rem;
  font-size: 1.35rem;
  font-weight: 600;
  color: #376bb0;
}

.payment-summary-card__meta {
  margin: 0;
  font-size: 0.8rem;
}

.payment-summary-card__hint {
  margin: 0.65rem 0 0;
  font-size: 0.7rem;
  color: #9ca3af;
}

.payment-primary-action {
  margin-top: 0.75rem;
  display: flex;
  justify-content: flex-end;
}

.payment-and-client {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.payment-and-client__column {
  flex: 1 1 260px;
  min-width: 0;
}

.payment-and-client__title {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
}

.required-asterisk {
  color: #f97373;
  margin-left: 0.15rem;
}

.floa-accordion {
  margin-top: 0.35rem;
  overflow: hidden;
}

.floa-accordion__header {
  width: 100%;
  padding: 0.55rem 0.2rem 0.25rem;
  background: transparent;
  border: 0;
  color: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
  cursor: pointer;
}

.floa-accordion__icon {
  font-size: 0.85rem;
  transition: transform 0.2s ease;
}

.floa-accordion__icon.is-open {
  transform: rotate(180deg);
}

.floa-accordion__header-right {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.floa-plans {
  padding: 0 0.75rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.floa-plans__label {
  font-size: 0.75rem;
}

.floa-plans__options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.floa-plan {
  flex: 1 1 120px;
  min-width: 0;
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: transparent;
  padding: 0.5rem 0.7rem;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  color: #0f172a;
}

.floa-plan--active {
  border-color: #376bb0;
  background: #376bb0;
  box-shadow: 0 14px 30px -18px rgba(55, 107, 176, 0.35);
}

.floa-plan__title {
  font-weight: 600;
  font-size: 0.85rem;
}

.floa-plan__meta {
  font-size: 0.75rem;
  color: #475569;
}

.floa-plan--active .floa-plan__title,
.floa-plan--active .floa-plan__meta {
  color: #ffffff;
}
</style>
