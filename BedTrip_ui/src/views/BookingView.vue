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
                          Paiement par carte (Kotan Payments)
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
                        Redirection immédiate vers Kotan Payments (externPayment)
                        pour effectuer un paiement par carte bancaire classique.
                      </p>
                    </button>

                    <button
                      type="button"
                      class="payment-method-card"
                      :class="{
                        'payment-method-card--active':
                          paymentMethod === 'applepay',
                      }"
                      @click="paymentMethod = 'applepay'"
                    >
                      <div class="payment-method-card__header">
                        <span class="payment-method-card__title">
                          <i
                            class="pi pi-apple payment-method-card__icon"
                            aria-hidden="true"
                          ></i>
                          Apple Pay (Kotan Payments)
                        </span>
                        <span class="payment-method-card__right">
                          <span class="payment-method-card__brands">
                            <span
                              class="card-brand card-brand--applepay"
                              aria-hidden="true"
                            >
                              Apple Pay
                            </span>
                          </span>
                          <span class="payment-method-card__radio"></span>
                        </span>
                      </div>
                      <p class="muted payment-method-card__hint">
                        Redirection immédiate vers Kotan Payments (externPayment)
                        pour effectuer un paiement via Apple Pay.
                      </p>
                    </button>

                    <button
                      type="button"
                      class="payment-method-card"
                      :class="{
                        'payment-method-card--active':
                          paymentMethod === 'cofidis',
                      }"
                      @click="paymentMethod = 'cofidis'"
                    >
                      <div class="payment-method-card__header">
                        <span class="payment-method-card__title payment-method-card__title--with-logo">
                          <img
                            src="https://kotan-voyages.com/img/cofidis.webp"
                            alt="Cofidis"
                            class="payment-method-card__logo"
                            width="100"
                            height="32"
                          />
                          Cofidis - Je paie 4 fois Cofidis (chèque caution)
                        </span>
                        <span class="payment-method-card__right">
                          <span class="payment-method-card__radio"></span>
                        </span>
                      </div>
                      <p class="muted payment-method-card__hint">
                        Paiement en 4 fois avec Cofidis (chèque de caution).
                        Redirection vers la page de paiement sécurisée.
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

                      <p
                        v-if="paymentMethod === 'floa'"
                        class="muted payment-method-card__hint"
                        style="margin-top: 0.5rem;"
                      >
                        Redirection vers Kotan Payments (externPayment) pour le paiement Floa.
                      </p>
                    </div>

                    <button
                      type="button"
                      class="payment-method-card"
                      :class="{ 'payment-method-card--active': paymentMethod === 'paypal' }"
                      @click="paymentMethod = 'paypal'"
                    >
                      <div class="payment-method-card__header">
                        <span class="payment-method-card__title">
                          <i class="pi pi-paypal payment-method-card__icon"></i>
                          PayPal
                        </span>
                        <span class="payment-method-card__right">
                          <span class="payment-method-card__radio"></span>
                        </span>
                      </div>
                      <p class="muted payment-method-card__hint">
                        Paiement via PayPal (popup PayPal), capture côté serveur.
                      </p>
                    </button>
                  </div>

                  <div class="payment-primary-action">
                    <div class="conditions-summary" aria-live="polite">
                      <p class="conditions-summary__title">
                        En cliquant sur « {{ primaryActionLabel }} », vous confirmez :
                      </p>
                      <ul class="conditions-summary__list">
                        <li>avoir vérifié l'exactitude des informations voyageurs.</li>
                        <li>que les voyageurs sont en règle pour les formalités de voyage.</li>
                        <li>
                          avoir pris connaissance des
                          <RouterLink
                            class="conditions-link"
                            to="/conditions"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            conditions de réservation
                          </RouterLink>.
                        </li>
                      </ul>
                    </div>
                    <label
                      class="conditions-acceptance"
                      :class="{ 'conditions-acceptance--invalid': showConditionsError }"
                    >
                      <input
                        v-model="conditionsAccepted"
                        type="checkbox"
                      />
                      <span>
                        J'ai lu et j'accepte les
                        <RouterLink
                          class="conditions-link"
                          to="/conditions"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          conditions de réservation
                        </RouterLink>.
                      </span>
                    </label>
                    <p v-if="showValidationHelp" class="validation-help">
                      Veuillez remplir les champs obligatoires (*) et accepter les conditions.
                    </p>
                    <button
                      type="button"
                      class="primary"
                      @click="handlePrimaryAction"
                      :disabled="isPrimaryDisabled"
                    >
                      {{ primaryActionLabel }}
                    </button>
                  </div>

                  <div v-if="paymentMethod === 'paypal'" class="card" style="margin-top: .75rem;">
                    <div v-if="!paypalReady" class="muted">Chargement PayPal…</div>
                    <div v-else id="paypal-buttons"></div>
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
                        :class="{ 'field-invalid': showFieldError('civility') }"
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
                        :class="{ 'field-invalid': showFieldError('firstName') }"
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
                        :class="{ 'field-invalid': showFieldError('lastName') }"
                        type="text"
                        placeholder="Doe"
                        required
                      />
                    </label>
                  </div>
                  <div class="row">
                    <label>
                      Date de naissance
                      <span class="required-asterisk">*</span>
                      <input
                        v-model="traveller.birthdate"
                        :class="{ 'field-invalid': showFieldError('birthdate') }"
                        type="date"
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
                        :class="{ 'field-invalid': showFieldError('email') }"
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
                        :class="{ 'field-invalid': showFieldError('phone') }"
                        type="tel"
                        placeholder="+33 6 00 00 00 00"
                        required
                      />
                    </label>
                  </div>
                  <div v-if="autofillEnabled" class="row row--autofill">
                    <div class="autofill-wrap">
                      <button
                        type="button"
                        class="autofill-btn"
                        :disabled="autofillLoading"
                        @click="fillAutoClient"
                      >
                        {{ autofillLoading ? 'Chargement…' : 'Fill auto' }}
                      </button>
                    </div>
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
        <pre>kotan extern: {{ formatDebug(debugSystempay) }}</pre>
        <pre>floa deal request: {{ formatDebug(debugFloaReq) }}</pre>
        <pre>floa deal response: {{ formatDebug(debugFloaRes) }}</pre>
        <pre>floa deal error: {{ formatDebug(debugFloaErr) }}</pre>
      </details>

    </section>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  requestBookingForm,
  createKotanExternPayment,
} from '../services/bookingApi.js'
import { API_BASE, safeJsonFetch } from '../services/httpClient.js'

