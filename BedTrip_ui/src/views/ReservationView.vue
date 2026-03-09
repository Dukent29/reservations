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
  <section class="workspace__content reservation-view">
    <section class="card search-edit-card">
      <div class="search-edit-card__head">
        <div>
          <p class="muted search-edit-card__label">Votre recherche</p>
          <strong class="search-edit-card__summary">
            {{ editSearchSummary }}
          </strong>
        </div>
        <button
          type="button"
          class="secondary mini search-edit-toggle"
          @click="editPanelOpen = !editPanelOpen"
          :aria-expanded="editPanelOpen ? 'true' : 'false'"
        >
          <span class="search-edit-toggle__icon" aria-hidden="true">✎</span>
          <span>{{ editPanelOpen ? 'Fermer' : 'Modifier' }}</span>
        </button>
      </div>

      <div
        v-if="editPanelOpen"
        class="search-edit-form-wrap"
      >
        <HotelSearchForm
          :show-hint-text="false"
          submit-label="Mettre à jour la recherche"
          :initial-destination="destination"
          :initial-checkin="checkin"
          :initial-checkout="checkout"
          :initial-adults="adults"
          :initial-children-ages="childrenList"
          @submit-search="submitEditedSearch"
        />
      </div>
    </section>

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
      <details class="geo-debug" open>
        <summary>Debug Geo</summary>
        <div class="geo-debug__grid">
          <div>
            <strong>Hôtels analysés:</strong> {{ geoDebug.total }}
          </div>
          <div>
            <strong>Centre-ville (connus/manquants):</strong>
            {{ geoDebug.cityKnown }} / {{ geoDebug.cityMissing }}
          </div>
          <div>
            <strong>Plage (connus/manquants):</strong>
            {{ geoDebug.beachKnown }} / {{ geoDebug.beachMissing }}
          </div>
          <div>
            <strong>Filtre centre-ville (m):</strong>
            {{ geoDebug.activeCityLimit ?? '—' }}
          </div>
          <div>
            <strong>Filtre plage (m):</strong>
            {{ geoDebug.activeBeachLimit ?? '—' }}
          </div>
        </div>
        <div class="geo-debug__samples">
          <strong>Exemples distances:</strong>
          <ul>
            <li v-for="row in geoDebug.samples" :key="row.key">
              {{ row.name }} | ville:
              {{ row.cityDistance ?? 'NA' }} ({{ row.citySource || '—' }}) | plage:
              {{ row.beachDistance ?? 'NA' }} ({{ row.beachSource || '—' }})
            </li>
          </ul>
        </div>
      </details>
    </header>
    <div class="results-layout">
      <aside class="filters-panel card">
        <div class="installment-highlight" role="note" aria-label="Paiement en plusieurs fois">
          <span class="installment-highlight__badge">3x / 4x</span>
          <div class="installment-highlight__text">
            <strong>Paiement en plusieurs fois</strong>
            <p>
              Disponible en <strong>3 ou 4 mensualités</strong> avec FLOA.
            </p>
          </div>
        </div>
        <section class="filters">
          <div class="filter-group">
            <p class="filter-title">Étoiles</p>
            <div class="filter-checklist">
              <label
                v-for="n in STAR_FILTER_OPTIONS"
                :key="n"
                class="filter-check"
              >
                <input
                  type="checkbox"
                  :value="n"
                  v-model="filters.stars"
                />
                <span class="filter-check__title">
                  {{ n }} étoile{{ n > 1 ? 's' : '' }}
                </span>
              </label>
            </div>
            <p class="muted" style="margin:.4rem 0 0;font-size:.75rem;">
              Sélectionnez la catégorie d’hôtel souhaitée.
            </p>
          </div>

          <div class="filter-group">
            <p class="filter-title">Politiques</p>
            <div class="filter-checklist">
              <label class="filter-check">
                <input
                  type="checkbox"
                  v-model="filters.freeCancel"
                />
                <span class="filter-check__title">Annulation gratuite</span>
              </label>
              <span class="filter-check__hint">
                Sans frais avant la date limite
              </span>
            </div>
            <p class="muted" style="margin:.4rem 0 0;font-size:.75rem;">
              Afficher uniquement les offres avec annulation sans frais.
            </p>
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
                <span class="chip-toggle__desc">{{ meal.label }}</span>
              </label>
            </div>
            <p class="muted" style="margin:.4rem 0 0;font-size:.75rem;">
              RO = chambre seule · BB = petit-déjeuner · HB = demi‑pension · FB = pension complète · AI/AL = tout compris
            </p>
          </div>

          <div class="filter-group geo-filter-card">
            <p class="filter-title">Emplacement</p>
            <div class="geo-filter-city">
              <p class="geo-filter-city__label">du centre-ville</p>
              <div class="geo-filter-city__control">
                <input
                  v-model.number="filters.cityDistanceKm"
                  type="range"
                  class="geo-range"
                  :min="CITY_DISTANCE_MIN_KM"
                  :max="CITY_DISTANCE_MAX_KM"
                  :step="1"
                />
                <span class="geo-range__value">{{ filters.cityDistanceKm }} km</span>
              </div>
            </div>
            <div class="geo-filter-beach">
              <p class="geo-filter-beach__title">Distance de la plage</p>
              <div class="filter-checklist">
                <label
                  v-for="option in BEACH_DISTANCE_OPTIONS"
                  :key="option.value"
                  class="filter-check"
                >
                  <input
                    type="checkbox"
                    :value="option.value"
                    v-model="filters.beachDistanceMeters"
                  />
                  <span class="filter-check__title">{{ option.label }}</span>
                </label>
              </div>
            </div>
            <p class="muted" style="margin:.2rem 0 0;font-size:.72rem;">
              Le filtrage suit les distances réellement renvoyées par l’API.
            </p>
          </div>

          <div class="filter-group">
            <p class="filter-title">Budget (€)</p>
            <div class="budget-filter">
              <div class="budget-range">
                <span class="sr-only">Budget maximum</span>
                <div
                  class="budget-range__track"
                  :style="{
                    '--min': `${budgetMinPercent}%`,
                    '--max': `${budgetMaxPercent}%`,
                  }"
                ></div>
                <input
                  class="budget-range__input budget-range__input--max-only"
                  type="range"
                  :min="BUDGET_RANGE_MIN"
                  :max="BUDGET_RANGE_MAX"
                  :step="BUDGET_RANGE_STEP"
                  :value="budgetSliderValue"
                  @input="onBudgetInput"
                />
              </div>
              <div class="budget-values">
                <span>{{ formatBudgetLabel(budgetMinValue) }}</span>
                <span>{{ formatBudgetLabel(budgetMaxValue, true) }}</span>
              </div>
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
      </aside>

      <div class="results-panel">
        <div
          v-if="loading"
          class="results-loading"
          role="status"
          aria-live="polite"
        >
          <div class="results-loading__banner">
            <span class="results-loading__spinner" aria-hidden="true"></span>
            <span>Recherche des meilleures offres en cours…</span>
          </div>
          <ResultsSkeleton />
        </div>

        <div class="results-list" v-else>
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
            <div class="results-map-block" v-if="hotels.length">
              <div class="results-map-block__head">
                <strong>Carte des hôtels</strong>
                <small>
                  {{ mapCoverage.exact }} exacts · {{ mapCoverage.approx }} approx.
                </small>
              </div>
              <div ref="mapContainerRef" class="results-map-canvas"></div>
              <small class="muted">
                Cliquez sur un numéro pour ouvrir l’hôtel correspondant.
              </small>
            </div>

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
                          <span
                            v-if="hotelDisplayIndex(hotel)"
                            class="hotel-list-index"
                          >
                            {{ hotelDisplayIndex(hotel) }}.
                          </span>
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
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HotelSearchForm from '../components/search/HotelSearchForm.vue'
import ResultsSkeleton from '../components/ResultsSkeleton.vue'
import { API_BASE, safeJsonFetch } from '../services/httpClient.js'

