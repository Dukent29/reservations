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
    <div class="hero__bg-stage">
      <transition name="hero-bg-fade">
        <div
          v-if="currentHeroSlide"
          :key="currentHeroSlide"
          class="hero__bg hero__bg--dynamic"
          :style="{ backgroundImage: `url(${currentHeroSlide})` }"
          role="presentation"
        ></div>
      </transition>
      <div class="hero__bg hero__bg--overlay" aria-hidden="true"></div>
    </div>

    <div class="hero__content">
      <p class="hero__eyebrow">BedTrip</p>
      <h2 class="hero__title">Découvrez la magie de chaque destination.</h2>
      <p class="hero__subtitle">
        Recherchez rapidement l’hébergement idéal pour vos clients.
      </p>
      <div
        v-if="heroSlideImages.length > 1"
        class="hero__bg-bullets"
        role="group"
        aria-label="Navigation du diaporama"
      >
        <button
          v-for="(slide, idx) in heroSlideImages"
          :key="slide"
          type="button"
          class="hero__bg-bullet"
          :class="{ 'is-active': idx === activeSlideIndex }"
          :aria-label="`Afficher la diapositive ${idx + 1}`"
          :aria-pressed="idx === activeSlideIndex"
          @click="selectSlide(idx)"
        ></button>
      </div>

      <div class="hero__search-shell">
        <div class="search-shell full">
          <section class="card searchbar">
            <form class="search-grid" @submit.prevent="goToResults">
              <div
                ref="suggestionRootRef"
                class="field field--suggestions"
              >
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
                <label for="dateRangeInput">Séjour</label>
                <div
                  class="date-range-wrapper"
                  role="button"
                  tabindex="0"
                  @click.prevent="openDateModal"
                  @keydown.enter.prevent="openDateModal"
                  @keydown.space.prevent="openDateModal"
                >
                  <input
                    id="dateRangeInput"
                    type="text"
                    :value="dateRangeLabel"
                    placeholder="Choisissez les dates"
                    autocomplete="off"
                    readonly
                  />
                  <input type="hidden" :value="checkin" />
                  <input type="hidden" :value="checkout" />
                </div>
              </div>

              <div class="field compact">
                <label>Voyageurs</label>
                <button
                  type="button"
                  class="secondary"
                  style="text-align:left;"
                  @click="openGuestModal"
                >
                  {{ guestsSummary }}
                </button>
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

  <!-- About BedTrip -->
  <section class="landing-section landing-section--about">
    <h2 class="landing-section__title">Le principe de BedTrip</h2>
    <p class="landing-section__subtitle muted">
      BedTrip est une console hôtelière B2B pensée pour les agences et partenaires :
      un seul outil pour chercher, comparer et réserver les meilleurs séjours pour vos clients.
    </p>
    <div class="landing-section__grid">
      <article class="info-card">
        <h3>Un moteur de recherche conçu pour les pros</h3>
        <p>
          Des filtres précis, des tarifs négociés et des disponibilités mises à jour en temps réel,
          directement connectés à nos fournisseurs.
        </p>
      </article>
      <article class="info-card">
        <h3>Une interface claire pour aller vite</h3>
        <p>
          Une seule page pour visualiser les résultats, les détails d’hôtel, les conditions et les
          options de chambre, sans perdre le fil de votre réservation.
        </p>
      </article>
      <article class="info-card">
        <h3>Un support pensé pour les équipes</h3>
        <p>
          Des parcours alignés sur vos besoins opérationnels, avec un historique de commande clair
          et des informations structurées pour vos équipes back-office.
        </p>
      </article>
    </div>
  </section>

  <!-- Highlighted hotels / promotions -->
  <section class="landing-section landing-section--highlights">
    <h2 class="landing-section__title">Sélections & offres à ne pas manquer</h2>
    <p class="landing-section__subtitle muted">
      Inspirez-vous de quelques idées de séjours : passez la souris sur une carte pour en savoir plus.
    </p>

    <div class="landing-section__grid landing-section__grid--cards">
      <article class="highlight-card">
        <div
          class="highlight-card__image"
          style="background-image:url('/images/pexels-apasaric-1285625.jpg');"
          aria-hidden="true"
        ></div>
        <div class="highlight-card__overlay">
          <h3>Escapades urbaines</h3>
          <p>
            Hôtels idéalement situés au cœur des grandes villes européennes, avec des tarifs
            flexibles pour les voyages d’affaires de dernière minute.
          </p>
        </div>
      </article>

      <article class="highlight-card">
        <div
          class="highlight-card__image"
          style="background-image:url('/images/pexels-minan1398-774042.jpg');"
          aria-hidden="true"
        ></div>
        <div class="highlight-card__overlay">
          <h3>Vue mer & séjours loisirs</h3>
          <p>
            Une sélection de resorts et d’hôtels balnéaires adaptés aux familles, avec
            des promotions saisonnières sur les séjours longs.
          </p>
        </div>
      </article>

      <article class="highlight-card">
        <div
          class="highlight-card__image"
          style="background-image:url('/images/pexels-thorsten-technoman-109353-338504.jpg');"
          aria-hidden="true"
        ></div>
        <div class="highlight-card__overlay">
          <h3>Adresses confidentielles</h3>
          <p>
            Petits boutique-hôtels et établissements de charme, parfaits pour des séjours sur mesure
            et des expériences uniques pour vos clients.
          </p>
        </div>
      </article>
    </div>
  </section>

  <!-- Payment advantages -->
  <section class="landing-section landing-section--payments">
    <h2 class="landing-section__title">Des paiements simples et sécurisés</h2>
    <p class="landing-section__subtitle muted">
      BedTrip s’appuie sur un partenaire de paiement sécurisé pour traiter chaque transaction
      dans un cadre fiable et transparent.
    </p>

    <div class="landing-section__columns">
      <div class="payment-point">
        <h3>Paiements sécurisés</h3>
        <p>
          Toutes les transactions passent par une plateforme certifiée,
          avec chiffrement bout‑à‑bout et suivi des statuts de paiement en temps réel.
        </p>
      </div>
      <div class="payment-point">
        <h3>Conditions claires</h3>
        <p>
          Dépôt, prépaiement ou paiement sur place : le type de paiement est affiché clairement
          pour chaque offre, avec les conditions d’annulation associées.
        </p>
      </div>
      <div class="payment-point">
        <h3>Adapté aux équipes comptables</h3>
        <p>
          Références partenaires et fournisseurs, montants et devises sont structurés pour faciliter
          votre rapprochement comptable et la gestion de vos dossiers.
        </p>
      </div>
    </div>
  </section>

  <teleport to="body">
    <div
      v-if="isDateModalOpen"
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dateModalTitle"
      @click.self="closeDateModal"
    >
      <div class="modal__backdrop"></div>
      <div class="modal__dialog">
        <div class="modal__header">
          <div class="modal__title" id="dateModalTitle">Séjour</div>
          <button
            type="button"
            class="secondary mini"
            aria-label="Fermer"
            @click="closeDateModal"
          >
            ✕
          </button>
        </div>
        <div class="modal__body">
          <div class="date-calendar" aria-label="Sélection de la période">
            <div class="date-calendar__header">
              <div class="date-calendar__title">{{ calendarMonthLabel }}</div>
              <div class="date-calendar__nav">
                <button type="button" @click="shiftCalendar(-1)">‹</button>
                <button type="button" @click="shiftCalendar(1)">›</button>
              </div>
            </div>
            <div
              class="date-calendar__grid"
              @mouseleave="clearHoverPreview"
            >
              <div
                v-for="dow in calendarWeekdays"
                :key="`dow-${dow}`"
                class="date-calendar__dow"
              >
                {{ dow }}
              </div>
              <template v-for="cell in calendarCells" :key="cell.key">
                <div v-if="cell.type === 'empty'"></div>
                <button
                  v-else
                  type="button"
                  class="date-calendar__day"
                  :class="cell.classObject"
                  :disabled="cell.disabled"
                  @click="selectCalendarDate(cell.date)"
                  @mouseenter="!cell.disabled && previewCalendarDate(cell.date)"
                >
                  {{ cell.label }}
                </button>
              </template>
            </div>
          </div>
        </div>
        <div class="modal__footer">
          <button type="button" class="primary" @click="applyDateSelection">
            Valider
          </button>
        </div>
      </div>
    </div>
  </teleport>

  <teleport to="body">
    <div
      v-if="isGuestModalOpen"
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guestModalTitle"
      @click.self="closeGuestModal"
    >
      <div class="modal__backdrop"></div>
      <div class="modal__dialog">
        <div class="modal__header">
          <div class="modal__title" id="guestModalTitle">Voyageurs</div>
          <button
            type="button"
            class="secondary mini"
            aria-label="Fermer"
            @click="closeGuestModal"
          >
            ✕
          </button>
        </div>
        <div class="modal__body guest-modal__body">
          <div class="guest-row">
            <div>
              <p class="guest-row__label">Adultes</p>
              <small class="muted">A partir de 18 ans</small>
            </div>
            <div class="counter">
              <button type="button" @click="decrementAdults">−</button>
              <div class="value">{{ adultsCount }}</div>
              <button type="button" @click="incrementAdults">+</button>
            </div>
          </div>
          <div class="guest-row">
            <div>
              <p class="guest-row__label">Enfants</p>
              <small class="muted">0 à 17 ans</small>
            </div>
            <div class="counter">
              <button type="button" @click="removeChild">−</button>
              <div class="value">{{ childrenCount }}</div>
              <button type="button" @click="addChild">+</button>
            </div>
          </div>
          <div
            v-if="childrenAges.length"
            class="children-ages"
          >
            <div
              v-for="(age, idx) in childrenAges"
              :key="`child-${idx}`"
              class="child-age-row"
            >
              <label :for="`child-age-${idx}`">
                Enfant {{ idx + 1 }} · âge
              </label>
              <select
                :id="`child-age-${idx}`"
                :value="age"
                @change="updateChildAge(idx, $event.target.value)"
              >
                <option
                  v-for="ageOption in childAgeOptions"
                  :key="ageOption"
                  :value="ageOption"
                >
                  {{ ageOption }} an{{ ageOption > 1 ? 's' : '' }}
                </option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal__footer">
          <button type="button" class="primary" @click="applyGuestSelection">
            Valider
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE, safeJsonFetch } from '../services/httpClient.js'

