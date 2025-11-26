const $ = (selector) => document.querySelector(selector);

const API_BASE = (() => {
  try {
    return window.location.port === "3000" ? "" : "http://localhost:3000";
  } catch (_) {
    return "";
  }
})();

const PREBOOK_SUMMARY_KEY = "booking:lastPrebook";
const params = new URLSearchParams(window.location.search);
const token = params.get("token") || params.get("book_hash") || params.get("prebook_token");

const statusEl = $("#bookingStatus");
const tokenEl = $("#prebookToken");
const partnerIdEl = $("#partnerOrderId");
const hotelNameEl = $("#hotelName");
const hotelDetailsEl = $("#hotelDetails");
const rawFormEl = $("#rawForm");
const formSummaryEl = $("#bookingFormSummary");
const staySummaryEl = $("#staySummary");
const refreshButton = $("#refreshForm");
const copyButton = $("#copyPartnerId");
const civilityEl = $("#customerCivility");
const nameEl = $("#customerName");
const emailEl = $("#customerEmail");
const phoneEl = $("#customerPhone");
const addrLine1El = $("#customerAddressLine1");
const addrZipCityEl = $("#customerAddressZipCity");
const countryCodeEl = $("#customerCountryCode");
const floaProductEl = $("#floaProduct");
const floaPayButton = $("#btnFloaPay");

let currentPartnerOrderId = null;

let storedPrebookSummary = null;
let storedPrebookPayload = null;
try {
  if (typeof sessionStorage !== "undefined") {
    const rawSummary = sessionStorage.getItem(PREBOOK_SUMMARY_KEY);
    if (rawSummary) {
      const parsed = JSON.parse(rawSummary);
      const payloadToken = parsed?.token || parsed?.summary?.token;
      if (!token || payloadToken === token) {
        if (parsed?.summary || parsed?.payload) {
          storedPrebookSummary = parsed.summary || null;
          storedPrebookPayload = parsed.payload || null;
        } else {
          storedPrebookSummary = parsed;
          storedPrebookPayload = parsed?.payload || null;
        }
      }
    }
  }
} catch (_) {
  storedPrebookSummary = storedPrebookSummary || null;
  storedPrebookPayload = storedPrebookPayload || null;
}

function setStatus(message, type = "info") {
  if (!statusEl) return;
  if (!message) {
    statusEl.textContent = "";
    statusEl.classList.remove("error");
    return;
  }
  statusEl.textContent = message;
  statusEl.classList.toggle("error", type === "error");
}