const route = useRoute()
const router = useRouter()

const PREBOOK_SUMMARY_KEY = 'booking:lastPrebook'
const MARKUP_PERCENT = 10
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
const CITY_DISTANCE_MIN_KM = 1
const CITY_DISTANCE_MAX_KM = 30
const BEACH_DISTANCE_OPTIONS = [
  { value: 100, label: "jusqu'à 100 m" },
  { value: 500, label: "jusqu'à 500 m" },
  { value: 1000, label: "jusqu'à 1 km" },
  { value: 1500, label: "jusqu'à 1,5 km" },
  { value: 2000, label: "jusqu'à 2 km" },
]
const STAR_FILTER_OPTIONS = [2, 3, 4, 5]
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

const editPanelOpen = ref(false)

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
  cityDistanceKm: CITY_DISTANCE_MAX_KM,
  beachDistanceMeters: [],
  freeCancel: false,
  budgetMin: '',
  budgetMax: '',
})
const budgetInputMin = ref('')
const budgetInputMax = ref('')
const BUDGET_RANGE_MIN = 0
const BUDGET_RANGE_MAX = 1000
const BUDGET_RANGE_STEP = 10
const BUDGET_WINDOW = 500
const BUDGET_HALF_WINDOW = BUDGET_WINDOW / 2
const budgetSliderValue = ref(500)

const selectedHotelDetails = ref(null)
const selectedHotelForRequest = ref(null)
const hotelDetailsLoading = ref(false)
const hotelDetailsError = ref('')

const hotelImagesByKey = ref({})
const detailImages = ref([])
const detailImagesLoading = ref(false)
const detailImagesError = ref('')
const mapContainerRef = ref(null)
const leafletApi = ref(null)
const resultsMap = ref(null)
const mapMarkerLayer = ref(null)
const destinationCenterFallback = ref(null)
const geocodeCenterCache = new Map()

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

const editSearchSummary = computed(() => {
  const who = `${adults.value || 1} adulte${Number(adults.value || 1) > 1 ? 's' : ''}`
  const kids = Number(childrenList.value.length || 0)
  const kidsLabel = `${kids} enfant${kids > 1 ? 's' : ''}`
  const datePart =
    checkin.value && checkout.value
      ? `${checkin.value} → ${checkout.value}`
      : ''
  return [destination.value || '-', datePart, `${who} · ${kidsLabel}`]
    .filter(Boolean)
    .join(' · ')
})


