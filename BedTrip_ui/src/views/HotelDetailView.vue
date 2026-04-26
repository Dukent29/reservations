<!--
  HotelDetailView
  ===============
  Hotel details page shown after a user selects a search result.

  Main responsibilities:
  - Load hotel details, images, POIs and rates from the search APIs.
  - Present the hotel summary, gallery, location, amenities and available rooms.
  - Open the full image lightbox while keeping the page gallery lightweight.
  - Start prebooking for the selected room/rate and pass context to BookingView.
-->

<template>
  <section class="workspace__content hotel-detail-view">
    <div class="card details-card">
      <div class="details-card__header">
        <button
          class="secondary mini details-card__back"
          type="button"
          @click="goBack"
        >
          &lsaquo; Retours aux resultats
        </button>
      </div>

      <div v-if="hotelDetailsLoading" class="hotel-detail hotel-detail--skeleton" aria-busy="true">
        <div class="hotel-detail__summary">
          <div class="skeleton-line skeleton-line--title"></div>
          <div class="skeleton-line skeleton-line--meta"></div>
        </div>

        <div class="hotel-detail__gallery">
          <div class="hotel-gallery hotel-gallery--skeleton">
            <div
              v-for="n in GALLERY_PREVIEW_LIMIT"
              :key="`gallery-skeleton-${n}`"
              :class="[
                'skeleton-thumb',
                { 'skeleton-thumb--primary': n === 1 },
              ]"
            ></div>
          </div>
        </div>

        <div class="hotel-detail__info-grid">
          <div
            v-for="n in 3"
            :key="`info-skeleton-${n}`"
            class="hotel-detail__info-box"
          >
            <div class="skeleton-line skeleton-line--subtitle"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line skeleton-line--short"></div>
          </div>
        </div>

        <div class="hotel-detail__rooms">
          <div class="skeleton-line skeleton-line--subtitle"></div>
          <ul class="room-list">
            <li
              v-for="n in 2"
              :key="`room-skeleton-${n}`"
              class="room-card room-card--skeleton"
            >
              <div class="room-card__header">
                <div class="skeleton-line skeleton-line--room"></div>
                <div class="skeleton-line skeleton-line--price"></div>
              </div>
              <div class="room-card__chips">
                <span
                  v-for="c in 3"
                  :key="`room-skeleton-${n}-chip-${c}`"
                  class="skeleton-chip"
                ></span>
              </div>
              <div class="room-card__details">
                <div class="skeleton-line"></div>
                <div class="skeleton-line skeleton-line--short"></div>
              </div>
              <div class="room-card__footer">
                <div class="skeleton-button"></div>
              </div>
            </li>
          </ul>
        </div>
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
              <span
                v-if="deriveHotelStars(selectedHotelDetails)"
                class="hotel-detail__stars"
              >
                <span
                  v-for="star in deriveHotelStars(selectedHotelDetails)"
                  :key="star"
                  class="hotel-detail__star"
                >★</span>
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
            v-if="detailImagesLoading || detailImagesRetryPending"
            class="hotel-gallery hotel-gallery--skeleton hotel-gallery--inline-loading"
            aria-busy="true"
          >
            <div
              v-for="n in GALLERY_PREVIEW_LIMIT"
              :key="`gallery-inline-loading-${n}`"
              :class="[
                'skeleton-thumb',
                { 'skeleton-thumb--primary': n === 1 },
              ]"
            ></div>
          </div>
          <p
            v-if="detailImagesLoading || detailImagesRetryPending"
            class="hotel-gallery__loading-note"
          >
            Chargement des photos de l’hôtel…
            <span v-if="detailImagesRetryPending">nouvelle tentative en cours.</span>
          </p>
          <div
            v-else-if="detailImagesError"
            class="hotel-thumb__placeholder hotel-thumb__placeholder--error"
          >
            <span>{{ detailImagesError }}</span>
            <button
              type="button"
              class="secondary mini hotel-thumb__retry"
              @click="retryDetailImages"
            >
              Réessayer
            </button>
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
              v-for="(url, idx) in galleryPreviewImages"
              :key="url + '-' + idx"
              :class="[
                'hotel-gallery__cell',
                { 'hotel-gallery__cell--primary': idx === 0 },
              ]"
            >
              <button
                class="hotel-gallery__item"
                type="button"
                :aria-label="`Afficher la photo ${idx + 1}`"
                @click="openLightbox(idx)"
              >
                <img
                  :src="url"
                  :alt="`${hotelDisplayName(selectedHotelDetails) } · photo ${idx + 1}`"
                  :loading="idx === 0 ? 'eager' : 'lazy'"
                  :fetchpriority="idx === 0 ? 'high' : 'auto'"
                  decoding="async"
                />
              </button>
              <button
                v-if="idx === galleryPreviewImages.length - 1 && hiddenGalleryImagesCount > 0"
                class="hotel-gallery__show-all"
                type="button"
                :aria-label="`Afficher toutes les ${detailImages.length} photos`"
                @click.stop="openLightbox(0)"
              >
                <i class="pi pi-images" aria-hidden="true"></i>
                <span>Afficher toutes les photos</span>
              </button>
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
            v-if="hotelLocationLabel || hotelContactDetails.length"
            class="hotel-detail__info-box hotel-detail__info-box--plain hotel-detail__info-box--location"
          >
            <h4>Contact & localisation</h4>
            <div
              v-if="hotelLocationLabel"
              class="hotel-detail__location-row"
            >
              <i
                class="pi pi-map-marker hotel-detail__location-icon"
                aria-hidden="true"
              ></i>
              <div class="hotel-detail__location-copy">
                <p class="hotel-detail__location-text">
                  {{ hotelLocationLabel }}
                </p>
                <a
                  v-if="hotelMapsUrl"
                  :href="hotelMapsUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="hotel-detail__map-link"
                >
                  <i class="pi pi-external-link" aria-hidden="true"></i>
                  Ouvrir dans Maps
                </a>
              </div>
            </div>
            <ul
              v-if="hotelContactDetails.length"
              class="hotel-detail__info-list hotel-detail__info-list--compact"
            >
              <li
                v-for="item in hotelContactDetails"
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
                :key="item.label || item"
                class="hotel-detail__chip"
              >
                <i
                  v-if="item.icon"
                  :class="['hotel-detail__chip-icon', item.icon]"
                  aria-hidden="true"
                ></i>
                <span>{{ item.label || item }}</span>
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
                :key="method.label || method"
                class="hotel-detail__chip"
              >
                <i
                  v-if="method.icon"
                  :class="['hotel-detail__chip-icon', method.icon]"
                  aria-hidden="true"
                ></i>
                <span>{{ method.label || method }}</span>
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

          <div class="rooms-toolbar">
            <h4>Chambres et tarifs</h4>
            <div
              class="rooms-view-toggle"
              role="group"
              aria-label="Choisir la vue des chambres"
            >
              <button
                type="button"
                class="rooms-view-toggle__btn"
                :class="{ 'is-active': !compareView }"
                :aria-pressed="!compareView"
                aria-label="Vue cartes"
                title="Vue cartes"
                @click="compareView = false"
              >
                <i class="pi pi-th-large" aria-hidden="true"></i>
              </button>
              <button
                type="button"
                class="rooms-view-toggle__btn"
                :class="{ 'is-active': compareView }"
                :aria-pressed="compareView"
                aria-label="Vue tableau de comparaison"
                title="Vue tableau de comparaison"
                @click="compareView = true"
              >
                <i class="pi pi-table" aria-hidden="true"></i>
              </button>
              <button
                type="button"
                class="rooms-view-toggle__help"
                aria-label="Aide sur les vues"
                title="Icône carrée: Vue liste. Icône tableau: Comparer les chambres."
                data-tip="Icône carrée: Vue liste. Icône tableau: Comparer les chambres."
              >
                ?
              </button>
            </div>
          </div>
          <div
            v-if="!limitedRates.length"
            class="muted"
            style="font-size:.75rem;"
          >
            Aucune offre pour cette recherche.
          </div>
          <ul v-else-if="!compareView" class="room-list">
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
                      applyMarkupAmount(
                        rate.payment_options?.payment_types?.[0]?.show_amount ??
                          rate.payment_options?.payment_types?.[0]?.amount,
                      ),
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
                <div class="room-card__cancellation">
                  <span
                    :class="[
                      'room-card__cancellation-badge',
                      rateIsCancellable(rate)
                        ? 'room-card__cancellation-badge--free'
                        : 'room-card__cancellation-badge--nonrefund',
                    ]"
                  >
                    {{ rateIsCancellable(rate) ? 'Annulable' : 'Non remboursable' }}
                  </span>
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
          <div v-else class="compare-table-wrap">
            <table class="compare-table">
              <thead>
                <tr>
                  <th>Type de logement</th>
                  <th>Nombre de voyageurs</th>
                  <th>Tarif pour le séjour</th>
                  <th>Vos options</th>
                  <th>Réserver</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(rate, idx) in limitedRates"
                  :key="`compare-${idx}`"
                >
                  <td class="compare-type">
                    <div class="compare-title">
                      {{ rate.room_name || rate.room_data_trans?.main_name || 'Chambre' }}
                    </div>
                    <div class="compare-chips">
                      <span
                        v-for="chip in rateChipLabels(rate)"
                        :key="chip"
                        class="chip"
                      >
                        {{ chip }}
                      </span>
                    </div>
                  </td>
                  <td class="compare-capacity">
                    {{ rateCapacityDetail(rate) || '—' }}
                  </td>
                  <td class="compare-price">
                    <div class="compare-price__main">
                      {{
                        formatCurrency(
                          applyMarkupAmount(
                            rate.payment_options?.payment_types?.[0]?.show_amount ??
                              rate.payment_options?.payment_types?.[0]?.amount,
                          ),
                          rate.payment_options?.payment_types?.[0]?.show_currency_code ??
                            rate.payment_options?.payment_types?.[0]?.currency_code ??
                            'EUR',
                        )
                      }}
                    </div>
                    <div v-if="rateTaxesText(rate)" class="compare-price__sub">
                      {{ rateTaxesText(rate) }}
                    </div>
                  </td>
                  <td class="compare-options">
                    <div class="room-card__cancellation">
                      <span
                        :class="[
                          'room-card__cancellation-badge',
                          rateIsCancellable(rate)
                            ? 'room-card__cancellation-badge--free'
                            : 'room-card__cancellation-badge--nonrefund',
                        ]"
                      >
                        {{ rateIsCancellable(rate) ? 'Annulable' : 'Non remboursable' }}
                      </span>
                      {{ rateCancellationText(rate) }}
                    </div>
                    <div v-if="rateBeddingText(rate)">{{ rateBeddingText(rate) }}</div>
                    <div v-if="rateBathroomText(rate)">{{ rateBathroomText(rate) }}</div>
                  </td>
                  <td class="compare-action">
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
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="prebookStatus" class="muted" style="font-size:.75rem;margin-top:.5rem;">
            {{ prebookStatus }}
          </p>
        </div>
      </div>
    </div>

    <div
      v-if="isLightboxOpen"
      class="gallery-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Galerie photos"
      @click="closeLightbox"
    >
      <div class="gallery-lightbox__frame" @click.stop>
        <button
          type="button"
          class="gallery-lightbox__close"
          aria-label="Fermer la galerie"
          @click="closeLightbox"
        >
          ✕
        </button>
        <button
          v-if="detailImages.length > 1"
          type="button"
          class="gallery-lightbox__nav gallery-lightbox__nav--prev"
          aria-label="Photo précédente"
          @click="lightboxPrev"
        >
          ‹
        </button>
        <img
          class="gallery-lightbox__image"
          :src="lightboxImageUrl"
          :alt="`Photo ${lightboxIndex + 1}`"
        />
        <button
          v-if="detailImages.length > 1"
          type="button"
          class="gallery-lightbox__nav gallery-lightbox__nav--next"
          aria-label="Photo suivante"
          @click="lightboxNext"
        >
          ›
        </button>
        <div
          v-if="detailImages.length > 1"
          class="gallery-lightbox__count"
        >
          {{ lightboxIndex + 1 }} / {{ detailImages.length }}
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { API_BASE, safeJsonFetch } from '../services/httpClient.js'
import { fetchHotelInfoSummary } from '../services/hotelInfoService.js'
import { fetchHotelPois } from '../services/hotelPoiService.js'

