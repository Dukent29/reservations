const $ = (selector) => document.querySelector(selector);

const API_BASE = (() => {
  try {
    const { hostname, port, origin } = window.location;
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1";
    if (port === "3000") return "";
    if (isLocalhost) return "http://localhost:3000";
    return origin;
  } catch (_) {
    return "";
  }
})();

const PREBOOK_SUMMARY_KEY = "booking:lastPrebook";
const LAST_PARTNER_KEY = "booking:lastPartnerOrderId";
const LAST_CUSTOMER_KEY = "booking:lastCustomer";

const partnerIdEl = $("#successPartnerOrderId");
const statusEl = $("#successStatus");
const hotelNameEl = $("#successHotelName");
const stayDetailsEl = $("#successStayDetails");
const amountEl = $("#successAmount");
const summaryEl = $("#successSummary");
const guestListEl = $("#guestList");
const addGuestBtn = $("#addGuestBtn");
const contactEmailEl = $("#successContactEmail");
const contactPhoneEl = $("#successContactPhone");
const commentEl = $("#successComment");
const confirmBtn = $("#confirmBookingBtn");
const finalizeStatusEl = $("#bookingFinalizeStatus");
const debugEl = $("#successDebug");

let currentPartnerOrderId = null;
let currentPaymentInfo = null;
let storedPrebookSummary = null;
let storedPrebookPayload = null;
let storedCustomer = null;

function setStatus(message, type = "info") {
  if (!statusEl) return;
  statusEl.textContent = message || "";
  statusEl.classList.toggle("error", type === "error");
}

function setFinalizeStatus(message, type = "info") {
  if (!finalizeStatusEl) return;
  finalizeStatusEl.textContent = message || "";
  finalizeStatusEl.classList.toggle("error", type === "error");
}

function appendDebug(label, data) {
  if (!debugEl) return;
  const time = new Date().toISOString();
  const header = `// [${time}] ${label}\n`;
  let body;
  try {
    body = JSON.stringify(data, null, 2);
  } catch (_) {
    body = String(data);
  }
  debugEl.textContent = `${header}${body}\n\n${debugEl.textContent || ""}`;
}

function redirectToConfirmationPage({ supplierReference, partnerOrderId, delaySeconds = 6 } = {}) {
  const params = new URLSearchParams();
  if (partnerOrderId) params.set("partner_order_id", partnerOrderId);
  if (supplierReference) params.set("supplier_reference", supplierReference);
  params.set("next", "booking.html");
  params.set("next_label", "le formulaire de reservation");
  params.set("delay", String(delaySeconds));
  window.location.href = `booking-finished.html?${params.toString()}`;
}

function loadSessionData() {
  try {
    if (typeof sessionStorage === "undefined") return;
    const rawSummary = sessionStorage.getItem(PREBOOK_SUMMARY_KEY);
    if (rawSummary) {
      const parsed = JSON.parse(rawSummary);
      if (parsed?.summary || parsed?.payload) {
        storedPrebookSummary = parsed.summary || null;
        storedPrebookPayload = parsed.payload || null;
      } else {
        storedPrebookSummary = parsed;
        storedPrebookPayload = parsed?.payload || null;
      }
    }
    const rawCustomer = sessionStorage.getItem(LAST_CUSTOMER_KEY);
    if (rawCustomer) {
      storedCustomer = JSON.parse(rawCustomer);
    }
  } catch (_) {
    storedPrebookSummary = storedPrebookSummary || null;
    storedPrebookPayload = storedPrebookPayload || null;
    storedCustomer = storedCustomer || null;
  }
}

function derivePartnerOrderId() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("partner_order_id");
  if (fromQuery) return fromQuery;
  try {
    if (typeof sessionStorage !== "undefined") {
      const stored = sessionStorage.getItem(LAST_PARTNER_KEY);
      if (stored) return stored;
    }
  } catch (_) {
    // ignore
  }
  return null;
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

