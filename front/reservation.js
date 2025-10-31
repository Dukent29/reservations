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

function renderHotels(resultsMaybeNested) {
  const hotels = extractHotels(resultsMaybeNested);
  if (!hotels || !hotels.length) {
    hotelsContainer.innerHTML = `<div style="font-size:.7rem;color:#64748b;">No hotels found.</div>`;
    return;
  }
  hotelsContainer.innerHTML = hotels.map((h, i) => {
    const name = h.name || h.hotel_name || "Unnamed hotel";
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
  const name  = hotel.name || hotel.hotel_name || "Hotel";
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
  if (mode === 'region') {
    const rid = (regionIdEl?.value || '').trim();
    if (!rid) { hotelsContainer.innerHTML = `<div style=\"color:#dc2626;font-size:.75rem;\">Please enter region_id.</div>`; return; }
    body.region_id = isNaN(Number(rid)) ? rid : Number(rid);
  } else {
    const lat = parseFloat(latEl?.value);
    const lon = parseFloat(lonEl?.value);
    const rad = parseInt(radiusEl?.value, 10);
    if (isNaN(lat) || isNaN(lon) || isNaN(rad)) {
      hotelsContainer.innerHTML = `<div style=\"color:#dc2626;font-size:.75rem;\">Please enter lat/lon/radius.</div>`; return;
    }
    body.latitude = lat; body.longitude = lon; body.radius = rad;
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
  renderHotels(data.results);
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