const router = useRouter()

const heroSlideImages = [
  '/images/pexels-apasaric-1285625.jpg',
  '/images/pexels-donaldtong94-189296.jpg',
  '/images/pexels-jimbear-1458457.jpg',
  '/images/pexels-minan1398-774042.jpg',
  '/images/pexels-recalmedia-60217.jpg',
  '/images/pexels-thorsten-technoman-109353-338504.jpg',
]
const activeSlideIndex = ref(0)
const currentHeroSlide = computed(() =>
  heroSlideImages.length
    ? heroSlideImages[activeSlideIndex.value % heroSlideImages.length]
    : null,
)
const HERO_SLIDE_INTERVAL = 7000
const MAX_GUESTS = 6
const MIN_ADULTS = 1
const DEFAULT_CHILD_AGE = 8
const childAgeOptions = Array.from({ length: 18 }, (_, idx) => idx)
let heroSlideTimer = null

const checkin = ref('')
const checkout = ref('')
const adultsCount = ref(2)
const childrenAges = ref([])

const isDateModalOpen = ref(false)
const isGuestModalOpen = ref(false)
const calendarBaseDate = ref(new Date())
const rangeStartDate = ref(null)
const rangeEndDate = ref(null)
const hoverDate = ref(null)

function parseISODate(value) {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value))
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