const resultsMeta = computed(() => {
  if (!hotels.value.length) return ''
  return `${hotels.value.length} hôtels · page ${currentPage.value} / ${totalPages.value}`
})

function parseDistanceMeters(value) {
  if (value === undefined || value === null) return null
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value
  }
  const raw = String(value).trim().toLowerCase()
  if (!raw) return null
  const normalized = raw.replace(',', '.')
  const kmMatch = normalized.match(/(\d+(?:\.\d+)?)\s*km\b/)
  if (kmMatch) return Number(kmMatch[1]) * 1000
  const mMatch = normalized.match(/(\d+(?:\.\d+)?)\s*m\b/)
  if (mMatch) return Number(mMatch[1])
  const miMatch = normalized.match(/(\d+(?:\.\d+)?)\s*mi\b/)
  if (miMatch) return Number(miMatch[1]) * 1609.34
  const num = Number(normalized)
  return Number.isFinite(num) && num >= 0 ? num : null
}

function firstDistanceByPaths(hotel, paths = []) {
  for (const path of paths) {
    const val = path
      .split('.')
      .reduce((acc, key) => (acc && acc[key] != null ? acc[key] : null), hotel)
    const parsed = parseDistanceMeters(val)
    if (parsed !== null) return { distance: Math.round(parsed), source: path }
  }
  return { distance: null, source: null }
}

function poiDistance(hotel, keywords = []) {
  const groups = [
    hotel?.points_of_interest,
    hotel?.pois,
    hotel?.nearby_points,
    hotel?.rg_ext?.points_of_interest,
  ]
  for (const pois of groups) {
    if (!Array.isArray(pois)) continue
    for (const poi of pois) {
      const label = String(
        poi?.name || poi?.label || poi?.description || poi?.type || poi?.kind || '',
      )
        .trim()
        .toLowerCase()
      if (!label) continue
      if (!keywords.some((kw) => label.includes(kw))) continue
      const candidates = [
        poi?.distance,
        poi?.distance_meters,
        poi?.distance_center_meters,
      ]
      for (const candidate of candidates) {
        const parsed = parseDistanceMeters(candidate)
        if (parsed !== null) {
          return {
            distance: Math.round(parsed),
            source: `poi:${label}`,
          }
        }
      }
    }
  }
  return { distance: null, source: null }
}

function resolveCityDistance(hotel) {
  const direct = firstDistanceByPaths(hotel, [
    'cityCenterDistanceM',
    'geo.cityCenterDistanceM',
    'distance_to_city_center',
    'distance_to_center',
    'city_center_distance',
    'center_distance',
    'distance_center',
    'location.distance_to_city_center',
    'location.distance_to_center',
    'distances.city_center',
    'distances.to_center',
    'rg_ext.distance_to_city_center',
    'rg_ext.distance_to_center',
    'rg_ext.city_center_distance',
    'rg_ext.center_distance',
  ])
  if (direct.distance !== null) return direct
  return poiDistance(hotel, [
    'city center',
    'city centre',
    'center',
    'centre',
    'downtown',
    'old town',
    'centre-ville',
  ])
}

function resolveBeachDistance(hotel) {
  const direct = firstDistanceByPaths(hotel, [
    'beachDistanceM',
    'geo.beachDistanceM',
    'distance_to_beach',
    'beach_distance',
    'distance_beach',
    'location.distance_to_beach',
    'distances.beach',
    'rg_ext.distance_to_beach',
    'rg_ext.beach_distance',
  ])
  if (direct.distance !== null) return direct
  return poiDistance(hotel, ['beach', 'plage', 'sea', 'shore', 'coast'])
}

const geoDebug = computed(() => {
  const rows = hotels.value.map((hotel, idx) => {
    const city = resolveCityDistance(hotel)
    const beach = resolveBeachDistance(hotel)
    return {
      key: `${hotelKey(hotel) || 'idx'}-${idx}`,
      name: hotelDisplayName(hotel),
      cityDistance: city.distance,
      citySource: city.source,
      beachDistance: beach.distance,
      beachSource: beach.source,
    }
  })
  const cityKnown = rows.filter((r) => Number.isFinite(r.cityDistance)).length
  const beachKnown = rows.filter((r) => Number.isFinite(r.beachDistance)).length
  const payload = buildFilterPayload()
  return {
    total: rows.length,
    cityKnown,
    cityMissing: rows.length - cityKnown,
    beachKnown,
    beachMissing: rows.length - beachKnown,
    activeCityLimit: payload.city_distance_max_m ?? null,
    activeBeachLimit: payload.beach_distance_max_m ?? null,
    samples: rows.slice(0, 8),
  }
})

function getBudgetRange(value) {
  let min = value - BUDGET_HALF_WINDOW
  let max = value + BUDGET_HALF_WINDOW
  if (min < BUDGET_RANGE_MIN) {
    min = BUDGET_RANGE_MIN
    max = min + BUDGET_WINDOW
  }
  if (max > BUDGET_RANGE_MAX) {
    max = BUDGET_RANGE_MAX
    min = max - BUDGET_WINDOW
  }
  return { min, max }
}

const budgetMinValue = computed(() => getBudgetRange(budgetSliderValue.value).min)
const budgetMaxValue = computed(() => getBudgetRange(budgetSliderValue.value).max)