const route = useRoute()
const router = useRouter()

const compareView = ref(false)

const PREBOOK_SUMMARY_KEY = 'booking:lastPrebook'
const MARKUP_PERCENT = 10
const DETAIL_IMAGE_PREVIEW_SIZE = 'x500'
const DETAIL_IMAGE_SIZE = '1024x768'
const DETAIL_IMAGE_LIMIT = 15
const GALLERY_PREVIEW_LIMIT = 5
const DETAIL_IMAGE_STORAGE_PREFIX = 'bedtrip:hotel-images:v2:'
const DETAIL_IMAGE_STORAGE_TTL_MS = 12 * 60 * 60 * 1000
const DETAIL_IMAGE_RETRY_DELAY_MS = 8000
const DETAIL_IMAGE_ENDPOINT_COOLDOWN_MS = 30000
const DETAIL_IMAGE_AUTO_RETRY_MAX = 3
const DETAIL_IMAGE_FALLBACK_LIMITS = [10, 6, 3, 1]

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
const importedHotelPois = ref([])

const detailPreviewImages = ref([])
const detailImages = ref([])
const detailImagesLoading = ref(false)
const detailImagesError = ref('')
const detailImagesRetryPending = ref(false)
const isLightboxOpen = ref(false)
const lightboxIndex = ref(0)
let latestDetailImagesToken = 0
const detailImageCache = new Map()
const detailImageCooldown = new Map()
let detailImagesRetryTimer = null
const detailImagesRetryCount = ref(0)

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

