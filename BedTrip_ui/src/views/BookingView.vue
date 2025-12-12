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
        <h3>Détails du voyageur</h3>
        <!-- Skeleton of traveller form; wiring to payment will follow -->
        <form class="booking-details-form" @submit.prevent>
          <div class="row">
            <label>
              Civilité
              <select v-model="traveller.civility" required>
                <option value="">Sélectionner…</option>
                <option value="Mr">Mr</option>
                <option value="Mrs">Mrs</option>
                <option value="Ms">Ms</option>
              </select>
            </label>
            <label>
              Nom complet
              <input
                v-model="traveller.fullName"
                type="text"
                placeholder="John Doe"
                required
              />
            </label>
            <label>
              Email
              <input
                v-model="traveller.email"
                type="email"
                placeholder="john@example.com"
                required
              />
            </label>
          </div>
          <div class="row">
            <label>
              Numéro de téléphone
              <input
                v-model="traveller.phone"
                type="tel"
                placeholder="+33 6 00 00 00 00"
                required
              />
            </label>
            <label>
              Adresse
              <input
                v-model="traveller.addressLine1"
                type="text"
                placeholder="1 Rue de la Paix"
              />
            </label>
            <label>
              Code postal / Ville
              <input
                v-model="traveller.zipCity"
                type="text"
                placeholder="33000 Bordeaux"
              />
            </label>
          </div>
          <div class="row">
            <label>
              Notes (optionnel)
              <input
                v-model="traveller.notes"
                type="text"
                placeholder="Arrivée tardive, VIP, …"
              />
            </label>
          </div>
          <div class="row">
            <label>
              Moyen de paiement
              <div style="display:flex;flex-direction:column;gap:.25rem;margin-top:.25rem;">
                <label style="font-size:.85rem;">
                  <input
                    v-model="paymentMethod"
                    type="radio"
                    value="floa"
                  />
                  Payer en plusieurs fois avec Floa
                </label>
                <label style="font-size:.85rem;">
                  <input
                    v-model="paymentMethod"
                    type="radio"
                    value="systempay"
                  />
                  Payer par carte avec Systempay
                </label>
              </div>
            </label>
          </div>
          <div
            class="row"
            v-if="paymentMethod === 'floa'"
          >
            <label>
              Produit Floa
              <select v-model="floaProduct">
                <option value="">Choisir un produit…</option>
                <option value="BC1XF">Paiement comptant (BC1XF)</option>
                <option value="BC3XF">Paiement en 3x (BC3XF)</option>
                <option value="BC4XF">Paiement en 4x (BC4XF)</option>
              </select>
            </label>
          </div>
          <div class="row">
            <div style="display:flex;align-items:flex-end;gap:.5rem;">
              <button
                type="button"
                class="primary"
                @click="startPayment"
                :disabled="payLoading"
              >
                {{ payLoading ? 'Traitement du paiement…' : 'Payer maintenant' }}
              </button>
            </div>
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
  fullName: '',
  email: '',
  phone: '',
  addressLine1: '',
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
    if (fallback.room.price) {
      price = formatPrice(
        fallback.room.price,
        fallback.room.currency,
      )
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
    const price = formatPrice(
      payment.show_amount || payment.amount,
      payment.show_currency_code || payment.currency_code,
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

async function startPayment() {
  const partnerId = partnerOrderId.value?.trim()
  if (!partnerId) {
    setStatus(
      "ID de commande partenaire manquant. Chargez d'abord le formulaire.",
      'error',
    )
    return
  }

  const method = paymentMethod.value
  if (!method) {
    setStatus('Choisissez un moyen de paiement.', 'error')
    return
  }

  const civility = traveller.value.civility || ''
  if (!civility) {
    setStatus(
      'Veuillez sélectionner une civilité pour le voyageur.',
      'error',
    )
    return
  }

  const fullName = (traveller.value.fullName || '').trim()
  const email = (traveller.value.email || '').trim()
  const phone = (traveller.value.phone || '').trim()
  if (!fullName || !email || !phone) {
    setStatus(
      'Veuillez renseigner nom complet, email et téléphone avant le paiement.',
      'error',
    )
    return
  }

  const [firstName, ...restName] = fullName.split(' ')
  const lastName = restName.join(' ') || firstName || 'Traveller'

  const addrLine1 = (traveller.value.addressLine1 || '').trim()
  const zipCity = (traveller.value.zipCity || '').trim()

  let zipCode = ''
  let city = ''
  if (zipCity) {
    const parts = zipCity.split(' ')
    zipCode = parts.shift() || ''
    city = parts.join(' ') || ''
  }

  const countryCode = 'FR'

  // Try to auto-extract ZIP/city for FR if user typed full address in one field
  if (countryCode === 'FR') {
    const fromAddr = addrLine1.match(/(\d{5})\s+(.+)/)
    const fromZipCity = zipCity.match(/(\d{5})\s+(.+)/)
    if (fromZipCity) {
      zipCode = fromZipCity[1]
      city = fromZipCity[2]
    } else if (fromAddr) {
      zipCode = fromAddr[1]
      city = fromAddr[2]
    }

    if (!/^\d{5}$/.test(zipCode || '')) {
      setStatus(
        'Veuillez saisir un code postal français à 5 chiffres valide (ex : 76710).',
        'error',
      )
      return
    }
    if (!city) {
      setStatus(
        'Veuillez saisir une ville (ex : Bordeaux).',
        'error',
      )
      return
    }
  }

  const customer = {
    civility,
    firstName,
    lastName,
    email,
    mobilePhoneNumber: phone,
    homeAddress: {
      line1: addrLine1,
      zipCode: zipCode || '',
      city: city || '',
      countryCode,
    },
  }

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
</style>
