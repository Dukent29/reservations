<!--
  ReservationView
  ===============
  Results + filters + hotel details page.

  Flow:
  - User searches from SearchLandingView (/) and is redirected here (/results)
    with query parameters (destination, dates, adults, ...).
  - This view:
    - Reads query params from the route.
    - Calls the same `/api/search/serp` endpoint used in front/reservation.js.
    - Displays a list of hotels + basic filters (stars, free cancellation).
    - Loads details for a selected hotel via `/api/search/hp`.
-->

<template>
  <section class="workspace__content">
    <header class="panel" style="margin-bottom: 1rem;">
      <h2>
        Résultats pour
        <small v-if="searchSummary">
          {{ searchSummary }}
        </small>
      </h2>
      <p v-if="statusMessage" class="muted">
        {{ statusMessage }}
      </p>
    </header>

    <section class="filters">
      <div class="filter-group">
        <p class="filter-title">Étoiles</p>
        <div class="filter-options">
          <label v-for="n in 5" :key="n" class="checkbox-inline">
            <input
              type="checkbox"
              :value="n"
              v-model="filters.stars"
            />
            {{ n }}★
          </label>
        </div>
      </div>

      <div class="filter-group">
        <p class="filter-title">Politiques</p>
        <label class="checkbox-inline">
          <input
            type="checkbox"
            v-model="filters.freeCancel"
          />
          Uniquement annulation gratuite
        </label>
      </div>
    </section>

    <div class="results-grid">
      <div class="card results-card">
        <h3>
          Résultats de recherche
          <span
            v-if="resultsMeta"
            style="color:#64748b;font-size:.7rem;font-weight:400;"
          >
            {{ resultsMeta }}
          </span>
        </h3>

        <div v-if="loading" class="muted" style="font-size:.8rem;">
          Recherche en cours…
        </div>
        <div v-else-if="error" style="color:#dc2626;font-size:.8rem;">
          {{ error }}
        </div>
        <div v-else>
          <div v-if="!hotels.length" style="font-size:.7rem;color:#64748b;">
            Aucun résultat pour cette recherche.
          </div>
          <ul v-else class="hotel-list">
            <li
              v-for="hotel in paginatedHotels"
              :key="hotelKey(hotel)"
              class="hotel-card"
            >
              <div class="hotel-card__main">
                <h4 class="hotel-name">
                  {{ hotelDisplayName(hotel) }}
                </h4>
                <p class="hotel-meta">
                  <span v-if="hotel.city_name || hotel.city">
                    {{ hotel.city_name || hotel.city }}
                  </span>
                  <span v-if="deriveHotelStars(hotel)">
                    · {{ deriveHotelStars(hotel) }}★
                  </span>
                </p>
              </div>
              <div class="hotel-card__actions">
                <button
                  class="secondary mini"
                  type="button"
                  @click="selectHotel(hotel)"
                >
                  Voir les détails
                </button>
              </div>
            </li>
          </ul>
          <div
            v-if="totalPages > 1"
            class="pagination"
          >
            <button
              class="secondary mini"
              type="button"
              @click="goPrevPage"
              :disabled="currentPage === 1"
            >
              Précédent
            </button>
            <span class="pagination__label">
              Page {{ currentPage }} / {{ totalPages }}
            </span>
            <button
              class="secondary mini"
              type="button"
              @click="goNextPage"
              :disabled="currentPage === totalPages"
            >
              Suivant
            </button>
          </div>
        </div>
      </div>

      <div class="card details-card">
        <h3>
          <span> Détails de l’hôtel &amp; tarifs </span>
        </h3>
        <div v-if="hotelDetailsLoading" class="muted" style="font-size:.8rem;">
          Chargement des détails de l’hôtel…
        </div>
        <div v-else-if="hotelDetailsError" style="color:#dc2626;font-size:.8rem;">
          {{ hotelDetailsError }}
        </div>
        <div v-else-if="!selectedHotelDetails">
          <div style="font-size:.7rem;color:#64748b;">
            Aucun hôtel sélectionné.
          </div>
        </div>
        <div v-else class="hotel-detail">
          <div class="hotel-detail__summary">
            <div class="hotel-detail__header">
              <div class="hotel-detail__title">
                {{ hotelDisplayName(selectedHotelDetails) }}
              </div>
              <div class="hotel-detail__meta">
                <span v-if="deriveHotelStars(selectedHotelDetails)">
                  {{ deriveHotelStars(selectedHotelDetails) }}★
                </span>
              </div>
            </div>
            <div class="hotel-detail__meta">
              <span v-if="selectedHotelDetails.address">
                {{ selectedHotelDetails.address }}
              </span>
            </div>
          </div>

          <div class="hotel-detail__rooms">
            <h4>Chambres et tarifs</h4>
            <div
              v-if="!limitedRates.length"
              class="muted"
              style="font-size:.75rem;"
            >
              Aucune offre pour cette recherche.
            </div>
            <ul v-else class="room-list">
              <li
                v-for="(rate, idx) in limitedRates"
                :key="idx"
                class="room-card"
              >
                <div class="room-card__header">
                  <div class="room-card__title">
                    {{ rate.room_name || rate.room_data_trans?.main_name || 'Chambre' }}
                  </div>
                  <div class="room-card__price">
                    {{
                      formatCurrency(
                        rate.payment_options?.payment_types?.[0]?.show_amount ??
                          rate.payment_options?.payment_types?.[0]?.amount,
                        rate.payment_options?.payment_types?.[0]?.show_currency_code ??
                          rate.payment_options?.payment_types?.[0]?.currency_code ??
                          'EUR',
                      )
                    }}
                  </div>
                </div>
                <div class="room-card__chips">
                  <span v-if="friendlyMeal(rate.meal_data?.value || rate.meal)" class="chip">
                    {{ friendlyMeal(rate.meal_data?.value || rate.meal) }}
                  </span>
                </div>
                <div class="room-card__footer">
                  <button
                    class="primary mini"
                    type="button"
                    @click="prebookRate(rate, idx)"
                    :disabled="prebookLoadingIndex === idx"
                  >
                    {{
                      prebookLoadingIndex === idx
                        ? 'Pré-réservation…'
                        : 'Réserver'
                    }}
                  </button>
                </div>
              </li>
            </ul>
            <p v-if="prebookStatus" class="muted" style="font-size:.75rem;margin-top:.5rem;">
              {{ prebookStatus }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <section class="card" style="margin-top: 1rem;">
      <h3 style="font-size:.9rem;margin-top:0;">Debug API search</h3>
      <p class="muted" style="font-size:.75rem;margin-bottom:.5rem;">
        Historique des appels à /api/search/serp et /api/search/hp (dernier en haut).
      </p>
      <pre
        v-if="debugEntries.length"
        style="max-height:220px;overflow:auto;font-size:.7rem;white-space:pre-wrap;background:rgba(15,23,42,.7);padding:.5rem;border-radius:.5rem;border:1px solid rgba(148,163,184,.4);"
      >{{ formattedDebug }}</pre>
      <p v-else class="muted" style="font-size:.75rem;">
        Aucun appel effectué pour le moment.
      </p>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { API_BASE, safeJsonFetch } from '../services/httpClient.js'

const route = useRoute()
const router = useRouter()

const PREBOOK_SUMMARY_KEY = 'booking:lastPrebook'

// Basic search state derived from route query.
const destination = computed(() => String(route.query.destination || '').trim())
const checkin = computed(() => String(route.query.checkin || '').trim())
const checkout = computed(() => String(route.query.checkout || '').trim())
const adults = computed(() => {
  const raw = Number(route.query.adults)
  return Number.isFinite(raw) && raw > 0 ? raw : 2
})

const statusMessage = ref('')
const loading = ref(false)
const error = ref('')
const hotels = ref([])
const currentPage = ref(1)
const pageSize = 8

const filters = ref({
  stars: [],
  freeCancel: false,
})

const selectedHotelDetails = ref(null)
const selectedHotelForRequest = ref(null)
const hotelDetailsLoading = ref(false)
const hotelDetailsError = ref('')

// Debug entries for API calls
const debugEntries = ref([])

const prebookLoadingIndex = ref(null)
const prebookStatus = ref('')

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

const searchSummary = computed(() => {
  if (!destination.value) return ''
  const datePart =
    checkin.value && checkout.value
      ? `${checkin.value} → ${checkout.value}`
      : ''
  return [destination.value, datePart].filter(Boolean).join(' · ')
})

const resultsMeta = computed(() => {
  if (!hotels.value.length) return ''
  return `${hotels.value.length} hôtels · page ${currentPage.value} / ${totalPages.value}`
})

const totalPages = computed(() => {
  if (!hotels.value.length) return 1
  return Math.max(1, Math.ceil(hotels.value.length / pageSize))
})

const paginatedHotels = computed(() => {
  if (!hotels.value.length) return []
  const page = Math.min(Math.max(currentPage.value, 1), totalPages.value)
  const start = (page - 1) * pageSize
  return hotels.value.slice(start, start + pageSize)
})

function buildGuestsPayload() {
  return [
    {
      adults: adults.value,
      children: [],
    },
  ]
}

function hotelKey(hotel) {
  return (
    hotel.id ||
    hotel.hid ||
    hotel.hotel_id ||
    hotel.hotelId ||
    hotel.name
  )
}

function hotelDisplayName(hotel) {
  const fallbackId =
    hotel?.id || hotel?.hid || hotel?.hotel_id || hotel?.hotelId
  return (
    hotel?.name ||
    hotel?.hotel_name ||
    hotel?.hotel_name_trans ||
    hotel?.full_name ||
    hotel?.fullName ||
    (typeof fallbackId === 'string'
      ? fallbackId.replace(/_/g, ' ')
      : fallbackId) ||
    'Hotel'
  )
}

function deriveHotelStars(hotel) {
  const direct =
    hotel?.stars ?? hotel?.category ?? hotel?.rg_ext?.class
  const directNum = Number(direct)
  if (Number.isFinite(directNum) && directNum > 0) return directNum
  const vals = Array.isArray(hotel?.rates)
    ? hotel.rates
        .map((r) => Number(r?.rg_ext?.class))
        .filter((n) => Number.isFinite(n) && n > 0)
    : []
  return vals.length ? Math.max(...vals) : null
}

// Extract hotels array from various possible shapes
function extractHotels(payload) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  if (Array.isArray(payload.hotels)) return payload.hotels
  if (Array.isArray(payload.results)) return payload.results
  if (payload.results) return extractHotels(payload.results)
  if (payload.data) return extractHotels(payload.data)
  return []
}