const budgetMinPercent = computed(() => {
  const range = BUDGET_RANGE_MAX - BUDGET_RANGE_MIN
  return ((budgetMinValue.value - BUDGET_RANGE_MIN) / range) * 100
})

const budgetMaxPercent = computed(() => {
  const range = BUDGET_RANGE_MAX - BUDGET_RANGE_MIN
  return ((budgetMaxValue.value - BUDGET_RANGE_MIN) / range) * 100
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

function normalizeCoord(value) {
  if (value === undefined || value === null) return null
  const normalized =
    typeof value === 'string'
      ? value.trim().replace(',', '.')
      : value
  const num = Number(normalized)
  return Number.isFinite(num) ? num : null
}

function hotelCoords(hotel) {
  const lat = normalizeCoord(
    hotel?.lat ??
      hotel?.geo?.lat ??
      hotel?.geo?.latitude ??
      hotel?.latitude ??
      hotel?.coordinates?.lat ??
      hotel?.coordinates?.latitude ??
      hotel?.point?.lat ??
      hotel?.point?.latitude ??
      hotel?.location?.latitude ??
      hotel?.location?.lat ??
      hotel?.content?.latitude ??
      hotel?.content?.lat ??
      hotel?.content?.coordinates?.lat ??
      hotel?.content?.coordinates?.latitude ??
      hotel?.content?.point?.lat ??
      hotel?.content?.point?.latitude ??
      hotel?.content?.location?.latitude ??
      hotel?.content?.location?.lat,
  )
  const lon = normalizeCoord(
    hotel?.lon ??
      hotel?.lng ??
      hotel?.geo?.lon ??
      hotel?.geo?.lng ??
      hotel?.geo?.longitude ??
      hotel?.longitude ??
      hotel?.coordinates?.lon ??
      hotel?.coordinates?.lng ??
      hotel?.coordinates?.longitude ??
      hotel?.point?.lon ??
      hotel?.point?.lng ??
      hotel?.point?.longitude ??
      hotel?.location?.longitude ??
      hotel?.location?.lon ??
      hotel?.location?.lng ??
      hotel?.content?.longitude ??
      hotel?.content?.lon ??
      hotel?.content?.lng ??
      hotel?.content?.coordinates?.lon ??
      hotel?.content?.coordinates?.lng ??
      hotel?.content?.coordinates?.longitude ??
      hotel?.content?.point?.lon ??
      hotel?.content?.point?.lng ??
      hotel?.content?.point?.longitude ??
      hotel?.content?.location?.longitude ??
      hotel?.content?.location?.lon ??
      hotel?.content?.location?.lng,
  )
  if (lat === null || lon === null) return null
  return { lat, lon }
}

function destinationCenterCoords() {
  if (
    destinationCenterFallback.value &&
    Number.isFinite(Number(destinationCenterFallback.value.lat)) &&
    Number.isFinite(Number(destinationCenterFallback.value.lon))
  ) {
    return {
      lat: Number(destinationCenterFallback.value.lat),
      lon: Number(destinationCenterFallback.value.lon),
    }
  }
  const first = hotels.value[0]
  if (!first) return null
  const center = first?.geo?.destinationCenter || first?.geo?.destination_center
  if (!center) return null
  const lat = normalizeCoord(center.latitude ?? center.lat)
  const lon = normalizeCoord(center.longitude ?? center.lon ?? center.lng)
  if (lat === null || lon === null) return null
  return { lat, lon }
}

function extractCenterFromSearchResponse(data) {
  const center =
    data?.geo_enrichment?.destination_center ||
    data?.geoEnrichment?.destinationCenter ||
    null
  if (!center) return null
  const lat = normalizeCoord(center.latitude ?? center.lat)
  const lon = normalizeCoord(center.longitude ?? center.lon ?? center.lng)
  if (lat === null || lon === null) return null
  return { lat, lon }
}

function extractCenterFromResolvedRegion(data) {
  const region = data?.resolvedRegion || data?.resolved_region || null
  if (!region) return null
  const lat = normalizeCoord(region.latitude ?? region.lat)
  const lon = normalizeCoord(region.longitude ?? region.lon ?? region.lng)
  if (lat === null || lon === null) return null
  return { lat, lon }
}

async function geocodeDestinationCenter(query) {
  const key = String(query || '').trim().toLowerCase()
  if (!key) return null
  if (geocodeCenterCache.has(key)) return geocodeCenterCache.get(key)
  try {
    const endpoint =
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=` +
      encodeURIComponent(query)
    const res = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const rows = await res.json()
    const first = Array.isArray(rows) ? rows[0] : null
    const lat = normalizeCoord(first?.lat)
    const lon = normalizeCoord(first?.lon)
    const center =
      lat === null || lon === null ? null : { lat, lon }
    geocodeCenterCache.set(key, center)
    return center
  } catch {
    return null
  }
}

function approximateCoordsAroundCenter(center, index) {
  const lat = Number(center?.lat)
  const lon = Number(center?.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const angleDeg = (index * 137.508) % 360
  const angle = (angleDeg * Math.PI) / 180
  const radiusM = 250 + Math.floor(index / 8) * 180 + (index % 8) * 40
  const latOffset = (radiusM * Math.cos(angle)) / 111320
  const lonBase = Math.cos((lat * Math.PI) / 180)
  const lonOffset =
    (radiusM * Math.sin(angle)) /
    (111320 * (Math.abs(lonBase) > 0.01 ? lonBase : 0.01))
  return {
    lat: lat + latOffset,
    lon: lon + lonOffset,
  }
}

const mapHotels = computed(() =>
  hotels.value.map((hotel, idx) => {
    const exact = hotelCoords(hotel)
    if (exact) {
      return {
        hotel,
        index: idx + 1,
        lat: exact.lat,
        lon: exact.lon,
        approximate: false,
      }
    }
    const center = destinationCenterCoords()
    const approx = center ? approximateCoordsAroundCenter(center, idx + 1) : null
    if (!approx) return null
    return {
      hotel,
      index: idx + 1,
      lat: approx.lat,
      lon: approx.lon,
      approximate: true,
    }
  }).filter(Boolean),
)

const mapCoverage = computed(() => {
  const approx = mapHotels.value.filter((item) => item.approximate).length
  const exact = mapHotels.value.length - approx
  return { exact, approx, total: mapHotels.value.length }
})

function hotelDisplayIndex(hotel) {
  const key = hotelKey(hotel)
  const idx = hotels.value.findIndex((item) => hotelKey(item) === key)
  return idx >= 0 ? idx + 1 : null
}

async function ensureLeafletLoaded() {
  if (typeof window === 'undefined') return null
  if (window.L) return window.L
  const cssId = 'leaflet-css-cdn'
  const scriptId = 'leaflet-js-cdn'
  if (!window.document.getElementById(cssId)) {
    const link = window.document.createElement('link')
    link.id = cssId
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    window.document.head.appendChild(link)
  }
  await new Promise((resolve, reject) => {
    if (window.L) {
      resolve()
      return
    }
    const existing = window.document.getElementById(scriptId)
    if (existing) {
      existing.addEventListener('load', resolve, { once: true })
      existing.addEventListener(
        'error',
        () => reject(new Error('Leaflet script failed to load')),
        { once: true },
      )
      return
    }
    const script = window.document.createElement('script')
    script.id = scriptId
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () =>
      reject(new Error('Leaflet script failed to load'))
    window.document.head.appendChild(script)
  })
  return window.L || null
}

async function renderResultsMap() {
  if (!mapContainerRef.value) return
  let L = leafletApi.value
  if (!L) {
    try {
      L = await ensureLeafletLoaded()
      leafletApi.value = L
    } catch {
      return
    }
  }
  if (!L) return

  if (!resultsMap.value) {
    resultsMap.value = L.map(mapContainerRef.value, {
      zoomControl: true,
      attributionControl: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(resultsMap.value)
    mapMarkerLayer.value = L.layerGroup().addTo(resultsMap.value)
  }

  resultsMap.value.invalidateSize()

  mapMarkerLayer.value.clearLayers()
  if (!mapHotels.value.length) {
    const center =
      hotels.value[0]?.geo?.destinationCenter &&
      Number.isFinite(Number(hotels.value[0]?.geo?.destinationCenter?.latitude)) &&
      Number.isFinite(Number(hotels.value[0]?.geo?.destinationCenter?.longitude))
        ? [
            Number(hotels.value[0].geo.destinationCenter.latitude),
            Number(hotels.value[0].geo.destinationCenter.longitude),
          ]
        : [48.8566, 2.3522]
    resultsMap.value.setView(center, 8)
    return
  }
  const bounds = []
  mapHotels.value.forEach((item) => {
    const icon = L.divIcon({
      className: `hotel-map-marker${
        item.approximate ? ' hotel-map-marker--approx' : ''
      }`,
      html: `<span>${item.index}</span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })
    const marker = L.marker([item.lat, item.lon], { icon })
    marker.on('click', () => selectHotel(item.hotel))
    marker.bindTooltip(
      `${item.index}. ${hotelDisplayName(item.hotel)}${
        item.approximate ? ' (approx.)' : ''
      }`,
      { direction: 'top', offset: [0, -8] },
    )
    marker.addTo(mapMarkerLayer.value)
    bounds.push([item.lat, item.lon])
  })
  if (bounds.length === 1) {
    resultsMap.value.setView(bounds[0], 13)
  } else if (bounds.length > 1) {
    resultsMap.value.fitBounds(bounds, { padding: [28, 28] })
  }
  resultsMap.value.invalidateSize()
}

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
  const cityKm = Number(filters.value.cityDistanceKm)
  if (
    Number.isFinite(cityKm) &&
    cityKm >= CITY_DISTANCE_MIN_KM &&
    cityKm < CITY_DISTANCE_MAX_KM
  ) {
    payload.city_distance_max_m = Math.round(cityKm * 1000)
  }
  const beachThresholds = (Array.isArray(filters.value.beachDistanceMeters)
    ? filters.value.beachDistanceMeters
    : []
  )
    .map((value) => Number(value))
    .filter((num) => Number.isFinite(num) && num > 0)
  if (beachThresholds.length) {
    payload.beach_distance_max_m = Math.max(...beachThresholds)
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

function formatBudgetLabel(value, isMax = false) {
  if (isMax && value >= BUDGET_RANGE_MAX) return `${BUDGET_RANGE_MAX}€+`
  return `${value}€`
}

function syncBudgetInputsFromSliders() {
  budgetInputMin.value = String(budgetMinValue.value)
  budgetInputMax.value = String(budgetMaxValue.value)
}

function onBudgetInput(event) {
  const nextValue = Number(event.target.value)
  if (!Number.isFinite(nextValue)) return
  budgetSliderValue.value = Math.min(
    BUDGET_RANGE_MAX,
    Math.max(nextValue, BUDGET_RANGE_MIN),
  )
  syncBudgetInputsFromSliders()
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

function applyMarkupAmount(amount) {
  const num = Number(amount)
  if (!Number.isFinite(num)) return amount
  return Math.round(num * (1 + MARKUP_PERCENT / 100) * 100) / 100
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
      return { amount: applyMarkupAmount(amount), currency, nights }
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
    case 'ro':
    case 'nomeal':
    case 'room_only':
    case 'room-only':
      return 'Room only'
    case 'bb':
    case 'breakfast':
    case 'bed_breakfast':
    case 'bed-breakfast':
      return 'Breakfast'
    case 'hb':
    case 'half_board':
    case 'half-board':
      return 'Half board'
    case 'fb':
    case 'full_board':
    case 'full-board':
      return 'Full board'
    case 'ai':
    case 'al':
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
        price: applyMarkupAmount(payment?.show_amount || payment?.amount || null),
        currency:
          payment?.show_currency_code ||
          payment?.currency_code ||
          null,
        amenities: rate?.amenities_data || null,
        daily_prices: Array.isArray(rate?.daily_prices)
          ? rate.daily_prices.map((value) => applyMarkupAmount(value))
          : rate?.daily_prices || null,
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
  statusMessage.value = 'Recherche en cours...'
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
    destinationCenterFallback.value =
      extractCenterFromSearchResponse(data) ||
      extractCenterFromResolvedRegion(data) ||
      (await geocodeDestinationCenter(destination.value))
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
      residency: 'fr',
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
    price_increase_percent: MARKUP_PERCENT,
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
  const query = { ...route.query }
  const regionId =
    hotel?.region_id || hotel?.regionId || hotel?.rg_ext?.region_id || null
  if (regionId) query.region_id = regionId
  router.push({
    name: 'hotel-detail',
    params: { hid },
    query,
  })
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

function submitEditedSearch(searchPayload = {}) {
  const nextDestination = String(searchPayload.destination || '').trim()
  const nextCheckin = String(searchPayload.checkin || '').trim()
  const nextCheckout = String(searchPayload.checkout || '').trim()
  const nextAdults = Math.min(6, Math.max(1, Number(searchPayload.adults) || 1))
  const nextChildren = Math.min(5, Math.max(0, Number(searchPayload.children) || 0))

  if (!nextDestination || !nextCheckin || !nextCheckout) {
    error.value = 'Veuillez renseigner destination et dates pour relancer la recherche.'
    return
  }
  if (nextCheckout <= nextCheckin) {
    error.value = 'La date de départ doit être après la date d’arrivée.'
    return
  }

  const childrenAges = String(searchPayload.childrenAges || '').trim() || undefined

  router.push({
    name: 'search-results',
    query: {
      ...route.query,
      destination: nextDestination,
      checkin: nextCheckin,
      checkout: nextCheckout,
      adults: String(nextAdults),
      children: String(nextChildren),
      childrenAges,
    },
  })
  editPanelOpen.value = false
}

// Trigger initial search when route query is available.
onMounted(() => {
  searchHotels()
  budgetInputMin.value = filters.value.budgetMin ? String(filters.value.budgetMin) : ''
  budgetInputMax.value = filters.value.budgetMax ? String(filters.value.budgetMax) : ''
  const initialMin = Number(budgetInputMin.value)
  const initialMax = Number(budgetInputMax.value)
  let center = 500
  if (Number.isFinite(initialMin) && Number.isFinite(initialMax)) {
    center = Math.round((initialMin + initialMax) / 2)
  } else if (Number.isFinite(initialMax)) {
    center = initialMax
  } else if (Number.isFinite(initialMin)) {
    center = initialMin
  }
  budgetSliderValue.value = Math.min(
    BUDGET_RANGE_MAX,
    Math.max(center, BUDGET_RANGE_MIN),
  )
  syncBudgetInputsFromSliders()
  nextTick(() => {
    renderResultsMap()
  })
})

// Re-run search when filters change.
watch(
  () => [
    route.query.destination,
    route.query.checkin,
    route.query.checkout,
    route.query.adults,
    route.query.children,
    route.query.childrenAges,
  ],
  () => {
    searchHotels()
  },
)

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

watch(
  hotels,
  () => {
    if (!hotels.value.length && resultsMap.value) {
      resultsMap.value.remove()
      resultsMap.value = null
      mapMarkerLayer.value = null
      return
    }
    nextTick(() => {
      renderResultsMap()
    })
  },
  { deep: false },
)

watch(
  loading,
  (isLoading) => {
    if (isLoading) return
    nextTick(() => {
      renderResultsMap()
    })
  },
)

onBeforeUnmount(() => {
  if (filtersDebounceTimer) clearTimeout(filtersDebounceTimer)
  if (resultsMap.value) {
    resultsMap.value.remove()
    resultsMap.value = null
    mapMarkerLayer.value = null
  }
})
</script>

<style scoped>
.reservation-view {
  gap: 1.5rem;
}

.search-edit-card {
  margin-bottom: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.32);
}

.search-edit-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.search-edit-card__label {
  margin: 0;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.search-edit-card__summary {
  display: block;
  margin-top: 0.2rem;
  color: #0f172a;
  font-size: 0.86rem;
}

.search-edit-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-color: rgba(165, 20, 30, 0.4);
  color: #a5141e;
}

.search-edit-toggle__icon {
  font-weight: 700;
  font-size: 0.82rem;
}

.search-edit-form-wrap {
  margin-top: 0.8rem;
}

.reservation-view h2,
.reservation-view h3 {
  color: #376bb0;
}

.geo-debug {
  margin-top: 0.65rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 0.8rem;
  padding: 0.55rem 0.7rem;
  background: rgba(248, 250, 252, 0.85);
}

.geo-debug summary {
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 700;
  color: #0f172a;
}

.geo-debug__grid {
  margin-top: 0.45rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.35rem 0.8rem;
  font-size: 0.74rem;
  color: #334155;
}

.geo-debug__samples {
  margin-top: 0.5rem;
  font-size: 0.72rem;
  color: #334155;
}

.geo-debug__samples ul {
  margin: 0.25rem 0 0;
  padding-left: 1rem;
}

.installment-highlight {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 1rem;
  border-radius: 0.95rem;
  border: 1px solid rgba(14, 116, 144, 0.28);
  background: linear-gradient(
    90deg,
    rgba(236, 254, 255, 0.95) 0%,
    rgba(239, 246, 255, 0.95) 100%
  );
  box-shadow: 0 8px 20px rgba(14, 116, 144, 0.12);
  margin-bottom: 0.9rem;
}

.installment-highlight__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  height: 32px;
  padding: 0 0.55rem;
  border-radius: 999px;
  background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
  color: #fff;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.installment-highlight__text strong {
  color: #0f172a;
  font-size: 0.9rem;
}

.installment-highlight__text p {
  margin: 0.2rem 0 0;
  color: #334155;
  font-size: 0.8rem;
}

.results-layout {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.filters-panel {
  position: sticky;
  top: 1.25rem;
  align-self: start;
  padding: 0.9rem 1rem;
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.filter-group {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 0.9rem;
  padding: 0.75rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-title {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.7rem;
  color: #64748b;
}

.filter-checklist {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-check {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #0f172a;
}

.filter-check input {
  width: 16px;
  height: 16px;
  accent-color: #a5141e;
}

.filter-check__title {
  font-weight: 600;
  color: #0f172a;
}

.filter-check__hint {
  font-size: 0.75rem;
  color: #475569;
  margin-left: 1.6rem;
}

.geo-filter-card {
  gap: 0.75rem;
}

.geo-filter-city {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.geo-filter-city__label {
  margin: 0;
  font-size: 0.8rem;
  color: #0f172a;
  font-weight: 600;
}

.geo-filter-city__control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
}

.geo-range {
  width: 100%;
  accent-color: #eab308;
}

.geo-range__value {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  padding: 0.35rem 0.5rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.55);
  background: #fff;
  color: #0f172a;
  font-size: 0.8rem;
  font-weight: 600;
}

.geo-filter-beach {
  border-top: 1px solid rgba(148, 163, 184, 0.28);
  padding-top: 0.55rem;
}

.geo-filter-beach__title {
  margin: 0 0 0.45rem;
  font-size: 0.8rem;
  color: #0f172a;
  font-weight: 700;
}

.results-panel {
  min-width: 0;
}

.results-loading {
  position: relative;
}

.results-loading__banner {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 0.8rem;
  padding: 0.5rem 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(165, 20, 30, 0.25);
  background: linear-gradient(
    90deg,
    rgba(255, 241, 242, 0.96) 0%,
    rgba(255, 247, 237, 0.96) 100%
  );
  color: #7f1d1d;
  font-size: 0.78rem;
  font-weight: 600;
}

.results-loading__spinner {
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 999px;
  border: 2px solid rgba(165, 20, 30, 0.2);
  border-top-color: #a5141e;
  animation: reservation-loading-spin 0.8s linear infinite;
}

@keyframes reservation-loading-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1100px) {
  .results-layout {
    grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
    gap: 1rem;
  }
}

@media (max-width: 900px) {
  .search-edit-card__head {
    flex-direction: column;
    align-items: flex-start;
  }

  .installment-highlight {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.5rem;
  }

  .results-layout {
    grid-template-columns: 1fr;
  }

  .filters-panel {
    position: static;
  }
}

.hotel-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.results-card {
  width: 100%;
}

.results-map-block {
  margin: 0.7rem 0 1rem;
  padding: 0.7rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 0.9rem;
  background: rgba(248, 250, 252, 0.7);
}

.results-map-block__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  margin-bottom: 0.45rem;
}

.results-map-block__head strong {
  font-size: 0.84rem;
  color: #0f172a;
}

.results-map-block__head small {
  font-size: 0.72rem;
  color: #475569;
}

.results-map-canvas {
  height: 320px;
  width: 100%;
  position: relative;
  z-index: 0;
  isolation: isolate;
  border-radius: 0.7rem;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.35);
  margin-bottom: 0.45rem;
}

:deep(.hotel-map-marker) {
  background: #a5141e;
  color: #fff;
  border: 2px solid #fff;
  border-radius: 999px;
  box-shadow: 0 6px 12px rgba(15, 23, 42, 0.28);
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 0.75rem;
}

:deep(.hotel-map-marker span) {
  line-height: 1;
}

:deep(.hotel-map-marker--approx) {
  background: #0f766e;
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
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.3);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
}