const route = useRoute()

const PREBOOK_SUMMARY_KEY = 'booking:lastPrebook'
const MARKUP_PERCENT = 10
const CONDITIONS_VERSION = 'booking_conditions_v1'
const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID

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
  birthdate: '',
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
const paypalReady = ref(false)
const conditionsAccepted = ref(false)
const submitAttempted = ref(false)

const autofillEnabled = ref(false)
const autofillLoading = ref(false)

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
  if (paymentMethod.value === 'floa') return 'Continuer avec Floa'
  if (paymentMethod.value === 'cofidis') return 'Payer avec Cofidis'
  if (paymentMethod.value === 'applepay') return 'Payer avec Apple Pay'
  if (paymentMethod.value === 'paypal') return 'Payer avec PayPal'
  return 'Payer avec Kotan Payments'
})

const isPrimaryDisabled = computed(
  () => payLoading.value,
)

const requiredFieldKeys = [
  'civility',
  'firstName',
  'lastName',
  'birthdate',
  'email',
  'phone',
]

const missingRequiredFields = computed(() =>
  requiredFieldKeys.filter((key) => !String(traveller.value?.[key] || '').trim()),
)

const showConditionsError = computed(
  () => submitAttempted.value && !conditionsAccepted.value,
)

const showValidationHelp = computed(
  () => submitAttempted.value && (missingRequiredFields.value.length > 0 || !conditionsAccepted.value),
)

function setStatus(message, type = 'info') {
  statusMessage.value = message || ''
  statusType.value = type
}