function toTitleCase(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function hotelDisplayName(hotel) {
  const fallbackId =
    hotel?.id || hotel?.hid || hotel?.hotel_id || hotel?.hotelId
  const rawName = (
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
  return toTitleCase(rawName)
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
  const normalizeHotelStarsValue = (value) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) return null
    const normalized = parsed > 5 && parsed <= 10
      ? parsed / 2
      : parsed
    return Math.max(1, Math.min(5, Math.round(normalized)))
  }

  const direct =
    hotel?.stars ?? hotel?.category ?? hotel?.rg_ext?.class
  const directNum = normalizeHotelStarsValue(direct)
  if (directNum !== null) return directNum
  const vals = Array.isArray(hotel?.rates)
    ? hotel.rates
        .map((r) => normalizeHotelStarsValue(r?.rg_ext?.class))
        .filter((n) => n !== null)
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

function applyMarkupAmount(amount) {
  const num = Number(amount)
  if (!Number.isFinite(num)) return amount
  return Math.round(num * (1 + MARKUP_PERCENT / 100) * 100) / 100
}

const lightboxImageUrl = computed(() => {
  if (!detailImages.value.length) return ''
  const idx = Math.min(
    Math.max(lightboxIndex.value, 0),
    detailImages.value.length - 1,
  )
  return detailImages.value[idx] || ''
})

const galleryPreviewImages = computed(() =>
  (detailPreviewImages.value.length
    ? detailPreviewImages.value
    : detailImages.value
  ).slice(0, GALLERY_PREVIEW_LIMIT),
)

const hiddenGalleryImagesCount = computed(() =>
  Math.max(detailImages.value.length - galleryPreviewImages.value.length, 0),
)

function setBodyLock(locked) {
  if (typeof document === 'undefined') return
  document.body.style.overflow = locked ? 'hidden' : ''
}

function openLightbox(index) {
  if (!detailImages.value.length) return
  lightboxIndex.value = Math.min(
    Math.max(index, 0),
    detailImages.value.length - 1,
  )
  isLightboxOpen.value = true
  setBodyLock(true)
}

function closeLightbox() {
  isLightboxOpen.value = false
  setBodyLock(false)
}

function lightboxPrev() {
  const total = detailImages.value.length || 1
  lightboxIndex.value = (lightboxIndex.value - 1 + total) % total
}

function lightboxNext() {
  const total = detailImages.value.length || 1
  lightboxIndex.value = (lightboxIndex.value + 1) % total
}

function handleLightboxKey(event) {
  if (!isLightboxOpen.value) return
  if (event.key === 'Escape') {
    closeLightbox()
    return
  }
  if (event.key === 'ArrowLeft') {
    lightboxPrev()
  }
  if (event.key === 'ArrowRight') {
    lightboxNext()
  }
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

/**
 * Cancellation policy from ETG: payment_options.payment_types[0].cancellation_penalties
 * - free_cancellation_before: date until which free cancellation is allowed
 * - policies: [{ start_at, end_at, amount_show, amount_charge }] — first policy with amount 0 = free until end_at
 * A rate is cancellable (free cancellation) only if it has free_cancellation_before or a policy with amount 0.
 * Cheapest rates often have no free window → "Tarif non remboursable".
 */
function rateCancellationText(rate) {
  const payment = getRatePayment(rate)
  const penalties = payment?.cancellation_penalties
  const freeBefore = penalties?.free_cancellation_before
  const policies = Array.isArray(penalties?.policies) ? penalties.policies : []

  const formatDate = (iso) => {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      }
    } catch {
      // ignore
    }
    return iso
  }

  if (freeBefore) {
    const dateText = formatDate(freeBefore) || freeBefore
    return `Annulation gratuite possible jusqu’au ${dateText}.`
  }
  const freePolicy = policies.find(
    (p) =>
      p &&
      (Number(p.amount_show) === 0 || Number(p.amount_charge) === 0),
  )
  if (freePolicy?.end_at) {
    const dateText = formatDate(freePolicy.end_at) || freePolicy.end_at
    return `Annulation gratuite possible jusqu’au ${dateText}.`
  }
  if (policies.length > 0) {
    const firstPenalty = policies[0]
    const amount =
      firstPenalty?.amount_show ?? firstPenalty?.amount_charge
    if (amount && Number(amount) > 0) {
      return 'Tarif non remboursable — annulation non gratuite.'
    }
  }
  return 'Frais d’annulation peuvent s’appliquer selon les conditions du tarif.'
}

