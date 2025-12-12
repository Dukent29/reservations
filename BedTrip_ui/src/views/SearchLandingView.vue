<!--
  SearchLandingView
  =================
  Landing page of the app.

  Differences from the legacy reservation.html:
  - This page only hosts the search engine (destination, dates, guests).
  - Actual results, filters and hotel details live on `/results`.
  - On submit, the form navigates to the results route with query params.
-->

<template>
  <section class="hero" aria-label="Destination highlight">
    <div class="hero__bg hero__bg--1"></div>
    <div class="hero__bg hero__bg--2"></div>
    <div class="hero__bg hero__bg--3"></div>
    <div class="hero__bg hero__bg--4"></div>
    <div class="hero__bg hero__bg--5"></div>
    <div class="hero__bg hero__bg--6"></div>

    <div class="hero__content">
      <p class="hero__eyebrow">BedTrip</p>
      <h2 class="hero__title">Découvrez la magie de chaque destination.</h2>
      <p class="hero__subtitle">
        Recherchez rapidement l’hébergement idéal pour vos clients.
      </p>

      <div class="hero__search-shell">
        <div class="search-shell full">
          <section class="card searchbar">
            <form class="search-grid" @submit.prevent="goToResults">
              <div class="field field--suggestions">
                <label for="destination">Destination</label>
                <input
                  id="destination"
                  v-model="destination"
                  type="text"
                  placeholder="Essayez Paris, Rome, Dubaï..."
                  autocomplete="off"
                  required
                />
                <small class="muted" style="font-size:.7rem;">
                  Saisissez une ville ou une région ETG ; l’autocomplétion vous aidera.
                </small>
                <small
                  v-if="suggestionStatus"
                  class="muted"
                  style="font-size:.7rem;"
                >
                  {{ suggestionStatus }}
                </small>

                <div
                  v-if="hasSuggestions"
                  class="suggestions-dropdown"
                >
                  <div
                    v-if="regionSuggestions.length"
                    class="suggestions-section"
                  >
                    <div class="suggestions-title">Régions</div>
                    <button
                      v-for="(region, idx) in regionSuggestions"
                      :key="'r-' + idx"
                      type="button"
                      class="suggestion-option"
                      @click="selectRegion(region)"
                    >
                      <span class="suggestion-option__name">
                        {{ region.name || region.full_name || region.fullName || 'Région' }}
                      </span>
                      <span class="suggestion-option__meta">
                        {{ region.country_code || '' }}
                        <span v-if="region.id">
                          · #{{ region.id }}
                        </span>
                      </span>
                    </button>
                  </div>

                  <div
                    v-if="hotelSuggestions.length"
                    class="suggestions-section"
                  >
                    <div class="suggestions-title">Hôtels</div>
                    <button
                      v-for="(hotel, idx) in hotelSuggestions"
                      :key="'h-' + idx"
                      type="button"
                      class="suggestion-option"
                      @click="selectHotelSuggestion(hotel)"
                    >
                      <span class="suggestion-option__name">
                        {{ hotel.name || 'Hôtel' }}
                      </span>
                      <span class="suggestion-option__meta">
                        HID {{ hotel.hid || '?' }}
                        <span v-if="hotel.region_id">
                          · Région {{ hotel.region_id }}
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div class="field">
                <label for="checkin">Arrivée</label>
                <input
                  id="checkin"
                  v-model="checkin"
                  type="date"
                  required
                />
              </div>

              <div class="field">
                <label for="checkout">Départ</label>
                <input
                  id="checkout"
                  v-model="checkout"
                  type="date"
                  required
                />
              </div>

              <div class="field compact">
                <label for="adults">Voyageurs</label>
                <div class="field">
                  <input
                    id="adults"
                    v-model.number="adults"
                    type="number"
                    min="1"
                    max="8"
                  />
                  <small class="muted">
                    Adultes · enfants gérés sur la page de résultats.
                  </small>
                </div>
              </div>

              <div class="field action">
                <label>&nbsp;</label>
                <button class="primary" type="submit">
                  Rechercher
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE, safeJsonFetch } from '../services/httpClient.js'