function showFieldError(fieldKey) {
  return submitAttempted.value && missingRequiredFields.value.includes(fieldKey)
}

async function fetchAutofillConfig() {
  try {
    const { statusCode, data } = await safeJsonFetch(`${API_BASE}/api/config`)
    if (statusCode === 200 && data && data.autofill === true) {
      autofillEnabled.value = true
    }
  } catch (_) {
    // Config fetch failure: keep autofill disabled
  }
}

async function fillAutoClient() {
  if (autofillLoading.value) return
  autofillLoading.value = true
  try {
    const { statusCode, data } = await safeJsonFetch(`${API_BASE}/api/test-client`)
    if (statusCode !== 200 || !data || typeof data !== 'object') {
      setStatus('Données test indisponibles.', 'error')
      return
    }
    const t = traveller.value
    if (data.civility != null) t.civility = data.civility
    if (data.firstName != null) t.firstName = data.firstName
    if (data.lastName != null) t.lastName = data.lastName
    if (data.company != null) t.company = data.company
    if (data.birthdate != null) t.birthdate = data.birthdate
    if (data.dateOfBirth != null) t.birthdate = data.dateOfBirth
    if (data.email != null) t.email = data.email
    if (data.phone != null) t.phone = data.phone
    if (data.addressLine1 != null) t.addressLine1 = data.addressLine1
    if (data.postalCode != null) t.postalCode = data.postalCode
    if (data.city != null) t.city = data.city
    if (data.zipCity != null) t.zipCity = data.zipCity
    if (data.notes != null) t.notes = data.notes
    setStatus('Informations client remplies.', 'info')
  } catch (_) {
    setStatus('Erreur lors du remplissage automatique.', 'error')
  } finally {
    autofillLoading.value = false
  }
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
  const birthdate = (traveller.value.birthdate || '').trim()

  if (!civility || !firstName || !lastName || !birthdate || !email || !phone) {
    return {
      ok: false,
      error:
        'Veuillez renseigner civilité, prénom, nom, date de naissance, email et téléphone avant le paiement.',
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
    birthdate,
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
    birthdate,
    email,
    phone,
    customer,
  }
}

function submitExternPaymentForm(action, externPaymentData) {
  if (typeof window === 'undefined' || !window.document) return
  const form = window.document.createElement('form')
  form.method = 'POST'
  form.action = action
  form.style.display = 'none'

  const input = window.document.createElement('input')
  input.type = 'hidden'
  input.name = 'extern_payment_data'
  input.value = JSON.stringify(externPaymentData)
  form.appendChild(input)

  window.document.body.appendChild(form)
  form.submit()
}

function loadPayPalSdk() {
  if (typeof window === 'undefined') return

  if (!PAYPAL_CLIENT_ID) {
    setStatus('PayPal indisponible: VITE_PAYPAL_CLIENT_ID manquant.', 'error')
    return
  }

  if (window.paypal) {
    paypalReady.value = true
    return
  }

  const existing = window.document.querySelector('script[data-paypal-sdk="1"]')
  if (existing) {
    existing.addEventListener('load', () => {
      paypalReady.value = true
    })
    existing.addEventListener('error', () => {
      setStatus('Impossible de charger PayPal SDK.', 'error')
    })
    return
  }

  const script = window.document.createElement('script')
  const currency = 'EUR'
  script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
    PAYPAL_CLIENT_ID,
  )}&currency=${currency}&intent=capture&components=buttons`
  script.async = true
  script.setAttribute('data-paypal-sdk', '1')
  script.onload = () => {
    paypalReady.value = true
  }
  script.onerror = () => {
    setStatus('Impossible de charger PayPal SDK.', 'error')
  }
  window.document.head.appendChild(script)
}

async function renderPayPalButtons() {
  if (!paypalReady.value || typeof window === 'undefined' || !window.paypal) return

  const container = window.document.getElementById('paypal-buttons')
  if (!container) return
  container.innerHTML = ''

  window.paypal
    .Buttons({
      createOrder: async () => {
        const ctx = buildCustomerContext()
        if (!ctx.ok) throw new Error(ctx.error)

        const { statusCode, data } = await safeJsonFetch(
          `${API_BASE}/api/payments/paypal/order`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ partner_order_id: ctx.partnerId }),
          },
        )
        if (statusCode !== 200 || !data?.orderId) {
          throw new Error('PayPal order creation failed')
        }
        return data.orderId
      },
      onApprove: async (data) => {
        const { statusCode, data: cap } = await safeJsonFetch(
          `${API_BASE}/api/payments/paypal/order/${encodeURIComponent(data.orderID)}/capture`,
          { method: 'POST' },
        )
        if (statusCode !== 200 || !cap?.paid) throw new Error('PayPal capture failed')

        window.location.href = `/payment/success?partner_order_id=${encodeURIComponent(
          partnerOrderId.value,
        )}&provider=paypal`
      },
      onCancel: () => {
        setStatus('Paiement PayPal annulé.', 'error')
      },
      onError: (err) => {
        setStatus(`Erreur PayPal: ${err?.message || String(err)}`, 'error')
      },
    })
    .render('#paypal-buttons')
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
    birthdate,
    email,
    phone,
    customer,
  } = context

  const method = forcedMethod || currentMethod

  // Kotan extern payment path (carte, Cofidis, or Floa bank → redirect to externPayment)
  if (
    method === 'systempay' ||
    method === 'applepay' ||
    method === 'cofidis' ||
    method === 'floa'
  ) {
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
      const isCofidis = method === 'cofidis'
      const isFloa = method === 'floa'
      const isApplePay = method === 'applepay'
      setStatus(
        isCofidis
          ? 'Préparation de la redirection vers Cofidis…'
          : isFloa
            ? 'Préparation de la redirection vers Floa (Kotan Payments)…'
            : isApplePay
              ? 'Préparation de la redirection vers Apple Pay (Kotan Payments)…'
              : 'Préparation de la redirection vers Kotan Payments…',
        'info',
      )
      payLoading.value = true
      const kotanCustomer = {
        civility,
        firstName,
        lastName,
        birthdate,
        email,
        phone,
      }
      const optionalFields = {
        addressLine1: traveller.value.addressLine1,
        postalCode: traveller.value.postalCode,
        city: traveller.value.city,
        company: traveller.value.company,
      }
      Object.entries(optionalFields).forEach(([key, raw]) => {
        const value = String(raw || '').trim()
        if (value) kotanCustomer[key] = value
      })
      const createPayload = {
        partner_order_id: partnerId,
        customer: kotanCustomer,
        conditions_acceptance: {
          accepted: true,
          conditions_version: CONDITIONS_VERSION,
          accepted_at_client: new Date().toISOString(),
        },
      }
      if (isCofidis) createPayload.payment_variant = 'cofidis'
      if (isFloa) createPayload.payment_variant = 'floa'
      if (isApplePay) createPayload.payment_variant = 'applepay'
      const payload = await createKotanExternPayment(createPayload)
      debugSystempay.value = payload
      console.log('[Debug][BookingView] kotan extern create response', payload)
      const action =
        typeof payload?.action === 'string' && payload.action.trim()
          ? payload.action.trim()
          : 'https://kotan-voyages.com/externPayment'
      const externPaymentData = payload?.extern_payment_data || null
      if (!externPaymentData) {
        throw new Error('extern_payment_data manquant dans la réponse API')
      }
      setStatus(
        isCofidis
          ? 'Redirection vers Cofidis…'
          : isFloa
            ? 'Redirection vers Floa…'
            : isApplePay
              ? 'Redirection vers Apple Pay…'
              : 'Redirection vers Kotan Payments…',
        'info',
      )
      submitExternPaymentForm(action, externPaymentData)
    } catch (err) {
      let validationHint = ''
      try {
        const detail = JSON.parse(err?._detail || '{}')
        const first = detail?.debug?.errors?.[0]
        if (first?.path && first?.message) {
          validationHint = ` (${first.path} ${first.message})`
        }
      } catch {
        // ignore
      }
      setStatus(
        `Erreur lors de la préparation du paiement : ${
          err?.message || String(err || '')
        }${validationHint}`,
        'error',
      )
    } finally {
      payLoading.value = false
    }
    return
  }

}

function handlePrimaryAction() {
  submitAttempted.value = true
  if (missingRequiredFields.value.length > 0) {
    setStatus(
      'Veuillez compléter tous les champs obligatoires avant de poursuivre le paiement.',
      'error',
    )
    return
  }
  if (!conditionsAccepted.value) {
    setStatus(
      'Vous devez accepter les conditions de réservation avant de poursuivre le paiement.',
      'error',
    )
    return
  }
  if (paymentMethod.value === 'paypal') {
    setStatus('Utilisez les boutons PayPal ci-dessous pour payer.', 'info')
    loadPayPalSdk()
    return
  }
  if (isFloaPayment.value) {
    startPayment()
  } else {
    startPayment('systempay')
  }
}

watch(paymentMethod, (method) => {
  if (method === 'paypal') loadPayPalSdk()
})

watch([paypalReady, paymentMethod], async () => {
  if (paymentMethod.value === 'paypal' && paypalReady.value) {
    await nextTick()
    renderPayPalButtons()
  }
})

onMounted(() => {
  loadPrebookSummaryFromSession()
  fetchAutofillConfig()
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

.card-brand--applepay {
  background: #0f172a;
  color: #f8fafc;
}

.payment-method-card__icon {
  font-size: 1rem;
}

.payment-method-card__title--with-logo {
  flex-wrap: wrap;
  gap: 0.5rem;
}

.payment-method-card__logo {
  display: inline-block;
  height: 28px;
  width: auto;
  max-width: 100px;
  object-fit: contain;
  vertical-align: middle;
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
  flex-direction: column;
  align-items: stretch;
  gap: 0.5rem;
  justify-content: flex-end;
}

.conditions-summary {
  border: 1px solid #cbd5e1;
  border-radius: 0.8rem;
  background: #f8fafc;
  padding: 0.75rem 0.9rem;
}

.conditions-summary__title {
  margin: 0 0 0.45rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: #0f172a;
}

.conditions-summary__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.35rem;
  font-size: 0.84rem;
  line-height: 1.45;
  color: #334155;
}

.conditions-summary__list li {
  position: relative;
  padding-left: 1.25rem;
}

.conditions-summary__list li::before {
  content: "✓";
  position: absolute;
  left: 0;
  top: 0;
  font-weight: 700;
  color: #dc2626;
}

.conditions-acceptance {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.82rem;
  color: #334155;
  max-width: 100%;
  text-align: left;
}

.conditions-acceptance input {
  margin-top: 0.18rem;
  width: 16px;
  height: 16px;
  accent-color: #a5141e;
}

.conditions-acceptance--invalid {
  color: #b91c1c;
}

.conditions-acceptance--invalid input {
  outline: 2px solid rgba(185, 28, 28, 0.45);
  outline-offset: 1px;
}

.validation-help {
  margin: 0;
  font-size: 0.78rem;
  color: #b91c1c;
  font-weight: 600;
  text-align: left;
}

.conditions-link {
  color: #a5141e;
  font-weight: 700;
  text-decoration: underline;
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

.field-invalid {
  border-color: #ef4444 !important;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.15);
  background: rgba(239, 68, 68, 0.04);
}

.row--autofill {
  margin-top: 0.25rem;
}

.autofill-wrap {
  display: flex;
  align-items: center;
}

.autofill-btn {
  padding: 0.4rem 0.85rem;
  font-size: 0.85rem;
  border-radius: 6px;
  border: 1px solid rgba(55, 107, 176, 0.5);
  background: rgba(55, 107, 176, 0.12);
  color: #376bb0;
  cursor: pointer;
}

.autofill-btn:hover:not(:disabled) {
  background: rgba(55, 107, 176, 0.2);
}

.autofill-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
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