.hotel-card:hover {
  transform: translateY(-2px);
  border-color: rgba(55, 107, 176, 0.35);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.12);
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
  color: #376bb0;
  line-height: 1.2;
  text-transform: capitalize;
}

.hotel-list-index {
  color: #a5141e;
  margin-right: 0.25rem;
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

  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.3);
  box-shadow: none;
}

.hotel-card__price-main {
  font-size: 1.05rem;
  font-weight: 500;
  color: #a5141e;
}

.hotel-card__price small {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.7rem;
  color: #475569;
}

.chip-toggle--meal {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.chip-toggle--meal .chip-toggle__desc {
  font-size: 0.65rem;
  color: #475569;
}

.chip-toggle__desc {
  font-size: 0.65rem;
  color: #475569;
}

/* detail panel */
.hotel-card__detail-panel {
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: #fff;
  padding: 0.75rem 0.85rem;
}

.hotel-card__room-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: #0f172a;
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
  color: #111827;
  border: 1px solid rgba(148,163,184,0.18);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
}

/* You were missing badge--danger in your CSS */
.badge--success { 
  background: rgba(34,197,94,0.18);
  border-color: rgba(34,197,94,0.28);
  color: #166534;
}
.badge--success::before { content: "✅"; }

.badge--danger {
  background: rgba(239,68,68,0.18);
  border-color: rgba(239,68,68,0.28);
  color: #7f1d1d;
}
.badge--danger::before { content: "⛔"; }