function toISODate(date) {
  if (!(date instanceof Date)) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDisplayDate(value) {
  const date = parseISODate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
  }).format(date)
}

function normalizeDate(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function isSameDay(a, b) {
  if (!(a instanceof Date) || !(b instanceof Date)) return false
  return a.getTime() === b.getTime()
}

function isBetween(date, start, end) {
  if (!(date instanceof Date) || !(start instanceof Date) || !(end instanceof Date)) {
    return false
  }
  const time = date.getTime()
  return time >= start.getTime() && time <= end.getTime()
}

const childrenCount = computed(() => childrenAges.value.length)
const totalGuests = computed(() => adultsCount.value + childrenCount.value)

const dateRangeLabel = computed(() => {
  if (checkin.value && checkout.value) {
    return `${formatDisplayDate(checkin.value)} · ${formatDisplayDate(checkout.value)}`
  }
  if (checkin.value) return formatDisplayDate(checkin.value)
  return ''
})

const guestsSummary = computed(() => {
  const adultLabel = `${adultsCount.value} adulte${adultsCount.value > 1 ? 's' : ''}`
  const childLabel = childrenCount.value
    ? `${childrenCount.value} enfant${childrenCount.value > 1 ? 's' : ''}`
    : '0 enfant'
  return `${adultLabel} · ${childLabel}`
})

const calendarMonthLabel = computed(() => {
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  })
  const label = formatter.format(calendarBaseDate.value)
  return label.charAt(0).toUpperCase() + label.slice(1)
})

