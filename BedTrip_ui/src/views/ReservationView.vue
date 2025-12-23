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
        <div class="chip-toggle-group">
          <label
            v-for="n in 5"
            :key="n"
            class="chip-toggle"
            :class="{ 'chip-toggle--active': filters.stars.includes(n) }"
          >
            <input
              type="checkbox"
              :value="n"
              v-model="filters.stars"
            />
            <span class="chip-toggle__label">{{ n }}★</span>
          </label>
        </div>
      </div>

      <div class="filter-group">
        <p class="filter-title">Politiques</p>
        <div class="chip-toggle-group">
          <label
            class="chip-toggle"
            :class="{ 'chip-toggle--active': filters.freeCancel }"
          >
            <input
              type="checkbox"
              v-model="filters.freeCancel"
            />
            <span class="chip-toggle__label">Annulation gratuite</span>
          </label>
        </div>
      </div>

      <div class="filter-group">
        <p class="filter-title">Régime</p>
        <div class="chip-toggle-group chip-toggle-group--wrap chip-toggle-group--compact">
          <label
            v-for="meal in MEAL_OPTIONS"
            :key="meal.value"
            class="chip-toggle chip-toggle--meal"
            :class="{ 'chip-toggle--active': filters.meals.includes(meal.value) }"
            :title="meal.label"
          >
            <input
              type="checkbox"
              class="flt-meal"
              :value="meal.value"
              v-model="filters.meals"
            />
            <span class="chip-toggle__code">{{ meal.code }}</span>
            <span class="sr-only">{{ meal.label }}</span>
          </label>
        </div>
      </div>

      <div class="filter-group">
        <p class="filter-title">Budget (€)</p>
        <div class="budget-filter">
          <label>
            <span class="sr-only">Budget minimum</span>
            <input
              type="number"
              min="0"
              inputmode="numeric"
              placeholder="Min"
              v-model="budgetInputMin"
            />
          </label>
          <span class="budget-sep">—</span>
          <label>
            <span class="sr-only">Budget maximum</span>
            <input
              type="number"
              min="0"
              inputmode="numeric"
              placeholder="Max"
              v-model="budgetInputMax"
            />
          </label>
          <button
            type="button"
            class="secondary mini"
            @click="applyBudgetFilter"
          >
            Appliquer
          </button>
        </div>
        <small class="muted budget-hint">
          Les montants correspondent au prix par nuit et se mettent à jour automatiquement après validation.
        </small>
      </div>
    </section>

    <ResultsSkeleton v-if="loading" />

    <div class="results-grid" v-else>
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

        <div v-if="error" style="color:#dc2626;font-size:.8rem;">
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
              <div class="hotel-card__media" aria-hidden="true">
                <div class="hotel-thumb__viewport">
                  <template v-if="cardHasImages(hotel)">
                    <img
                      :src="cardCurrentImageUrl(hotel)"
                      :alt="`${hotelDisplayName(hotel)} · photo ${cardCurrentImageIndex(hotel) + 1}`"
                      loading="lazy"
                      decoding="async"
                    />
                  </template>
                  <div
                    v-else
                    class="hotel-thumb__placeholder"
                  >
                    Photo en cours de chargement…
                  </div>
                </div>
                <button
                  v-if="cardImageCount(hotel) > 1"
                  type="button"
                  class="hotel-thumb__nav hotel-thumb__nav--prev"
                  @click.stop="prevCardImage(hotel)"
                >
                  ‹
                </button>
                <button
                  v-if="cardImageCount(hotel) > 1"
                  type="button"
                  class="hotel-thumb__nav hotel-thumb__nav--next"
                  @click.stop="nextCardImage(hotel)"
                >
                  ›
                </button>
                <div
                  v-if="cardImageCount(hotel) > 1"
                  class="hotel-thumb__counter"
                >
                  {{ cardCurrentImageIndex(hotel) + 1 }} /
                  {{ cardImageCount(hotel) }}
                </div>
              </div>
              <div class="hotel-card__content">
                <header class="hotel-card__header">
                  <div class="hotel-card__title-block">
                    <h4 class="hotel-name">
                      {{ hotelDisplayName(hotel) }}
                    </h4>
                    <p class="hotel-meta">
                      <span v-if="hotel.city_name || hotel.city">
                        {{ hotel.city_name || hotel.city }}
                      </span>
                      <span v-if="hotel.country">
                        · {{ hotel.country }}
                      </span>
                    </p>
                    <div class="hotel-card__stars">
                      <span
                        v-for="star in deriveHotelStars(hotel) || 0"
                        :key="star"
                      >
                        ★
                      </span>
                    </div>
                  </div>
                  <div
                    v-if="hotelPriceLabel(hotel)"
                    class="hotel-card__price"
                  >
                    <span class="hotel-card__price-main">
                      À partir de {{ hotelPriceLabel(hotel) }}
                    </span>
                    <small>
                      pour le séjour
                      <span v-if="hotelNightlyPriceLabel(hotel)">
                        · {{ hotelNightlyPriceLabel(hotel) }}
                      </span>
                    </small>
                  </div>
                </header>
                <div class="hotel-card__detail-panel">
                  <div class="hotel-card__detail-info">
                    <div class="hotel-card__room-title">
                      {{ hotelPrimaryRoomName(hotel) }}
                    </div>
                    <div class="hotel-card__badges">
                      <span
                        v-if="hotelHasFreeCancellation(hotel)"
                        class="badge badge--success"
                      >
                        Annulation gratuite
                      </span>
                      <span
                        v-else
                        class="badge badge--danger"
                      >
                        Non remboursable
                      </span>
                      <span
                        v-for="meal in hotelMealBadges(hotel)"
                        :key="meal"
                        class="badge badge--meal"
                      >
                        {{ meal }}
                      </span>
                    </div>
                    <p class="hotel-request" v-if="guestRequestLabel">
                      Demande : {{ guestRequestLabel }}
                    </p>
                  </div>
                </div>
                <footer class="hotel-card__footer">
                  <button
                    class="secondary"
                    type="button"
                    @click="selectHotel(hotel)"
                  >
                    Voir les disponibilités
                  </button>
                </footer>
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

          <div class="hotel-detail__gallery">
            <div
              v-if="detailImagesLoading"
              class="hotel-thumb__placeholder"
            >
              Chargement des photos de l’hôtel…
            </div>
            <div
              v-else-if="detailImagesError"
              class="hotel-thumb__placeholder"
            >
              {{ detailImagesError }}
            </div>
            <div
              v-else-if="!detailImages.length"
              class="hotel-thumb__placeholder"
            >
              Aucune photo disponible pour cet hôtel.
            </div>
            <div
              v-else
              class="hotel-gallery"
            >
              <div
                v-for="(url, idx) in detailImages"
                :key="url + '-' + idx"
                class="hotel-gallery__item"
              >
                <img
                  :src="url"
                  :alt="`${hotelDisplayName(selectedHotelDetails) } · photo ${idx + 1}`"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>

          <div class="hotel-detail__info-grid">
            <div
              v-if="hotelDescriptionSnippet"
              class="hotel-detail__info-box"
            >
              <h4>Présentation</h4>
              <p class="hotel-detail__description">
                {{ hotelDescriptionSnippet }}
              </p>
            </div>

            <div
              v-if="hotelStayInfo.length"
              class="hotel-detail__info-box"
            >
              <h4>Arrivée et départ</h4>
              <ul class="hotel-detail__info-list">
                <li
                  v-for="item in hotelStayInfo"
                  :key="item"
                >
                  {{ item }}
                </li>
              </ul>
            </div>

            <div
              v-if="hotelContactInfo.length"
              class="hotel-detail__info-box"
            >
              <h4>Contact & localisation</h4>
              <ul class="hotel-detail__info-list">
                <li
                  v-for="item in hotelContactInfo"
                  :key="item"
                >
                  {{ item }}
                </li>
              </ul>
            </div>

            <div
              v-if="hotelAmenityList.length"
              class="hotel-detail__info-box"
            >
              <h4>Équipements et services</h4>
              <ul class="hotel-detail__chip-list">
                <li
                  v-for="item in hotelAmenityList"
                  :key="item.label"
                  class="hotel-detail__chip"
                >
                  <i
                    v-if="item.icon"
                    :class="['hotel-detail__chip-icon', item.icon]"
                    aria-hidden="true"
                  ></i>
                  <span>{{ item.label }}</span>
                </li>
              </ul>
            </div>

            <div
              v-if="hotelPaymentMethods.length"
              class="hotel-detail__info-box"
            >
              <h4>Moyens de paiement</h4>
              <ul class="hotel-detail__chip-list">
                <li
                  v-for="method in hotelPaymentMethods"
                  :key="method.label"
                  class="hotel-detail__chip"
                >
                  <i
                    v-if="method.icon"
                    :class="['hotel-detail__chip-icon', method.icon]"
                    aria-hidden="true"
                  ></i>
                  <span>{{ method.label }}</span>
                </li>
              </ul>
            </div>
          </div>

          <div class="hotel-detail__rooms">
            <div
              v-if="hotelHighlights.length"
              class="hotel-detail__highlights"
            >
              <h4>Équipements prisés</h4>
              <ul class="hotel-detail__chip-list">
                <li
                  v-for="item in hotelHighlights"
                  :key="item"
                  class="hotel-detail__chip"
                >
                  <i
                    class="pi pi-check-circle hotel-detail__chip-icon"
                    aria-hidden="true"
                  ></i>
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>

            <div
              v-if="nearbyPoints.length"
              class="hotel-detail__nearby"
            >
              <h4>Que faire à proximité</h4>
              <ul class="hotel-detail__nearby-list">
                <li
                  v-for="place in nearbyPoints"
                  :key="place.label + '-' + place.distanceText"
                >
                  <i
                    class="pi pi-map-marker hotel-detail__fact-icon"
                    aria-hidden="true"
                  ></i>
                  <span class="nearby-label">{{ place.label }}</span>
                  <span class="nearby-sep">•</span>
                  <span class="nearby-distance">{{ place.distanceText }}</span>
                </li>
              </ul>
            </div>

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
                  <span
                    v-for="chip in rateChipLabels(rate)"
                    :key="chip"
                    class="chip"
                  >
                    {{ chip }}
                  </span>
                </div>
                <div class="room-card__details">
                  <div>
                    {{ rateCancellationText(rate) }}
                  </div>
                  <div v-if="rateCapacityDetail(rate)">
                    {{ rateCapacityDetail(rate) }}
                  </div>
                  <div v-if="rateTaxesText(rate)">
                    {{ rateTaxesText(rate) }}
                  </div>
                  <div v-if="rateBeddingText(rate)">
                    {{ rateBeddingText(rate) }}
                  </div>
                  <div v-if="rateBathroomText(rate)">
                    {{ rateBathroomText(rate) }}
                  </div>
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
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ResultsSkeleton from '../components/ResultsSkeleton.vue'
import { API_BASE, safeJsonFetch } from '../services/httpClient.js'

