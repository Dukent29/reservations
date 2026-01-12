<template>
  <section class="workspace__content hotel-detail-view">
    <div class="card details-card">
      <div class="details-card__header">
        <button
          class="secondary mini"
          type="button"
          @click="goBack"
        >
          Retour aux résultats
        </button>
      </div>

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
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { API_BASE, safeJsonFetch } from '../services/httpClient.js'

const route = useRoute()
const router = useRouter()

const PREBOOK_SUMMARY_KEY = 'booking:lastPrebook'
const DETAIL_IMAGE_SIZE = '1024x768'
const DETAIL_IMAGE_LIMIT = 13

const MAX_GUESTS_PER_ROOM = 6
const DEFAULT_CHILD_AGE = 8

const checkin = computed(() => String(route.query.checkin || '').trim())
const checkout = computed(() => String(route.query.checkout || '').trim())
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

const hotelDetailsLoading = ref(false)
const hotelDetailsError = ref('')
const selectedHotelDetails = ref(null)

const detailImages = ref([])
const detailImagesLoading = ref(false)
const detailImagesError = ref('')
let latestDetailImagesToken = 0

const prebookLoadingIndex = ref(null)
const prebookStatus = ref('')

function goBack() {
  router.push({ name: 'search-results', query: route.query })
}

function buildGuestsPayload() {
  return [
    {
      adults: adults.value,
      children: childrenList.value,
    },
  ]
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

function extractHotels(payload) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  if (Array.isArray(payload.hotels)) return payload.hotels
  if (Array.isArray(payload.results)) return payload.results
  if (payload.results) return extractHotels(payload.results)
  if (payload.data) return extractHotels(payload.data)
  return []
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
  const safeSize = size || DETAIL_IMAGE_SIZE
  const parsedLimit = Number(limit)
  const hasLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
  const cappedLimit = hasLimit
    ? Math.max(1, Math.min(parsedLimit, 50))
    : null
  if (identity.hid === null && !identity.fallbackId) return []
  const payload = {
    language: safeLang,
    size: safeSize,
  }
  if (cappedLimit !== null) payload.limit = cappedLimit
  if (identity.hid !== null) payload.hid = identity.hid
  else if (identity.fallbackId) payload.id = identity.fallbackId
  return await requestHotelImagesFromApi(payload)
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

async function loadHotelDetails() {
  const hid = String(route.params.hid || '').trim()
  if (!hid) {
    selectedHotelDetails.value = null
    return
  }
  hotelDetailsLoading.value = true
  hotelDetailsError.value = ''
  selectedHotelDetails.value = null
  detailImages.value = []
  detailImagesError.value = ''
  const imagesToken = ++latestDetailImagesToken
  try {
    const regionId =
      route.query.region_id || route.query.regionId || null

    const body = {
      id: hid,
      checkin: checkin.value,
      checkout: checkout.value,
      residency: 'gb',
      language: 'fr',
      guests: buildGuestsPayload(),
      region_id: regionId || undefined,
      currency: 'EUR',
    }
    const endpoint = `${API_BASE}/api/search/hp`
    const { statusCode, data } = await safeJsonFetch(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    if (statusCode >= 400 || !data || data.error) {
      throw new Error(data?.error || data?._raw || 'Hotel lookup failed')
    }
    const results = extractHotels(data?.results ?? data)
    selectedHotelDetails.value = results[0] || null
    if (selectedHotelDetails.value) {
      hydrateHotelDetailGallery(selectedHotelDetails.value, imagesToken)
    }
  } catch (err) {
    hotelDetailsError.value = err.message || String(err || '')
  } finally {
    hotelDetailsLoading.value = false
  }
}

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
        guest_label: '',
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

  try {
    prebookLoadingIndex.value = index
    const { statusCode, data } = await safeJsonFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
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
    prebookStatus.value =
      `Erreur lors de la pré‑réservation : ${err?.message || String(err || '')}`
  } finally {
    prebookLoadingIndex.value = null
  }
}

watch(
  () => [route.params.hid, route.query.checkin, route.query.checkout, route.query.adults, route.query.children, route.query.childrenAges],
  () => {
    loadHotelDetails()
  },
)

onMounted(() => {
  loadHotelDetails()
})
</script>

<style scoped>
.hotel-detail-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 2rem;
}

.details-card__header {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 0.75rem;
}

.hotel-detail__gallery {
  display: grid;
  margin: 1rem 0;
  gap: 0.5rem;
}

.hotel-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.5rem;
}

.hotel-gallery__item {
  border-radius: 0.65rem;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(15, 23, 42, 0.7);
}

.hotel-gallery__item img {
  display: block;
  width: 100%;
  height: 120px;
  object-fit: cover;
}

.hotel-detail__summary {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.hotel-detail__header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
}

.hotel-detail__title {
  font-size: 1.1rem;
  font-weight: 600;
}

.hotel-detail__meta {
  font-size: 0.85rem;
  color: #94a3b8;
}

.hotel-detail__info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.hotel-detail__info-box {
  border-radius: 0.65rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  padding: 0.75rem;
  background: rgba(15, 23, 42, 0.6);
}

.hotel-detail__description {
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  line-height: 1.5;
}

.hotel-detail__info-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8rem;
}

.hotel-detail__chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
}

.hotel-detail__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  font-size: 0.7rem;
  background: rgba(15, 23, 42, 0.8);
}

.hotel-detail__chip-icon {
  font-size: 0.75rem;
}

.hotel-detail__rooms {
  margin-top: 1rem;
}

.hotel-detail__highlights,
.hotel-detail__nearby {
  margin-bottom: 0.75rem;
}

.hotel-detail__nearby-list {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8rem;
}

.hotel-detail__fact-icon {
  margin-right: 0.4rem;
}

.room-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}

.room-card {
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.75rem;
  background: rgba(15, 23, 42, 0.65);
}

.room-card__header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: baseline;
}

.room-card__title {
  font-weight: 600;
  font-size: 0.9rem;
}

.room-card__price {
  font-weight: 600;
}

.room-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0.5rem 0;
}

.room-card__details {
  font-size: 0.75rem;
  color: #9ca3af;
  display: grid;
  gap: 0.35rem;
}

.room-card__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.hotel-thumb__placeholder {
  border-radius: 0.65rem;
  border: 1px dashed rgba(148, 163, 184, 0.4);
  padding: 1rem;
  text-align: center;
  font-size: 0.75rem;
  color: #9ca3af;
}
</style>