function deriveHotelSummary() {
  if (!storedPrebookSummary && !storedPrebookPayload) return;
  const summary = storedPrebookSummary || {};
  const hotel = summary.hotel || {};
  const stay = summary.stay || {};
  const room = summary.room || {};

  const name = hotel.name || null;
  const city = hotel.city || null;
  const address = hotel.address || null;
  const country = hotel.country || null;

  const checkin = stay.checkin || null;
  const checkout = stay.checkout || null;

  if (hotelNameEl) {
    hotelNameEl.textContent =
      name ||
      city ||
      country ||
      "Hôtel non spécifié";
  }

  const parts = [];
  if (address || city) {
    const locParts = [address, city].filter(Boolean);
    parts.push(locParts.join(", "));
  }
  if (checkin || checkout) {
    parts.push(`Séjour ${checkin || "?"} → ${checkout || "?"}`);
  }
  if (!parts.length && country) {
    parts.push(country);
  }
  if (stayDetailsEl) {
    stayDetailsEl.textContent = parts.join(" · ");
  }

  let amount = null;
  let currency = null;
  if (room && room.price) {
    amount = room.price;
    currency = room.currency || stay.currency || null;
  }
  if (currentPaymentInfo && Number.isFinite(currentPaymentInfo.amount)) {
    amount = currentPaymentInfo.amount;
    currency = currentPaymentInfo.currency_code || currentPaymentInfo.currencyCode || currency;
  }

  if (amountEl) {
    amountEl.textContent = amount != null ? formatPrice(amount, currency || "EUR") : "-";
  }
}

function createGuestRow(index, initial) {
  const div = document.createElement("div");
  div.className = "summary-card";
  div.dataset.guestIndex = String(index);
  const first = initial?.firstName || initial?.first_name || "";
  const last = initial?.lastName || initial?.last_name || "";
  div.innerHTML = `
    <p class="muted">Voyageur ${index + 1}</p>
    <div class="row">
      <label>
        Prénom
        <input type="text" name="guest_first_name" value="${first ? String(first).replace(/"/g, "&quot;") : ""}" required />
      </label>
      <label>
        Nom
        <input type="text" name="guest_last_name" value="${last ? String(last).replace(/"/g, "&quot;") : ""}" required />
      </label>
    </div>
  `;
  return div;
}

function ensureAtLeastOneGuest() {
  if (!guestListEl) return;
  if (!guestListEl.children.length) {
    const initial = storedCustomer
      ? (() => {
          const full = storedCustomer.fullName || "";
          const parts = full.split(" ");
          const firstName = parts.shift() || "";
          const lastName = parts.join(" ") || "";
          return { firstName, lastName };
        })()
      : null;
    const row = createGuestRow(0, initial);
    guestListEl.appendChild(row);
  }
}

function collectGuests() {
  const guests = [];
  if (!guestListEl) return guests;
  const cards = guestListEl.querySelectorAll(".summary-card");
  cards.forEach((card) => {
    const firstInput = card.querySelector('input[name="guest_first_name"]');
    const lastInput = card.querySelector('input[name="guest_last_name"]');
    const firstName = firstInput?.value?.trim();
    const lastName = lastInput?.value?.trim();
    if (firstName || lastName) {
      guests.push({
        first_name: firstName || "",
        last_name: lastName || "",
      });
    }
  });
  return guests;
}

async function fetchBookingStatus(partnerOrderId) {
  try {
    setStatus("Récupération des informations de réservation…");
    const endpoint = `${API_BASE}/api/booking/status?partner_order_id=${encodeURIComponent(
      partnerOrderId
    )}`;
    const res = await fetch(endpoint);
    const payload = await res.json();
    appendDebug("RESPONSE /api/booking/status", payload);
    if (!res.ok || payload?.status !== "ok") {
      throw new Error(payload?.error || payload?.message || res.status);
    }
    currentPaymentInfo = payload.payment || null;
    if (summaryEl) summaryEl.classList.remove("hidden");
    deriveHotelSummary();
    setStatus("Paiement confirmé. Merci de confirmer les voyageurs pour finaliser la réservation.");
  } catch (err) {
    setStatus(
      `Impossible de récupérer le statut de réservation : ${err.message || err}`,
      "error"
    );
  }
}

