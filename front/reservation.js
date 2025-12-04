// reservation.js

const $ = (sel) => document.querySelector(sel);

// Resolve API base for Apache/XAMPP vs Express
const API_BASE = (function () {
  try {
    return window.location.port === "3000" ? "" : "http://localhost:3000";
  } catch (_) { return ""; }
})();

// DOM refs
const checkinEl   = $("#checkin");
const checkoutEl  = $("#checkout");
const dateRangeEl = $("#dateRange");
const dateModal   = $("#dateModal");
const dateModalClose = $("#dateModalClose");
const dateModalApply = $("#dateModalApply");
const dateCalendarEl = $("#dateCalendar");
const langEl      = $("#language");
const currencyEl  = $("#currency");
const regionIdEl  = $("#region_id");
const regionStatusEl = $("#regionStatus");
const suggestionsDropdownEl = $("#suggestionsDropdown");
const destinationFieldEl = document.querySelector("[data-suggestions-root]");
const latEl       = $("#latitude");
const lonEl       = $("#longitude");
const radiusEl    = $("#radius");

const modeRadios  = document.querySelectorAll('input[name="mode"]');
const regionBlock = $("#regionBlock");
const geoBlock    = $("#geoBlock");

const btnSearch   = $("#btnSearch");
const btnGuests   = $("#btnGuests");
const guestsSummaryEl = $("#guestsSummary");
const PREBOOK_SUMMARY_KEY = "booking:lastPrebook";

const hotelsContainer       = $("#hotelsContainer");
const hotelDetailsContainer = $("#hotelDetails");
const logOutput             = $("#logOutput");
const searchMeta            = $("#searchMeta");
const resultsPaginationEl   = $("#resultsPagination");
const btnResultsPrev        = $("#btnResultsPrev");
const btnResultsNext        = $("#btnResultsNext");
const resultsPaginationLabel = $("#resultsPaginationLabel");
const topProgressBarEl      = document.getElementById("top-progress-bar");
// Filters refs
const starBoxes   = document.querySelectorAll('.flt-stars');
const mealBoxes   = document.querySelectorAll('.flt-meal');
const freeCancelEl = $("#flt_free_cancel");
const heroEl      = document.querySelector(".hero");
const searchBarEl = document.querySelector(".searchbar");

// Older optional elements removed from UI (kept null-safe in code)
const hotelIdEl   = $("#hotel_id");
const btnHotelDetails = $("#btnHotelDetails");

// Guests modal refs
const guestModal      = $("#guestModal");
const guestClose      = $("#guestClose");
const adultDecBtn     = $("#adultDec");
const adultIncBtn     = $("#adultInc");
const adultValueEl    = $("#adultValue");
const childrenCountEl = $("#childrenCount");
const childAgesEl     = $("#childAges");
const guestsDoneModal = $("#guestsDoneModal");

// Guests state (single room)
let adultsCount = 2;
let childrenAges = [];
let selectedHotel = null;
const DEFAULT_IMAGE_SIZE = "x300";
const HOTEL_IMAGE_LIMIT = 1;
const DETAIL_IMAGE_SIZE = "1024x768";
const DETAIL_IMAGE_LIMIT = 13;
const CARD_IMAGE_LIMIT = 13;
const HOTELS_PAGE_SIZE = 10;
// How many hotels to fetch per request (server still caps at 100).
const SERP_FETCH_LIMIT = 60;
let activeProgressRequests = 0;
let progressSlowTimer = null;

// Initialize meal-plan button active styles
document.querySelectorAll(".meal-chip input.flt-meal").forEach((input) => {
  const label = input.closest(".meal-chip");
  if (!label) return;
  if (input.checked) {
    label.classList.add("meal-chip--active");
  }
  input.addEventListener("change", () => {
    label.classList.toggle("meal-chip--active", input.checked);
  });
});

// Blur hero background while user interacts with search bar
if (heroEl && searchBarEl) {
  searchBarEl.addEventListener("focusin", () => {
    heroEl.classList.add("hero--active");
  });
  searchBarEl.addEventListener("focusout", () => {
    const active = document.activeElement;
    if (!active || !searchBarEl.contains(active)) {
      heroEl.classList.remove("hero--active");
    }
  });
  btnSearch?.addEventListener("click", () => {
    heroEl.classList.remove("hero--active");
  });
}

// Star rating filter (1–5 stars, visual)
(function initStarFilter() {
  const container = document.querySelector("[data-star-filter]");
  if (!container) return;
  const starButtons = Array.from(container.querySelectorAll(".star-filter__star"));
  const starCheckboxes = Array.from(container.querySelectorAll("input.flt-stars"));

  function applyStarSelection(maxStars) {
    // Visual: highlight all stars up to clicked value
    starButtons.forEach((btn) => {
      const value = Number(btn.getAttribute("data-star-value"));
      btn.classList.toggle("star-filter__star--active", value <= maxStars);
    });
    // Data: check underlying checkboxes whose value <= maxStars
    starCheckboxes.forEach((cb) => {
      const value = Number(cb.value);
      if (!Number.isFinite(value)) return;
      cb.checked = value <= maxStars && maxStars > 0;
    });
  }

  starButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = Number(btn.getAttribute("data-star-value"));
      const isActive = btn.classList.contains("star-filter__star--active");
      const activeCount = starButtons.filter((b) => b.classList.contains("star-filter__star--active")).length;
      const newMax = isActive && value === activeCount ? 0 : value;
      applyStarSelection(newMax);
    });
  });
})();

// Date range selection state
let calendarBaseDate = new Date();
calendarBaseDate.setDate(1);
let rangeStartDate = null;
let rangeEndDate = null;
let hoverDate = null;

function startTopProgress() {
  if (!topProgressBarEl) return;
  activeProgressRequests++;
  if (activeProgressRequests > 1) return;
  topProgressBarEl.style.transition = "none";
  topProgressBarEl.style.opacity = "1";
  topProgressBarEl.style.width = "0";
  // force reflow
  void topProgressBarEl.offsetWidth;
  topProgressBarEl.style.transition = "width 0.2s ease, opacity 0.2s ease";
  topProgressBarEl.style.width = "40%";
  if (progressSlowTimer) clearTimeout(progressSlowTimer);
  progressSlowTimer = setTimeout(() => {
    topProgressBarEl.style.width = "75%";
  }, 500);
}

function finishTopProgress() {
  if (!topProgressBarEl) return;
  if (activeProgressRequests > 0) activeProgressRequests--;
  if (activeProgressRequests > 0) return;
  if (progressSlowTimer) {
    clearTimeout(progressSlowTimer);
    progressSlowTimer = null;
  }
  topProgressBarEl.style.width = "100%";
  setTimeout(() => {
    topProgressBarEl.style.opacity = "0";
    topProgressBarEl.style.width = "0";
  }, 300);
}

function formatDateForDisplay(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return date.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch (_) {
    return value;
  }
}

function syncDateRangeDisplay() {
  if (!dateRangeEl) return;
  const checkin = checkinEl?.value;
  const checkout = checkoutEl?.value;
  if (!checkin && !checkout) {
    dateRangeEl.value = "";
    return;
  }
  const from = formatDateForDisplay(checkin);
  const to = formatDateForDisplay(checkout);
  dateRangeEl.value = from && to ? `${from} \u2192 ${to}` : from || to || "";
}

function toISODate(date) {
  if (!(date instanceof Date)) return null;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseISODate(str) {
  if (!str) return null;
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isBetween(date, start, end) {
  if (!date || !start || !end) return false;
  const t = date.getTime();
  const s = start.getTime();
  const e = end.getTime();
  return t > Math.min(s, e) && t < Math.max(s, e);
}

function renderDateCalendar() {
  if (!dateCalendarEl) return;
  const month = calendarBaseDate.getMonth();
  const year = calendarBaseDate.getFullYear();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay() || 7; // 1..7, Monday-based
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayIso = toISODate(today);

  const lang = (langEl?.value || "fr").toLowerCase();
  const monthFormatter = new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : undefined, {
    month: "long",
    year: "numeric",
  });
  const monthLabel = monthFormatter.format(firstDay);

  const container = document.createElement("div");

  const header = document.createElement("div");
  header.className = "date-calendar__header";
  const title = document.createElement("div");
  title.textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const nav = document.createElement("div");
  nav.className = "date-calendar__nav";
  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.textContent = "<";
  prevBtn.addEventListener("click", () => {
    calendarBaseDate.setMonth(calendarBaseDate.getMonth() - 1);
    renderDateCalendar();
  });
  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.textContent = ">";
  nextBtn.addEventListener("click", () => {
    calendarBaseDate.setMonth(calendarBaseDate.getMonth() + 1);
    renderDateCalendar();
  });
  nav.appendChild(prevBtn);
  nav.appendChild(nextBtn);
  header.appendChild(title);
  header.appendChild(nav);

  const grid = document.createElement("div");
  grid.className = "date-calendar__grid";

  // Day of week headers (Mon..Sun)
  const dowFormatter = new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : undefined, {
    weekday: "short",
  });
  const baseDow = new Date(2023, 0, 2); // Monday
  for (let i = 0; i < 7; i++) {
    const span = document.createElement("div");
    span.className = "date-calendar__dow";
    const d = new Date(baseDow);
    d.setDate(baseDow.getDate() + i);
    span.textContent = dowFormatter.format(d);
    grid.appendChild(span);
  }

  // Empty slots before first day
  for (let i = 1; i < startWeekday; i++) {
    const empty = document.createElement("div");
    grid.appendChild(empty);
  }

  const minDate = todayIso ? parseISODate(todayIso) : null;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = String(day);
    btn.className = "date-calendar__day";

    let disabled = false;
    if (minDate && date.setHours(0,0,0,0) < minDate.setHours(0,0,0,0)) {
      disabled = true;
    }
    if (disabled) {
      btn.classList.add("date-calendar__day--disabled");
    } else {
      const start = rangeStartDate;
      const end = rangeEndDate || hoverDate;
      if (start && isSameDay(date, start)) {
        btn.classList.add("date-calendar__day--start");
      }
      if (end && isSameDay(date, end)) {
        btn.classList.add("date-calendar__day--end");
      }
      if (start && end && isBetween(date, start, end)) {
        btn.classList.add("date-calendar__day--inrange");
      }

      btn.addEventListener("click", () => {
        if (!rangeStartDate || (rangeStartDate && rangeEndDate)) {
          rangeStartDate = date;
          rangeEndDate = null;
          hoverDate = null;
        } else {
          if (date < rangeStartDate) {
            rangeEndDate = rangeStartDate;
            rangeStartDate = date;
          } else if (date.getTime() === rangeStartDate.getTime()) {
            rangeEndDate = date;
          } else {
            rangeEndDate = date;
          }
        }
        renderDateCalendar();
      });

      btn.addEventListener("mouseenter", () => {
        if (rangeStartDate && !rangeEndDate) {
          hoverDate = date;
          renderDateCalendar();
        }
      });
    }

    grid.appendChild(btn);
  }

  container.appendChild(header);
  container.appendChild(grid);
  dateCalendarEl.innerHTML = "";
  dateCalendarEl.appendChild(container);
}
function openDateModal() {
  if (!dateModal) return;
  // Pre-fill selection from hidden values
  rangeStartDate = parseISODate(checkinEl?.value || "");
  rangeEndDate = parseISODate(checkoutEl?.value || "");
  hoverDate = null;
  // Base month from start date or today
  const base = rangeStartDate || new Date();
  calendarBaseDate = new Date(base.getFullYear(), base.getMonth(), 1);
  renderDateCalendar();
  dateModal.classList.remove("hidden");
  dateModal.setAttribute("aria-hidden", "false");
}