const route = useRoute()
const router = useRouter()

const PREBOOK_SUMMARY_KEY = 'booking:lastPrebook'
const DEFAULT_IMAGE_SIZE = 'x300'
const DETAIL_IMAGE_SIZE = '1024x768'
const CARD_IMAGE_LIMIT = 10
const DETAIL_IMAGE_LIMIT = 13

const hotelImageCache = new Map()

const MEAL_OPTIONS = [
  { value: 'nomeal', code: 'RO', label: 'Room only' },
  { value: 'breakfast', code: 'BB', label: 'Bed & breakfast' },
  { value: 'half_board', code: 'HB', label: 'Half board' },
  { value: 'full_board', code: 'FB', label: 'Full board' },
  { value: 'all_inclusive', code: 'AI', label: 'All inclusive' },
]
const FILTER_DEBOUNCE_MS = 450

// Basic search state derived from route query.
const destination = computed(() => String(route.query.destination || '').trim())
const checkin = computed(() => String(route.query.checkin || '').trim())
const checkout = computed(() => String(route.query.checkout || '').trim())
const MAX_GUESTS_PER_ROOM = 6
const DEFAULT_CHILD_AGE = 8

const adults = computed(() => {
  const raw = Number(route.query.adults)
  const normalized = Number.isFinite(raw) ? raw : 2
  return Math.min(Math.max(1, normalized), MAX_GUESTS_PER_ROOM)
})
const rawChildrenCount = computed(() => {
  const raw = Number(route.query.children)
  if (Number.isFinite(raw) && raw >= 0) return raw
  return null
})