async function submitBooking(event) {
  event.preventDefault();
  if (!currentPartnerOrderId) {
    setFinalizeStatus(
      "partner_order_id manquant. Retournez au formulaire de réservation.",
      "error"
    );
    return;
  }

  const email = contactEmailEl?.value?.trim();
  const phone = contactPhoneEl?.value?.trim();
  const comment = commentEl?.value?.trim() || null;

  if (!email || !phone) {
    setFinalizeStatus(
      "Merci de renseigner l’email et le téléphone de contact.",
      "error"
    );
    return;
  }

  const guests = collectGuests();
  if (!guests.length) {
    setFinalizeStatus(
      "Ajoutez au moins un voyageur pour finaliser la réservation.",
      "error"
    );
    return;
  }

  const mainGuest = guests[0];
  const amount =
    (currentPaymentInfo && currentPaymentInfo.amount) ||
    (storedPrebookSummary && storedPrebookSummary.room && storedPrebookSummary.room.price) ||
    null;
  const currency =
    (currentPaymentInfo &&
      (currentPaymentInfo.currency_code || currentPaymentInfo.currencyCode)) ||
    (storedPrebookSummary && storedPrebookSummary.stay && storedPrebookSummary.stay.currency) ||
    "EUR";

  const paymentType = {
    type: "deposit",
    amount: amount != null ? String(amount) : "0",
    currency_code: currency || "EUR",
  };

  const body = {
    partner_order_id: currentPartnerOrderId,
    language: "fr",
    user: {
      email,
      phone,
      comment,
    },
    supplier_data: {
      first_name_original: mainGuest.first_name || "",
      last_name_original: mainGuest.last_name || "",
      phone,
      email,
    },
    rooms: [
      {
        guests,
      },
    ],
    payment_type: paymentType,
  };

  try {
    setFinalizeStatus("Finalisation de la réservation auprès du fournisseur…");
    confirmBtn?.setAttribute("disabled", "disabled");
    appendDebug("REQUEST /api/booking/start", body);
    const res = await fetch(`${API_BASE}/api/booking/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json();
    appendDebug("RESPONSE /api/booking/start", payload);
    if (!res.ok || payload?.status !== "ok") {
      const baseMessage =
        payload?.error ||
        payload?.message ||
        (payload?.debug && (payload.debug.error || payload.debug.reason)) ||
        `HTTP ${res.status}`;
      const detail =
        payload && typeof payload === "object"
          ? JSON.stringify(payload, null, 2)
          : String(baseMessage);
      const error = new Error(baseMessage);
      error._detail = detail;
      throw error;
    }
    const start = payload.start || {};
    const etgOrderId = start.order_id || start.id || null;
    const successMessage =
      etgOrderId
        ? `Réservation confirmée (référence fournisseur : ${etgOrderId}).`
        : "Réservation confirmée. La référence fournisseur sera disponible prochainement.";
    setFinalizeStatus(successMessage, "info");
    redirectToConfirmationPage({
      supplierReference: etgOrderId || "",
      partnerOrderId: currentPartnerOrderId || "",
    });
  } catch (err) {
    const detail = err && err._detail ? err._detail : err?.message || String(err || "");
    const errorMessage = `Erreur lors de la finalisation de la réservation :\n${detail}`;
    setFinalizeStatus(errorMessage, "error");
    try {
      alert(errorMessage);
    } catch (_) {
      // ignore alert failures
    }
  } finally {
    confirmBtn?.removeAttribute("disabled");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadSessionData();
  currentPartnerOrderId = derivePartnerOrderId();
  if (partnerIdEl) {
    partnerIdEl.textContent = currentPartnerOrderId || "-";
  }
  if (!currentPartnerOrderId) {
    setStatus(
      "Impossible de retrouver la référence de commande partenaire. Retournez au formulaire de réservation.",
      "error"
    );
  } else {
    fetchBookingStatus(currentPartnerOrderId);
  }

  if (storedCustomer) {
    if (contactEmailEl && storedCustomer.email) contactEmailEl.value = storedCustomer.email;
    if (contactPhoneEl && storedCustomer.phone) contactPhoneEl.value = storedCustomer.phone;
  }

  ensureAtLeastOneGuest();

  addGuestBtn?.addEventListener("click", () => {
    if (!guestListEl) return;
    const index = guestListEl.children.length;
    const row = createGuestRow(index, null);
    guestListEl.appendChild(row);
  });

  const form = document.getElementById("successBookingForm");
  form?.addEventListener("submit", submitBooking);
});