function formatPrice(amount, currency) {
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

function renderStaySummary(form = {}, fallbackSummary, fallbackPayload) {
  staySummaryEl.innerHTML = "";
  const rooms = Array.isArray(form.rooms) ? form.rooms : [];
  if (!rooms.length) {
    if (fallbackSummary?.room) {
      const div = document.createElement("div");
      div.className = "summary-card";
      const guests = fallbackSummary?.stay?.guest_label || fallbackSummary?.room?.guests_label || "";
      let price = "";
      if (fallbackSummary.room.price) {
        price = formatPrice(fallbackSummary.room.price, fallbackSummary.room.currency);
      } else if (fallbackPayload) {
        const payment = fallbackPayload?.data?.hotels?.[0]?.rates?.[0]?.payment_options?.payment_types?.[0];
        if (payment) {
          price = formatPrice(payment.show_amount || payment.amount, payment.show_currency_code || payment.currency_code);
        }
      }
      div.innerHTML = `
        <p class="muted">Room 1</p>
        <strong>${fallbackSummary.room.name || "Room"}</strong>
        <p>${fallbackSummary.room.meal || ""}</p>
        <p class="muted">Guests: ${guests || "-"}</p>
        <p class="muted">${price || ""}</p>
      `;
      staySummaryEl.appendChild(div);
      return;
    }
    staySummaryEl.innerHTML = `<div class="muted">No room data provided.</div>`;
    return;
  }
  const fragment = document.createDocumentFragment();
  rooms.forEach((room, idx) => {
    const div = document.createElement("div");
    div.className = "summary-card";
    const guests = Array.isArray(room.guests) ? room.guests.map((g) => `${g.type || "guest"} ${g.name || ""}`.trim()).join(", ") : "-";
    const payment = room.payment_options?.payment_types?.[0] || form.payment_type || {};
    const price = formatPrice(payment.show_amount || payment.amount, payment.show_currency_code || payment.currency_code);
    div.innerHTML = `
      <p class="muted">Room ${idx + 1}</p>
      <strong>${room.name || room.room_name || "Room"}</strong>
      <p>${room.rate_name || room.board_name || ""}</p>
      <p class="muted">Guests: ${guests || "-"}</p>
      <p class="muted">${price || ""}</p>
    `;
    fragment.appendChild(div);
  });
  staySummaryEl.appendChild(fragment);
}

function deriveHotelFromPayload(payload) {
  if (!payload) return null;
  const hotels =
    (Array.isArray(payload?.data?.hotels) && payload.data.hotels) ||
    (Array.isArray(payload?.hotels) && payload.hotels) ||
    [];
  if (!hotels.length) return null;
  const hotel = hotels[0];
  return {
    id: hotel?.id || null,
    hid: hotel?.hid || null,
    name: hotel?.name || hotel?.hotel_name || hotel?.legal_info?.hotel?.name || null,
    city: hotel?.city || hotel?.city_name || hotel?.legal_info?.hotel?.city || null,
    address: hotel?.address || hotel?.legal_info?.hotel?.address || null,
    country: hotel?.country || hotel?.country_name || hotel?.legal_info?.hotel?.country || null,
  };
}

function renderHotelSummary(form = {}, fallbackSummary, fallbackPayload) {
  if (!hotelNameEl || !hotelDetailsEl) return;
  const rooms = Array.isArray(form.rooms) ? form.rooms : [];
  const hotelPayload = form.hotel || form.order?.hotel || {};
  const roomSample = rooms[0] || {};
  const payloadHotel = deriveHotelFromPayload(fallbackPayload);
  const fallbackId = fallbackSummary?.hotel?.id || payloadHotel?.id || null;
  const fallbackHid = fallbackSummary?.hotel?.hid || payloadHotel?.hid || null;
  const hotelName =
    hotelPayload.name ||
    hotelPayload.hotel_name ||
    form.hotel_name ||
    form.order?.hotel_name ||
    roomSample.hotel_name ||
    roomSample.name ||
    fallbackSummary?.hotel?.name ||
    payloadHotel?.name ||
    fallbackId ||
    (fallbackHid ? `Hotel #${fallbackHid}` : null);
  hotelNameEl.textContent = hotelName || "Hotel not specified";

  const checkin =
    form.checkin ||
    form.order?.checkin ||
    hotelPayload.checkin ||
    form.arrival_date ||
    fallbackSummary?.stay?.checkin ||
    null;
  const checkout =
    form.checkout ||
    form.order?.checkout ||
    hotelPayload.checkout ||
    form.departure_date ||
    fallbackSummary?.stay?.checkout ||
    null;
  const city =
    hotelPayload.city ||
    hotelPayload.location_city ||
    form.city ||
    form.destination_name ||
    fallbackSummary?.hotel?.city ||
    payloadHotel?.city ||
    null;
  const address = hotelPayload.address || fallbackSummary?.hotel?.address || payloadHotel?.address || null;
  const detailParts = [];
  if (city || address) {
    const locParts = [address, city].filter(Boolean);
    detailParts.push(locParts.join(", "));
  }
  if (checkin || checkout) {
    detailParts.push(`Stay ${checkin || "?"} → ${checkout || "?"}`);
  }
  const country = fallbackSummary?.hotel?.country || payloadHotel?.country || null;
  if (!detailParts.length && country) {
    detailParts.push(country);
  }
  hotelDetailsEl.textContent = detailParts.join(" · ") || "";
}

async function fetchBookingForm() {
  if (!token) {
    setStatus("Missing prebook token. Append ?token=p-... to the URL.", "error");
    return;
  }
  setStatus("Loading booking form...");
  rawFormEl.textContent = "// contacting /api/booking/form";
  try {
    const response = await fetch(`${API_BASE}/api/booking/form`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prebook_token: token }),
    });
    const payload = await response.json();
    if (!response.ok || payload?.error) {
      throw new Error(payload?.error || payload?._raw || response.status);
    }
    currentPartnerOrderId = payload.partner_order_id || null;
    partnerIdEl.textContent = currentPartnerOrderId || "-";
    rawFormEl.textContent = JSON.stringify(payload.form || {}, null, 2);
    formSummaryEl.classList.remove("hidden");
    renderStaySummary(payload.form || {}, storedPrebookSummary, storedPrebookPayload);
    renderHotelSummary(payload.form || {}, storedPrebookSummary, storedPrebookPayload);
    setStatus("Booking form fetched. Complete traveller details below.");
  } catch (err) {
    formSummaryEl.classList.add("hidden");
    rawFormEl.textContent = "";
    setStatus(`Unable to fetch booking form: ${err.message || err}`, "error");
  }
}