const calendarWeekdays = computed(() => {
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
  })
  const baseMonday = new Date(2023, 0, 2)
  return Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(baseMonday)
    d.setDate(baseMonday.getDate() + idx)
    return formatter.format(d)
  })
})

const calendarCells = computed(() => {
  const cells = []
  const month = calendarBaseDate.value.getMonth()
  const year = calendarBaseDate.value.getFullYear()
  const firstDay = new Date(year, month, 1)
  const startWeekday = firstDay.getDay() || 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const minDate = new Date()
  minDate.setHours(0, 0, 0, 0)

  for (let i = 1; i < startWeekday; i++) {
    cells.push({
      key: `empty-${year}-${month}-${i}`,
      type: 'empty',
    })
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    date.setHours(0, 0, 0, 0)
    const iso = toISODate(date)
    const disabled = date.getTime() < minDate.getTime()
    const start = rangeStartDate.value
    const end = rangeEndDate.value || hoverDate.value
    const classes = {
      'date-calendar__day--start': false,
      'date-calendar__day--end': false,
      'date-calendar__day--inrange': false,
      'date-calendar__day--disabled': disabled,
    }
    if (!disabled) {
      if (start && isSameDay(date, start)) {
        classes['date-calendar__day--start'] = true
      }
      if (end && isSameDay(date, end)) {
        classes['date-calendar__day--end'] = true
      }
      if (start && end && isBetween(date, start, end)) {
        classes['date-calendar__day--inrange'] = true
      }
    }

    cells.push({
      key: `day-${iso}`,
      type: 'day',
      label: day,
      date,
      disabled,
      classObject: classes,
    })
  }

  return cells
})

function nextHeroSlide() {
  if (!heroSlideImages.length) return
  activeSlideIndex.value =
    (activeSlideIndex.value + 1) % heroSlideImages.length
}

function startHeroSlideshow() {
  if (heroSlideTimer || !heroSlideImages.length) return
  if (typeof window === 'undefined') return
  heroSlideTimer = window.setInterval(() => {
    nextHeroSlide()
  }, HERO_SLIDE_INTERVAL)
}

function stopHeroSlideshow() {
  if (heroSlideTimer && typeof window !== 'undefined') {
    window.clearInterval(heroSlideTimer)
    heroSlideTimer = null
  }
}

function selectSlide(index) {
  if (!heroSlideImages.length) return
  activeSlideIndex.value = index % heroSlideImages.length
  stopHeroSlideshow()
  startHeroSlideshow()
}

function openGuestModal() {
  isGuestModalOpen.value = true
}

function closeGuestModal() {
  isGuestModalOpen.value = false
}

function incrementAdults() {
  if (adultsCount.value + childrenCount.value >= MAX_GUESTS) return
  adultsCount.value += 1
}

function decrementAdults() {
  if (adultsCount.value <= MIN_ADULTS) return
  adultsCount.value -= 1
}

function addChild() {
  if (adultsCount.value + childrenCount.value >= MAX_GUESTS) return
  childrenAges.value = [...childrenAges.value, DEFAULT_CHILD_AGE]
}

function removeChild() {
  if (!childrenAges.value.length) return
  childrenAges.value = childrenAges.value.slice(0, -1)
}

function updateChildAge(idx, value) {
  const age = Math.max(0, Math.min(17, Number(value) || 0))
  const next = [...childrenAges.value]
  next[idx] = age
  childrenAges.value = next
}

function applyGuestSelection() {
  closeGuestModal()
}

function openDateModal() {
  rangeStartDate.value = parseISODate(checkin.value) || null
  rangeEndDate.value = parseISODate(checkout.value) || null
  hoverDate.value = null
  const base = rangeStartDate.value || new Date()
  calendarBaseDate.value = new Date(base.getFullYear(), base.getMonth(), 1)
  isDateModalOpen.value = true
}

function closeDateModal() {
  isDateModalOpen.value = false
  hoverDate.value = null
}

function shiftCalendar(delta) {
  const base = calendarBaseDate.value
  calendarBaseDate.value = new Date(base.getFullYear(), base.getMonth() + delta, 1)
}