const parsedChildrenAges = computed(() => {
  const raw = route.query.childrenAges
  const joined = Array.isArray(raw) ? raw.join(',') : String(raw || '')
  if (!joined.trim()) return []
  return joined
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((value) => {
      const num = Number(value)
      if (!Number.isFinite(num)) return DEFAULT_CHILD_AGE
      return Math.min(Math.max(Math.floor(num), 0), 17)
    })
})

const childrenList = computed(() => {
  const maxChildren = Math.max(0, MAX_GUESTS_PER_ROOM - adults.value)
  const desired =
    rawChildrenCount.value != null
      ? Math.min(Math.max(rawChildrenCount.value, 0), maxChildren)
      : Math.min(parsedChildrenAges.value.length, maxChildren)
  const base = parsedChildrenAges.value.slice(0, desired)
  while (base.length < desired) {
    base.push(DEFAULT_CHILD_AGE)
  }
  return base
})

const guestRequestLabel = computed(() => {
  const adultLabel = `${adults.value} adulte${adults.value > 1 ? 's' : ''}`
  const kids = childrenList.value.length
  const childLabel = kids
    ? `${kids} enfant${kids > 1 ? 's' : ''}`
    : '0 enfant'
  return `${adultLabel} · ${childLabel}`
})

const statusMessage = ref('')
const loading = ref(false)
const error = ref('')
const hotels = ref([])
const currentPage = ref(1)
const pageSize = 8

const filters = ref({
  stars: [],
  meals: [],
  freeCancel: false,
  budgetMin: '',
  budgetMax: '',
})
const budgetInputMin = ref('')
const budgetInputMax = ref('')

const selectedHotelDetails = ref(null)
const selectedHotelForRequest = ref(null)
const hotelDetailsLoading = ref(false)
const hotelDetailsError = ref('')

const hotelImagesByKey = ref({})
const detailImages = ref([])
const detailImagesLoading = ref(false)
const detailImagesError = ref('')

// Debug entries for API calls
const debugEntries = ref([])

const prebookLoadingIndex = ref(null)
const prebookStatus = ref('')
let filtersDebounceTimer = null
let latestCardImagesToken = 0
let latestDetailImagesToken = 0

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

function getCardState(hotel) {
  const key = hotelKey(hotel)
  if (!key) return null
  return hotelImagesByKey.value[key] || null
}

function cardImageCount(hotel) {
  const state = getCardState(hotel)
  return Array.isArray(state?.images) ? state.images.length : 0
}

function cardHasImages(hotel) {
  return cardImageCount(hotel) > 0
}

function cardCurrentImageIndex(hotel) {
  const state = getCardState(hotel)
  const count = cardImageCount(hotel)
  if (!count || !state) return 0
  const idx = Number(state.index) || 0
  return Math.min(Math.max(idx, 0), count - 1)
}

function cardCurrentImageUrl(hotel) {
  const state = getCardState(hotel)
  const count = cardImageCount(hotel)
  if (!count || !state) return ''
  const idx = cardCurrentImageIndex(hotel)
  return state.images[idx] || ''
}

function updateCardImageIndex(hotel, delta) {
  const key = hotelKey(hotel)
  if (!key) return
  const state = getCardState(hotel)
  if (!state || !Array.isArray(state.images) || !state.images.length) {
    return
  }
  const total = state.images.length
  const nextIndex =
    (cardCurrentImageIndex(hotel) + delta + total) % total
  hotelImagesByKey.value = {
    ...hotelImagesByKey.value,
    [key]: {
      ...state,
      index: nextIndex,
    },
  }
}

function prevCardImage(hotel) {
  updateCardImageIndex(hotel, -1)
}

function nextCardImage(hotel) {
  updateCardImageIndex(hotel, 1)
}

function buildGuestsPayload() {
  return [
    {
      adults: adults.value,
      children: childrenList.value,
    },
  ]
}

function buildFilterPayload() {
  const payload = {
    stars: filters.value.stars.slice(),
    meals: filters.value.meals.slice(),
    free_cancel: filters.value.freeCancel,
  }
  const minRaw = String(filters.value.budgetMin ?? '').trim()
  const maxRaw = String(filters.value.budgetMax ?? '').trim()
  const minBudgetVal = minRaw === '' ? null : Number(minRaw)
  const maxBudgetVal = maxRaw === '' ? null : Number(maxRaw)
  let minBudget = Number.isFinite(minBudgetVal) && minBudgetVal >= 0 ? Math.floor(minBudgetVal) : null
  let maxBudget = Number.isFinite(maxBudgetVal) && maxBudgetVal >= 0 ? Math.floor(maxBudgetVal) : null
  if (minBudget !== null && maxBudget !== null && maxBudget < minBudget) {
    ;[minBudget, maxBudget] = [maxBudget, minBudget]
  }
  if (minBudget !== null) payload.budget_min = minBudget
  if (maxBudget !== null) payload.budget_max = maxBudget
  return payload
}