function formatCurrency(amount, currency) {
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

function friendlyMeal(value) {
  switch ((value || '').toLowerCase()) {
    case 'nomeal':
      return 'Room only'
    case 'breakfast':
      return 'Breakfast'
    case 'half_board':
      return 'Half board'
    case 'full_board':
      return 'Full board'
    case 'all-inclusive':
    case 'all_inclusive':
      return 'All inclusive'
    default:
      return value || ''
  }
}

const selectedHotelRates = computed(() => {
  const hotel = selectedHotelDetails.value
  return Array.isArray(hotel?.rates) ? hotel.rates : []
})

const limitedRates = computed(() => selectedHotelRates.value.slice(0, 8))

function persistPrebookSummary(apiResponse, hotel, rate) {
  if (typeof window === 'undefined') return
  try {
    const ss = window.sessionStorage
    if (!ss) return

    const payment =
      rate?.payment_options?.payment_types?.[0] || {}

    const summary = {
      token: apiResponse?.prebook_token || null,
      created_at: Date.now(),
      hotel: {
        id: hotel?.id || null,
        hid: hotel?.hid || null,
        name: hotel ? hotelDisplayName(hotel) : null,
        city:
          hotel?.city_name ||
          hotel?.city ||
          hotel?.location ||
          hotel?.address?.city ||
          null,
        address:
          hotel?.address ||
          hotel?.address_line ||
          hotel?.address_full ||
          null,
        country: hotel?.country || hotel?.country_name || null,
      },
      stay: {
        checkin: checkin.value || null,
        checkout: checkout.value || null,
        currency:
          payment?.show_currency_code ||
          payment?.currency_code ||
          'EUR',
        guests: buildGuestsPayload(),
        guest_label: '', // can be enriched later
      },
      room: {
        name:
          rate?.room_name ||
          rate?.room_data_trans?.main_name ||
          rate?.name ||
          null,
        meal: rate?.meal || null,
        price:
          payment?.show_amount || payment?.amount || null,
        currency:
          payment?.show_currency_code ||
          payment?.currency_code ||
          null,
        amenities: rate?.amenities_data || null,
        daily_prices: rate?.daily_prices || null,
        guests_label: '',
      },
      payload: apiResponse || null,
    }

    ss.setItem(PREBOOK_SUMMARY_KEY, JSON.stringify(summary))
  } catch {
    // ignore storage errors
  }
}

async function searchHotels() {
  error.value = ''
  statusMessage.value = ''
  hotels.value = []

  if (!destination.value) {
    error.value = 'Veuillez saisir une destination depuis la page de recherche.'
    return
  }
  if (!checkin.value || !checkout.value) {
    error.value = 'Les dates d’arrivée et de départ sont requises.'
    return
  }

  const body = {
    checkin: checkin.value,
    checkout: checkout.value,
    language: 'fr',
    guests: buildGuestsPayload(),
    filters: {
      stars: filters.value.stars.slice(),
      meals: [],
      free_cancel: filters.value.freeCancel,
    },
    query: destination.value,
  }

  loading.value = true
  try {
    const endpoint = `${API_BASE}/api/search/serp?limit=60`
    pushDebug('REQUEST /api/search/serp', { endpoint, body })
    const { statusCode, data } = await safeJsonFetch(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    pushDebug('RESPONSE /api/search/serp', {
      statusCode,
      data,
    })
    if (statusCode >= 400 || !data || data.error) {
      throw new Error(data?.error || data?._raw || 'Search failed')
    }
    const results = extractHotels(data?.results ?? data)
    hotels.value = results
    currentPage.value = 1
    statusMessage.value = results.length
      ? `Recherche terminée · ${results.length} hôtel(s) trouvé(s).`
      : 'Aucun hôtel trouvé pour cette recherche.'
  } catch (err) {
    pushDebug('ERROR /api/search/serp', {
      error: err?.message || String(err || ''),
    })
    error.value = err.message || String(err || '')
  } finally {
    loading.value = false
  }
}

async function loadHotelDetails(hid) {
  hotelDetailsLoading.value = true
  hotelDetailsError.value = ''
  selectedHotelDetails.value = null
  try {
    const selected = selectedHotelForRequest.value || {}
    const regionId =
      selected.region_id || selected.regionId || null

    const body = {
      id: hid,
      checkin: checkin.value,
      checkout: checkout.value,
      residency: 'gb',
      language: 'fr',
      guests: buildGuestsPayload(),
      region_id: regionId,
      currency: 'EUR',
    }
    const endpoint = `${API_BASE}/api/search/hp`
    pushDebug('REQUEST /api/search/hp', { endpoint, body })
    const { statusCode, data } = await safeJsonFetch(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    pushDebug('RESPONSE /api/search/hp', {
      statusCode,
      data,
    })
    if (statusCode >= 400 || !data || data.error) {
      throw new Error(data?.error || data?._raw || 'Hotel lookup failed')
    }
    const resultArray = extractHotels(data?.results ?? data)
    selectedHotelDetails.value = resultArray[0] || null
  } catch (err) {
    pushDebug('ERROR /api/search/hp', {
      error: err?.message || String(err || ''),
    })
    hotelDetailsError.value = err.message || String(err || '')
  } finally {
    hotelDetailsLoading.value = false
  }
}

async function prebookRate(rate, index) {
  prebookStatus.value = ''
  const hotel = selectedHotelDetails.value
  if (!hotel || !rate) return

  const hash = rate.book_hash || rate.hash || rate.match_hash
  if (!hash) {
    prebookStatus.value = "Impossible de pré‑réserver cette option (hash manquant)."
    return
  }

  const payload = {
    book_hash: hash,
    price_increase_percent: 0,
    hp_context: {
      id: hotel.id || hotel.hid,
      hid: hotel.hid,
      checkin: checkin.value,
      checkout: checkout.value,
      guests: buildGuestsPayload(),
      currency: 'EUR',
      language: 'fr',
    },
  }

  const endpoint = `${API_BASE}/api/prebook`
  pushDebug('REQUEST /api/prebook', { endpoint, payload })

  try {
    prebookLoadingIndex.value = index
    const { statusCode, data } = await safeJsonFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    pushDebug('RESPONSE /api/prebook', { statusCode, data })
    if (statusCode >= 400 || !data || data.error) {
      prebookStatus.value =
        `Pré‑réservation impossible : ${data?.error || data?._raw || statusCode}`
      return
    }
    if (data?.prebook_token) {
      prebookStatus.value = 'Pré‑réservation créée. Redirection vers le formulaire de réservation…'
      persistPrebookSummary(data, hotel, rate)
      router.push({
        name: 'booking',
        query: { token: data.prebook_token },
      })
    } else {
      prebookStatus.value =
        "Pré‑réservation effectuée, mais aucun token n’a été retourné."
    }
  } catch (err) {
    pushDebug('ERROR /api/prebook', {
      error: err?.message || String(err || ''),
    })
    prebookStatus.value =
      `Erreur lors de la pré‑réservation : ${err?.message || String(err || '')}`
  } finally {
    prebookLoadingIndex.value = null
  }
}

function selectHotel(hotel) {
  const rawId =
    hotel?.id || hotel?.hotel_id || hotel?.hid || hotel?.hotelId
  if (!rawId) return
  const hid = String(rawId)
  selectedHotelForRequest.value = hotel
  loadHotelDetails(hid)
}

function goPrevPage() {
  if (currentPage.value > 1) {
    currentPage.value -= 1
  }
}

function goNextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value += 1
  }
}

// Trigger initial search when route query is available.
onMounted(() => {
  searchHotels()
})

// Re-run search when filters change.
watch(
  () => ({ ...filters.value }),
  () => {
    searchHotels()
  },
  { deep: true },
)
</script>

<style scoped>
.hotel-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.hotel-card {
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 0.75rem;
  padding: 0.75rem 0.85rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.hotel-card__main {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.hotel-card__actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.room-list {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.room-card {
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 0.75rem;
  padding: 0.6rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  background: rgba(15, 23, 42, 0.7);
}

.room-card__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}

.room-card__title {
  font-size: 0.85rem;
  font-weight: 600;
}

.room-card__price {
  font-size: 0.9rem;
  font-weight: 600;
}

.room-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  font-size: 0.75rem;
}

.pagination {
  margin-top: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
}

.pagination__label {
  font-size: 0.75rem;
  color: #94a3b8;
}
</style>
