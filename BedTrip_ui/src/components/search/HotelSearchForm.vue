<template>
  <section class="card searchbar">
    <form class="search-grid" @submit.prevent="submitSearch">
      <div
        ref="suggestionRootRef"
        class="field field--suggestions"
      >
        <label :for="destinationInputId">{{ destinationLabel }}</label>
        <input
          :id="destinationInputId"
          v-model="destination"
          type="text"
          :placeholder="destinationPlaceholder"
          autocomplete="off"
          required
        />
        <small
          v-if="showHintText"
          class="muted"
          style="font-size:.7rem;"
        >
          {{ hintText }}
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
              :key="`r-${idx}`"
              type="button"
              class="suggestion-option"
              @click="selectRegion(region)"
            >
              <span class="suggestion-option__name">
                {{ region.name || region.full_name || region.fullName || 'Région' }}
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
              :key="`h-${idx}`"
              type="button"
              class="suggestion-option"
              @click="selectHotelSuggestion(hotel)"
            >
              <span class="suggestion-option__hotel">
                <span class="suggestion-option__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" focusable="false">
                    <path
                      d="M4 20V7.5C4 6.67 4.67 6 5.5 6H10V4.5C10 3.67 10.67 3 11.5 3H18.5C19.33 3 20 3.67 20 4.5V20"
                      stroke="currentColor"
                      stroke-width="1.7"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M8 10H8.01M8 13.5H8.01M8 17H8.01M13 8H17M13 11H17M13 14H17M10 20V17.5C10 16.67 10.67 16 11.5 16H12.5C13.33 16 14 16.67 14 17.5V20"
                      stroke="currentColor"
                      stroke-width="1.7"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <span class="suggestion-option__content">
                  <span class="suggestion-option__name">
                    {{ hotel.name || 'Hôtel' }}
                  </span>
                  <span
                    v-if="hotelSuggestionMeta(hotel)"
                    class="suggestion-option__meta"
                  >
                    {{ hotelSuggestionMeta(hotel) }}
                  </span>
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>

      <div class="field">
        <label :for="dateInputId">Séjour</label>
        <div
          class="date-range-wrapper"
          role="button"
          tabindex="0"
          @click.prevent="openDateModal"
          @keydown.enter.prevent="openDateModal"
          @keydown.space.prevent="openDateModal"
        >
          <input
            :id="dateInputId"
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
          {{ submitLabel }}
        </button>
      </div>
    </form>
  </section>

  <teleport to="body">
    <div
      v-if="isDateModalOpen"
      class="modal"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="dateModalTitleId"
      @click.self="closeDateModal"
    >
      <div class="modal__backdrop"></div>
      <div class="modal__dialog">
        <div class="modal__header">
          <div :id="dateModalTitleId" class="modal__title">Séjour</div>
          <button
            type="button"
            class="modal__close"
            aria-label="Fermer"
            @click="closeDateModal"
          >
            ×
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
      :aria-labelledby="guestModalTitleId"
      @click.self="closeGuestModal"
    >
      <div class="modal__backdrop"></div>
      <div class="modal__dialog">
        <div class="modal__header">
          <div :id="guestModalTitleId" class="modal__title">Voyageurs</div>
          <button
            type="button"
            class="modal__close"
            aria-label="Fermer"
            @click="closeGuestModal"
          >
            ×
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
              <label :for="`child-age-${uid}-${idx}`">
                Enfant {{ idx + 1 }} · âge
              </label>
              <select
                :id="`child-age-${uid}-${idx}`"
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
import { API_BASE, safeJsonFetch } from '../../services/httpClient.js'

const props = defineProps({
  destinationLabel: { type: String, default: 'Destination ou hotel' },
  destinationPlaceholder: { type: String, default: "Essayez Paris, Rome ou un nom d'hotel..." },
  hintText: {
    type: String,
    default: 'Saisissez une destination ou un hotel ; l’autocompletion vous aidera.',
  },
  showHintText: { type: Boolean, default: true },
  submitLabel: { type: String, default: 'Rechercher' },
  initialDestination: { type: String, default: '' },
  initialDestinationType: { type: String, default: '' },
  initialHotelHid: { type: [String, Number], default: '' },
  initialHotelId: { type: [String, Number], default: '' },
  initialRegionId: { type: [String, Number], default: '' },
  initialCheckin: { type: String, default: '' },
  initialCheckout: { type: String, default: '' },
  initialAdults: { type: Number, default: 2 },
  initialChildrenAges: { type: Array, default: () => [] },
})

const emit = defineEmits(['submit-search'])

const uid = Math.random().toString(36).slice(2, 8)
const destinationInputId = `destination-${uid}`
const dateInputId = `date-range-${uid}`
const dateModalTitleId = `dateModalTitle-${uid}`
const guestModalTitleId = `guestModalTitle-${uid}`

const MAX_GUESTS = 6
const MIN_ADULTS = 1
const DEFAULT_CHILD_AGE = 8
const childAgeOptions = Array.from({ length: 18 }, (_, idx) => idx)