function applyBudgetFilter() {
  filters.value.budgetMin = budgetInputMin.value
  filters.value.budgetMax = budgetInputMax.value
}

function hotelKey(hotel) {
  return (
    hotel.id ||
    hotel.hid ||
    hotel.hotel_id ||
    hotel.hotelId ||
    hotel.rg_ext?.hid ||
    hotel.rg_ext?.id ||
    hotel.rg_ext?.hotel_id ||
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

function normalizeNumericId(value) {
  if (value === undefined || value === null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const str = String(value).trim()
  if (!str) return null
  if (/^\d+$/.test(str)) {
    const num = Number(str)
    return Number.isFinite(num) ? num : null
  }
  return null
}

function pickFirstString(...values) {
  for (const val of values) {
    if (val === undefined || val === null) continue
    const str = String(val).trim()
    if (!str) continue
    return str
  }
  return null
}

function buildHotelImageIdentity(hotel) {
  if (!hotel || typeof hotel !== 'object') {
    return { hid: null, fallbackId: null, cacheKey: null }
  }
  const hidCandidates = [
    hotel.hid,
    hotel.hotel_id,
    hotel.hotelId,
    hotel.id,
    hotel.rg_ext?.hid,
    hotel.rg_ext?.id,
    hotel.rg_ext?.hotel_id,
  ]
  let hid = null
  for (const candidate of hidCandidates) {
    const normalized = normalizeNumericId(candidate)
    if (normalized !== null) {
      hid = normalized
      break
    }
  }
  const fallbackId = pickFirstString(
    hotel.id,
    hotel.hotel_id,
    hotel.hotelId,
    hotel.hid,
    hotel.rg_ext?.id,
    hotel.rg_ext?.hid,
    hotel.rg_ext?.hotel_id,
  )
  const cacheKey =
    hid !== null
      ? `hid:${hid}`
      : fallbackId
        ? `id:${fallbackId}`
        : null
  return { hid, fallbackId, cacheKey }
}

async function requestHotelImagesFromApi(payload) {
  const endpoint = `${API_BASE}/api/hotel/images`
  const { statusCode, data } = await safeJsonFetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  pushDebug('RESPONSE /api/hotel/images', {
    statusCode,
    payload,
    sample: Array.isArray(data?.images)
      ? data.images.slice(0, 2)
      : null,
  })
  if (statusCode >= 400) {
    throw new Error(
      data?.error || data?._raw || 'Image lookup failed',
    )
  }
  const images = Array.isArray(data?.images)
    ? data.images.filter(
        (url) => typeof url === 'string' && url.length,
      )
    : []
  return images
}

async function fetchHotelImages(hotel, lang, size, limit = 1) {
  const identity = buildHotelImageIdentity(hotel)
  if (!identity.cacheKey) return []
  const safeLang = (lang || 'en').trim() || 'en'
  const safeSize = size || DEFAULT_IMAGE_SIZE
  const parsedLimit = Number(limit)
  const hasLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
  const cappedLimit = hasLimit
    ? Math.max(1, Math.min(parsedLimit, 50))
    : null
  const cacheKey = `${identity.cacheKey}|${safeLang}|${safeSize}|${
    cappedLimit ?? 'all'
  }`
  if (hotelImageCache.has(cacheKey)) {
    const cached = hotelImageCache.get(cacheKey)
    return typeof cached?.then === 'function' ? cached : cached
  }
  if (identity.hid === null && !identity.fallbackId) return []
  const payload = {
    language: safeLang,
    size: safeSize,
  }
  if (cappedLimit !== null) payload.limit = cappedLimit
  if (identity.hid !== null) payload.hid = identity.hid
  else if (identity.fallbackId) payload.id = identity.fallbackId

  const fetchPromise = (async () => {
    try {
      return await requestHotelImagesFromApi(payload)
    } catch (err) {
      pushDebug('ERROR /api/hotel/images', {
        payload,
        error: err?.message || String(err || ''),
      })
      return []
    }
  })()

  hotelImageCache.set(cacheKey, fetchPromise)
  const result = await fetchPromise
  hotelImageCache.set(cacheKey, result)
  return Array.isArray(result) ? result : []
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

function hotelCheapestRate(hotel) {
  if (!hotel || !Array.isArray(hotel?.rates)) return null
  const normalized = hotel.rates
    .map((rate) => {
      const payment = rate?.payment_options?.payment_types?.[0]
      const amount = Number(payment?.show_amount ?? payment?.amount)
      if (!Number.isFinite(amount)) return null
      const currency =
        payment?.show_currency_code ||
        payment?.currency_code ||
        'EUR'
      const nights = rate?.daily_prices?.length || 1
      return { amount, currency, nights }
    })
    .filter(Boolean)
  if (!normalized.length) return null
  normalized.sort((a, b) => a.amount - b.amount)
  return normalized[0]
}

function hotelPriceLabel(hotel) {
  const cheapest = hotelCheapestRate(hotel)
  if (!cheapest) return ''
  return formatCurrency(cheapest.amount, cheapest.currency)
}

function hotelNightlyPriceLabel(hotel) {
  const cheapest = hotelCheapestRate(hotel)
  if (!cheapest) return ''
  const nights = Math.max(1, cheapest.nights || 1)
  const nightlyAmount = cheapest.amount / nights
  const formatted = formatCurrency(nightlyAmount, cheapest.currency)
  return `${formatted} / nuit`
}

function hotelHasFreeCancellation(hotel) {
  if (!hotel || !Array.isArray(hotel?.rates)) return false
  return hotel.rates.some((rate) => {
    const penalties = rate?.payment_options?.payment_types?.[0]?.cancellation_penalties
    const freeBefore = penalties?.free_cancellation_before
    if (!freeBefore) return false
    const ts = Date.parse(freeBefore)
    return Number.isFinite(ts) && ts > Date.now()
  })
}

function hotelMealBadges(hotel) {
  if (!hotel || !Array.isArray(hotel?.rates)) return []
  const unique = new Set()
  hotel.rates.forEach((rate) => {
    const label = friendlyMeal(rate?.meal_data?.value || rate?.meal)
    if (label) unique.add(label)
  })
  return Array.from(unique).slice(0, 3)
}

function hotelPrimaryRoomName(hotel) {
  const rate = Array.isArray(hotel?.rates) ? hotel.rates[0] : null
  return (
    rate?.room_name ||
    rate?.room_data_trans?.main_name ||
    rate?.name ||
    'Chambre'
  )
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

function friendlySerpFilter(code) {
  switch ((code || '').toLowerCase()) {
    case 'has_breakfast':
      return 'Petit‑déjeuner inclus'
    case 'has_internet':
      return 'Internet gratuit'
    case 'has_bathroom':
      return 'Salle de bain privative'
    case 'free_cancellation':
      return 'Annulation gratuite'
    case 'refundable':
      return 'Tarif remboursable'
    default:
      return code ? code.replace(/_/g, ' ') : null
  }
}

function collectHotelHighlights(rates) {
  const tags = new Set()
  ;(rates || []).forEach((rate) => {
    ;(rate?.serp_filters || []).forEach((flt) => {
      const label = friendlySerpFilter(flt)
      if (label) tags.add(label)
    })
    ;(rate?.amenities_data || []).forEach((amenity) => {
      if (amenity) {
        const label = amenity.replace(/_/g, ' ')
        tags.add(label)
      }
    })
  })
  return Array.from(tags)
}

function getRatePayment(rate) {
  return rate?.payment_options?.payment_types?.[0] || null
}

function getRateCapacity(rate) {
  if (!rate) return null
  const candidates = [
    rate?.rg_ext?.capacity,
    rate?.rg_ext?.occupancy,
    rate?.capacity,
    rate?.max_occupancy,
    rate?.occupancy,
  ]
  for (const value of candidates) {
    const num = Number(value)
    if (Number.isFinite(num) && num > 0) return num
  }
  return null
}

function requestedGuestsSummary() {
  const adultsCount = adults.value
  const childrenCount = childrenList.value.length
  const adultLabel = `${adultsCount} adulte${
    adultsCount > 1 ? 's' : ''
  }`
  const childLabel = `${childrenCount} enfant${
    childrenCount > 1 ? 's' : ''
  }`
  return `${adultLabel} · ${childLabel}`
}

function rateChipLabels(rate) {
  const chips = []
  const mealLabel = friendlyMeal(
    rate?.meal_data?.value || rate?.meal,
  )
  const capacity = getRateCapacity(rate)
  if (mealLabel) chips.push(mealLabel)
  if (capacity) {
    chips.push(
      `Capacité : ${capacity} personne${
        capacity > 1 ? 's' : ''
      }`,
    )
  }
  if (rate?.rg_ext?.class) {
    chips.push(`${rate.rg_ext.class}★`)
  }
  if (rate?.allotment) {
    chips.push(
      `Il reste ${rate.allotment} chambre${
        rate.allotment > 1 ? 's' : ''
      }`,
    )
  }
  return chips
}

function rateCancellationText(rate) {
  const payment = getRatePayment(rate)
  const freeBefore =
    payment?.cancellation_penalties?.free_cancellation_before
  if (freeBefore) {
    let dateText = freeBefore
    try {
      const d = new Date(freeBefore)
      if (!Number.isNaN(d.getTime())) {
        dateText = d.toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      }
    } catch {
      // ignore parse errors
    }
    return `Annulation gratuite possible jusqu’au ${dateText}.`
  }
  return 'Frais d’annulation peuvent s’appliquer selon les conditions du tarif.'
}

function rateCapacityDetail(rate) {
  const capacity = getRateCapacity(rate)
  const requested = requestedGuestsSummary()
  if (capacity) {
    return `Capacité maximale : ${capacity} personne${
      capacity > 1 ? 's' : ''
    } · Demande actuelle : ${requested}.`
  }
  return `Demande actuelle : ${requested}.`
}

function rateTaxesText(rate) {
  const payment = getRatePayment(rate)
  const taxes = payment?.tax_data?.taxes
  if (!Array.isArray(taxes) || !taxes.length) return ''
  const parts = taxes
    .slice(0, 3)
    .map((tax) => {
      if (!tax) return null
      const name = (tax.name || 'Taxe locale').replace(/_/g, ' ')
      const amountText =
        tax.amount != null
          ? formatCurrency(
              tax.amount,
              tax.currency_code ||
                payment?.show_currency_code ||
                payment?.currency_code ||
                'EUR',
            )
          : ''
      const included = tax.included_by_supplier
        ? 'inclus'
        : 'à régler sur place'
      return `${name} ${amountText} (${included})`
    })
    .filter(Boolean)
  if (!parts.length) return ''
  return `Taxes & frais : ${parts.join(', ')}`
}

function rateBeddingText(rate) {
  const bedding = rate?.room_data_trans?.bedding_type
  if (!bedding) return ''
  return `Literie : ${bedding}.`
}

function rateBathroomText(rate) {
  const bathroom = rate?.room_data_trans?.bathroom
  if (!bathroom) return ''
  return `Salle de bain : ${bathroom}.`
}

const selectedHotelRates = computed(() => {
  const hotel = selectedHotelDetails.value
  return Array.isArray(hotel?.rates) ? hotel.rates : []
})

const limitedRates = computed(() => selectedHotelRates.value.slice(0, 8))

const hotelHighlights = computed(() =>
  collectHotelHighlights(selectedHotelRates.value).slice(0, 8),
)

const nearbyPoints = computed(() => {
  const hotel = selectedHotelDetails.value
  if (!hotel) return []
  const pois =
    hotel.points_of_interest ||
    hotel.pois ||
    hotel.nearby_points ||
    []
  if (!Array.isArray(pois) || !pois.length) return []
  const formatDistance = (meters) => {
    const num = Number(meters)
    if (!Number.isFinite(num) || num <= 0) return ''
    if (num >= 1000) {
      const km = num / 1000
      return `${km >= 10 ? km.toFixed(0) : km.toFixed(1)} km`
    }
    return `${Math.round(num)} m`
  }
  return pois
    .map((poi) => {
      const label =
        poi?.name ||
        poi?.label ||
        poi?.description ||
        null
      const distanceText =
        formatDistance(poi?.distance) ||
        formatDistance(poi?.distance_meters) ||
        formatDistance(poi?.distance_center_meters)
      if (!label || !distanceText) return null
      return { label, distanceText }
    })
    .filter(Boolean)
    .slice(0, 6)
})

const hotelDescriptionSnippet = computed(() => {
  const hotel = selectedHotelDetails.value
  if (!hotel) return ''
  const ds = hotel.description_struct || {}
  const raw =
    ds.short ||
    ds.summary ||
    ds.description ||
    hotel.description ||
    ''
  return String(raw || '').trim()
})

const hotelStayInfo = computed(() => {
  const hotel = selectedHotelDetails.value
  if (!hotel) return []
  const items = []
  if (hotel.check_in_time) {
    items.push(`Arrivée à partir de ${hotel.check_in_time}`)
  }
  if (hotel.check_out_time) {
    items.push(`Départ jusqu’à ${hotel.check_out_time}`)
  }
  if (hotel.front_desk_time_start || hotel.front_desk_time_end) {
    const start = hotel.front_desk_time_start || ''
    const end = hotel.front_desk_time_end || ''
    items.push(
      `Réception ouverte de ${start || '?'} à ${end || '?'}`,
    )
  }
  return items
})

const hotelContactInfo = computed(() => {
  const hotel = selectedHotelDetails.value
  if (!hotel) return []
  const items = []
  const region = hotel.region || {}
  if (hotel.address) {
    items.push(hotel.address)
  }
  if (hotel.postal_code || region.city || region.name) {
    const parts = [
      hotel.postal_code,
      region.city || region.name,
      region.country_name || region.country,
    ].filter(Boolean)
    if (parts.length) items.push(parts.join(' '))
  }
  if (hotel.phone) {
    items.push(`Téléphone : ${hotel.phone}`)
  }
  if (hotel.email) {
    items.push(`Email : ${hotel.email}`)
  }
  return items
})

function normalizeAmenityGroupItem(value) {
  if (!value) return ''
  return String(value).replace(/_/g, ' ').trim()
}

const hotelAmenityList = computed(() => {
  const hotel = selectedHotelDetails.value
  if (!hotel) return []
  const groups = hotel.amenity_groups
  if (!Array.isArray(groups) || !groups.length) return []
  const items = []
  groups.forEach((group) => {
    const label =
      normalizeAmenityGroupItem(group?.name) ||
      normalizeAmenityGroupItem(group?.group_name)
    const amenities =
      group?.amenities ||
      group?.items ||
      group?.values ||
      []
    const normalized = (amenities || [])
      .map((a) => normalizeAmenityGroupItem(a))
      .filter(Boolean)
    if (label && normalized.length) {
      normalized.slice(0, 3).forEach((amen) => {
        items.push(`${label} : ${amen}`)
      })
    } else if (normalized.length) {
      items.push(...normalized)
    }
  })
  return items.slice(0, 8)
})

const hotelPaymentMethods = computed(() => {
  const hotel = selectedHotelDetails.value
  const methods = hotel?.payment_methods
  if (!Array.isArray(methods) || !methods.length) return []
  const mapLabel = (code) => {
    const c = String(code || '').toLowerCase()
    if (!c) return null
    if (c.includes('visa')) return 'Carte Visa'
    if (c.includes('master') || c.includes('mc'))
      return 'Carte Mastercard'
    if (c.includes('amex') || c.includes('american'))
      return 'American Express'
    if (c.includes('cash')) return 'Espèces'
    if (c.includes('paypal')) return 'PayPal'
    return code
  }
  const labels = methods
    .map((m) => mapLabel(m))
    .filter(Boolean)
  return Array.from(new Set(labels)).slice(0, 6)
})

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
    filters: buildFilterPayload(),
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
    hotelImagesByKey.value = {}
    detailImages.value = []
    detailImagesError.value = ''
    const token = ++latestCardImagesToken
    hydrateHotelCardImages(results, token)
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
  detailImages.value = []
  detailImagesError.value = ''
  const imagesToken = ++latestDetailImagesToken
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
    if (selectedHotelDetails.value) {
      hydrateHotelDetailGallery(selectedHotelDetails.value, imagesToken)
    }
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
    hotel?.id ||
    hotel?.hotel_id ||
    hotel?.hotelId ||
    hotel?.hid ||
    hotel?.rg_ext?.id ||
    hotel?.rg_ext?.hid ||
    hotel?.rg_ext?.hotel_id
  if (!rawId) return
  const hid = String(rawId)
  selectedHotelForRequest.value = hotel
  loadHotelDetails(hid)
}

async function hydrateHotelCardImages(hotelsList, token) {
  if (!Array.isArray(hotelsList) || !hotelsList.length) return
  const lang = 'fr'
  const size = DEFAULT_IMAGE_SIZE
  for (const hotel of hotelsList) {
    const key = hotelKey(hotel)
    if (!key) continue
    const state = {
      images: [],
      index: 0,
      title: hotelDisplayName(hotel),
    }
    hotelImagesByKey.value = {
      ...hotelImagesByKey.value,
      [key]: state,
    }
    try {
      const images = await fetchHotelImages(
        hotel,
        lang,
        size,
        CARD_IMAGE_LIMIT,
      )
      if (token !== latestCardImagesToken) return
      if (!images.length) continue
      hotelImagesByKey.value = {
        ...hotelImagesByKey.value,
        [key]: {
          ...state,
          images,
          index: 0,
        },
      }
    } catch {
      // ignore per-hotel image errors
    }
  }
}

async function hydrateHotelDetailGallery(hotel, token) {
  detailImagesLoading.value = true
  detailImagesError.value = ''
  try {
    const lang = 'fr'
    const images = await fetchHotelImages(
      hotel,
      lang,
      DETAIL_IMAGE_SIZE,
      DETAIL_IMAGE_LIMIT,
    )
    if (token !== latestDetailImagesToken) return
    detailImages.value = images || []
  } catch (err) {
    if (token !== latestDetailImagesToken) return
    detailImages.value = []
    detailImagesError.value =
      err?.message ||
      "Impossible de charger les photos de l'hôtel."
  } finally {
    if (token === latestDetailImagesToken) {
      detailImagesLoading.value = false
    }
  }
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
  budgetInputMin.value = filters.value.budgetMin ? String(filters.value.budgetMin) : ''
  budgetInputMax.value = filters.value.budgetMax ? String(filters.value.budgetMax) : ''
})

// Re-run search when filters change.
watch(
  () => ({ ...filters.value }),
  () => {
    if (filtersDebounceTimer) clearTimeout(filtersDebounceTimer)
    filtersDebounceTimer = setTimeout(() => {
      searchHotels()
    }, FILTER_DEBOUNCE_MS)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  if (filtersDebounceTimer) clearTimeout(filtersDebounceTimer)
})
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

/* =========================
   Hotel Result Card (ONLY)
   ========================= */

.hotel-card {
  display: grid;
  grid-template-columns: minmax(320px, 360px) 1fr;
  gap: 1rem;
  align-items: stretch;
  padding: 0.9rem;
  border-radius: 1.1rem;
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 10px 30px rgba(0,0,0,0.22);
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
}

.hotel-card:hover {
  transform: translateY(-2px);
  border-color: rgba(148, 163, 184, 0.28);
  box-shadow: 0 16px 40px rgba(0,0,0,0.30);
}

/* media left */
.hotel-card__media {
  width: 100%;
  min-height: 220px;
  height: 100%;
  border-radius: 1rem;
  overflow: hidden;
  position: relative;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(2, 6, 23, 0.6);
}

.hotel-thumb__viewport {
  width: 100%;
  height: 100%;
}

.hotel-thumb__viewport img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.hotel-thumb__placeholder {
  font-size: 0.75rem;
  color: #cbd5e1;
  text-align: center;
  padding: 0.5rem;
  opacity: 0.85;
  display: grid;
  place-items: center;
  height: 100%;
}

.hotel-thumb__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: 1px solid rgba(248, 250, 252, 0.7);
  background: rgba(15, 23, 42, 0.55);
  color: #f8fafc;
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 1rem;
  font-weight: 600;
  transition: background 0.15s, opacity 0.15s;
}

.hotel-thumb__nav:hover {
  background: rgba(15, 23, 42, 0.75);
}

.hotel-thumb__nav--prev {
  left: 0.4rem;
}

.hotel-thumb__nav--next {
  right: 0.4rem;
}

.hotel-thumb__counter {
  position: absolute;
  bottom: 0.35rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  color: #e2e8f0;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(248, 250, 252, 0.4);
}

/* right column */
.hotel-card__content {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.hotel-card__header {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: 1rem;
}

/* Hide internal ID (no one cares) */
.hotel-card__id { display: none; }

.hotel-name {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: #f8fafc;
  line-height: 1.2;
}

.hotel-meta {
  margin: 0.1rem 0 0;
  font-size: 0.78rem;
  color: rgba(148,163,184,0.95);
}

.hotel-card__stars span {
  color: #fbbf24;
  font-size: 0.85rem;
  filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));
}

/* price top-right like your screenshot but cleaner */
.hotel-card__price {
  text-align: right;
  min-width: 180px;

  padding: 0.55rem 0.8rem;
  border-radius: 1rem;

  background: linear-gradient(
    180deg,
    rgba(59,130,246,0.16),
    rgba(59,130,246,0.08)
  );
  border: 1px solid rgba(96,165,250,0.32);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
}

.hotel-card__price-main {
  font-size: 1.05rem;
  font-weight: 500;
  color: #f8fafc;
}

.hotel-card__price small {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.7rem;
  color: rgba(148,163,184,0.95);
}

/* detail panel */
.hotel-card__detail-panel {
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(2, 6, 23, 0.25);
  padding: 0.75rem 0.85rem;
}

.hotel-card__room-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: #fff;
  margin-bottom: 0.45rem;
}