.badge--meal {
  background: rgba(251,146,60,0.18);
  border-color: rgba(249,115,22,0.24);
  color: #9a3412;
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

  background: #a5141e;
  color: #fff;
  border: 1px solid #a5141e;

  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
  width: 100%;
}

.hotel-card__footer .secondary:hover {
  transform: translateY(-1px);
  border-color: #7f1017;
  box-shadow: 0 10px 20px rgba(165, 20, 30, 0.25);
}

.hotel-card__footer .secondary:focus-visible {
  outline: 2px solid rgba(59,130,246,0.85);
  outline-offset: 2px;
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
  background: transparent;
  font-size: 0.75rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.chip-toggle--active {
  border-color: #a5141e;
  background: rgba(165, 20, 30, 0.12);
  color: #a5141e;
}

.chip-toggle--active .chip-toggle__label,
.chip-toggle--active .chip-toggle__desc,
.chip-toggle--active .chip-toggle__code {
  color: #a5141e;
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
  color: #1f2937;
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
  flex-direction: column;
  align-items: stretch;
  gap: 0.65rem;
}

.budget-filter button {
  width: 100%;
  height: auto;
  padding: 0.80rem 0.75rem;
  min-width: unset;
  background: #a5141e;
  color: #fff;
  border: 1px solid #a5141e;
}

.budget-range {
  position: relative;
  height: 36px;
  display: flex;
  align-items: center;
}

.budget-range__track {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    rgba(148, 163, 184, 0.35) 0%,
    rgba(59, 130, 246, 0.9) var(--max),
    rgba(148, 163, 184, 0.35) var(--max),
    rgba(148, 163, 184, 0.35) 100%
  );
}