function closeDateModal() {
  if (!dateModal) return;
  dateModal.classList.add("hidden");
  dateModal.setAttribute("aria-hidden", "true");
}

if (dateRangeEl) {
  dateRangeEl.addEventListener("click", (event) => {
    event.preventDefault();
    openDateModal();
  });
  dateRangeEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDateModal();
    }
  });
}

if (dateModalClose) {
  dateModalClose.addEventListener("click", () => closeDateModal());
}

if (dateModalApply) {
  dateModalApply.addEventListener("click", () => {
    const start = rangeStartDate;
    const end = rangeEndDate || hoverDate;
    if (!start || !end) {
      closeDateModal();
      return;
    }
    const startIso = toISODate(start);
    const endIso = toISODate(end);
    if (checkinEl) checkinEl.value = startIso;
    if (checkoutEl) checkinEl && (checkoutEl.value = endIso);
    syncDateRangeDisplay();
    closeDateModal();
  });
}

dateModal?.addEventListener("click", (event) => {
  if (event.target === dateModal || event.target.classList?.contains("modal__backdrop")) {
    closeDateModal();
  }
});
const TRANSLATIONS = {
  en: {
    meal_nomeal: "Room only",
    meal_breakfast: "Breakfast",
    meal_half_board: "Half board",
    meal_full_board: "Full board",
    meal_all_inclusive: "All inclusive",
    meal_default: "Meal plan",
    free_cancellation: "Free cancellation",
    no_cancellation: "No cancellation",
    capacity_prefix: "max",
    button_view_details: "View details",
    room_label: "Room",
    nights_label: (n) => `for ${n} night${n > 1 ? "s" : ""}`,
    distance_from_center: (dist) => `${dist} from center`,
    detail_header: "Hotel details & rates",
    detail_hint: "select a hotel",
    detail_placeholder: "No hotel selected.",
    detail_highlights_title: "Highlights",
    detail_know_title: "Know before you go",
    detail_rooms_title: "Available rooms & rates",
    detail_no_highlights: "No extra facts for this hotel.",
    detail_no_policies: "No special policies reported.",
    detail_no_rates: "No rates returned for this search.",
    detail_no_data: "No hotel data.",
    detail_no_hotel: "No hotel found.",
    search_no_hotels: "No hotels found.",
    detail_gallery_loading: "Loading photos...",
    detail_gallery_none: "No photos available.",
    detail_gallery_error: "Unable to load photos.",
    detail_offers_label: (count) => `Offers: ${count}`,
    detail_from_label: (price) => `From ${price}`,
    detail_id_label: (id) => `ID: ${id}`,
    thumb_loading: "Loading photo...",
    thumb_no_photo: "No photo",
    free_cancel_before: (date) => `Free cancellation before ${date}.`,
    cancel_charge_after: (amount, date) => `Cancellation charge ${amount} after ${date}.`,
    tax_payable: (label, amount) => `${label}: ${amount} payable at property.`,
    deposit_amount: (amount, type) => `Deposit (${type || "deposit"}): ${amount}.`,
    no_show_fee: (amount, time) => `No-show fee ${amount} after ${time || "deadline"}.`,
    payment_type: (type, cardNeeded) => `Payment type: ${type}${cardNeeded ? " (card required)" : ""}.`,
    cancellation_fees: "Cancellation fees may apply.",
    taxes_fees_label: "Taxes & fees",
    bedding_label: "Bedding",
    provider_label: "Provider",
    selected_hotel_status: (name) => `Selected hotel: ${name}`,
    bathroom_label: "Bathroom",
    filter_breakfast: "Breakfast available",
    filter_wifi: "Wi-Fi",
    filter_bathroom: "Private bathroom",
    filter_free_cancel: "Free cancellation",
    filter_refundable: "Refundable",
    rooms_left: (n) => `${n} left`,
    sleeps_label: (n) => `Sleeps ${n}`,
    guest_breakdown: (adults, children) => {
      const parts = [];
      if (adults) parts.push(`${adults} adult${adults > 1 ? "s" : ""}`);
      if (children) parts.push(`${children} child${children > 1 ? "ren" : ""}`);
      return parts.join(" + ");
    },
    requested_occupancy_label: (text) => (text ? `Requested: ${text}` : ""),
    room_capacity_detail: (capacity, requestedText) =>
      requestedText && requestedText.length
        ? `Sleeps ${capacity} · ${requestedText}`
        : `Sleeps ${capacity}`,
    status_no_matches: "No matching regions or hotels.",
    error_no_region: "No region found for that destination.",
    error_no_coords: "No coordinates available for that destination.",
    error_enter_destination: "Please enter a destination.",
    error_enter_coords_or_destination: "Enter coordinates or a destination name.",
    error_invalid_coords: "Please enter valid coordinates or search by destination.",
    error_destination_lookup: "Destination lookup failed.",
    prebook_button: "Book",
    prebook_success: "Prebook created. Review prebook token in logs.",
    prebook_error: "Prebook failed.",
  },
  fr: {
    meal_nomeal: "Chambre seule",
    meal_breakfast: "Petit-dejeuner",
    meal_half_board: "Demi-pension",
    meal_full_board: "Pension complete",
    meal_all_inclusive: "Tout compris",
    meal_default: "Repas",
    free_cancellation: "Annulation gratuite",
    no_cancellation: "Non remboursable",
    capacity_prefix: "max",
    button_view_details: "Voir les details",
    room_label: "Chambre",
    nights_label: (n) => `pour ${n} nuit${n > 1 ? "s" : ""}`,
    distance_from_center: (dist) => `${dist} du centre`,
    detail_header: "Details & tarifs",
    detail_hint: "selectionnez un hotel",
    detail_placeholder: "Aucun hotel selectionne.",
    detail_highlights_title: "Points forts",
    detail_know_title: "A savoir",
    detail_rooms_title: "Chambres et tarifs",
    detail_no_highlights: "Aucune information supplementaire.",
    detail_no_policies: "Aucune politique particuliere.",
    detail_no_rates: "Aucune offre pour cette recherche.",
    detail_no_data: "Aucune donnee hotel.",
    detail_no_hotel: "Aucun hotel trouve.",
    search_no_hotels: "Aucun hotel trouve.",
    detail_gallery_loading: "Chargement des photos...",
    detail_gallery_none: "Aucune photo disponible.",
    detail_gallery_error: "Impossible de charger les photos.",
    detail_offers_label: (count) => `Offres : ${count}`,
    detail_from_label: (price) => `A partir de ${price}`,
    detail_id_label: (id) => `ID : ${id}`,
    thumb_loading: "Chargement...",
    thumb_no_photo: "Pas de photo",
    free_cancel_before: (date) => `Annulation gratuite avant ${date}.`,
    cancel_charge_after: (amount, date) => `Frais d'annulation ${amount} apres ${date}.`,
    tax_payable: (label, amount) => `${label} : ${amount} a regler sur place.`,
    deposit_amount: (amount, type) => `Depot (${type || "depot"}) : ${amount}.`,
    no_show_fee: (amount, time) => `Frais de non-presentation ${amount} apres ${time || "limite"}.`,
    payment_type: (type, cardNeeded) => `Type de paiement : ${type}${cardNeeded ? " (carte requise)" : ""}.`,
    cancellation_fees: "Frais d'annulation possibles.",
    taxes_fees_label: "Taxes et frais",
    bedding_label: "Literie",
    provider_label: "Fournisseur",
    selected_hotel_status: (name) => `Hotel selectionne : ${name}`,
    bathroom_label: "Salle de bain",
    filter_breakfast: "Petit-dejeuner",
    filter_wifi: "Wi-Fi",
    filter_bathroom: "Salle de bain privee",
    filter_free_cancel: "Annulation gratuite",
    filter_refundable: "Remboursable",
    rooms_left: (n) => `${n} restant${n > 1 ? "s" : ""}`,
    sleeps_label: (n) => `Capacite ${n}`,
    guest_breakdown: (adults, children) => {
      const parts = [];
      if (adults) parts.push(`${adults} adulte${adults > 1 ? "s" : ""}`);
      if (children) parts.push(`${children} enfant${children > 1 ? "s" : ""}`);
      return parts.join(" + ");
    },
    requested_occupancy_label: (text) => (text ? `Demande : ${text}` : ""),
    room_capacity_detail: (capacity, requestedText) =>
      requestedText && requestedText.length
        ? `Capacite ${capacity} · ${requestedText}`
        : `Capacite ${capacity}`,
    status_no_matches: "Aucune region ou hotel correspondant.",
    error_no_region: "Aucune region trouvee pour cette destination.",
    error_no_coords: "Pas de coordonnees disponibles pour cette destination.",
    error_enter_destination: "Veuillez saisir une destination.",
    error_enter_coords_or_destination: "Saisissez des coordonnees ou une destination.",
    error_invalid_coords: "Coordonnees invalides. Saisissez des valeurs valides ou recherchez par destination.",
    error_destination_lookup: "Recherche de destination impossible.",
    prebook_button: "Réserver",
    prebook_success: "Prebook cree. Consultez le token dans les logs.",
    prebook_error: "Echec du prebook.",
  },
};
const hotelImageCache = new Map();
let latestHotelsRenderToken = 0;
let latestHotelDetailsToken = 0;
let lastRenderedHotels = [];
const cardImageState = new WeakMap();
let currentHotelsStore = [];
let currentHotelsPage = 0;
let lastSearchEndpoint = "";
let lastHotelDetailsResults = null;
let currentHotelDetail = null;
let currentHotelRates = [];