.hotel-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.hotel-request {
  margin: 0.45rem 0 0;
  font-size: 0.75rem;
  color: rgba(148,163,184,0.95);
}

/* badges (chips) */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;

  padding: 0.28rem 0.7rem;
  border-radius: 999px;

  font-size: 0.72rem;
  font-weight: 500;

  background: rgba(255,255,255,0.06);
  color: #e2e8f0;
  border: 1px solid rgba(148,163,184,0.18);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
}

/* You were missing badge--danger in your CSS */
.badge--success { 
  background: rgba(34,197,94,0.14);
  border-color: rgba(34,197,94,0.28);
  color: #bbf7d0;
}
.badge--success::before { content: "✅"; }

.badge--danger {
  background: rgba(239,68,68,0.14);
  border-color: rgba(239,68,68,0.28);
  color: #fecaca;
}
.badge--danger::before { content: "⛔"; }

.badge--meal {
  background: rgba(251,146,60,0.12);
  border-color: rgba(249,115,22,0.24);
  color: #fed7aa;
}
.badge--meal::before { content: "🍽️"; }

/* footer CTA */
.hotel-card__footer {
  margin-top: auto;
  display: flex;
  justify-content: flex-end;
}

.hotel-card__footer .secondary {
  padding: 0.55rem 1rem;
  border-radius: 0.95rem;
  font-weight: 800;

  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(148,163,184,0.20);

  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
  width: 100%;
}