/** True if this rate has a free cancellation window (until a given date). */
function rateIsCancellable(rate) {
  const payment = getRatePayment(rate)
  const penalties = payment?.cancellation_penalties
  if (penalties?.free_cancellation_before) return true
  const policies = Array.isArray(penalties?.policies) ? penalties.policies : []
  return policies.some(
    (p) =>
      p && (Number(p.amount_show) === 0 || Number(p.amount_charge) === 0),
  )
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
  return importedHotelPois.value
    .map((poi) => {
      const label = poi?.name || poi?.name_en || null
      const distanceText = poi?.distance_label || null
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

const hotelLocationLabel = computed(() => {
  const hotel = selectedHotelDetails.value
  if (!hotel) return ''
  const region = hotel.region || {}
  const primary = pickFirstString(
    hotel.address,
    hotel.address_full,
    hotel.location?.address,
  )
  const locality = [
    hotel.postal_code,
    region.city || region.name,
    region.country_name || region.country,
  ].filter(Boolean).join(' ')
  if (primary && locality && !primary.includes(locality)) {
    return `${primary}, ${locality}`
  }
  return primary || locality || ''
})

const hotelContactDetails = computed(() => {
  const hotel = selectedHotelDetails.value
  if (!hotel) return []
  const items = []
  if (hotel.phone) {
    items.push(`Téléphone : ${hotel.phone}`)
  }
  if (hotel.email) {
    items.push(`Email : ${hotel.email}`)
  }
  return items
})

function pickCoordinate(...values) {
  for (const value of values) {
    const num = Number(value)
    if (Number.isFinite(num)) return num
  }
  return null
}

const hotelMapsUrl = computed(() => {
  const hotel = selectedHotelDetails.value
  if (!hotel) return ''
  const latitude = pickCoordinate(
    hotel.latitude,
    hotel.lat,
    hotel.location?.latitude,
    hotel.location?.lat,
    hotel.location?.center?.latitude,
    hotel.location?.center?.lat,
    hotel.region?.latitude,
    hotel.region?.lat,
  )
  const longitude = pickCoordinate(
    hotel.longitude,
    hotel.lon,
    hotel.lng,
    hotel.location?.longitude,
    hotel.location?.lon,
    hotel.location?.lng,
    hotel.location?.center?.longitude,
    hotel.location?.center?.lon,
    hotel.location?.center?.lng,
    hotel.region?.longitude,
    hotel.region?.lon,
    hotel.region?.lng,
  )
  if (latitude !== null && longitude !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
  }
  const label = hotelLocationLabel.value
  if (!label) return ''
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`
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

function buildHotelImagesCacheKey(identity, lang, size, limit) {
  const safeLang = (lang || 'en').trim() || 'en'
  const safeSize = size || DETAIL_IMAGE_SIZE
  const parsedLimit = Number(limit)
  const cappedLimit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.max(1, Math.min(parsedLimit, 50))
      : null
  return `${identity.cacheKey}|${safeLang}|${safeSize}|${
    cappedLimit === null ? 'all' : cappedLimit
  }`
}

function readStoredHotelImages(cacheKey) {
  if (typeof window === 'undefined' || !cacheKey) return []
  try {
    const storageKey = `${DETAIL_IMAGE_STORAGE_PREFIX}${cacheKey}`
    const raw = window.localStorage?.getItem(storageKey)
    if (!raw) return []
    const payload = JSON.parse(raw)
    if (!payload || payload.expiresAt <= Date.now()) {
      window.localStorage?.removeItem(storageKey)
      return []
    }
    return Array.isArray(payload.images)
      ? payload.images.filter((url) => typeof url === 'string' && url.length)
      : []
  } catch {
    return []
  }
}

function writeStoredHotelImages(cacheKey, images) {
  if (typeof window === 'undefined' || !cacheKey || !Array.isArray(images) || !images.length) return
  try {
    window.localStorage?.setItem(
      `${DETAIL_IMAGE_STORAGE_PREFIX}${cacheKey}`,
      JSON.stringify({
        expiresAt: Date.now() + DETAIL_IMAGE_STORAGE_TTL_MS,
        images,
      }),
    )
  } catch {
    // Ignore storage quota/private mode failures.
  }
}

function getCachedHotelImages(hotel, lang, size, limit) {
  const identity = buildHotelImageIdentity(hotel)
  if (!identity.cacheKey) return []
  const cacheKey = buildHotelImagesCacheKey(identity, lang, size, limit)
  const memoryValue = detailImageCache.get(cacheKey)
  if (Array.isArray(memoryValue) && memoryValue.length) return memoryValue
  return readStoredHotelImages(cacheKey)
}

const preconnectedImageOrigins = new Set()

function warmGalleryImages(images) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  const urls = Array.isArray(images) ? images.filter(Boolean) : []
  urls.slice(0, GALLERY_PREVIEW_LIMIT).forEach((url) => {
    try {
      const origin = new URL(url, window.location.href).origin
      if (!origin || preconnectedImageOrigins.has(origin)) return
      preconnectedImageOrigins.add(origin)
      const link = document.createElement('link')
      link.rel = 'preconnect'
      link.href = origin
      link.crossOrigin = ''
      document.head.appendChild(link)
    } catch {
      // Ignore invalid image URLs.
    }
  })
  if (urls[0]) {
    const img = new Image()
    img.decoding = 'async'
    img.src = urls[0]
  }
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

function isEndpointExceededError(err) {
  const message = String(err?.message || '').toLowerCase()
  return message.includes('endpoint_exceeded_limit')
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
  const cacheKey = buildHotelImagesCacheKey(identity, safeLang, safeSize, cappedLimit)
  const cooldownUntil = detailImageCooldown.get(cacheKey)
  if (cooldownUntil && cooldownUntil > Date.now()) {
    throw new Error('endpoint_exceeded_limit')
  }
  if (detailImageCache.has(cacheKey)) {
    return await detailImageCache.get(cacheKey)
  }
  const storedImages = readStoredHotelImages(cacheKey)
  if (storedImages.length) {
    detailImageCache.set(cacheKey, storedImages)
    return storedImages
  }
  const limitsToTry = []
  if (cappedLimit !== null) limitsToTry.push(cappedLimit)
  for (const fallbackLimit of DETAIL_IMAGE_FALLBACK_LIMITS) {
    if (cappedLimit !== null && fallbackLimit > cappedLimit) continue
    if (!limitsToTry.includes(fallbackLimit)) limitsToTry.push(fallbackLimit)
  }
  if (!limitsToTry.length) limitsToTry.push(null)

  const requestPromise = (async () => {
    let lastError = null
    for (const candidateLimit of limitsToTry) {
      const payload = {
        language: safeLang,
        size: safeSize,
      }
      if (candidateLimit !== null) payload.limit = candidateLimit
      if (identity.hid !== null) payload.hid = identity.hid
      else if (identity.fallbackId) payload.id = identity.fallbackId
      try {
        return await requestHotelImagesFromApi(payload)
      } catch (err) {
        lastError = err
        if (!isEndpointExceededError(err)) throw err
      }
    }
    throw lastError || new Error('Image lookup failed')
  })()

  detailImageCache.set(cacheKey, requestPromise)
  try {
    const images = await requestPromise
    if (Array.isArray(images) && images.length) {
      detailImageCache.set(cacheKey, images)
      writeStoredHotelImages(cacheKey, images)
    }
    return images
  } catch (err) {
    if (isEndpointExceededError(err)) {
      detailImageCooldown.set(
        cacheKey,
        Date.now() + DETAIL_IMAGE_ENDPOINT_COOLDOWN_MS,
      )
    }
    detailImageCache.delete(cacheKey)
    throw err
  }
}

function clearDetailImagesRetryTimer() {
  if (!detailImagesRetryTimer) return
  clearTimeout(detailImagesRetryTimer)
  detailImagesRetryTimer = null
  detailImagesRetryPending.value = false
}

function scheduleDetailImagesRetry(hotel, token) {
  clearDetailImagesRetryTimer()
  detailImagesRetryPending.value = true
  detailImagesRetryTimer = setTimeout(() => {
    detailImagesRetryPending.value = false
    if (token !== latestDetailImagesToken) return
    hydrateHotelDetailGallery(hotel, token)
  }, DETAIL_IMAGE_RETRY_DELAY_MS)
}

async function hydrateHotelDetailGallery(hotel, token) {
  clearDetailImagesRetryTimer()
  detailImagesRetryPending.value = false
  const lang = 'fr'
  const cachedFullImages = getCachedHotelImages(
    hotel,
    lang,
    DETAIL_IMAGE_SIZE,
    DETAIL_IMAGE_LIMIT,
  )
  const cachedPreviewImages = getCachedHotelImages(
    hotel,
    lang,
    DETAIL_IMAGE_PREVIEW_SIZE,
    GALLERY_PREVIEW_LIMIT,
  )
  const cachedImages = cachedFullImages.length ? cachedFullImages : cachedPreviewImages
  if (cachedImages.length) {
    detailImages.value = cachedImages
    detailPreviewImages.value = cachedPreviewImages.length
      ? cachedPreviewImages
      : cachedImages.slice(0, GALLERY_PREVIEW_LIMIT)
    warmGalleryImages(galleryPreviewImages.value)
  }
  detailImagesLoading.value = !cachedImages.length
  detailImagesError.value = ''
  try {
    const previewImages = await fetchHotelImages(
      hotel,
      lang,
      DETAIL_IMAGE_PREVIEW_SIZE,
      GALLERY_PREVIEW_LIMIT,
    )
    if (token !== latestDetailImagesToken) return
    if (previewImages.length) {
      detailPreviewImages.value = previewImages
      if (!detailImages.value.length) {
        detailImages.value = previewImages
      }
      detailImagesLoading.value = false
      warmGalleryImages(previewImages)
    }

    const images = await fetchHotelImages(
      hotel,
      lang,
      DETAIL_IMAGE_SIZE,
      DETAIL_IMAGE_LIMIT,
    )
    if (token !== latestDetailImagesToken) return
    detailImages.value = images?.length ? images : previewImages
    warmGalleryImages(galleryPreviewImages.value)
    detailImagesRetryCount.value = 0
  } catch (err) {
    if (token !== latestDetailImagesToken) return
    const hasShownImages =
      Array.isArray(detailImages.value) && detailImages.value.length > 0
    if (isEndpointExceededError(err)) {
      if (!hasShownImages) {
        detailImagesError.value =
          'Le service photo est momentanement sature. Nouvelle tentative automatique en cours.'
      }
      if (detailImagesRetryCount.value < DETAIL_IMAGE_AUTO_RETRY_MAX) {
        detailImagesRetryCount.value += 1
        scheduleDetailImagesRetry(hotel, token)
      } else if (!hasShownImages) {
        detailImagesError.value =
          'Le service photo est temporairement indisponible. Reessayez dans quelques secondes.'
      }
      return
    }
    if (!hasShownImages) {
      detailPreviewImages.value = []
      detailImages.value = []
    }
    detailImagesError.value =
      "Impossible de charger les photos de l'hotel."
  } finally {
    if (token === latestDetailImagesToken) {
      detailImagesLoading.value = false
    }
  }
}

async function loadImportedHotelPois(hotel) {
  if (!hotel) {
    importedHotelPois.value = []
    return
  }
  try {
    const response = await fetchHotelPois(hotel, {
      featured: true,
      limit: 8,
      maxDistanceM: 8000,
    })
    importedHotelPois.value = Array.isArray(response?.pois) ? response.pois : []
  } catch {
    importedHotelPois.value = []
  }
}

async function loadHotelDetails() {
  const hid = String(route.params.hid || '').trim()
  if (!hid) {
    selectedHotelDetails.value = null
    importedHotelPois.value = []
    return
  }
  hotelDetailsLoading.value = true
  hotelDetailsError.value = ''
  selectedHotelDetails.value = null
  importedHotelPois.value = []
  detailPreviewImages.value = []
  detailImages.value = []
  detailImagesError.value = ''
  detailImagesRetryPending.value = false
  detailImagesRetryCount.value = 0
  clearDetailImagesRetryTimer()
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
      try {
        const info = await fetchHotelInfoSummary(selectedHotelDetails.value, { language: 'fr' })
        if (info?.name || info?.address) {
          selectedHotelDetails.value = {
            ...selectedHotelDetails.value,
            name: info.name || selectedHotelDetails.value.name,
            address: info.address || selectedHotelDetails.value.address,
          }
        }
      } catch {
        // Keep /search/hp data if hotel/info is temporarily unavailable.
      }
    }
    if (selectedHotelDetails.value) {
      loadImportedHotelPois(selectedHotelDetails.value)
      hydrateHotelDetailGallery(selectedHotelDetails.value, imagesToken)
    }
  } catch (err) {
    hotelDetailsError.value = err.message || String(err || '')
  } finally {
    hotelDetailsLoading.value = false
  }
}

function retryDetailImages() {
  if (!selectedHotelDetails.value) return
  detailImagesRetryCount.value = 0
  detailImagesError.value = ''
  detailImagesRetryPending.value = false
  detailPreviewImages.value = []
  detailImages.value = []
  clearDetailImagesRetryTimer()
  const token = ++latestDetailImagesToken
  hydrateHotelDetailGallery(selectedHotelDetails.value, token)
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
    request_meta: {
      hotel_name: hotel.name || hotel.hotel_name || null,
      hotel_city: hotel.city || hotel.city_name || null,
      hotel_address: hotel.address || hotel.address_full || null,
      hotel_country: hotel.country || hotel.country_name || null,
      room_name:
        rate?.room_name || rate?.room_data_trans?.main_name || rate?.name || null,
      meal: rate?.meal || null,
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
  () => detailImages.value,
  (next) => {
    if (!Array.isArray(next) || !next.length) {
      if (isLightboxOpen.value) closeLightbox()
      return
    }
    if (lightboxIndex.value >= next.length) {
      lightboxIndex.value = 0
    }
  },
)

watch(
  () => [route.params.hid, route.query.checkin, route.query.checkout, route.query.adults, route.query.children, route.query.childrenAges],
  () => {
    loadHotelDetails()
  },
)

onMounted(() => {
  loadHotelDetails()
  window.addEventListener('keydown', handleLightboxKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleLightboxKey)
  setBodyLock(false)
  clearDetailImagesRetryTimer()
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

.details-card__back {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  font-size: 0.75rem;
}

.hotel-detail__gallery {
  display: grid;
  margin: 1rem 0;
  gap: 0.5rem;
}

.hotel-gallery {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  grid-template-rows: repeat(2, minmax(150px, 220px));
  gap: 0.5rem;
}

.hotel-gallery__cell {
  position: relative;
  overflow: hidden;
  min-height: 0;
  border-radius: 0.65rem;
  background: linear-gradient(
    135deg,
    rgba(59, 130, 246, 0.25),
    rgba(15, 23, 42, 0.6)
  );
}

.hotel-gallery__cell--primary,
.skeleton-thumb--primary {
  grid-row: span 2;
}

.hotel-gallery__item {
  appearance: none;
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0;
  width: 100%;
  height: 100%;
  text-align: left;
  border-radius: inherit;
  overflow: hidden;
  cursor: zoom-in;
}

.hotel-gallery__item img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s ease, filter 0.2s ease;
}

.hotel-gallery__item:hover img {
  transform: scale(1.02);
  filter: saturate(1.05);
}

.hotel-gallery__item:focus-visible {
  outline: 2px solid rgba(59, 130, 246, 0.85);
  outline-offset: 2px;
}

.hotel-gallery__show-all {
  position: absolute;
  right: 0.75rem;
  bottom: 0.75rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.8rem;
  border: 1px solid rgba(15, 23, 42, 0.18);
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.94);
  color: #0f172a;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.26);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 700;
  transition: transform 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
}

.hotel-gallery__show-all:hover,
.hotel-gallery__show-all:focus-visible {
  background: #ffffff;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.34);
  transform: translateY(-1px);
}

.hotel-gallery__show-all:focus-visible {
  outline: 2px solid rgba(59, 130, 246, 0.85);
  outline-offset: 2px;
}

.gallery-lightbox {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.82);
  display: grid;
  place-items: center;
  z-index: 2000;
  padding: 2rem min(4vw, 2.5rem);
}

.gallery-lightbox__frame {
  position: relative;
  width: min(1100px, 92vw);
  max-height: 88vh;
  background: transparent;
  border-radius: 1rem;
  box-shadow: 0 30px 80px rgba(15, 23, 42, 0.35);
  display: grid;
  place-items: center;
  padding: 1.5rem 3.5rem;
}

.gallery-lightbox__image {
  max-width: 100%;
  max-height: 78vh;
  object-fit: contain;
}

.gallery-lightbox__close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: #ffffff;
  color: #0f172a;
  border-radius: 999px;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  font-size: 1rem;
  cursor: pointer;
}

.gallery-lightbox__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(15, 23, 42, 0.8);
  color: #fff;
  font-size: 1.4rem;
  cursor: pointer;
  display: grid;
  place-items: center;
}

.gallery-lightbox__nav--prev {
  left: 0.85rem;
}

.gallery-lightbox__nav--next {
  right: 0.85rem;
}

.gallery-lightbox__count {
  position: absolute;
  bottom: 0.85rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.75rem;
  color: #475569;
}

@media (min-width: 1200px) {
  .hotel-gallery {
    grid-template-rows: repeat(2, minmax(180px, 250px));
  }
}

@media (max-width: 900px) {
  .hotel-gallery {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: none;
    grid-auto-rows: 150px;
  }

  .hotel-gallery__cell--primary,
  .skeleton-thumb--primary {
    grid-column: span 2;
    grid-row: span 2;
  }
}

@media (max-width: 700px) {
  .hotel-gallery {
    grid-auto-rows: 120px;
  }

  .hotel-gallery__cell--primary,
  .skeleton-thumb--primary {
    grid-row: span 2;
  }

  .hotel-gallery__show-all {
    right: 0.55rem;
    bottom: 0.55rem;
    max-width: calc(100% - 1.1rem);
    padding: 0.5rem 0.65rem;
    font-size: 0.75rem;
  }

  .gallery-lightbox__frame {
    padding: 1rem 2.5rem;
  }

  .gallery-lightbox__nav {
    width: 34px;
    height: 34px;
  }
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

.hotel-detail__stars {
  display: inline-flex;
  gap: 0.1rem;
}

.hotel-detail__star {
  color: #fbbf24;
  font-size: 0.85rem;
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

.hotel-detail__info-box--plain {
  background: transparent;
  border: 0;
  padding: 0;
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

.hotel-detail__info-list--compact {
  margin-top: 0.65rem;
}

.hotel-detail__location-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.hotel-detail__location-icon {
  color: #a5141e;
  font-size: 1rem;
  margin-top: 0.15rem;
}

.hotel-detail__location-copy {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
}

.hotel-detail__location-text {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.45;
  color: #a5141e;
  font-weight: 600;
}

.hotel-detail__map-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  width: fit-content;
  padding: 0.38rem 0.7rem;
  border-radius: 999px;
  border: 1px solid rgba(165, 20, 30, 0.22);
  background: rgba(165, 20, 30, 0.08);
  color: #7f1d1d;
  font-size: 0.78rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.hotel-detail__map-link:hover,
.hotel-detail__map-link:focus-visible {
  background: rgba(165, 20, 30, 0.14);
  border-color: rgba(165, 20, 30, 0.38);
  color: #991b1b;
}

.hotel-detail__map-link i {
  font-size: 0.72rem;
}

@media (max-width: 640px) {
  .hotel-detail__location-row {
    align-items: flex-start;
  }

  .hotel-detail__location-copy {
    align-items: flex-start;
  }
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
  border: 1px solid rgba(55, 107, 176, 0.35);
  font-size: 0.7rem;
  background: rgba(55, 107, 176, 0.12);
  color: #1e3a8a;
}

.hotel-detail__chip-icon {
  font-size: 0.75rem;
}

.hotel-detail__rooms {
  margin-top: 1rem;
}

.rooms-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.rooms-toolbar h4 {
  margin: 0;
}

.rooms-view-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.rooms-view-toggle__btn {
  width: 2.1rem;
  height: 2.1rem;
  min-width: 2.1rem;
  padding: 0;
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.5);
  background: #eef2f7;
  color: #64748b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.rooms-view-toggle__btn i {
  font-size: 0.95rem;
}

.rooms-view-toggle__btn:hover {
  background: #e2e8f0;
  color: #334155;
  border-color: rgba(148, 163, 184, 0.75);
}

.rooms-view-toggle__btn.is-active {
  background: rgba(165, 20, 30, 0.12);
  color: #a5141e;
  border-color: rgba(165, 20, 30, 0.48);
}

.rooms-view-toggle__btn:focus-visible {
  outline: 2px solid rgba(165, 20, 30, 0.3);
  outline-offset: 2px;
}

.rooms-view-toggle__help {
  position: relative;
  width: 1.9rem;
  height: 1.9rem;
  min-width: 1.9rem;
  padding: 0;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.55);
  background: #f1f5f9;
  color: #64748b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: help;
  flex-shrink: 0;
}

.rooms-view-toggle__help:hover,
.rooms-view-toggle__help:focus-visible {
  color: #334155;
  border-color: rgba(148, 163, 184, 0.75);
  background: #e2e8f0;
}

.rooms-view-toggle__help:focus-visible {
  outline: 2px solid rgba(148, 163, 184, 0.3);
  outline-offset: 2px;
}

.rooms-view-toggle__help::after {
  content: attr(data-tip);
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.45rem);
  width: min(280px, 70vw);
  padding: 0.45rem 0.55rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: #0f172a;
  color: #f8fafc;
  font-size: 0.72rem;
  line-height: 1.35;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.25);
  opacity: 0;
  visibility: hidden;
  transform: translateY(4px);
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: none;
  z-index: 3;
}

.rooms-view-toggle__help:hover::after,
.rooms-view-toggle__help:focus-visible::after {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.compare-table-wrap {
  margin-top: 0.75rem;
  overflow-x: auto;
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: #fff;
}

.compare-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 820px;
  font-size: 0.78rem;
}

.compare-table thead th {
  text-align: left;
  padding: 0.75rem 0.7rem;
  background: #376bb0;
  color: #fff;
  font-weight: 600;
  border-right: 1px solid rgba(255, 255, 255, 0.2);
}

.compare-table thead th:last-child {
  border-right: none;
}

.compare-table tbody td {
  vertical-align: top;
  padding: 0.75rem 0.7rem;
  border-top: 1px solid rgba(148, 163, 184, 0.25);
  border-right: 1px solid rgba(148, 163, 184, 0.2);
  color: #0f172a;
}

.compare-table tbody td:last-child {
  border-right: none;
}

.compare-title {
  font-weight: 700;
  color: #376bb0;
  margin-bottom: 0.35rem;
}

.compare-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.compare-table .chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  border: 1px solid rgba(165, 20, 30, 0.45);
  background: rgba(165, 20, 30, 0.12);
  color: #a5141e;
  font-size: 0.7rem;
  font-weight: 600;
}

.compare-capacity {
  white-space: nowrap;
  color: #0f172a;
  font-weight: 600;
}

.compare-price__main {
  font-weight: 700;
  color: #a5141e;
}

.compare-price__sub {
  margin-top: 0.2rem;
  color: #475569;
  font-size: 0.7rem;
}

.compare-options {
  display: grid;
  gap: 0.35rem;
  color: #0f172a;
}

.compare-action {
  text-align: center;
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
  background: #f8fafc;
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

.room-card__chips .chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  border: 1px solid rgba(165, 20, 30, 0.45);
  background: rgba(165, 20, 30, 0.12);
  color: #a5141e;
  font-size: 0.72rem;
  font-weight: 600;
}

.room-card__details {
  font-size: 0.75rem;
  color: #334155;
  display: grid;
  gap: 0.35rem;
}

.room-card__cancellation {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.room-card__cancellation-badge {
  display: inline-block;
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  font-weight: 600;
}

.room-card__cancellation-badge--free {
  background: #dcfce7;
  color: #166534;
}

.room-card__cancellation-badge--nonrefund {
  background: #fef3c7;
  color: #92400e;
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

.hotel-thumb__placeholder--error {
  display: grid;
  place-items: center;
  gap: 0.6rem;
}

.hotel-thumb__retry {
  width: fit-content;
}

.hotel-detail--skeleton {
  display: grid;
  gap: 1rem;
}

.hotel-gallery--skeleton {
  display: grid;
  gap: 0.5rem;
}

.hotel-gallery--inline-loading {
  margin-bottom: 0;
}

.hotel-gallery__loading-note {
  margin: 0;
  font-size: 0.75rem;
  color: #64748b;
}

.skeleton-line,
.skeleton-thumb,
.skeleton-chip,
.skeleton-button {
  position: relative;
  overflow: hidden;
  background: rgba(148, 163, 184, 0.18);
  border-radius: 0.6rem;
}

.skeleton-line::after,
.skeleton-thumb::after,
.skeleton-chip::after,
.skeleton-button::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-120%);
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(226, 232, 240, 0.35) 45%,
    rgba(226, 232, 240, 0.6) 55%,
    transparent 100%
  );
  animation: shimmer 1.4s ease-in-out infinite;
}

.skeleton-line {
  height: 0.7rem;
  border-radius: 999px;
}

.skeleton-line--title {
  height: 1.2rem;
  width: 60%;
}

.skeleton-line--meta {
  width: 40%;
}

.skeleton-line--subtitle {
  height: 0.85rem;
  width: 45%;
}

.skeleton-line--short {
  width: 65%;
}

.skeleton-line--room {
  width: 55%;
  height: 0.85rem;
}

.skeleton-line--price {
  width: 25%;
  height: 0.85rem;
}

.skeleton-thumb {
  height: 100%;
  min-height: 120px;
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
}

.skeleton-chip {
  display: inline-flex;
  width: 70px;
  height: 0.55rem;
  border-radius: 999px;
}

.skeleton-button {
  width: 90px;
  height: 1.8rem;
  border-radius: 999px;
}

.room-card--skeleton {
  border-color: rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.5);
}

@keyframes shimmer {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(120%);
  }
}
</style>