const destination = ref('')
const checkin = ref('')
const checkout = ref('')
const adultsCount = ref(2)
const childrenAges = ref([])

const suggestionRootRef = ref(null)
const regionSuggestions = ref([])
const hotelSuggestions = ref([])
const suggestionStatus = ref('')
const selectedDestinationType = ref('')
const selectedHotelHid = ref('')
const selectedHotelId = ref('')
const selectedRegionId = ref('')
const selectedDestinationLabel = ref('')
let suggestionTimer = null

const isDateModalOpen = ref(false)
const isGuestModalOpen = ref(false)
const calendarBaseDate = ref(new Date())
const rangeStartDate = ref(null)
const rangeEndDate = ref(null)
const hoverDate = ref(null)

function syncFromProps() {
  destination.value = String(props.initialDestination || '')
  selectedDestinationType.value = String(props.initialDestinationType || '').trim()
  selectedHotelHid.value = String(props.initialHotelHid || '').trim()
  selectedHotelId.value = String(props.initialHotelId || '').trim()
  selectedRegionId.value = String(props.initialRegionId || '').trim()
  selectedDestinationLabel.value = selectedDestinationType.value
    ? String(props.initialDestination || '').trim()
    : ''
  checkin.value = String(props.initialCheckin || '')
  checkout.value = String(props.initialCheckout || '')
  adultsCount.value = Math.min(MAX_GUESTS, Math.max(MIN_ADULTS, Number(props.initialAdults) || 2))
  const initialChildren = Array.isArray(props.initialChildrenAges)
    ? props.initialChildrenAges
    : []
  childrenAges.value = initialChildren
    .map((v) => Math.min(17, Math.max(0, Number(v) || DEFAULT_CHILD_AGE)))
    .slice(0, Math.max(0, MAX_GUESTS - adultsCount.value))
}

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
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(date)
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
  if (!(date instanceof Date) || !(start instanceof Date) || !(end instanceof Date)) return false
  const t = date.getTime()
  return t >= start.getTime() && t <= end.getTime()
}

const childrenCount = computed(() => childrenAges.value.length)

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
  const formatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
  const label = formatter.format(calendarBaseDate.value)
  return label.charAt(0).toUpperCase() + label.slice(1)
})

const calendarWeekdays = computed(() => {
  const formatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })
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
    cells.push({ key: `empty-${year}-${month}-${i}`, type: 'empty' })
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
      if (start && isSameDay(date, start)) classes['date-calendar__day--start'] = true
      if (end && isSameDay(date, end)) classes['date-calendar__day--end'] = true
      if (start && end && isBetween(date, start, end)) classes['date-calendar__day--inrange'] = true
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
  const allowedChildren = Math.max(0, MAX_GUESTS - adultsCount.value)
  if (childrenAges.value.length > allowedChildren) {
    childrenAges.value = childrenAges.value.slice(0, allowedChildren)
  }
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