.hotel-card__footer .secondary:hover {
  transform: translateY(-1px);
  border-color: rgba(96,165,250,0.45);
  box-shadow: 0 10px 20px rgba(0,0,0,0.25);
}

.hotel-detail {
  display: grid;
  gap: 1rem;
}

.hotel-detail__summary {
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 0.8rem;
  padding: 0.9rem 1rem;
  background: rgba(15, 23, 42, 0.55);
  display: grid;
  gap: 0.6rem;
}

.hotel-detail__header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
  align-items: baseline;
}

.hotel-detail__title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
}

.hotel-detail__meta {
  font-size: 0.75rem;
  color: #94a3b8;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.hotel-detail__gallery {
  margin-top: 0.5rem;
}

.hotel-gallery {
  column-count: 3;
  column-gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.hotel-gallery__item {
  break-inside: avoid;
  margin-bottom: 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 0.6rem;
  overflow: hidden;
  background: linear-gradient(
    135deg,
    rgba(59, 130, 246, 0.25),
    rgba(15, 23, 42, 0.6)
  );
}

.hotel-gallery__item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.hotel-detail__highlights,
.hotel-detail__nearby {
  margin-top: 0.5rem;
  padding: 0.75rem 0.9rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(15, 23, 42, 0.55);
}

.hotel-detail__highlights h4,
.hotel-detail__nearby h4 {
  margin: 0 0 0.4rem;
  font-size: 0.85rem;
}

.hotel-detail__highlights-list,
.hotel-detail__nearby-list {
  margin: 0;
  padding-left: 1rem;
  font-size: 0.75rem;
  color: #cbd5e1;
}

.hotel-detail__chip-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.hotel-detail__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.4);
}