refreshButton?.addEventListener("click", fetchBookingForm);
copyButton?.addEventListener("click", () => {
  const text = partnerIdEl?.textContent?.trim();
  if (!text) return;
  navigator.clipboard?.writeText(text).then(() => setStatus("Partner order ID copied."));
});

async function startFloaPayment() {
  try {
    const partnerOrderId = currentPartnerOrderId || partnerIdEl?.textContent?.trim();
    if (!partnerOrderId || partnerOrderId === "-") {
      setStatus("Missing partner order ID. Load booking form first.", "error");
      return;
    }
    const productCode = floaProductEl?.value || "";
    if (!productCode) {
      setStatus("Choose a Floa product before starting payment.", "error");
      return;
    }
    const civility = civilityEl?.value || "";
    if (!civility) {
      setStatus("Please select a civility for the traveller.", "error");
      return;
    }
    const fullName = nameEl?.value?.trim() || "";
    const [firstName, ...restName] = fullName.split(" ");
    const lastName = restName.join(" ") || firstName || "Traveller";
    const email = emailEl?.value?.trim();
    const phone = phoneEl?.value?.trim();
    if (!email || !phone || !fullName) {
      setStatus("Please fill traveller name, email, and phone before payment.", "error");
      return;
    }
    const addrLine1 = addrLine1El?.value?.trim() || "";
    const zipCity = addrZipCityEl?.value?.trim() || "";
    let zipCode = "";
    let city = "";
    if (zipCity) {
      const parts = zipCity.split(" ");
      zipCode = parts.shift() || "";
      city = parts.join(" ") || "";
    }
    let countryCode = (countryCodeEl?.value || "FR").trim().toUpperCase() || "FR";

    // Try to auto-extract ZIP/city for FR if user typed full address in one field
    if (countryCode === "FR") {
      const fromAddr = addrLine1.match(/(\d{5})\s+(.+)/);
      const fromZipCity = zipCity.match(/(\d{5})\s+(.+)/);
      if (fromZipCity) {
        zipCode = fromZipCity[1];
        city = fromZipCity[2];
      } else if (fromAddr) {
        zipCode = fromAddr[1];
        city = fromAddr[2];
      }

      if (!/^\d{5}$/.test(zipCode || "")) {
        setStatus("Please enter a valid 5‑digit French ZIP code (e.g. 76710).", "error");
        return;
      }
      if (!city) {
        setStatus("Please enter a city name (e.g. Bordeaux).", "error");
        return;
      }
    }

    const customer = {
      civility,
      firstName,
      lastName,
      email,
      mobilePhoneNumber: phone,
      homeAddress: {
        line1: addrLine1,
        zipCode: zipCode || "",
        city: city || "",
        countryCode,
      },
    };

    const body = {
      partner_order_id: partnerOrderId,
      productCode,
      device: "Desktop",
      customer,
    };

    // Frontend debug: see exactly what we send to backend
    console.log("[FLOA][front] /payments/floa/hotel/deal body:", body);

    setStatus("Contacting FloaBank for eligibility and deal creation…");
    floaPayButton?.setAttribute("disabled", "disabled");

    const response = await fetch(`${API_BASE}/api/payments/floa/hotel/deal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();

    if (!response.ok || payload?.status === "nok" || payload?.error) {
      const reason =
        payload?.reason ||
        payload?.error ||
        payload?._raw ||
        `HTTP ${response.status}`;
      setStatus(`Floa payment not available: ${reason}`, "error");
      return;
    }

    setStatus("Floa deal created. You can now continue the booking flow (finalization to be wired).");
    // Optionally show deal JSON in the raw form panel for debugging
    if (rawFormEl) {
      rawFormEl.textContent = JSON.stringify(payload.deal || payload, null, 2);
    }
  } catch (err) {
    setStatus(`Floa payment error: ${err.message || err}`, "error");
  } finally {
    floaPayButton?.removeAttribute("disabled");
  }
}

floaPayButton?.addEventListener("click", (event) => {
  event.preventDefault();
  startFloaPayment();
});

document.addEventListener("DOMContentLoaded", () => {
  if (tokenEl) tokenEl.textContent = token || "-";
  if (storedPrebookSummary || storedPrebookPayload) {
    renderHotelSummary({}, storedPrebookSummary, storedPrebookPayload);
    renderStaySummary({}, storedPrebookSummary, storedPrebookPayload);
  }
  if (token) fetchBookingForm();
  else setStatus("Provide a prebook token in the URL to load the booking form.", "error");
});