// Toggle mode region/geo
modeRadios.forEach(r => {
  r.addEventListener("change", () => {
    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'region';
    if (mode === "region") {
      if (regionBlock) regionBlock.style.display = "";
      if (geoBlock) geoBlock.style.display = "none";
    } else {
      if (regionBlock) regionBlock.style.display = "none";
      if (geoBlock) geoBlock.style.display = "";
    }
  });
});

// Logger
function log(data, label = "") {
  const time = new Date().toISOString();
  if (!logOutput) return;
  logOutput.textContent = `[${time}] ${label}\n` + JSON.stringify(data, null, 2) + "\n\n" + logOutput.textContent;
}

function setRegionStatus(message = "") {
  if (regionStatusEl) regionStatusEl.textContent = message;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

let currentRegionSuggestions = [];
let currentHotelSuggestions = [];

function renderRegionSuggestions(list = []) {
  currentRegionSuggestions = Array.isArray(list) ? list.slice(0, 8) : [];
  refreshSuggestionsDropdown();
}

function renderHotelSuggestions(list = []) {
  currentHotelSuggestions = Array.isArray(list) ? list.slice(0, 5) : [];
  refreshSuggestionsDropdown();
}

function clearSuggestionsDropdown() {
  currentRegionSuggestions = [];
  currentHotelSuggestions = [];
  refreshSuggestionsDropdown();
}

function hideSuggestionsDropdown() {
  if (!suggestionsDropdownEl) return;
  suggestionsDropdownEl.classList.add("hidden");
  suggestionsDropdownEl.setAttribute("aria-hidden", "true");
  regionIdEl?.setAttribute("aria-expanded", "false");
}

function refreshSuggestionsDropdown() {
  if (!suggestionsDropdownEl) return;
  if (!currentRegionSuggestions.length && !currentHotelSuggestions.length) {
    suggestionsDropdownEl.innerHTML = "";
    hideSuggestionsDropdown();
    return;
  }

  const sections = [];
  if (currentRegionSuggestions.length) {
    sections.push(`
      <div class="suggestions-section">
        <div class="suggestions-title">Regions</div>
        ${currentRegionSuggestions
          .map((region, idx) => {
            const title = region.name || region.full_name || region.fullName || "Region";
            const metaParts = [];
            if (region.country_code) metaParts.push(region.country_code);
            if (region.id) metaParts.push(`#${region.id}`);
            return `
              <button type="button" role="option" class="suggestion-option" data-suggestion-type="region" data-suggestion-index="${idx}">
                <span class="suggestion-option__name">${escapeHtml(title)}</span>
                <span class="suggestion-option__meta">${escapeHtml(metaParts.join(" · "))}</span>
              </button>`;
          })
          .join("")}
      </div>`);
  }

  if (currentHotelSuggestions.length) {
    sections.push(`
      <div class="suggestions-section">
        <div class="suggestions-title">Hotels</div>
        ${currentHotelSuggestions
          .map((hotel, idx) => {
            const idMeta = hotel.region_id ? `Region ${hotel.region_id}` : "";
            return `
              <button type="button" role="option" class="suggestion-option" data-suggestion-type="hotel" data-suggestion-index="${idx}">
                <span class="suggestion-option__name">${escapeHtml(hotel.name || "Hotel")}</span>
                <span class="suggestion-option__meta">${escapeHtml(`HID ${hotel.hid || "?"}${idMeta ? ` · ${idMeta}` : ""}`)}</span>
              </button>`;
          })
          .join("")}
      </div>`);
  }

  suggestionsDropdownEl.innerHTML = sections.join("");
  suggestionsDropdownEl.classList.remove("hidden");
  suggestionsDropdownEl.setAttribute("aria-hidden", "false");
  regionIdEl?.setAttribute("aria-expanded", "true");
}

// Guests helpers
function updateGuestsSummary() {
  const kids = childrenAges.length;
  const kidLabel = kids ? `${kids} child${kids>1?'ren':''}` : '0 children';
  if (guestsSummaryEl) guestsSummaryEl.textContent = `${adultsCount} adult${adultsCount>1?'s':''} · ${kidLabel}`;
}

function renderAgeSelectors(count) {
  const current = childrenAges.slice(0, count);
  while (current.length < count) current.push(8);
  childrenAges = current;
  const opts = Array.from({length:18}).map((_,a)=>`<option value="${a}">${a}</option>`).join('');
  childAgesEl.innerHTML = childrenAges.map((age, i)=>`
    <div class="age-item">
      <label>Child ${i+1}</label>
      <select data-age-index="${i}">${opts}</select>
    </div>`).join('');
  childAgesEl.querySelectorAll('select[data-age-index]').forEach(sel => {
    const idx = parseInt(sel.getAttribute('data-age-index'),10);
    sel.value = String(childrenAges[idx] ?? 8);
    sel.addEventListener('change', () => {
      const v = parseInt(sel.value,10);
      childrenAges[idx] = isNaN(v) ? 8 : Math.max(0, Math.min(17, v));
      updateGuestsSummary();
    });
  });
}

function openGuestModal() {
  if (!guestModal) return;
  adultValueEl.textContent = String(adultsCount);
  childrenCountEl.value = String(childrenAges.length || 0);
  renderAgeSelectors(childrenAges.length || 0);
  guestModal.classList.remove('hidden');
  guestModal.setAttribute('aria-hidden','false');
}
function closeGuestModal() {
  if (!guestModal) return;
  guestModal.classList.add('hidden');
  guestModal.setAttribute('aria-hidden','true');
}

btnGuests?.addEventListener('click', (e)=>{ e.preventDefault(); openGuestModal(); });
guestClose?.addEventListener('click', ()=> closeGuestModal());
guestsDoneModal?.addEventListener('click', ()=> closeGuestModal());
guestModal?.addEventListener('click', (e)=>{ if (e.target===guestModal || e.target.classList?.contains('modal__backdrop')) closeGuestModal(); });

adultIncBtn?.addEventListener('click', ()=>{ adultsCount = Math.min(8, (adultsCount||1)+1); adultValueEl.textContent = String(adultsCount); updateGuestsSummary(); });
adultDecBtn?.addEventListener('click', ()=>{ adultsCount = Math.max(1, (adultsCount||1)-1); adultValueEl.textContent = String(adultsCount); updateGuestsSummary(); });

childrenCountEl?.addEventListener('change', ()=>{
  let n = parseInt(childrenCountEl.value,10); if (isNaN(n) || n<0) n=0; if (n>8) n=8; childrenCountEl.value=String(n);
  renderAgeSelectors(n);
  updateGuestsSummary();
});

// Build guests payload for ETG
function buildGuests() {
  return [{
    adults: Math.max(1, parseInt(adultsCount, 10) || 1),
    children: (childrenAges || []).map(a => Math.max(0, Math.min(17, parseInt(a, 10) || 0)))
  }];
}

function requestedGuestCounts() {
  const adults = Math.max(1, parseInt(adultsCount, 10) || 1);
  const children = (childrenAges || []).length;
  return {
    adults,
    children,
    total: adults + children,
  };
}

function formatRequestedGuestsLabel() {
  const counts = requestedGuestCounts();
  const summary = tr("guest_breakdown", counts.adults, counts.children);
  return {
    summary,
    counts,
  };
}

// Extract/render helpers
function extractHotels(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.hotels)) return payload.hotels;
  if (Array.isArray(payload.results)) return payload.results;
  if (payload.results) return extractHotels(payload.results);
  if (payload.data) return extractHotels(payload.data);
  return [];
}

// Derive hotel stars similar to backend logic
function deriveHotelStars(hotel) {
  const direct = hotel?.stars ?? hotel?.category ?? hotel?.rg_ext?.class;
  const directNum = Number(direct);
  if (Number.isFinite(directNum) && directNum > 0) return directNum;
  const vals = Array.isArray(hotel?.rates)
    ? hotel.rates
        .map(r => Number(r?.rg_ext?.class))
        .filter(n => Number.isFinite(n) && n > 0)
    : [];
  return vals.length ? Math.max(...vals) : null;
}

function hotelDisplayName(hotel) {
  const fallbackId = hotel?.id || hotel?.hid || hotel?.hotel_id || hotel?.hotelId;
  return (
    hotel?.name ||
    hotel?.hotel_name ||
    hotel?.hotel_name_trans ||
    hotel?.full_name ||
    hotel?.fullName ||
    (typeof fallbackId === "string" ? fallbackId.replace(/_/g, " ") : fallbackId) ||
    "Hotel"
  );
}

function formatDistanceFromCenter(hotel) {
  if (!hotel || typeof hotel !== "object") return null;
  let meters = null;
  const tryNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };
  meters = tryNumber(hotel.distance_center);
  if (meters === null) meters = tryNumber(hotel.distance_center_meters);
  if (meters === null) {
    const km = tryNumber(hotel.distance_center_km);
    meters = km !== null ? km * 1000 : null;
  }
  if (meters === null || !Number.isFinite(meters) || meters <= 0) return null;
  if (meters >= 1000) {
    const km = meters / 1000;
    const value = `${km.toFixed(km >= 10 ? 0 : 1)} km`;
    return tr("distance_from_center", value);
  }
  const value = `${Math.round(meters)} m`;
  return tr("distance_from_center", value);
}

function getRateCapacity(rate) {
  if (!rate) return null;
  const candidates = [
    rate?.rg_ext?.capacity,
    rate?.rg_ext?.occupancy,
    rate?.capacity,
    rate?.max_occupancy,
    rate?.occupancy,
  ];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return null;
}

function renderStarIcons(stars) {
  const value = Number(stars);
  if (!Number.isFinite(value) || value <= 0) return "";
  const count = Math.max(1, Math.round(value));
  const starsHtml = Array.from({ length: count })
    .map(() => "<span>★</span>")
    .join("");
  return `<span class="star-rating" aria-label="${escapeHtml(String(value))} star rating">${starsHtml}</span>`;
}

function chipIcon(type) {
  switch (type) {
    case "meal":
      return `<svg class="chip__icon" viewBox="0 0 16 16" role="presentation"><circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2.5 3.5v9M13.5 3.5v9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
    case "check":
      return `<svg class="chip__icon" viewBox="0 0 16 16" role="presentation"><path d="M3.2 8.5l3 3 6.6-6.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case "ban":
      return `<svg class="chip__icon" viewBox="0 0 16 16" role="presentation"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.5 11.5l7-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    default:
      return "";
  }
}

