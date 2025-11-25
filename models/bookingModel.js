"use strict";

const { callETG } = require("../utils/etg");
const httpError = require("../src/utils/httpError");
const searchModel = require("./searchModel");
const { savePrebook } = require("../utils/repo");

const HOTEL_HASH_REGEX = /^h-/i;
const PREBOOK_HASH_REGEX = /^p-/i;

function normalizeHash(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function isHotelHash(hash) {
  return HOTEL_HASH_REGEX.test(hash || "");
}

function shouldRefreshAfterPrebookError(error, hash, hpContext) {
  if (!hpContext) return false;
  const stale = error?.debug?.error === "no_available_rates" || error?.message === "no_available_rates";
  return stale && isHotelHash(hash);
}

function extractPrebookToken(response) {
  if (!response) return null;
  if (typeof response === "string") return response;
  if (typeof response.token === "string") return response.token;
  if (typeof response.prebook_token === "string") return response.prebook_token;

  const hotelBuckets = response.prebook_token?.hotels || response.hotels || [];
  for (const hotel of hotelBuckets) {
    const rates = Array.isArray(hotel?.rates) ? hotel.rates : [];
    for (const rate of rates) {
      if (typeof rate?.book_hash === "string" && PREBOOK_HASH_REGEX.test(rate.book_hash)) {
        return rate.book_hash;
      }
    }
  }
  return null;
}

function buildPrebookSummary(response, token, context = {}) {
  if (!response) return null;
  const hotelsCandidate =
    (Array.isArray(response?.data?.hotels) && response.data.hotels) ||
    (Array.isArray(response?.hotels) && response.hotels) ||
    [];
  const hotels = Array.isArray(hotelsCandidate) ? hotelsCandidate : [];
  let pickedHotel = null;
  let pickedRate = null;
  for (const hotel of hotels) {
    const rates = Array.isArray(hotel?.rates) ? hotel.rates : [];
    for (const rate of rates) {
      if (typeof rate?.book_hash === "string" && (!token || rate.book_hash === token)) {
        pickedHotel = hotel;
        pickedRate = rate;
        break;
      }
    }
    if (pickedHotel) break;
  }
  if (!pickedHotel && hotels[0]) {
    pickedHotel = hotels[0];
    const rates = Array.isArray(pickedHotel?.rates) ? pickedHotel.rates : [];
    pickedRate = rates.find((rate) => typeof rate?.book_hash === "string") || rates[0] || null;
  }
  const payment = pickedRate?.payment_options?.payment_types?.[0];
  const hpContext = context?.hpContext || {};
  const legalHotel = pickedRate?.legal_info?.hotel || pickedHotel?.legal_info?.hotel || null;
  const normalizeText = (value) => (typeof value === "string" && value.trim().length ? value.trim() : null);
  const hotelName =
    normalizeText(pickedHotel?.name) ||
    normalizeText(pickedHotel?.hotel_name) ||
    normalizeText(pickedHotel?.hotel_name_trans) ||
    normalizeText(legalHotel?.name) ||
    normalizeText(context?.requestMeta?.hotel_name) ||
    null;
  const hotelCity =
    normalizeText(pickedHotel?.city) ||
    normalizeText(pickedHotel?.city_name) ||
    normalizeText(legalHotel?.city) ||
    normalizeText(hpContext?.city) ||
    normalizeText(hpContext?.hp_city) ||
    null;
  const hotelAddress =
    normalizeText(pickedHotel?.address) ||
    normalizeText(pickedHotel?.address_full) ||
    normalizeText(legalHotel?.address) ||
    normalizeText(context?.requestMeta?.hotel_address) ||
    null;
  const hotelCountry =
    normalizeText(pickedHotel?.country) ||
    normalizeText(pickedHotel?.country_name) ||
    normalizeText(legalHotel?.country) ||
    null;
  const summary = {
    token: token || pickedRate?.book_hash || null,
    created_at: new Date().toISOString(),
    hotel: {
      id: pickedHotel?.id || null,
      hid: pickedHotel?.hid || null,
      name: hotelName,
      city: hotelCity,
      address: hotelAddress,
      country: hotelCountry,
    },
    stay: {
      checkin: hpContext.checkin || response?.checkin || null,
      checkout: hpContext.checkout || response?.checkout || null,
      guests: hpContext.guests || null,
      currency: hpContext.currency || payment?.show_currency_code || payment?.currency_code || null,
      language: hpContext.language || null,
    },
    room: {
      name: pickedRate?.room_name || pickedRate?.room_data_trans?.main_name || null,
      meal: pickedRate?.meal || null,
      price: payment?.show_amount || payment?.amount || null,
      currency: payment?.show_currency_code || payment?.currency_code || null,
      daily_prices: pickedRate?.daily_prices || null,
      match_hash: pickedRate?.match_hash || null,
    },
  };
  return summary;
}

async function createPrebook(hash, priceIncreasePercent = 0, context = {}) {
  const payload = { hash, price_increase_percent: priceIncreasePercent };
  const response = await callETG("POST", "/hotel/prebook/", payload);
  const token = extractPrebookToken(response);
  if (!token) {
    throw httpError(500, "prebook_failed", { hash, response });
  }
  const summary = buildPrebookSummary(response, token, context);
  try {
    await savePrebook({ offerId: hash, token, summary, rawPayload: response });
  } catch (_) {
    // best effort logging only
  }
  return { token, response, summary };
}

async function refreshPrebook(hpContext = {}, options = {}) {
  const body = searchModel.buildHotelPageRequest({
    ...hpContext,
    id: hpContext.id || hpContext.hid,
  });
  const hp = await searchModel.fetchHotelPage(body);
  const hotels = Array.isArray(hp?.hotels) ? hp.hotels : [];
  const rates = hotels[0]?.rates || [];
  if (!rates.length) {
    throw httpError(400, "no fresh rates available after refresh");
  }

  const candidate =
    rates.find((rate) => {
      if (options.meal && rate.meal !== options.meal) return false;
      if (options.roomName && rate.room_name !== options.roomName) return false;
      return true;
    }) || rates[0];

  if (!candidate?.hash || !isHotelHash(candidate.hash)) {
    throw httpError(400, "no valid h- hash in refreshed rates");
  }

  const { token, response, summary } = await createPrebook(candidate.hash, options.priceIncreasePercent || 0, {
    hpContext,
    ratePreferences: options,
  });
  return {
    token,
    response,
    summary,
    picked: {
      meal: candidate.meal,
      room_name: candidate.room_name,
      hash: candidate.hash,
    },
  };
}

function ensurePrebookHash(raw) {
  const normalized = normalizeHash(raw);
  if (!normalized || !PREBOOK_HASH_REGEX.test(normalized)) {
    throw httpError(400, "book_hash is required and must start with 'p-'");
  }
  return normalized;
}

async function requestBookingForm(payload) {
  return callETG("POST", "/hotel/order/booking/form/", payload);
}

function buildBookingStartPayload(body = {}) {
  const {
    partner_order_id,
    language = "fr",
    user,
    rooms,
    payment_type,
    supplier_data,
    upsell_data,
    return_path,
    arrival_datetime,
  } = body;

  if (!partner_order_id) throw httpError(400, "partner_order_id is required");
  if (!user?.email || !user?.phone) {
    throw httpError(400, "user.email and user.phone are required");
  }
  if (!Array.isArray(rooms) || !rooms.length) {
    throw httpError(400, "rooms (with guests[]) is required");
  }
  if (!payment_type?.currency_code) {
    throw httpError(400, "payment_type.currency_code is required (e.g., 'EUR')");
  }
  if (!payment_type?.type) {
    payment_type.type = "deposit";
  }

  return {
    partner: { partner_order_id, comment: null, amount_sell_b2b2c: null },
    language,
    user,
    supplier_data,
    rooms,
    upsell_data,
    payment_type,
    return_path,
    arrival_datetime,
  };
}

async function startBookingProcess(payload) {
  return callETG("POST", "/hotel/order/booking/finish/", payload);
}

async function checkBookingStatus(partnerOrderId) {
  const payload = { partner_order_id: partnerOrderId };
  return callETG("POST", "/hotel/order/booking/finish/status/", payload);
}

module.exports = {
  normalizeHash,
  isHotelHash,
  shouldRefreshAfterPrebookError,
  createPrebook,
  refreshPrebook,
  ensurePrebookHash,
  requestBookingForm,
  buildBookingStartPayload,
  startBookingProcess,
  checkBookingStatus,
};