function selectCalendarDate(date) {
  if (!date || !(date instanceof Date)) return
  const selected = normalizeDate(date)
  if (!rangeStartDate.value || (rangeStartDate.value && rangeEndDate.value)) {
    rangeStartDate.value = selected
    rangeEndDate.value = null
    hoverDate.value = null
  } else if (selected < rangeStartDate.value) {
    rangeEndDate.value = rangeStartDate.value
    rangeStartDate.value = selected
  } else if (isSameDay(selected, rangeStartDate.value)) {
    rangeEndDate.value = selected
  } else {
    rangeEndDate.value = selected
  }
}

function previewCalendarDate(date) {
  if (!(date instanceof Date)) return
  if (rangeStartDate.value && !rangeEndDate.value) {
    hoverDate.value = normalizeDate(date)
  }
}

function clearHoverPreview() {
  if (rangeStartDate.value && !rangeEndDate.value) {
    hoverDate.value = null
  }
}

function applyDateSelection() {
  const start = rangeStartDate.value
  const end = rangeEndDate.value || hoverDate.value
  if (!start || !end) {
    closeDateModal()
    return
  }
  checkin.value = toISODate(start)
  checkout.value = toISODate(end)
  closeDateModal()
}

// Basic search parameters for landing.
const destination = ref('')
const suggestionRootRef = ref(null)

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
      skipServerDownRedirect: true,
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

function closeSuggestions() {
  regionSuggestions.value = []
  hotelSuggestions.value = []
  suggestionStatus.value = ''
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
  closeSuggestions()
}

const hasSuggestions = computed(
  () =>
    regionSuggestions.value.length > 0 ||
    hotelSuggestions.value.length > 0,
)

function handleClickOutside(event) {
  const root = suggestionRootRef.value
  if (!root) return
  if (root.contains(event.target)) return
  closeSuggestions()
}