.budget-range__input {
  position: absolute;
  left: 0;
  right: 0;
  top: -7px;
  bottom: 0;
  width: 100%;
  height: 36px;
  margin: 0;
  background: transparent;
  pointer-events: none;
  appearance: none;
}

.budget-range__input--max-only {
  z-index: 1;
}

.budget-range__input::-webkit-slider-thumb {
  pointer-events: auto;
  appearance: none;
  height: 18px;
  width: 18px;
  border-radius: 50%;
  background: #0ea5e9;
  border: 2px solid #e2e8f0;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.4);
  cursor: pointer;
}

.budget-range__input::-moz-range-thumb {
  pointer-events: auto;
  height: 18px;
  width: 18px;
  border-radius: 50%;
  background: #0ea5e9;
  border: 2px solid #e2e8f0;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.4);
  cursor: pointer;
}

.budget-range__input::-webkit-slider-runnable-track {
  height: 6px;
  background: transparent;
}

.budget-range__input::-moz-range-track {
  height: 6px;
  background: transparent;
}

.budget-values {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #0f172a;
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

.pagination .secondary {
  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
}

.pagination .secondary:hover {
  transform: translateY(-1px);
  border-color: rgba(96,165,250,0.45);
  box-shadow: 0 10px 20px rgba(0,0,0,0.25);
}

.pagination .secondary:focus-visible {
  outline: 2px solid rgba(59,130,246,0.85);
  outline-offset: 2px;
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
