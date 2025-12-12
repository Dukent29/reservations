const $ = (selector) => document.querySelector(selector);

const params = new URLSearchParams(window.location.search);
const partnerOrderId = params.get("partner_order_id") || params.get("partnerOrderId") || "";
const supplierReference = params.get("supplier_reference") || params.get("supplierReference") || "";
const nextTarget = params.get("next") || "booking.html";
const nextLabel = params.get("next_label") || "le formulaire de r\u00e9servation";
const countdownSeconds = (() => {
  const raw = Number(params.get("delay"));
  if (!Number.isFinite(raw) || raw <= 0) return 6;
  return Math.min(Math.max(Math.round(raw), 3), 60);
})();

const confirmationMessageEl = $("#confirmationMessage");
const partnerOrderEl = $("#partnerOrderValue");
const supplierRefEl = $("#supplierRefValue");
const redirectCountdownEl = $("#redirectCountdown");
const redirectTargetLabelEl = $("#redirectTargetLabel");
const backHomeBtn = $("#backHomeBtn");
const stayHereLink = $("#stayHereLink");

function describeDestination(label) {
  if (!label) return "le formulaire de r\u00e9servation";
  return label;
}

function updateMessage() {
  if (partnerOrderEl && partnerOrderId) {
    partnerOrderEl.textContent = partnerOrderId;
  }
  if (supplierRefEl) {
    if (supplierReference) {
      supplierRefEl.textContent = supplierReference;
    } else {
      supplierRefEl.textContent = "En attente";
    }
  }
  if (confirmationMessageEl) {
    confirmationMessageEl.textContent = supplierReference
      ? "R\u00e9servation confirm\u00e9e. La r\u00e9f\u00e9rence fournisseur est disponible."
      : "R\u00e9servation confirm\u00e9e. La r\u00e9f\u00e9rence fournisseur sera disponible prochainement.";
  }
  if (redirectTargetLabelEl) {
    redirectTargetLabelEl.textContent = describeDestination(nextLabel);
  }
}

function startCountdown() {
  if (!redirectCountdownEl) {
    setTimeout(() => {
      window.location.href = nextTarget;
    }, countdownSeconds * 1000);
    return;
  }

  let remaining = countdownSeconds;
  const tick = () => {
    redirectCountdownEl.textContent = String(remaining);
    if (remaining <= 0) {
      window.location.href = nextTarget;
      return;
    }
    remaining -= 1;
    setTimeout(tick, 1000);
  };
  tick();
}

document.addEventListener("DOMContentLoaded", () => {
  updateMessage();
  if (stayHereLink) {
    stayHereLink.href = "reservation.html";
  }
  backHomeBtn?.addEventListener("click", () => {
    window.location.href = nextTarget;
  });
  startCountdown();
});
