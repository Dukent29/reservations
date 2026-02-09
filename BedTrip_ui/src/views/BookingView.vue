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
            <strong>{{ hotelSummary?.name || '-' }}</strong>
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
                <div class="payment-summary-card__lines">
                  <div class="payment-summary-card__line">
                    <span class="muted">Montant du séjour</span>
                    <span>{{ primaryPriceText || '-' }}</span>
                  </div>
                  <div
                    v-if="selectedExtras.length"
                    class="payment-summary-card__addons"
                  >
                    <div
                      v-for="extra in selectedExtras"
                      :key="extra.id"
                      class="payment-summary-card__line"
                    >
                      <span class="muted">{{ extra.title }}</span>
                      <span>
                        {{ formatPrice(extra.price, displayCurrency) }}
                      </span>
                    </div>
                  </div>
                  <div class="payment-summary-card__line payment-summary-card__total">
                    <span>Total estimé</span>
                    <span>{{ totalPriceText }}</span>
                  </div>
                </div>
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
              <div class="insurance-card">
                <div class="insurance-card__header">
                  <h4 class="insurance-card__title">Assurance voyage</h4>
                  <p class="muted insurance-card__subtitle">
                    Ajoutez la couverture ANBVM d’Assur‑Travel.
                  </p>
                </div>
                <div class="insurance-options">
                  <label
                    v-for="option in insuranceOptions"
                    :key="option.id"
                    class="insurance-option"
                    :class="{ 'insurance-option--active': selectedExtrasMap[option.key] }"
                  >
                    <span class="insurance-option__left">
                      <input
                        type="checkbox"
                        :value="true"
                        v-model="selectedExtrasMap[option.key]"
                      />
                      <span>
                        <strong>{{ option.title }}</strong>
                        <span class="insurance-option__desc">
                          {{ option.description }}
                        </span>
                      </span>
                    </span>
                    <span class="insurance-option__price">
                      + {{ formatPrice(option.price, displayCurrency) }}
                    </span>
                  </label>
                </div>
                <p class="muted insurance-card__hint">
                  Le total estimé inclut les options choisies. Le montant final est confirmé au paiement.
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

      <section class="card booking-raw">
        <h3>Formulaire ETG brut</h3>
        <pre class="booking-raw__pre">
{{ rawFormText }}
        </pre>
      </section>
    </section>

    <section class="card" style="margin-top:1rem;">
      <h3 style="font-size:.9rem;margin-top:0;">Debug réservation</h3>
      <p class="muted" style="font-size:.75rem;margin-bottom:.5rem;">
        Historique des appels /api/booking/form et futurs paiements.
      </p>
      <pre
        v-if="debugEntries.length"
        style="max-height:220px;overflow:auto;font-size:.7rem;white-space:pre-wrap;background:rgba(15,23,42,.7);padding:.5rem;border-radius:.5rem;border:1px solid rgba(148,163,184,.4);"
      >{{ formattedDebug }}</pre>
      <p v-else class="muted" style="font-size:.75rem;">
        Aucun appel pour le moment.
      </p>
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

const route = useRoute()
const router = useRouter()

const PREBOOK_SUMMARY_KEY = 'booking:lastPrebook'

const statusMessage = ref('')
const statusType = ref('info')
const loading = ref(false)

const partnerOrderId = ref('')
const hotelSummary = ref(null)
const stayCards = ref([])
const rawFormText = ref('// en attente du formulaire de réservation…')

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

const debugEntries = ref([])

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

const insuranceOptions = [
  {
    id: 'ANBVM',
    key: 'anbvm',
    title: 'Assurance voyage ANBVM',
    description: 'Couverture Assur‑Travel pour votre séjour.',
    price: 18,
  },
]

const selectedExtrasMap = ref({
  anbvm: false,
})

const selectedExtras = computed(() =>
  insuranceOptions.filter(
    (option) => selectedExtrasMap.value[option.key],
  ),
)

const selectedExtrasIds = computed(() =>
  selectedExtras.value.map((extra) => extra.id),
)

const insurancePayload = computed(() =>
  selectedExtrasIds.value.length
    ? { selected: selectedExtrasIds.value }
    : null,
)

const displayCurrency = computed(
  () => stayCards.value[0]?.currency || 'EUR',
)

const extrasTotal = computed(() =>
  selectedExtras.value.reduce(
    (sum, option) => sum + Number(option.price || 0),
    0,
  ),
)

const baseAmount = computed(
  () =>
    Number.isFinite(stayCards.value[0]?.amount)
      ? stayCards.value[0].amount
      : null,
)

const totalAmount = computed(
  () =>
    Number.isFinite(baseAmount.value)
      ? baseAmount.value + extrasTotal.value
      : null,
)