.hotel-detail__chip-icon {
  font-size: 0.75rem;
  color: #a5b4fc;
}

.hotel-detail__info-list {
  margin: 0;
  padding-left: 0.9rem;
  font-size: 0.75rem;
  color: #cbd5e1;
}

.hotel-detail__info-list li {
  margin-bottom: 0.2rem;
}

.hotel-detail__facts-list {
  list-style: none;
  padding-left: 0;
}

.hotel-detail__fact-icon {
  font-size: 0.75rem;
  margin-right: 0.3rem;
  color: #7dd3fc;
}

.hotel-detail__fact-label {
  font-weight: 600;
}

.hotel-detail__fact-value {
  margin-left: 0.2rem;
}

.hotel-detail__nearby-list {
  list-style: none;
  padding-left: 0;
}

.hotel-detail__nearby-list li {
  margin-bottom: 0.2rem;
}

.nearby-label {
  font-weight: 500;
}

.nearby-sep {
  margin: 0 0.25rem;
}

@media (max-width: 900px) {
  .hotel-gallery {
    column-count: 2;
  }
}

/* responsive */
@media (max-width: 900px) {
  .hotel-card { grid-template-columns: 1fr; }
  .hotel-card__media { height: 200px; }
  .hotel-card__header { grid-template-columns: 1fr; }
  .hotel-card__price { text-align: left; min-width: 0; }
}