function getSelectedImageSize() {
  return DEFAULT_IMAGE_SIZE;
}

function normalizeNumericId(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function pickFirstString(...values) {
  for (const val of values) {
    if (val === undefined || val === null) continue;
    const str = String(val).trim();
    if (!str) continue;
    return str;
  }
  return null;
}

function buildHotelImageIdentity(hotel) {
  if (!hotel || typeof hotel !== "object") return { hid: null, fallbackId: null, cacheKey: null };
  const hidCandidates = [hotel.hid, hotel.hotel_id, hotel.hotelId, hotel.id];
  let hid = null;
  for (const candidate of hidCandidates) {
    const normalized = normalizeNumericId(candidate);
    if (normalized !== null) {
      hid = normalized;
      break;
    }
  }
  const fallbackId = pickFirstString(hotel.id, hotel.hotel_id, hotel.hotelId, hotel.hid);
  const cacheKey = hid !== null ? `hid:${hid}` : fallbackId ? `id:${fallbackId}` : null;
  return { hid, fallbackId, cacheKey };
}

async function requestHotelImagesFromApi(payload) {
  const endpoint = `${API_BASE}/api/hotel/images`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const rawText = await response.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (_err) {
    throw new Error("Invalid image payload");
  }
  if (!response.ok) {
    throw new Error(data?.error || data?._raw || "Image lookup failed");
  }
  const images = Array.isArray(data?.images)
    ? data.images.filter((url) => typeof url === "string" && url.length)
    : [];
  return images;
}

async function fetchHotelImages(hotel, lang, size, limit = 1) {
  const identity = buildHotelImageIdentity(hotel);
  if (!identity.cacheKey) return [];
  const safeLang = (lang || "en").trim() || "en";
  const safeSize = size || DEFAULT_IMAGE_SIZE;
  const parsedLimit = Number(limit);
  const hasLimit = Number.isFinite(parsedLimit) && parsedLimit > 0;
  const cappedLimit = hasLimit ? Math.max(1, Math.min(parsedLimit, 50)) : null;
  const cacheKey = `${identity.cacheKey}|${safeLang}|${safeSize}|${cappedLimit ?? "all"}`;
  if (hotelImageCache.has(cacheKey)) {
    const cached = hotelImageCache.get(cacheKey);
    return typeof cached?.then === "function" ? cached : cached;
  }
  if (identity.hid === null && !identity.fallbackId) return [];
  const payload = {
    language: safeLang,
    size: safeSize,
  };
  if (cappedLimit !== null) payload.limit = cappedLimit;
  if (identity.hid !== null) payload.hid = identity.hid;
  else if (identity.fallbackId) payload.id = identity.fallbackId;
  const fetchPromise = (async () => {
    try {
      return await requestHotelImagesFromApi(payload);
    } catch (err) {
      console.warn("Hotel image fetch failed", err);
      return [];
    }
  })();
  hotelImageCache.set(cacheKey, fetchPromise);
  const result = await fetchPromise;
  hotelImageCache.set(cacheKey, result);
  return Array.isArray(result) ? result : [];
}

async function getHotelImageUrl(hotel, lang, size) {
  const images = await fetchHotelImages(hotel, lang, size, HOTEL_IMAGE_LIMIT);
  return images[0] || null;
}

function setThumbLoadingState(cardEl, message = tr("thumb_loading")) {
  cardImageState.delete(cardEl);
  const target = cardEl?.querySelector("[data-thumb-image]");
  if (target) {
    target.innerHTML = `<div class="hotel-thumb__placeholder">${escapeHtml(message)}</div>`;
  }
  const counter = cardEl?.querySelector("[data-thumb-counter]");
  counter?.classList.add("is-hidden");
  const prev = cardEl?.querySelector("[data-thumb-prev]");
  const next = cardEl?.querySelector("[data-thumb-next]");
  prev?.classList.add("is-hidden");
  next?.classList.add("is-hidden");
}

function updateCardThumbUI(cardEl, state) {
  const viewport = cardEl?.querySelector("[data-thumb-image]");
  const counter = cardEl?.querySelector("[data-thumb-counter]");
  const prev = cardEl?.querySelector("[data-thumb-prev]");
  const next = cardEl?.querySelector("[data-thumb-next]");
  if (!viewport) return;
  if (!state || !Array.isArray(state.images) || !state.images.length) {
    viewport.innerHTML = `<div class="hotel-thumb__placeholder">${escapeHtml(tr("thumb_no_photo"))}</div>`;
    counter?.classList.add("is-hidden");
    prev?.classList.add("is-hidden");
    next?.classList.add("is-hidden");
    return;
  }
  const total = state.images.length;
  const currentIdx = Math.min(Math.max(state.index || 0, 0), total - 1);
  state.index = currentIdx;
  const currentUrl = state.images[currentIdx];
  viewport.innerHTML = `<img src="${escapeHtml(currentUrl)}" alt="${escapeHtml(`${state.title || "Hotel"} photo ${currentIdx + 1}`)}" loading="lazy" decoding="async">`;
  if (counter) {
    counter.textContent = `${currentIdx + 1} / ${total}`;
    counter.classList.toggle("is-hidden", total <= 1);
  }
  const hideNav = total <= 1;
  prev?.classList.toggle("is-hidden", hideNav);
  next?.classList.toggle("is-hidden", hideNav);
}

function setCardImages(cardEl, hotel, images) {
  const safeImages = Array.isArray(images) ? images.filter((u) => typeof u === "string" && u.length) : [];
  const state = {
    images: safeImages,
    index: 0,
    title: hotelDisplayName(hotel),
  };
  cardImageState.set(cardEl, state);
  updateCardThumbUI(cardEl, state);
}

async function loadHotelImagesForCard(hotel, index, lang, size, token) {
  if (!hotelsContainer) return;
  const card = hotelsContainer.querySelector(`[data-hotel-index="${index}"]`);
  if (!card) return;
  setThumbLoadingState(card);
  const images = await fetchHotelImages(hotel, lang, size, CARD_IMAGE_LIMIT);
  if (token !== latestHotelsRenderToken) return;
  if (images.length) setCardImages(card, hotel, images);
  else setThumbLoadingState(card, tr("thumb_no_photo"));
}

function hydrateHotelImages(hotels, token) {
  if (!Array.isArray(hotels) || !hotels.length) return;
  const lang = langEl?.value || "en";
  const size = getSelectedImageSize();
  hotels.forEach((hotel, index) => {
    loadHotelImagesForCard(hotel, index, lang, size, token).catch(() => {});
  });
}

function handleThumbNav(event) {
  const control = event.target.closest("[data-thumb-prev],[data-thumb-next]");
  if (!control) return;
  event.preventDefault();
  const card = control.closest(".hotel-item");
  if (!card) return;
  const state = cardImageState.get(card);
  if (!state || !Array.isArray(state.images) || state.images.length <= 1) return;
  const delta = control.hasAttribute("data-thumb-prev") ? -1 : 1;
  const total = state.images.length;
  state.index = (state.index + delta + total) % total;
  updateCardThumbUI(card, state);
}

hotelsContainer?.addEventListener("click", handleThumbNav);
btnResultsPrev?.addEventListener("click", () => {
  if (currentHotelsPage <= 0) return;
  renderHotelsEx(null, { page: currentHotelsPage - 1 });
});
btnResultsNext?.addEventListener("click", () => {
  const totalPages = Math.ceil((currentHotelsStore.length || 0) / HOTELS_PAGE_SIZE);
  if (currentHotelsPage >= totalPages - 1) return;
  renderHotelsEx(null, { page: currentHotelsPage + 1 });
});
hotelDetailsContainer?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-prebook-index]");
  if (!btn) return;
  const idx = Number(btn.getAttribute("data-prebook-index"));
  if (!Number.isFinite(idx)) return;
  prebookRateAtIndex(idx, btn);
});

async function hydrateHotelDetailGallery(hotel, token) {
  if (!hotelDetailsContainer || !hotel) return;
  const galleryEl = hotelDetailsContainer.querySelector("[data-hotel-gallery]");
  if (!galleryEl) return;
  galleryEl.innerHTML = `<div class="hotel-thumb__placeholder">${escapeHtml(tr("detail_gallery_loading"))}</div>`;
  try {
    const lang = langEl?.value || "en";
    const images = await fetchHotelImages(hotel, lang, DETAIL_IMAGE_SIZE, DETAIL_IMAGE_LIMIT);
    if (token !== latestHotelDetailsToken) return;
    if (!images.length) {
      galleryEl.innerHTML = `<div class="hotel-thumb__placeholder">${escapeHtml(tr("detail_gallery_none"))}</div>`;
      return;
    }
    galleryEl.innerHTML = images
      .map((url, idx) => {
        const safeUrl = escapeHtml(url);
        const alt = escapeHtml(`${hotelDisplayName(hotel)} photo ${idx + 1}`);
        return `<div class="hotel-gallery__item"><img src="${safeUrl}" alt="${alt}" loading="lazy" decoding="async"></div>`;
      })
      .join("");
  } catch (_err) {
    if (token !== latestHotelDetailsToken) return;
    galleryEl.innerHTML = `<div class="hotel-thumb__placeholder">${escapeHtml(tr("detail_gallery_error"))}</div>`;
  }
}