const totalPriceText = computed(() => {
  if (!Number.isFinite(totalAmount.value)) {
    return primaryPriceText.value || '-'
  }
  return formatPrice(totalAmount.value, displayCurrency.value)
})

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

const formattedDebug = computed(() =>
  debugEntries.value
    .map((entry) => {
      const payload =
        typeof entry.payload === 'string'
          ? entry.payload
          : JSON.stringify(entry.payload, null, 2)
      return `[${entry.time}] ${entry.label}\n${payload}`
    })
    .join('\n\n'),
)

function pushDebug(label, payload) {
  const time = new Date().toISOString()
  debugEntries.value.unshift({ time, label, payload })
  debugEntries.value = debugEntries.value.slice(0, 30)
}

function setStatus(message, type = 'info') {
  statusMessage.value = message || ''
  statusType.value = type
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

function deriveHotelFromPayload(payload) {
  if (!payload) return null
  const hotels =
    (Array.isArray(payload?.data?.hotels) && payload.data.hotels) ||
    (Array.isArray(payload?.hotels) && payload.hotels) ||
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
  const hotelName =
    hotelPayload.name ||
    hotelPayload.hotel_name ||
    form.hotel_name ||
    form.order?.hotel_name ||
    roomSample.hotel_name ||
    roomSample.name ||
    storedPrebookSummary.value?.hotel?.name ||
    payloadHotel?.name ||
    fallbackId ||
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

function computeStayCards(form = {}) {
  const cards = []
  const rooms = Array.isArray(form.rooms) ? form.rooms : []

  if (!rooms.length && storedPrebookSummary.value?.room) {
    const fallback = storedPrebookSummary.value
    const guests =
      fallback?.stay?.guest_label ||
      fallback?.room?.guests_label ||
      ''
    let price = ''
    let amount = null
    let currency = fallback.room.currency || 'EUR'
    if (fallback.room.price) {
      amount = Number(fallback.room.price)
      price = formatPrice(
        fallback.room.price,
        currency,
      )
    }
    cards.push({
      title: fallback.room.name || 'Room',
      meal: fallback.room.meal || '',
      guests: guests || '-',
      price: price || '',
      amount: Number.isFinite(amount) ? amount : null,
      currency,
    })
    stayCards.value = cards
    return
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
    const amount = Number(
      payment.show_amount ?? payment.amount ?? null,
    )
    const currency =
      payment.show_currency_code || payment.currency_code || 'EUR'
    const price = formatPrice(
      payment.show_amount || payment.amount,
      currency,
    )
    cards.push({
      title: room.name || room.room_name || 'Room',
      meal: room.rate_name || room.board_name || '',
      guests: guests || '-',
      price: price || '',
      amount: Number.isFinite(amount) ? amount : null,
      currency,
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
  rawFormText.value = '// contacting /api/booking/form'

  const endpoint = '/api/booking/form'
  const payload = { prebook_token: token.value }
  pushDebug('REQUEST /api/booking/form', { endpoint, payload })

  try {
    const data = await requestBookingForm(String(token.value))
    pushDebug('RESPONSE /api/booking/form', data)

    partnerOrderId.value = data.partner_order_id || ''
    const form = data.form || {}
    rawFormText.value = JSON.stringify(form, null, 2)

    computeHotelSummary(form)
    computeStayCards(form)

    setStatus(
      'Formulaire de réservation récupéré. Complétez les détails du voyageur.',
      'info',
    )
  } catch (err) {
    pushDebug('/api/booking/form error', {
      message: err?.message || String(err || ''),
      detail: err?._detail || null,
    })
    rawFormText.value = ''
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
              if (insurancePayload.value) {
                ss.setItem(
                  'booking:extras',
                  JSON.stringify(insurancePayload.value),
                )
              } else {
                ss.removeItem('booking:extras')
              }
              ss.setItem('booking:lastPartnerOrderId', partnerId)
              ss.setItem(
                'booking:lastCustomer',
                JSON.stringify({ civility, fullName, email, phone }),
          )
        }
        pushDebug('SYSTEMPAY redirect', {
          route: 'systempay-test',
          partner_order_id: partnerId,
          email,
        })
        router.push({
          name: 'systempay-test',
          query: { partner_order_id: partnerId, email },
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
          if (insurancePayload.value) {
            ss.setItem(
              'booking:extras',
              JSON.stringify(insurancePayload.value),
            )
          } else {
            ss.removeItem('booking:extras')
          }
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
      insurance: insurancePayload.value || undefined,
    }

    try {
      setStatus(
        'Contact de FloaBank pour éligibilité et création du deal…',
        'info',
      )
      payLoading.value = true
      pushDebug('REQUEST /api/payments/floa/hotel/deal', body)
      const payload = await createFloaHotelDeal(body)
      pushDebug('RESPONSE /api/payments/floa/hotel/deal', payload)

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
        rawFormText.value = JSON.stringify(deal, null, 2)
        return
      }

      setStatus('Deal Floa créé. Finalisation avec Floa…', 'info')

      const finalizeBody = {
        merchantReference: dealMerchantReference,
        configuration: {
          culture: 'fr-FR',
        },
      }

      pushDebug(
        'REQUEST /api/payments/floa/deal/finalize',
        { dealReference, finalizeBody },
      )
      const finalizePayload = await finalizeFloaDeal(
        dealReference,
        finalizeBody,
      )
      pushDebug(
        'RESPONSE /api/payments/floa/deal/finalize',
        finalizePayload,
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
        rawFormText.value = JSON.stringify(
          { deal, finalize: finalizePayload },
          null,
          2,
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

      rawFormText.value = JSON.stringify(
        { deal, finalize: finalizePayload },
        null,
        2,
      )

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
      setStatus(
        `Erreur de paiement Floa : ${
          err?.message || String(err || '')
        }`,
        'error',
      )
      pushDebug('ERROR Floa payment', {
        message: err?.message || String(err || ''),
        detail: err?._detail || null,
      })
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

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.summary-card {
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.75rem;
  background: rgba(15, 23, 42, 0.7);
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
  background: rgba(15, 23, 42, 0.9);
  padding: 0.7rem 0.85rem;
  text-align: left;
  cursor: pointer;
}

.payment-method-card--active {
  border-color: rgba(59, 130, 246, 0.9);
  box-shadow: 0 16px 40px -24px rgba(15, 23, 42, 0.9);
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
  box-shadow: inset 0 0 0 2px rgba(15, 23, 42, 1);
}

.payment-method-card--active .payment-method-card__radio {
  border-color: #60a5fa;
  background: #3b82f6;
}

.payment-method-card__hint {
  margin: 0.4rem 0 0;
  font-size: 0.75rem;
}

.payment-summary-card {
  border-radius: 0.9rem;
  border: 1px solid rgba(59, 130, 246, 0.5);
  background: radial-gradient(circle at 0 0, rgba(56, 189, 248, 0.1), transparent 55%),
    radial-gradient(circle at 100% 0, rgba(59, 130, 246, 0.12), transparent 55%),
    rgba(15, 23, 42, 0.95);
  padding: 0.9rem 1rem;
}

.payment-summary-card__amount {
  margin: 0.35rem 0 0.25rem;
  font-size: 1.35rem;
  font-weight: 600;
}

.payment-summary-card__lines {
  display: grid;
  gap: 0.35rem;
  margin: 0.4rem 0 0.6rem;
  font-size: 0.8rem;
}

.payment-summary-card__line {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.payment-summary-card__addons {
  display: grid;
  gap: 0.2rem;
}

.payment-summary-card__total {
  font-weight: 600;
  border-top: 1px solid rgba(148, 163, 184, 0.25);
  padding-top: 0.35rem;
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

.insurance-card {
  margin-top: 0.75rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.85);
  padding: 0.85rem 1rem;
}

.insurance-card__header {
  margin-bottom: 0.65rem;
}

.insurance-card__title {
  margin: 0 0 0.15rem;
  font-size: 0.9rem;
}

.insurance-card__subtitle {
  margin: 0;
  font-size: 0.75rem;
}

.insurance-options {
  display: grid;
  gap: 0.5rem;
}

.insurance-option {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 0.7rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(17, 24, 39, 0.7);
  cursor: pointer;
}

.insurance-option--active {
  border-color: rgba(59, 130, 246, 0.7);
  box-shadow: 0 16px 32px -24px rgba(59, 130, 246, 0.8);
}

.insurance-option__left {
  display: inline-flex;
  gap: 0.5rem;
  align-items: flex-start;
  flex: 1 1 auto;
}

.insurance-option__desc {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.72rem;
  color: #9ca3af;
}

.insurance-option__price {
  font-weight: 600;
  font-size: 0.8rem;
  white-space: nowrap;
}

.insurance-card__hint {
  margin: 0.6rem 0 0;
  font-size: 0.7rem;
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
  background: rgba(15, 23, 42, 0.9);
  padding: 0.5rem 0.7rem;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.floa-plan--active {
  border-color: rgba(52, 211, 153, 0.9);
  box-shadow: 0 14px 30px -18px rgba(16, 185, 129, 0.9);
}

.floa-plan__title {
  font-weight: 600;
  font-size: 0.85rem;
}

.floa-plan__meta {
  font-size: 0.75rem;
  color: #9ca3af;
}
</style>