.room-list {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chip-toggle-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.chip-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.6);
  font-size: 0.75rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.chip-toggle--active {
  border-color: rgba(59, 130, 246, 0.8);
  background: rgba(37, 99, 235, 0.18);
}

.chip-toggle input {
  display: none;
}

.chip-toggle__code {
  font-weight: 600;
  font-size: 0.8rem;
}

.chip-toggle__label {
  font-size: 0.75rem;
  color: #cbd5e1;
}

.chip-toggle-group--wrap {
  flex-wrap: wrap;
}

.chip-toggle-group--compact {
  justify-content: center;
  max-width: 360px;
  margin: 0 auto;
  gap: 0.35rem;
}

.budget-filter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.budget-filter input {
  width: 110px;
}

.budget-filter button {
  width: 110px;
  height: auto;
  padding: 0.80rem 0.75rem;
  min-width: unset;
}

.budget-sep {
  color: #94a3b8;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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

.room-card__details {
  margin-top: 0.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.72rem;
  color: #cbd5e1;
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
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.65rem;
  border-radius: 0.75rem;
  font-size: 0.7rem;
  font-weight: 600;
  width: fit-content;
}

.badge--success {
  background: rgba(34, 197, 94, 0.18);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.35);
}

.badge--info {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(96, 165, 250, 0.4);
}

.badge--meal {
  background: rgba(251, 146, 60, 0.15);
  color: #fdba74;
  border: 1px solid rgba(249, 115, 22, 0.4);
}
