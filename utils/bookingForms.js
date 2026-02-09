"use strict";

const db = require("./db");
const httpError = require("../src/utils/httpError");
const { parseAmount } = require("./repo");

async function getBookingFormByPartnerOrderId(partnerOrderId) {
  const sql = `
    SELECT *
    FROM booking_forms
    WHERE partner_order_id = $1
    ORDER BY id DESC
    LIMIT 1
  `;
  const result = await db.query(sql, [partnerOrderId]);
  if (!result.rows.length) {
    throw httpError(404, "booking_form_not_found");
  }
  return result.rows[0];
}

function extractAmountFromBookingForm(bf) {
  const form = bf?.form || {};
  const paymentType =
    form &&
    Array.isArray(form.payment_types) &&
    form.payment_types.length > 0
      ? form.payment_types[0]
      : null;

  const candidates = [];
  if (paymentType && paymentType.amount !== undefined) candidates.push(paymentType.amount);
  if (bf?.amount !== undefined) candidates.push(bf.amount);
  if (form && form.total_amount !== undefined) candidates.push(form.total_amount);
  if (form && form.order_amount !== undefined) candidates.push(form.order_amount);

  let amount = null;
  let usedSource = null;
  for (const c of candidates) {
    const parsed = parseAmount(c);
    if (Number.isFinite(parsed) && parsed > 0) {
      amount = parsed;
      usedSource = c;
      break;
    }
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    const first = candidates.length ? candidates[0] : null;
    let fallbackAmount = null;
    if (first !== null && first !== undefined) {
      if (typeof first === "string" && /^\d+$/.test(first)) {
        const asInt = Number(first);
        if (Number.isFinite(asInt) && asInt > 0) fallbackAmount = asInt / 100;
      }
      if (typeof first === "number" && Number.isFinite(first) && Number.isInteger(first) && first > 100) {
        fallbackAmount = first / 100;
      }
    }
    if (fallbackAmount && Number.isFinite(fallbackAmount) && fallbackAmount > 0) {
      amount = fallbackAmount;
      usedSource = first;
    }
  }

  const currency = bf?.currency_code || paymentType?.currency_code || "EUR";

  return {
    amount,
    currency,
    usedSource,
    candidates,
  };
}

function normalizeDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [yyyy, mm, dd] = str.split("-");
    return `${dd}/${mm}/${yyyy}`;
  }
  return str;
}

function extractTripDataFromBookingForm(form = {}) {
  const hotel = form.hotel || form.order?.hotel || {};
  const checkin =
    form.checkin ||
    form.order?.checkin ||
    hotel.checkin ||
    form.arrival_date ||
    null;
  const checkout =
    form.checkout ||
    form.order?.checkout ||
    hotel.checkout ||
    form.departure_date ||
    null;

  const departureDate = normalizeDate(checkin);
  const arrivalDate = normalizeDate(checkout);

  const country =
    hotel.country_code ||
    hotel.country ||
    form.country ||
    form.destination_code ||
    form.destination ||
    null;

  const destinations = Array.isArray(country)
    ? country.map((entry) => String(entry || "").trim()).filter(Boolean)
    : country
      ? [String(country).trim()]
      : [];

  const rooms = Array.isArray(form.rooms) ? form.rooms : [];
  let insuredCount = 0;
  rooms.forEach((room) => {
    if (Array.isArray(room.guests) && room.guests.length) {
      insuredCount += room.guests.length;
      return;
    }
    const occupancy = Number(room.occupancy || room.occupancy_total || room.max_occupancy || 0);
    if (Number.isFinite(occupancy) && occupancy > 0) {
      insuredCount += occupancy;
    }
  });
  if (!insuredCount) {
    const fallback = Number(form.guests_total || form.guests || form.adults || 0);
    if (Number.isFinite(fallback) && fallback > 0) insuredCount = fallback;
  }

  return {
    departureDate,
    arrivalDate,
    destinations,
    insuredCount,
  };
}

module.exports = {
  getBookingFormByPartnerOrderId,
  extractAmountFromBookingForm,
  extractTripDataFromBookingForm,
};