const router = useRouter()

// Basic search parameters for landing.
const destination = ref('')
const checkin = ref('')
const checkout = ref('')
const adults = ref(2)

// Suggestions state
const regionSuggestions = ref([])
const hotelSuggestions = ref([])
const suggestionStatus = ref('')

// Debug state for API calls
const debugEntries = ref([])

function pushDebug(label, payload) {
  const time = new Date().toISOString()
  debugEntries.value.unshift({ time, label, payload })
  debugEntries.value = debugEntries.value.slice(0, 20)
}

async function fetchAutocompleteData(term, language = 'fr') {
  const q = (term || '').trim()
  if (!q) return { regions: [], hotels: [] }
  const lang = (language || 'fr').trim() || 'fr'
  const endpoint = `${API_BASE}/api/regions/search?q=${encodeURIComponent(
    q,
  )}&lang=${encodeURIComponent(lang)}`

  try {
    const { statusCode, data } = await safeJsonFetch(endpoint, {
      method: 'GET',
    })
    pushDebug('RESPONSE /api/regions/search', {
      endpoint,
      statusCode,
      data,
    })
    if (statusCode >= 400) {
      throw new Error(
        data?.error || data?._raw || 'Autocomplete failed',
      )
    }
    return {
      regions: Array.isArray(data?.regions) ? data.regions : [],
      hotels: Array.isArray(data?.hotels) ? data.hotels : [],
    }
  } catch (err) {
    pushDebug('ERROR /api/regions/search', {
      endpoint,
      error: err?.message || String(err || ''),
    })
    throw err
  }
}

let suggestionTimer = null

async function loadSuggestions(term) {
  const trimmed = (term || '').trim()
  regionSuggestions.value = []
  hotelSuggestions.value = []
  suggestionStatus.value = ''

  if (trimmed.length < 2) return

  suggestionStatus.value = 'Recherche de suggestions…'
  try {
    const { regions, hotels } = await fetchAutocompleteData(
      trimmed,
      'fr',
    )
    regionSuggestions.value = regions.slice(0, 8)
    hotelSuggestions.value = hotels.slice(0, 5)
    if (!regions.length && !hotels.length) {
      suggestionStatus.value =
        'Aucun résultat pour cette destination.'
    } else {
      suggestionStatus.value = `Suggestions : ${regions.length} région(s), ${hotels.length} hôtel(s)`
    }
  } catch (err) {
    suggestionStatus.value =
      err?.message || 'Erreur lors de la recherche de suggestions.'
  }
}

function scheduleSuggestions(value) {
  if (suggestionTimer) clearTimeout(suggestionTimer)
  suggestionTimer = setTimeout(() => loadSuggestions(value), 300)
}

function selectRegion(region) {
  const label =
    region.name ||
    region.full_name ||
    region.fullName ||
    region.id ||
    ''
  destination.value = String(label)
  regionSuggestions.value = []
  hotelSuggestions.value = []
}

function selectHotelSuggestion(hotel) {
  const label = hotel.name || hotel.hid || ''
  destination.value = String(label)
  regionSuggestions.value = []
  hotelSuggestions.value = []
}

const hasSuggestions = computed(
  () =>
    regionSuggestions.value.length > 0 ||
    hotelSuggestions.value.length > 0,
)

function goToResults() {
  if (!destination.value || !checkin.value || !checkout.value) return

  router.push({
    name: 'search-results',
    query: {
      destination: destination.value,
      checkin: checkin.value,
      checkout: checkout.value,
      adults: String(adults.value || 1),
    },
  })
}

// Trigger suggestions as user types
watch(
  () => destination.value,
  (val) => {
    scheduleSuggestions(val)
  },
)
</script>

<style scoped>
/* This view relies mainly on existing global hero/search styles.
   Scoped rules can be added later if needed. */
</style>