function updatePaginationControls(totalPages) {
  if (!resultsPaginationEl || !btnResultsPrev || !btnResultsNext || !resultsPaginationLabel) return;
  if (!totalPages || totalPages <= 1) {
    resultsPaginationEl.style.display = "none";
    return;
  }
  resultsPaginationEl.style.display = "flex";
  resultsPaginationLabel.textContent = `Page ${currentHotelsPage + 1} / ${totalPages}`;
  btnResultsPrev.disabled = currentHotelsPage <= 0;
  btnResultsNext.disabled = currentHotelsPage >= totalPages - 1;
}

async function prebookRateAtIndex(index, triggerEl) {
  const rate = currentHotelRates?.[index];
  const hotel = currentHotelDetail;
  if (!rate || !hotel) return;
  const hash = rate.book_hash || rate.hash || rate.match_hash;
  if (!hash) {
    setRegionStatus(tr("prebook_error"));
    return;
  }
  const payload = {
    book_hash: hash,
    price_increase_percent: 0,
    hp_context: {
      id: hotel.id || hotel.hid,
      hid: hotel.hid,
      checkin: checkinEl?.value,
      checkout: checkoutEl?.value,
      guests: buildGuests(),
      currency: currencyEl?.value,
      language: langEl?.value,
    },
  };
  log(payload, "REQUEST /api/prebook");
  try {
    triggerEl?.setAttribute("disabled", "disabled");
    const { statusCode, data } = await safeJsonFetch(
      `${API_BASE}/api/prebook`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      "RESPONSE /api/prebook"
    );
    if (statusCode >= 400 || !data || data.error) {
      setRegionStatus(`${tr("prebook_error")} (${data?.error || data?._raw || statusCode})`);
      triggerEl?.removeAttribute("disabled");
      return;
    }
    setRegionStatus(tr("prebook_success"));
    if (data?.prebook_token) {
      persistPrebookSummary(data, hotel, rate);
      const baseUrl = new URL(window.location.href);
      const parts = baseUrl.pathname.split("/").filter(Boolean);
      if (parts.length) {
        parts[parts.length - 1] = "booking.html";
      } else {
        parts.push("booking.html");
      }
      baseUrl.pathname = `/${parts.join("/")}`;
      baseUrl.search = `token=${encodeURIComponent(data.prebook_token)}`;
      window.location.assign(baseUrl.toString());
    }
  } catch (err) {
    setRegionStatus(`${tr("prebook_error")} (${err.message || "ERR"})`);
  } finally {
    triggerEl?.removeAttribute("disabled");
  }
}

function persistPrebookSummary(apiResponse, hotel, rate) {
  if (typeof sessionStorage === "undefined") return;
  try {
    const guestLabel = (() => {
      try {
        return formatRequestedGuestsLabel()?.summary || "";
      } catch (_) {
        return "";
      }
    })();
    const payment = rate?.payment_options?.payment_types?.[0] || {};
    const summary = {
      token: apiResponse?.prebook_token || null,
      created_at: Date.now(),
      hotel: {
        id: hotel?.id || null,
        hid: hotel?.hid || null,
        name: hotel ? hotelDisplayName(hotel) : null,
        city: hotel?.city_name || hotel?.city || hotel?.location || hotel?.address?.city || null,
        address: hotel?.address || hotel?.address_line || hotel?.address_full || null,
        country: hotel?.country || hotel?.country_name || null,
      },
      stay: {
        checkin: checkinEl?.value || null,
        checkout: checkoutEl?.value || null,
        currency: currencyEl?.value || payment?.show_currency_code || payment?.currency_code || null,
        guests: buildGuests(),
        guest_label: guestLabel,
      },
      room: {
        name: rate?.room_name || rate?.room_data_trans?.main_name || rate?.name || null,
        meal: rate?.meal || null,
        price: payment?.show_amount || payment?.amount || null,
        currency: payment?.show_currency_code || payment?.currency_code || null,
        amenities: rate?.amenities_data || null,
        daily_prices: rate?.daily_prices || null,
        guests_label: guestLabel,
      },
      payload: apiResponse || null,
    };
    sessionStorage.setItem(PREBOOK_SUMMARY_KEY, JSON.stringify(summary));
  } catch (_) {
    /* ignore */
  }
}

function formatCurrency(amount, currency) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return amount || "";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 2,
    }).format(num);
  } catch (_) {
    return `${num} ${currency || ""}`.trim();
  }
}

function formatIsoDate(value, includeTime = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const opts = includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" };
  try {
    return new Intl.DateTimeFormat(undefined, opts).format(date);
  } catch (_) {
    return date.toISOString();
  }
}

function friendlyMeal(value) {
  switch ((value || "").toLowerCase()) {
    case "nomeal": return tr("meal_nomeal");
    case "breakfast": return tr("meal_breakfast");
    case "half_board": return tr("meal_half_board");
    case "full_board": return tr("meal_full_board");
    case "all-inclusive":
    case "all_inclusive": return tr("meal_all_inclusive");
    default: return value || tr("meal_default");
  }
}

function friendlySerpFilter(code) {
  switch (code) {
    case "has_breakfast": return tr("filter_breakfast");
    case "has_internet": return tr("filter_wifi");
    case "has_bathroom": return tr("filter_bathroom");
    case "free_cancellation": return tr("filter_free_cancel");
    case "refundable": return tr("filter_refundable");
    default:
      return code ? code.replace(/_/g, " ") : null;
  }
}

function collectHotelHighlights(rates) {
  const tags = new Set();
  (rates || []).forEach((rate) => {
    (rate?.serp_filters || []).forEach((flt) => {
      const label = friendlySerpFilter(flt);
      if (label) tags.add(label);
    });
    (rate?.amenities_data || []).forEach((amenity) => {
      if (amenity) tags.add(amenity.replace(/_/g, " "));
    });
  });
  return Array.from(tags);
}

function buildKnowBeforeList(rate) {
  const notes = [];
  const payment = rate?.payment_options?.payment_types?.[0];
  const penalties = payment?.cancellation_penalties;
  if (penalties?.free_cancellation_before) {
    notes.push(tr("free_cancel_before", formatIsoDate(penalties.free_cancellation_before, true)));
  } else if (Array.isArray(penalties?.policies) && penalties.policies.length) {
    const lastPolicy = penalties.policies[penalties.policies.length - 1];
    if (lastPolicy?.amount_show) {
      const cutoff = formatIsoDate(lastPolicy.start_at, true) || "";
      notes.push(tr("cancel_charge_after", formatCurrency(lastPolicy.amount_show, payment?.show_currency_code), cutoff));
    }
  }
  const taxes = payment?.tax_data?.taxes || [];
  taxes
    .filter((tax) => tax && tax.included_by_supplier === false)
    .forEach((tax) => {
      const label = (tax.name || "local tax").replace(/_/g, " ");
      notes.push(tr("tax_payable", label, formatCurrency(tax.amount, tax.currency_code)));
    });
  if (rate?.deposit?.price) {
    notes.push(tr("deposit_amount", formatCurrency(rate.deposit.price, rate.deposit.currency), rate.deposit.deposit_type));
  }
  if (rate?.no_show?.amount) {
    notes.push(tr("no_show_fee", formatCurrency(rate.no_show.amount, rate.no_show.currency_code), rate.no_show.from_time));
  }
  if (payment?.type) {
    notes.push(tr("payment_type", payment.type, payment.is_need_credit_card_data));
  }
  return notes.filter(Boolean).slice(0, 6);
}

function renderRateCard(rate, index) {
  const payment = rate?.payment_options?.payment_types?.[0];
  const price = formatCurrency(payment?.show_amount || payment?.amount, payment?.show_currency_code || payment?.currency_code);
  const roomName = rate?.room_name || rate?.room_data_trans?.main_name || tr("room_label");
  const mealLabel = friendlyMeal(rate?.meal_data?.value || rate?.meal);
  const chips = [];
  const capacityValue = getRateCapacity(rate);
  if (mealLabel) chips.push(mealLabel);
  if (capacityValue) chips.push(tr("sleeps_label", capacityValue));
  if (rate?.rg_ext?.class) chips.push(`${rate.rg_ext.class}★`);
  if (rate?.allotment) chips.push(tr("rooms_left", rate.allotment));
  const freeBefore = payment?.cancellation_penalties?.free_cancellation_before;
  const cancellationText = freeBefore
    ? tr("free_cancel_before", formatIsoDate(freeBefore, true))
    : tr("cancellation_fees");
  const taxes = (payment?.tax_data?.taxes || [])
    .map((tax) => `${tax.name || "tax"} ${formatCurrency(tax.amount, tax.currency_code)}${tax.included_by_supplier ? " (included)" : ""}`)
    .slice(0, 3);
  const { summary: requestSummary } = formatRequestedGuestsLabel();
  const capacityDetail = capacityValue
    ? tr("room_capacity_detail", capacityValue, requestSummary)
    : requestSummary
    ? tr("requested_occupancy_label", requestSummary)
    : "";
  return `
    <div class="room-card">
      <div class="room-card__header">
        <div class="room-card__title">${escapeHtml(roomName)}</div>
        <div class="room-card__price">${escapeHtml(price || "?")}</div>
      </div>
      <div class="room-card__chips">
        ${chips.map((chip) => `<span class="chip">${escapeHtml(chip)}</span>`).join("")}
      </div>
      <div class="room-card__details">
        <div>${escapeHtml(cancellationText)}</div>
        ${capacityDetail ? `<div>${escapeHtml(capacityDetail)}</div>` : ""}
        ${taxes.length ? `<div>${escapeHtml(tr("taxes_fees_label"))}: ${taxes.map(escapeHtml).join(", ")}</div>` : ""}
        ${rate?.room_data_trans?.bedding_type ? `<div>${escapeHtml(tr("bedding_label"))}: ${escapeHtml(rate.room_data_trans.bedding_type)}</div>` : ""}
        ${rate?.room_data_trans?.bathroom ? `<div>${escapeHtml(tr("bathroom_label"))}: ${escapeHtml(rate.room_data_trans.bathroom)}</div>` : ""}
      </div>
      <div class="room-card__footer">${escapeHtml(rate.book_hash || rate.match_hash || "")}</div>
      <div class="hotel-actions">
        <button class="primary mini" data-prebook-index="${index}">${escapeHtml(tr("prebook_button"))}</button>
      </div>
    </div>`;
}