function clearSelectedDestination() {
  selectedDestinationType.value = ''
  selectedHotelHid.value = ''
  selectedHotelId.value = ''
  selectedRegionId.value = ''
  selectedDestinationLabel.value = ''
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

async function fetchAutocompleteData(term, language = 'fr') {
  const q = (term || '').trim()
  if (!q) return { regions: [], hotels: [] }
  const lang = (language || 'fr').trim() || 'fr'
  const endpoint = `${API_BASE}/api/regions/search?q=${encodeURIComponent(q)}&lang=${encodeURIComponent(lang)}`
  const { statusCode, data } = await safeJsonFetch(endpoint, {
    method: 'GET',
    skipServerDownRedirect: true,
  })
  if (statusCode >= 400) {
    throw new Error(data?.error || data?._raw || 'Autocomplete failed')
  }
  return {
    regions: Array.isArray(data?.regions) ? data.regions : [],
    hotels: Array.isArray(data?.hotels) ? data.hotels : [],
  }
}

async function loadSuggestions(term) {
  const trimmed = (term || '').trim()
  regionSuggestions.value = []
  hotelSuggestions.value = []
  suggestionStatus.value = ''

  if (trimmed.length < 2) return

  suggestionStatus.value = 'Recherche de suggestions...'
  try {
    const { regions, hotels } = await fetchAutocompleteData(trimmed, 'fr')
    regionSuggestions.value = regions.slice(0, 8)
    hotelSuggestions.value = hotels.slice(0, 5)
    if (!regions.length && !hotels.length) {
      suggestionStatus.value = 'Aucun resultat pour cette destination ou cet hotel.'
    } else {
      suggestionStatus.value = `Suggestions : ${regions.length} region(s), ${hotels.length} hotel(s)`
    }
  } catch (err) {
    suggestionStatus.value = err?.message || 'Erreur lors de la recherche de suggestions.'
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
  const label = region.name || region.full_name || region.fullName || region.id || ''
  destination.value = String(label)
  selectedDestinationType.value = 'region'
  selectedHotelHid.value = ''
  selectedHotelId.value = ''
  selectedRegionId.value = String(region?.id || '').trim()
  selectedDestinationLabel.value = String(label)
  closeSuggestions()
}

function selectHotelSuggestion(hotel) {
  const label = hotel.name || hotel.hid || ''
  destination.value = String(label)
  selectedDestinationType.value = 'hotel'
  selectedHotelHid.value = String(hotel?.hid || '').trim()
  selectedHotelId.value = String(hotel?.id || '').trim()
  selectedRegionId.value = String(hotel?.region_id || '').trim()
  selectedDestinationLabel.value = String(label)
  closeSuggestions()
}

function hotelSuggestionMeta(hotel) {
  if (!hotel || typeof hotel !== 'object') return ''
  const parts = [
    hotel.address,
    hotel.city,
    hotel.city_name,
    hotel.country_name,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  return Array.from(new Set(parts)).join(' · ')
}

const hasSuggestions = computed(() =>
  regionSuggestions.value.length > 0 || hotelSuggestions.value.length > 0,
)

function handleClickOutside(event) {
  const root = suggestionRootRef.value
  if (!root) return
  if (root.contains(event.target)) return
  closeSuggestions()
}

function submitSearch() {
  if (!destination.value || !checkin.value || !checkout.value) return
  emit('submit-search', {
    destination: destination.value,
    destinationType: selectedDestinationType.value || undefined,
    hotelHid: selectedHotelHid.value || undefined,
    hotelId: selectedHotelId.value || undefined,
    regionId: selectedRegionId.value || undefined,
    checkin: checkin.value,
    checkout: checkout.value,
    adults: String(adultsCount.value || 1),
    children: String(childrenCount.value || 0),
    childrenAges: childrenAges.value.length ? childrenAges.value.map((age) => String(age)).join(',') : undefined,
  })
}

watch(
  () => destination.value,
  (val) => {
    const normalizedValue = String(val || '').trim()
    if (
      selectedDestinationLabel.value &&
      normalizedValue !== selectedDestinationLabel.value
    ) {
      clearSelectedDestination()
    }
    scheduleSuggestions(val)
  },
)

watch(
  () => [
    props.initialDestination,
    props.initialDestinationType,
    props.initialHotelHid,
    props.initialHotelId,
    props.initialRegionId,
    props.initialCheckin,
    props.initialCheckout,
    props.initialAdults,
    JSON.stringify(props.initialChildrenAges || []),
  ],
  () => {
    syncFromProps()
  },
)

onMounted(() => {
  syncFromProps()
  if (typeof window !== 'undefined') {
    window.addEventListener('click', handleClickOutside)
  }
})

onBeforeUnmount(() => {
  if (suggestionTimer) clearTimeout(suggestionTimer)
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', handleClickOutside)
  }
})
</script>

<style scoped>
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
  background: rgba(248, 250, 252, 0.9);
  color: #111827;
  font-size: 1rem;
  cursor: pointer;
}

.counter .value {
  min-width: 2rem;
  text-align: center;
  font-weight: 600;
}

.modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
}

.modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(2, 6, 23, 0.55);
}

.modal__dialog {
  position: relative;
  width: min(700px, calc(100vw - 2rem));
  background: #fff;
  border-radius: 1rem;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.35);
  overflow: hidden;
}

.modal__header,
.modal__footer {
  padding: 0.9rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal__body {
  padding: 0.5rem 1rem 1rem;
}

.modal__title {
  font-size: 0.95rem;
  font-weight: 700;
}

.modal__close {
  width: 2rem;
  height: 2rem;
  min-width: 2rem;
  padding: 0;
  border-radius: 999px;
  border: 1px solid rgba(165, 20, 30, 0.38);
  background: #fff5f5;
  color: #a5141e;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  line-height: 1;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
}

.modal__close:hover {
  background: #fee2e2;
  border-color: rgba(165, 20, 30, 0.55);
}

.modal__close:focus-visible {
  outline: 2px solid rgba(165, 20, 30, 0.3);
  outline-offset: 2px;
}

.date-calendar {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.date-calendar__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.date-calendar__nav {
  display: inline-flex;
  gap: 0.35rem;
}

.date-calendar__nav button {
  width: 2rem;
  height: 2rem;
  border: 1px solid rgba(148, 163, 184, 0.45);
  border-radius: 0.6rem;
  background: #fff;
  cursor: pointer;
}

.date-calendar__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.35rem;
}

.date-calendar__dow {
  font-size: 0.7rem;
  color: #64748b;
  text-align: center;
  font-weight: 600;
}

.date-calendar__day {
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 0.65rem;
  min-height: 2.1rem;
  background: #fff;
  cursor: pointer;
}

.date-calendar__day--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.date-calendar__day--start,
.date-calendar__day--end {
  background: #a5141e;
  color: #fff;
  border-color: #a5141e;
}

.date-calendar__day--inrange {
  background: rgba(165, 20, 30, 0.12);
  border-color: rgba(165, 20, 30, 0.25);
}
</style>
