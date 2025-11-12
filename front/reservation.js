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
const langEl      = $("#language");
const currencyEl  = $("#currency");

const regionIdEl  = $("#region_id");
const regionSuggestionsEl = $("#regionSuggestions");
const regionStatusEl = $("#regionStatus");
const hotelSuggestionsEl = $("#hotelSuggestions");
const latEl       = $("#latitude");
const lonEl       = $("#longitude");
const radiusEl    = $("#radius");

const modeRadios  = document.querySelectorAll('input[name="mode"]');
const regionBlock = $("#regionBlock");
const geoBlock    = $("#geoBlock");

const btnSearch   = $("#btnSearch");
const btnGuests   = $("#btnGuests");
const guestsSummaryEl = $("#guestsSummary");

const hotelsContainer       = $("#hotelsContainer");
const hotelDetailsContainer = $("#hotelDetails");
const logOutput             = $("#logOutput");
const searchMeta            = $("#searchMeta");
// Filters refs
const starBoxes   = document.querySelectorAll('.flt-stars');
const mealBoxes   = document.querySelectorAll('.flt-meal');
const freeCancelEl = $("#flt_free_cancel");

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

function escapeOptionValue(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderRegionSuggestions(list = []) {
  if (!regionSuggestionsEl) return;
  if (!Array.isArray(list) || !list.length) {
    regionSuggestionsEl.innerHTML = "";
    return;
  }
  regionSuggestionsEl.innerHTML = list
    .map((r) => {
      const name = r.name || r.full_name || r.fullName || "";
      const suffix = r.country_code ? ` (${r.country_code})` : "";
      const value = `${name}${suffix}`;
      return `<option value="${escapeOptionValue(value)}"></option>`;
    })
    .join("");
}

let currentHotelSuggestions = [];
function renderHotelSuggestions(list = []) {
  if (!hotelSuggestionsEl) return;
  currentHotelSuggestions = Array.isArray(list) ? list.slice(0, 5) : [];
  if (!currentHotelSuggestions.length) {
    hotelSuggestionsEl.innerHTML = "";
    hotelSuggestionsEl.dataset.count = "0";
    return;
  }
  hotelSuggestionsEl.dataset.count = String(currentHotelSuggestions.length);
  hotelSuggestionsEl.innerHTML = `
    <div class="hotel-suggestions__group">
      <div class="hotel-suggestions__title">Hotels</div>
      ${currentHotelSuggestions
        .map(
          (hotel, idx) => `
        <button type="button" class="hotel-suggestion" data-suggestion-index="${idx}">
          <span class="hotel-suggestion__name">${escapeHtml(hotel.name || "Hotel")}</span>
          <span class="hotel-suggestion__meta">
            HID ${hotel.hid || "?"}${hotel.region_id ? ` · region ${hotel.region_id}` : ""}
          </span>
        </button>`
        )
        .join("")}
    </div>`;
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

// Enriched results card renderer
function renderHotelsEx(resultsMaybeNested) {
  const hotels = extractHotels(resultsMaybeNested);
  if (!hotels || !hotels.length) {
    hotelsContainer.innerHTML = `<div style="font-size:.7rem;color:#64748b;">No hotels found.</div>`;
    return;
  }

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
      case 'nomeal': return 'Room only';
      case 'breakfast': return 'Breakfast';
      case 'half_board': return 'Half board';
      case 'full_board': return 'Full board';
      case 'all_inclusive': return 'All inclusive';
      default: return code || '';
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
  function pickBestRate(rates) {
    if (!Array.isArray(rates) || !rates.length) return null;
    let best = null; let bestAmt = Infinity;
    for (const r of rates) {
      const { amount } = ratePrice(r);
      if (amount !== null && amount < bestAmt) { bestAmt = amount; best = r; }
    }
    return best || rates[0];
  }

  hotelsContainer.innerHTML = hotels.map((h, i) => {
    const name = hotelDisplayName(h);
    const hid  = h.id || h.hotel_id || h.hid || 'n/a';
    const addr = h.address || h.location || '';
    const stars = deriveHotelStars(h);
    const best = pickBestRate(h.rates || []);
    const mealCode = best?.meal || best?.meal_data?.value || '';
    const mealText = rateMealLabel(mealCode);
    const freeCancel = best ? rateFreeCancellation(best) : false;
    const { amount, currency } = best ? ratePrice(best) : { amount: null, currency: 'EUR' };
    const roomName = best?.room_name || best?.room || '';
    const capacity = best?.rg_ext?.capacity || h?.rg_ext?.capacity || null;
    return `
      <div class="hotel-item">
        <div class="hotel-head">
          <div class="hotel-name">${i + 1}. ${name}</div>
          <div class="hotel-id">ID: ${hid}</div>
        </div>
        <div class="hotel-meta">${Number.isFinite(Number(stars)) ? `${stars}★` : ''} ${addr ? `· ${addr}` : ''}</div>
        <div class="rate-snippet" style="margin-top:.5rem; border:1px solid rgba(148,163,184,.25); border-radius:.6rem; padding:.6rem; display:grid; grid-template-columns: 1fr auto; gap:.5rem; align-items:center; background: rgba(15,23,42,.6);">
          <div>
            <div style="font-weight:600;">${roomName || 'Room'}</div>
            <div class="chips" style="margin-top:.25rem;">
              ${mealText ? `<span class="chip">${mealText}</span>` : ''}
              ${freeCancel ? `<span class="chip" style="border-color:#22c55e;color:#86efac;background:rgba(16,185,129,.12)">Free cancellation</span>` : ''}
              ${capacity ? `<span class="chip">max ${capacity}</span>` : ''}
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:1rem;font-weight:700;">${amount!=null ? `${amount} ${currency}` : '?'}</div>
            ${nights ? `<div class="muted" style="margin-top:.15rem;">for ${nights} night${nights>1?'s':''}</div>` : ''}
          </div>
        </div>
        <div style="margin-top:.5rem; display:flex; justify-content:flex-end;">
          <button class="secondary mini" data-view-hid="${hid}">View details</button>
        </div>
      </div>`;
  }).join('');

  hotelsContainer.querySelectorAll('button[data-view-hid]').forEach(btn => {
    btn.addEventListener('click', () => loadHotelDetails(btn.getAttribute('data-view-hid')));
  });
}

function renderHotels(resultsMaybeNested) {
  const hotels = extractHotels(resultsMaybeNested);
  if (!hotels || !hotels.length) {
    hotelsContainer.innerHTML = `<div style="font-size:.7rem;color:#64748b;">No hotels found.</div>`;
    return;
  }
  hotelsContainer.innerHTML = hotels.map((h, i) => {
    const name = hotelDisplayName(h);
    const hid  = h.id || h.hotel_id || h.hid || "n/a";
    const addr = h.address || h.location || "";
    const stars = deriveHotelStars(h);
    return `
      <div class="hotel-item">
        <div class="hotel-head">
          <div class="hotel-name">${i + 1}. ${name}</div>
          <div class="hotel-id">ID: ${hid}</div>
        </div>
        <div class="hotel-meta">${stars ? `${stars}★` : ""} ${addr ? `· ${addr}` : ""}</div>
        <div style="margin-top:.5rem;">
          <button class="secondary mini" data-view-hid="${hid}">View details</button>
        </div>
      </div>`;
  }).join("");

  hotelsContainer.querySelectorAll('button[data-view-hid]').forEach(btn => {
    btn.addEventListener('click', () => loadHotelDetails(btn.getAttribute('data-view-hid')));
  });
}

function renderHotelDetails(data) {
  if (!data || !data.results) {
    hotelDetailsContainer.innerHTML = `<div style="font-size:.7rem;color:#64748b;">No hotel data.</div>`;
    return;
  }
  const hotelsArray = Array.isArray(data.results?.hotels)
    ? data.results.hotels
    : Array.isArray(data.results)
    ? data.results
    : data.results.hotels || [];
  const hotel = Array.isArray(hotelsArray) ? hotelsArray[0] : data.results;
  if (!hotel) {
    hotelDetailsContainer.innerHTML = `<div style="font-size:.7rem;color:#64748b;">No hotel found in response.</div>`;
    return;
  }
  const name  = hotelDisplayName(hotel);
  const hid   = hotel.id || hotel.hid || hotel.hotel_id || "n/a";
  const addr  = hotel.address || hotel.location || "";
  const rates = hotel.rates || [];
  const ratesHTML = rates.length
    ? rates.map(r => {
        const meal = r.meal || "";
        const roomName = r.room_name || r.room || "";
        const price = r.sell_price || r.price || r.total || "";
        const currency = r.currency || r.currency_code || "EUR";
        const hash = r.hash || "";
        return `
          <div class="rate-item">
            <div class="rate-head">
              <div class="rate-left">
                <div>${roomName || "Room"}</div>
                <div style=\"color:#94a3b8;font-size:.7rem;\">${meal}</div>
              </div>
              <div class="rate-right">${price ? `${price} ${currency}` : "?"}</div>
            </div>
            <div class="hash">${hash}</div>
          </div>`;
      }).join("")
    : `<div style="font-size:.7rem;color:#64748b;">No rates found.</div>`;
  hotelDetailsContainer.innerHTML = `
    <div style="font-size:.8rem;font-weight:600;color:#fff;">${name}</div>
    <div style="font-size:.7rem;color:#64748b;">ID: ${hid}</div>
    <div style="font-size:.7rem;color:#94a3b8;margin:.25rem 0 .75rem 0;">${addr}</div>
    <div class="rates-list">${ratesHTML}</div>`;
}

async function safeJsonFetch(url, options = {}, labelForLog = "") {
  const r = await fetch(url, options);
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
      setRegionStatus("No matching regions or hotels.");
    } else {
      const pieces = [];
      if (regions.length) pieces.push(`${regions.length} region${regions.length > 1 ? "s" : ""}`);
      if (hotels.length) pieces.push(`${hotels.length} hotel${hotels.length > 1 ? "s" : ""}`);
      setRegionStatus(`Suggestions: ${pieces.join(", ")}`);
    }
  } catch (err) {
    if (lastSuggestionQuery === term) {
      setRegionStatus(err.message || "Suggestion lookup failed.");
      renderRegionSuggestions([]);
      renderHotelSuggestions([]);
    }
  }
}