// Enriched results card renderer
function renderHotelsEx(resultsMaybeNested, options = {}) {
  const renderToken = ++latestHotelsRenderToken;
  if (resultsMaybeNested) {
    currentHotelsStore = extractHotels(resultsMaybeNested) || [];
    currentHotelsPage = 0;
  }
  if (!Array.isArray(currentHotelsStore)) currentHotelsStore = [];
  if (typeof options.page === "number" && !Number.isNaN(options.page)) {
    currentHotelsPage = options.page;
  }
  const hotels = currentHotelsStore;
  const totalPages = hotels.length ? Math.ceil(hotels.length / HOTELS_PAGE_SIZE) : 0;
  if (!hotels.length) {
    lastRenderedHotels = [];
    hotelsContainer.innerHTML = `<div style="font-size:.7rem;color:#64748b;">${escapeHtml(tr("search_no_hotels") || "No hotels found.")}</div>`;
    updatePaginationControls(totalPages);
    if (searchMeta) searchMeta.textContent = lastSearchEndpoint ? `endpoint ${lastSearchEndpoint}` : "";
    return;
  }
  currentHotelsPage = Math.max(0, Math.min(currentHotelsPage, totalPages - 1));
  const startIndex = currentHotelsPage * HOTELS_PAGE_SIZE;
  const pagedHotels = hotels.slice(startIndex, startIndex + HOTELS_PAGE_SIZE);
  lastRenderedHotels = pagedHotels.slice();

  const ci = checkinEl?.value;
  const co = checkoutEl?.value;
  const oneDay = 24 * 60 * 60 * 1000;
  let nights = 0;
  try {
    const d1 = ci ? new Date(ci) : null;
    const d2 = co ? new Date(co) : null;
    nights = (d1 && d2) ? Math.max(1, Math.round((d2 - d1) / oneDay)) : 0;
  } catch (_) {}

  function rateMealLabel(code) {
    switch (code) {
      case 'nomeal': return tr('meal_nomeal');
      case 'breakfast': return tr('meal_breakfast');
      case 'half_board': return tr('meal_half_board');
      case 'full_board': return tr('meal_full_board');
      case 'all_inclusive':
      case 'all-inclusive': return tr('meal_all_inclusive');
      default: return code || tr('meal_default');
    }
  }
  function rateFreeCancellation(rate) {
    const fc = rate?.payment_options?.payment_types?.[0]?.cancellation_penalties?.free_cancellation_before;
    if (!fc) return false;
    const ts = Date.parse(fc);
    return Number.isFinite(ts) ? ts > Date.now() : false;
  }
  function ratePrice(rate) {
    const p = rate?.payment_options?.payment_types?.[0];
    const amountStr = p?.show_amount || p?.amount;
    const amt = Number(amountStr);
    const currency = p?.show_currency_code || p?.currency_code || 'EUR';
    return { amount: Number.isFinite(amt) ? amt : null, currency };
  }
  function pickBestRate(rates, requiredCapacity) {
    if (!Array.isArray(rates) || !rates.length) return null;
    const need = Math.max(1, requiredCapacity || 1);
    let best = null;
    let bestScore = Infinity;
    for (const r of rates) {
      const { amount } = ratePrice(r);
      const priceScore = amount !== null ? amount : Number.POSITIVE_INFINITY;
      const capacity = getRateCapacity(r) || 0;
      const deficit = capacity >= need ? 0 : need - capacity;
      const excess = capacity > need ? capacity - need : 0;
      const score = deficit * 100000 + excess * 1000 + priceScore;
      if (score < bestScore) {
        bestScore = score;
        best = r;
      }
    }
    return best || rates[0];
  }

  const { counts: requestedCounts, summary: requestedSummary } = formatRequestedGuestsLabel();

  hotelsContainer.innerHTML = pagedHotels.map((h, i) => {
    const name = hotelDisplayName(h);
    const hid  = h.id || h.hotel_id || h.hid || 'n/a';
    const addr = h.address || h.location || '';
    const stars = deriveHotelStars(h);
    const best = pickBestRate(h.rates || [], requestedCounts.total);
    const mealCode = best?.meal || best?.meal_data?.value || '';
    const mealText = rateMealLabel(mealCode);
    const freeCancel = best ? rateFreeCancellation(best) : false;
    const { amount, currency } = best ? ratePrice(best) : { amount: null, currency: 'EUR' };
    const roomName = best?.room_name || best?.room || tr("room_label");
    const safeRoomName = escapeHtml(roomName || tr("room_label"));
    const capacity = getRateCapacity(best) || h?.rg_ext?.capacity || null;
    const distanceText = formatDistanceFromCenter(h);
    const starHtml = renderStarIcons(stars);
    const listingNumber = startIndex + i + 1;
    const mealChip = mealText
      ? `<span class="chip chip--meal">${chipIcon("meal")}${escapeHtml(mealText)}</span>`
      : "";
    const cancelChip = best
      ? (freeCancel
          ? `<span class="chip chip--free">${chipIcon("check")}${escapeHtml(tr("free_cancellation"))}</span>`
          : `<span class="chip chip--danger">${chipIcon("ban")}${escapeHtml(tr("no_cancellation"))}</span>`)
      : "";
    const capacityChip = capacity ? `<span class="chip">${escapeHtml(`${tr("capacity_prefix")} ${capacity}`)}</span>` : "";
    const requestedLabel = requestedSummary ? tr("requested_occupancy_label", requestedSummary) : "";
    const capacityDetail = capacity
      ? tr("room_capacity_detail", capacity, requestedSummary)
      : requestedLabel;
    const capacityDetailHtml = capacityDetail
      ? `<div class="muted" style="margin-top:.35rem;">${escapeHtml(capacityDetail)}</div>`
      : "";
    const chipsHtml = [mealChip, cancelChip, capacityChip].filter(Boolean).join("");
    return `
      <div class="hotel-item" data-hotel-index="${i}">
        <div class="hotel-item__top">
          <div class="hotel-thumb" data-hotel-thumb>
            <div class="hotel-thumb__viewport" data-thumb-image>
              <div class="hotel-thumb__placeholder">${escapeHtml(tr("thumb_loading"))}</div>
            </div>
            <button type="button" class="hotel-thumb__nav hotel-thumb__nav--prev is-hidden" data-thumb-prev aria-label="Previous photo">‹</button>
            <button type="button" class="hotel-thumb__nav hotel-thumb__nav--next is-hidden" data-thumb-next aria-label="Next photo">›</button>
            <div class="hotel-thumb__counter is-hidden" data-thumb-counter></div>
          </div>
          <div class="hotel-summary">
            <div class="hotel-head">
              <div class="hotel-name">${listingNumber}. ${name}</div>
              <div class="hotel-id">${escapeHtml(tr("detail_id_label", hid))}</div>
            </div>
            <div class="hotel-meta">
              ${starHtml || ""}
              ${distanceText ? `<span class="hotel-distance">${escapeHtml(distanceText)}</span>` : ""}
              ${addr ? `<span>${escapeHtml(addr)}</span>` : ""}
            </div>
            <div class="rate-snippet" style="margin-top:.25rem; border:1px solid rgba(148,163,184,.25); border-radius:.6rem; padding:.6rem; display:grid; grid-template-columns: 1fr auto; gap:.5rem; align-items:center; background: rgba(15,23,42,.6);">
              <div>
                <div style="font-weight:600;">${safeRoomName}</div>
                <div class="chips" style="margin-top:.25rem;">
                  ${chipsHtml}
                </div>
                ${capacityDetailHtml}
              </div>
              <div style="text-align:right;">
                <div style="font-size:1rem;font-weight:700;">${amount!=null ? `${escapeHtml(formatCurrency(amount, currency))}` : '?'}</div>
                ${nights ? `<div class="muted" style="margin-top:.15rem;">${escapeHtml(tr('nights_label', nights))}</div>` : ''}
              </div>
            </div>
            <div class="hotel-actions">
              <button class="secondary mini" data-view-hid="${hid}">${escapeHtml(tr('button_view_details'))}</button>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  hotelsContainer.querySelectorAll('button[data-view-hid]').forEach(btn => {
    btn.addEventListener('click', () => loadHotelDetails(btn.getAttribute('data-view-hid')));
  });
  if (searchMeta) {
    const metaParts = [];
    if (lastSearchEndpoint) metaParts.push(`endpoint ${lastSearchEndpoint}`);
    metaParts.push(`${hotels.length} hotel${hotels.length === 1 ? "" : "s"}`);
    if (totalPages > 1) metaParts.push(`page ${currentHotelsPage + 1}/${totalPages}`);
    searchMeta.textContent = metaParts.join(" · ");
  }
  updatePaginationControls(totalPages);
  hydrateHotelImages(lastRenderedHotels, renderToken);
}

function renderHotelsSkeleton(count = 6) {
  if (!hotelsContainer) return;
  const items = Array.from({ length: count }).map((_, idx) => `
      <div class="hotel-item hotel-skeleton" aria-hidden="true">
        <div class="hotel-item__top">
          <div class="hotel-thumb">
            <div class="hotel-thumb__viewport">
              <div class="skeleton skeleton-thumb"></div>
            </div>
          </div>
          <div class="hotel-summary">
            <div class="skeleton skeleton-text skeleton-text-lg"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton-badge-row">
              <span class="skeleton skeleton-badge"></span>
              <span class="skeleton skeleton-badge"></span>
              <span class="skeleton skeleton-badge"></span>
            </div>
          </div>
        </div>
      </div>`).join("");
  hotelsContainer.innerHTML = items;
  if (resultsPaginationEl) resultsPaginationEl.style.display = "none";
  if (searchMeta) searchMeta.textContent = "Loading results…";
}

function renderHotels(resultsMaybeNested) {
  const renderToken = ++latestHotelsRenderToken;
  updatePaginationControls(0);
  const hotels = extractHotels(resultsMaybeNested);
  if (!hotels || !hotels.length) {
    hotelsContainer.innerHTML = `<div style="font-size:.7rem;color:#64748b;">${escapeHtml(tr("search_no_hotels") || "No hotels found.")}</div>`;
    return;
  }
  hotelsContainer.innerHTML = hotels.map((h, i) => {
    const name = hotelDisplayName(h);
    const hid  = h.id || h.hotel_id || h.hid || "n/a";
    const addr = h.address || h.location || "";
    const stars = deriveHotelStars(h);
    const starHtml = renderStarIcons(stars);
    const distanceText = formatDistanceFromCenter(h);
    return `
      <div class="hotel-item" data-hotel-index="${i}">
        <div class="hotel-thumb" data-hotel-thumb>
          <div class="hotel-thumb__viewport" data-thumb-image>
            <div class="hotel-thumb__placeholder">${escapeHtml(tr("thumb_loading"))}</div>
          </div>
          <button type="button" class="hotel-thumb__nav hotel-thumb__nav--prev is-hidden" data-thumb-prev aria-label="Previous photo">‹</button>
          <button type="button" class="hotel-thumb__nav hotel-thumb__nav--next is-hidden" data-thumb-next aria-label="Next photo">›</button>
          <div class="hotel-thumb__counter is-hidden" data-thumb-counter></div>
        </div>
        <div class="hotel-head">
          <div class="hotel-name">${i + 1}. ${name}</div>
          <div class="hotel-id">${escapeHtml(tr("detail_id_label", hid))}</div>
        </div>
        <div class="hotel-meta">
          ${starHtml || ""}
          ${distanceText ? `<span class="hotel-distance">${escapeHtml(distanceText)}</span>` : ""}
          ${addr ? `<span>${escapeHtml(addr)}</span>` : ""}
        </div>
        <div style="margin-top:.5rem;">
          <button class="secondary mini" data-view-hid="${hid}">${escapeHtml(tr('button_view_details'))}</button>
        </div>
      </div>`;
  }).join("");

  hotelsContainer.querySelectorAll('button[data-view-hid]').forEach(btn => {
    btn.addEventListener('click', () => loadHotelDetails(btn.getAttribute('data-view-hid')));
  });
  hydrateHotelImages(hotels, renderToken);
}

function renderHotelDetails(data) {
  if (!data || !data.results) {
    lastHotelDetailsResults = null;
    hotelDetailsContainer.innerHTML = `<div style="font-size:.7rem;color:#64748b;">${escapeHtml(tr("detail_no_data"))}</div>`;
    return;
  }
  const hotelsArray = Array.isArray(data.results?.hotels)
    ? data.results.hotels
    : Array.isArray(data.results)
    ? data.results
    : data.results.hotels || [];
  lastHotelDetailsResults = data.results || lastHotelDetailsResults;
  const hotel = Array.isArray(hotelsArray) ? hotelsArray[0] : data.results;
  if (!hotel) {
    lastHotelDetailsResults = data.results || null;
    hotelDetailsContainer.innerHTML = `<div style="font-size:.7rem;color:#64748b;">${escapeHtml(tr("detail_no_hotel"))}</div>`;
    return;
  }
  const detailToken = ++latestHotelDetailsToken;
  const name  = hotelDisplayName(hotel);
  const hid   = hotel.id || hotel.hid || hotel.hotel_id || "n/a";
  const addr  = hotel.address || hotel.location || "";
  const rates = Array.isArray(hotel.rates) ? hotel.rates : [];
  currentHotelDetail = hotel;
  currentHotelRates = rates.slice();
  const stars = deriveHotelStars(hotel);
  const cheapestRate = rates
    .map((rate) => {
      const payment = rate?.payment_options?.payment_types?.[0];
      const amount = Number(payment?.show_amount || payment?.amount);
      const currency = payment?.show_currency_code || payment?.currency_code || "EUR";
      return Number.isFinite(amount) ? { amount, currency } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.amount - b.amount)[0];
  const highlightTags = collectHotelHighlights(rates).slice(0, 8);
  const highlightChips = highlightTags.length
    ? highlightTags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")
    : `<span class="muted">${escapeHtml(tr("detail_no_highlights"))}</span>`;
  const knowBefore = buildKnowBeforeList(rates[0]) || [];
  const knowBeforeHTML = knowBefore.length
    ? knowBefore.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : `<li>${escapeHtml(tr("detail_no_policies"))}</li>`;
  const infoList = [];
  infoList.push(tr("detail_offers_label", rates.length || 0));
  if (addr) infoList.push(addr);
  if (cheapestRate) infoList.push(tr("detail_from_label", formatCurrency(cheapestRate.amount, cheapestRate.currency)));
  const metaPieces = [
    tr("detail_id_label", hid),
    stars ? `${stars}★` : "",
    cheapestRate ? tr("detail_from_label", formatCurrency(cheapestRate.amount, cheapestRate.currency)) : "",
  ].filter(Boolean);
  const metaHTML = infoList.map((fact) => `<span>${escapeHtml(fact)}</span>`).join("");
  const factsListHTML = infoList.length
    ? infoList.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")
    : `<li>${escapeHtml(tr("detail_no_highlights"))}</li>`;
  const roomsHTML = rates.length
    ? rates
        .map((rate, idx) => (idx < 12 ? renderRateCard(rate, idx) : ""))
        .filter(Boolean)
        .join("")
    : `<div style="font-size:.75rem;color:#94a3b8;">${escapeHtml(tr("detail_no_rates"))}</div>`;

  hotelDetailsContainer.innerHTML = `
    <div class="hotel-detail">
      <div class="hotel-detail__summary">
        <div class="hotel-detail__header">
          <div class="hotel-detail__title">${escapeHtml(name)}</div>
          <div class="hotel-detail__meta">
            ${metaPieces.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          </div>
        </div>
        <div class="hotel-detail__meta">${metaHTML}</div>
        <div class="hotel-detail__chips">${highlightChips}</div>
      </div>
      <div class="hotel-detail__info-grid">
        <div class="hotel-detail__info-box">
          <h4>${escapeHtml(tr("detail_highlights_title"))}</h4>
          <ul>${factsListHTML}</ul>
        </div>
        <div class="hotel-detail__info-box">
          <h4>${escapeHtml(tr("detail_know_title"))}</h4>
          <ul>${knowBeforeHTML}</ul>
        </div>
      </div>
      <div class="hotel-gallery" data-hotel-gallery>
        <div class="hotel-thumb__placeholder">${escapeHtml(tr("detail_gallery_loading"))}</div>
      </div>
      <div class="hotel-detail__rooms">
        <h4>${escapeHtml(tr("detail_rooms_title"))}</h4>
        ${roomsHTML}
      </div>
    </div>`;
  hydrateHotelDetailGallery(hotel, detailToken);
}

async function safeJsonFetch(url, options = {}, labelForLog = "") {
  startTopProgress();
  let r;
  try {
    r = await fetch(url, options);
  } finally {
    finishTopProgress();
  }
  const statusCode = r.status;
  const rawText = await r.text();
  let data;
  try { data = rawText ? JSON.parse(rawText) : null; }
  catch (parseErr) { data = { _parseError: parseErr.message, _raw: rawText, _httpStatus: statusCode }; }
  log({ statusCode, data }, labelForLog);
  return { statusCode, data };
}

function pickNumber(...values) {
  for (const val of values) {
    if (val === null || val === undefined || val === "") continue;
    const num = Number(val);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function extractRegionCoordinates(region) {
  if (!region || typeof region !== "object") return null;
  const latitude = pickNumber(
    region.latitude,
    region.lat,
    region.geo?.latitude,
    region.geo?.lat,
    region.location?.latitude,
    region.location?.lat,
    region.coordinates?.latitude,
    region.coordinates?.lat,
    region.center?.latitude,
    region.center?.lat
  );
  const longitude = pickNumber(
    region.longitude,
    region.lon,
    region.lng,
    region.geo?.longitude,
    region.geo?.lon,
    region.geo?.lng,
    region.location?.longitude,
    region.location?.lon,
    region.location?.lng,
    region.coordinates?.longitude,
    region.coordinates?.lon,
    region.coordinates?.lng,
    region.center?.longitude,
    region.center?.lon,
    region.center?.lng
  );
  const radius = pickNumber(region.radius, region.geo?.radius, region.location?.radius);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude, radius };
}

async function fetchAutocompleteData(term, language = "en") {
  const q = (term || "").trim();
  if (!q) return { regions: [], hotels: [] };
  const lang = (language || "en").trim() || "en";
  const endpoint = `${API_BASE}/api/regions/search?q=${encodeURIComponent(q)}&lang=${encodeURIComponent(lang)}`;
  const response = await safeJsonFetch(endpoint, { method: "GET" }, "RESPONSE /api/regions/search");
  if (response.statusCode >= 400) {
    throw new Error(response.data?.error || response.data?._raw || "Autocomplete failed");
  }
  return {
    regions: Array.isArray(response.data?.regions) ? response.data.regions : [],
    hotels: Array.isArray(response.data?.hotels) ? response.data.hotels : [],
  };
}

async function getTopRegionMatch(term, language = "en") {
  const { regions } = await fetchAutocompleteData(term, language);
  return regions[0] || null;
}

let suggestionTimer = null;
let lastSuggestionQuery = "";

async function loadRegionSuggestions(term) {
  const lang = langEl?.value || "en";
  lastSuggestionQuery = term;
  setRegionStatus("Searching...");
  try {
    const { regions, hotels } = await fetchAutocompleteData(term, lang);
    if (lastSuggestionQuery !== term) return;
    renderRegionSuggestions(regions.slice(0, 8));
    renderHotelSuggestions(hotels.slice(0, 5));
    if (!regions.length && !hotels.length) {
      setRegionStatus(tr("status_no_matches"));
    } else {
      const pieces = [];
      if (regions.length) pieces.push(`${regions.length} region${regions.length > 1 ? "s" : ""}`);
      if (hotels.length) pieces.push(`${hotels.length} hotel${hotels.length > 1 ? "s" : ""}`);
      setRegionStatus(`Suggestions: ${pieces.join(", ")}`);
    }
  } catch (err) {
    if (lastSuggestionQuery === term) {
      setRegionStatus(err.message || "Suggestion lookup failed.");
      clearSuggestionsDropdown();
    }
  }
}

regionIdEl?.addEventListener("input", () => {
  if (suggestionTimer) clearTimeout(suggestionTimer);
  const term = (regionIdEl.value || "").trim();
  selectedHotel = null;
  if (!term || term.length < 2) {
    clearSuggestionsDropdown();
    setRegionStatus("");
    return;
  }
  suggestionTimer = setTimeout(() => loadRegionSuggestions(term), 250);
});

langEl?.addEventListener("change", () => {
  const term = (regionIdEl?.value || "").trim();
  if (term.length >= 2) {
    if (suggestionTimer) clearTimeout(suggestionTimer);
    loadRegionSuggestions(term);
  } else {
    clearSuggestionsDropdown();
    setRegionStatus("");
  }
  applyStaticTranslations();
  if (currentHotelsStore.length) {
    renderHotelsEx(null, { page: currentHotelsPage });
  }
  if (lastHotelDetailsResults) {
    renderHotelDetails({ results: lastHotelDetailsResults });
  }
});

suggestionsDropdownEl?.addEventListener("click", (event) => {
  const option = event.target.closest(".suggestion-option");
  if (!option) return;
  const type = option.getAttribute("data-suggestion-type");
  const idx = Number(option.getAttribute("data-suggestion-index"));

  if (type === "region") {
    const region = Number.isInteger(idx) ? currentRegionSuggestions[idx] : null;
    if (!region) return;
    const label = region.name || region.full_name || region.fullName || region.id || "";
    if (regionIdEl) regionIdEl.value = label;
    selectedHotel = null;
    setRegionStatus(region.id ? `Region ID ${region.id}` : label);
    clearSuggestionsDropdown();
    regionIdEl?.focus();
    return;
  }

  if (type === "hotel") {
    const hotel = Number.isInteger(idx) ? currentHotelSuggestions[idx] : null;
    if (!hotel) return;
    selectedHotel = {
      hid: Number(hotel.hid) || hotel.hid,
      region_id: hotel.region_id || null,
      name: hotel.name || "",
      displayValue: hotel.name || "",
    };
    if (regionIdEl && selectedHotel.displayValue) {
      regionIdEl.value = selectedHotel.displayValue;
    }
    const selectedLabel = selectedHotel.name || selectedHotel.hid || "";
    setRegionStatus(tr("selected_hotel_status", selectedLabel));
    clearSuggestionsDropdown();
    regionIdEl?.focus();
  }
});

document.addEventListener("click", (event) => {
  if (!destinationFieldEl) return;
  const target = event.target;
  if (destinationFieldEl.contains(target)) return;
  if (suggestionsDropdownEl?.contains(target)) return;
  hideSuggestionsDropdown();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideSuggestionsDropdown();
});

// Search
btnSearch.addEventListener('click', async () => {
  const mode = document.querySelector('input[name="mode"]:checked')?.value || 'region';
  const body = {
    checkin:  checkinEl?.value,
    checkout: checkoutEl?.value,
    currency: currencyEl?.value,
    language: langEl?.value,
    guests:   buildGuests(),
  };

  // collect filters
  const stars = [...starBoxes].filter(b => b.checked).map(b => parseInt(b.value, 10));
  const meals = [...mealBoxes].filter(b => b.checked).map(b => b.value);
  const free_cancel = !!freeCancelEl?.checked;
  body.filters = { stars, meals, free_cancel };
  const destinationInput = (regionIdEl?.value || '').trim();
  const hasDestination = destinationInput.length > 0;
  const isNumericDestination = hasDestination && /^\d+$/.test(destinationInput);
  let regionLookupPromise = null;
  const ensureRegionMatch = () => {
    if (!hasDestination) return Promise.resolve(null);
    if (!regionLookupPromise) regionLookupPromise = getTopRegionMatch(destinationInput, body.language);
    return regionLookupPromise;
  };
  const hotelSelectionActive =
    selectedHotel &&
    hasDestination &&
    destinationInput === (selectedHotel.displayValue || selectedHotel.name || "");

  if (mode === 'region') {
    if (!hasDestination && !hotelSelectionActive) {
      hotelsContainer.innerHTML = `<div style="color:#dc2626;font-size:.75rem;">${escapeHtml(tr("error_enter_destination"))}</div>`; return;
    }
    if (hotelSelectionActive && selectedHotel?.hid) {
      body.hids = [selectedHotel.hid];
    } else if (isNumericDestination) {
      body.region_id = Number(destinationInput);
    } else {
      body.query = destinationInput;
    }
  } else {
    let lat = parseFloat(latEl?.value);
    let lon = parseFloat(lonEl?.value);
    let rad = parseInt(radiusEl?.value, 10);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      if (!hasDestination) {
        hotelsContainer.innerHTML = `<div style="color:#dc2626;font-size:.75rem;">${escapeHtml(tr("error_enter_coords_or_destination"))}</div>`; return;
      }
      let regionMatch = null;
      try {
        regionMatch = await ensureRegionMatch();
      } catch (err) {
        hotelsContainer.innerHTML = `<div style="color:#dc2626;font-size:.75rem;">${escapeHtml(err.message || tr("error_destination_lookup"))}</div>`; return;
      }
      if (!regionMatch) {
        hotelsContainer.innerHTML = `<div style="color:#dc2626;font-size:.75rem;">${escapeHtml(tr("error_no_region"))}</div>`; return;
      }
      const coords = extractRegionCoordinates(regionMatch);
      if (!coords) {
        hotelsContainer.innerHTML = `<div style="color:#dc2626;font-size:.75rem;">${escapeHtml(tr("error_no_coords"))}</div>`; return;
      }
      lat = coords.latitude;
      lon = coords.longitude;
      if (!Number.isFinite(rad) || rad <= 0) rad = coords.radius || 1500;
      if (latEl) latEl.value = String(lat);
      if (lonEl) lonEl.value = String(lon);
      if (radiusEl && rad) radiusEl.value = String(rad);
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      hotelsContainer.innerHTML = `<div style="color:#dc2626;font-size:.75rem;">${escapeHtml(tr("error_invalid_coords"))}</div>`; return;
    }
    if (!Number.isFinite(rad) || rad <= 0) rad = 1500;

    body.latitude = lat; body.longitude = lon; body.radius = rad;
  }

  if (!body.hids && hotelSelectionActive && selectedHotel?.hid) {
    body.hids = [selectedHotel.hid];
  }

  renderHotelsSkeleton();
  log(body, 'REQUEST /api/search/serp');
  const { statusCode, data } = await safeJsonFetch(
    `${API_BASE}/api/search/serp?limit=${SERP_FETCH_LIMIT}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    'RESPONSE /api/search/serp'
  );
  if (statusCode >= 400 || !data || data.error) {
    hotelsContainer.innerHTML = `<div style=\"font-size:.7rem;color:#dc2626;\">${data?.error || data?._raw || 'Search failed'}</div>`;
    return;
  }
  lastSearchEndpoint = data.endpoint || "";
  renderHotelsEx(data.results);
});

// Hotel details by hotel id (from results button)
async function loadHotelDetails(hid) {
  if (!hid) return;
  if (hotelDetailsContainer) {
    hotelDetailsContainer.innerHTML = `
      <div class="hotel-detail hotel-detail--skeleton" aria-hidden="true">
        <div class="hotel-detail__summary">
          <div class="skeleton skeleton-text skeleton-text-lg"></div>
          <div class="skeleton skeleton-text"></div>
        </div>
        <div class="hotel-detail__info-grid">
          <div class="hotel-detail__info-box">
            <div class="skeleton skeleton-text skeleton-text-lg"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
          </div>
          <div class="hotel-detail__info-box">
            <div class="skeleton skeleton-text skeleton-text-lg"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
          </div>
        </div>
        <div class="hotel-gallery">
          <div class="skeleton skeleton-thumb"></div>
        </div>
      </div>`;
  }
  const body = {
    id: hid,
    checkin: checkinEl?.value,
    checkout: checkoutEl?.value,
    guests: buildGuests(),
    language: langEl?.value,
    currency: currencyEl?.value,
  };
  log(body, 'REQUEST /api/search/hp');
  const { statusCode, data } = await safeJsonFetch(
    `${API_BASE}/api/search/hp`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    'RESPONSE /api/search/hp'
  );
  if (statusCode >= 400 || !data || data.error) {
    hotelDetailsContainer.innerHTML = `<div style=\"font-size:.7rem;color:#dc2626;\">${data?.error || data?._raw || 'Hotel lookup failed'}</div>`;
    return;
  }
  lastHotelDetailsResults = data.results;
  renderHotelDetails({ results: data.results });
}

// Optional older UI button
btnHotelDetails?.addEventListener('click', () => {
  const hid = hotelIdEl?.value?.trim();
  if (hid) loadHotelDetails(hid);
});

// Prebook logic removed for search-only scope

// Init summary
applyStaticTranslations();
updateGuestsSummary();
function currentLanguage() {
  return (langEl?.value || "en").toLowerCase();
}

function tr(key, ...args) {
  const lang = currentLanguage();
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const fallback = TRANSLATIONS.en || {};
  let value = dict?.[key];
  if (value === undefined) value = fallback[key];
  if (typeof value === "function") {
    try { return value(...args); }
    catch (_) { return ""; }
  }
  return value ?? "";
}

function applyStaticTranslations() {
  const header = document.querySelector("#hotelDetailHeaderTitle");
  if (header) header.textContent = tr("detail_header") || "Hotel details & rates";
  const hint = document.querySelector("#hotelDetailHeaderHint");
  if (hint) hint.textContent = tr("detail_hint") || "select a hotel";
  const placeholder = document.querySelector("#hotelDetailsPlaceholder");
  if (placeholder) placeholder.textContent = tr("detail_placeholder") || "No hotel selected.";
}