function goToResults() {
  if (!destination.value || !checkin.value || !checkout.value) return

  const childrenParam =
    childrenAges.value.length > 0
      ? childrenAges.value.map((age) => String(age)).join(',')
      : undefined

  router.push({
    name: 'search-results',
    query: {
      destination: destination.value,
      checkin: checkin.value,
      checkout: checkout.value,
      adults: String(adultsCount.value || 1),
      children: String(childrenCount.value || 0),
      childrenAges: childrenParam,
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

onMounted(() => {
  startHeroSlideshow()
  if (typeof window !== 'undefined') {
    window.addEventListener('click', handleClickOutside)
  }
})

onBeforeUnmount(() => {
  stopHeroSlideshow()
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', handleClickOutside)
  }
})
</script>

<style scoped>
.hero {
  position: relative;
  overflow: visible;
}

.hero__bg-stage {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  border-radius: 2rem;
  pointer-events: none;
}

.hero__bg {
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

.hero__bg--dynamic {
  background-size: cover;
  background-position: center;
  transform: scale(1.08);
  filter: saturate(115%) brightness(0.9);
  border-radius: inherit;
}

.hero__bg--overlay {
  background: radial-gradient(circle at 20% 25%, rgba(15, 23, 42, 0.3), transparent 50%),
    linear-gradient(135deg, rgba(2, 6, 23, 0.85), rgba(2, 6, 23, 0.35));
  mix-blend-mode: multiply;
  border-radius: inherit;
}

.hero__content {
  position: relative;
  z-index: 1;
}

.hero__search-shell {
  display: flex;
  justify-content: center;
}

.hero__bg-bullets {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.7rem;
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.55);
  backdrop-filter: blur(6px);
  width: fit-content;
  margin-bottom: 0.5rem;
}

.hero__bg-bullet {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  border: 1px solid rgba(248, 250, 252, 0.6);
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: background-color 0.2s, transform 0.2s;
}

.hero__bg-bullet.is-active {
  background: #f8fafc;
  transform: scale(1.15);
}

.date-range-wrapper {
  display: flex;
  width: 100%;
}

.date-range-wrapper input {
  cursor: pointer;
}

.guest-modal__body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.guest-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.guest-row__label {
  margin: 0;
  font-weight: 600;
}

.counter {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.counter button {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.5);
  background: rgba(15, 23, 42, 0.8);
  color: #f8fafc;
  font-size: 1rem;
  cursor: pointer;
}

.counter .value {
  min-width: 1.75rem;
  text-align: center;
  font-weight: 600;
  font-size: 1rem;
}

.children-ages {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.child-age-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.child-age-row select {
  width: 100%;
}

.modal {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(2, 6, 23, 0.75);
  backdrop-filter: blur(4px);
}

.modal__dialog {
  position: relative;
  width: min(360px, 92vw);
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 1.25rem;
  padding: 1rem;
  box-shadow: 0 30px 80px -40px rgba(0, 0, 0, 0.8);
  z-index: 1;
}

.modal__header,
.modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal__body {
  margin: 1rem 0;
}

.modal__title {
  font-weight: 600;
  font-size: 1rem;
}

.date-calendar {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.date-calendar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.date-calendar__nav {
  display: flex;
  gap: 0.35rem;
}

.date-calendar__nav button {
  width: 2rem;
  height: 2rem;
  border-radius: 0.65rem;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(15, 23, 42, 0.8);
  color: #f8fafc;
  cursor: pointer;
}

.date-calendar__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(2.2rem, 1fr));
  gap: 0.35rem;
}

.date-calendar__dow {
  text-transform: uppercase;
  font-size: 0.65rem;
  color: #94a3b8;
  text-align: center;
}

.date-calendar__day {
  border-radius: 0.75rem;
  border: 1px solid transparent;
  background: rgba(15, 23, 42, 0.7);
  color: #f8fafc;
  height: 2.4rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.date-calendar__day--disabled {
  color: #475569;
  cursor: not-allowed;
  border-color: rgba(71, 85, 105, 0.4);
}

.date-calendar__day--start,
.date-calendar__day--end {
  background: #1d4ed8;
  border-color: #93c5fd;
}

.date-calendar__day--inrange {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.5);
}

.hero-bg-fade-enter-active,
.hero-bg-fade-leave-active {
  transition: opacity 0.7s ease;
}

.hero-bg-fade-enter-from,
.hero-bg-fade-leave-to {
  opacity: 0;
}

.landing-section {
  margin-top: 2.5rem;
  padding: 1.5rem 0 0.5rem;
}

.landing-section__title {
  margin: 0 0 0.5rem;
  font-size: 1.4rem;
}

.landing-section__subtitle {
  margin: 0 0 1.25rem;
  max-width: 52rem;
}

.landing-section__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.info-card {
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  padding: 0.9rem 1rem;
  background: rgba(15, 23, 42, 0.9);
  box-shadow: 0 18px 40px -24px rgba(0, 0, 0, 0.9);
}

.info-card h3 {
  margin: 0 0 0.4rem;
  font-size: 0.98rem;
}

.info-card p {
  margin: 0;
  font-size: 0.8rem;
  color: #cbd5e1;
}

.landing-section__grid--cards {
  margin-top: 1rem;
}

.highlight-card {
  position: relative;
  border-radius: 1.1rem;
  overflow: hidden;
  min-height: 180px;
  cursor: pointer;
  box-shadow: 0 22px 50px -24px rgba(15, 23, 42, 0.95);
}

.highlight-card__image {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  filter: brightness(0.85) saturate(110%);
  transition: transform 0.4s ease, filter 0.4s ease;
}

.highlight-card__overlay {
  position: relative;
  z-index: 1;
  height: 100%;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  background: linear-gradient(
    to top,
    rgba(15, 23, 42, 0.85),
    rgba(15, 23, 42, 0.1)
  );
  color: #f9fafb;
  opacity: 0.9;
  transition: background 0.3s ease, opacity 0.3s ease, transform 0.3s ease;
}

.highlight-card__overlay h3 {
  margin: 0 0 0.4rem;
  font-size: 1rem;
}

.highlight-card__overlay p {
  margin: 0;
  font-size: 0.8rem;
}

.highlight-card:hover .highlight-card__image {
  transform: scale(1.05);
  filter: brightness(1) saturate(120%);
}

.highlight-card:hover .highlight-card__overlay {
  opacity: 1;
  transform: translateY(0px);
}

.landing-section--payments {
  margin-bottom: 2.5rem;
}

.landing-section__columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.payment-point {
  border-radius: 0.9rem;
  border: 1px solid rgba(34, 197, 94, 0.4);
  background: linear-gradient(
    145deg,
    rgba(22, 163, 74, 0.12),
    rgba(15, 23, 42, 0.95)
  );
  padding: 0.9rem 1rem;
}

.payment-point h3 {
  margin: 0 0 0.4rem;
  font-size: 0.98rem;
}

.payment-point p {
  margin: 0;
  font-size: 0.8rem;
  color: #d1fae5;
}
</style>