regionIdEl?.addEventListener("input", () => {
  if (suggestionTimer) clearTimeout(suggestionTimer);
  const term = (regionIdEl.value || "").trim();
  selectedHotel = null;
  if (!term || term.length < 2) {
    renderRegionSuggestions([]);
    renderHotelSuggestions([]);
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
    renderRegionSuggestions([]);
    renderHotelSuggestions([]);
    setRegionStatus("");
  }
});

hotelSuggestionsEl?.addEventListener("click", (event) => {
  const btn = event.target.closest("button.hotel-suggestion");
  if (!btn) return;
  const idx = Number(btn.getAttribute("data-suggestion-index"));
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
  setRegionStatus(`Selected hotel: ${selectedHotel.name || selectedHotel.hid || ""}`);
  regionIdEl?.focus();
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
      hotelsContainer.innerHTML = `<div style="color:#dc2626;font-size:.75rem;">Please enter a destination.</div>`; return;
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
        hotelsContainer.innerHTML = `<div style="color:#dc2626;font-size:.75rem;">Enter coordinates or a destination name.</div>`; return;
      }
      let regionMatch = null;
      try {
        regionMatch = await ensureRegionMatch();
      } catch (err) {
        hotelsContainer.innerHTML = `<div style="color:#dc2626;font-size:.75rem;">${err.message || 'Destination lookup failed.'}</div>`; return;
      }
      if (!regionMatch) {
        hotelsContainer.innerHTML = `<div style="color:#dc2626;font-size:.75rem;">No region found for that destination.</div>`; return;
      }
      const coords = extractRegionCoordinates(regionMatch);
      if (!coords) {
        hotelsContainer.innerHTML = `<div style="color:#dc2626;font-size:.75rem;">No coordinates available for that destination.</div>`; return;
      }
      lat = coords.latitude;
      lon = coords.longitude;
      if (!Number.isFinite(rad) || rad <= 0) rad = coords.radius || 1500;
      if (latEl) latEl.value = String(lat);
      if (lonEl) lonEl.value = String(lon);
      if (radiusEl && rad) radiusEl.value = String(rad);
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      hotelsContainer.innerHTML = `<div style="color:#dc2626;font-size:.75rem;">Please enter valid coordinates or search by destination.</div>`; return;
    }
    if (!Number.isFinite(rad) || rad <= 0) rad = 1500;

    body.latitude = lat; body.longitude = lon; body.radius = rad;
  }

  if (!body.hids && hotelSelectionActive && selectedHotel?.hid) {
    body.hids = [selectedHotel.hid];
  }

  log(body, 'REQUEST /api/search/serp');
  const { statusCode, data } = await safeJsonFetch(
    `${API_BASE}/api/search/serp?limit=10`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    'RESPONSE /api/search/serp'
  );
  if (statusCode >= 400 || !data || data.error) {
    hotelsContainer.innerHTML = `<div style=\"font-size:.7rem;color:#dc2626;\">${data?.error || data?._raw || 'Search failed'}</div>`;
    return;
  }
  searchMeta.textContent = `endpoint ${data.endpoint}`;
  renderHotelsEx(data.results);
});

// Hotel details by hotel id (from results button)
async function loadHotelDetails(hid) {
  if (!hid) return;
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
  renderHotelDetails({ results: data.results });
}

// Optional older UI button
btnHotelDetails?.addEventListener('click', () => {
  const hid = hotelIdEl?.value?.trim();
  if (hid) loadHotelDetails(hid);
});

// Prebook logic removed for search-only scope

// Init summary
updateGuestsSummary();
