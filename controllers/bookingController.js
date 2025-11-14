"use strict";

const { randomUUID } = require("crypto");
const bookingModel = require("../models/bookingModel");
const httpError = require("../src/utils/httpError");

/**
 * Create a prebook token from an ETG hash. Tries to refresh rates when stale.
 */
async function prebook(req, res, next) {
  try {
    const {
      search_hash,
      book_hash,
      hash,
      offer_id,
      price_increase_percent = 0,
      hp_context,
      meal,
      room_name,
    } = req.body || {};

    const rawHash = search_hash || book_hash || hash || offer_id;
    const normalizedHash = bookingModel.normalizeHash(rawHash);
    if (!normalizedHash || /^m-/i.test(normalizedHash)) {
      throw httpError(400, "invalid hash: provide sr-... or h-...");
    }

    try {
      const { token, response } = await bookingModel.createPrebook(
        normalizedHash,
        price_increase_percent,
        {
          hpContext: hp_context,
          requestMeta: {
            meal,
            room_name,
          },
        }
      );
      const etgPayload = response && typeof response === "object" ? response : {};
      return res.json({
        ...etgPayload,
        endpoint: "/hotel/prebook/",
        prebook_token: token,
      });
    } catch (error) {
      if (!bookingModel.shouldRefreshAfterPrebookError(error, normalizedHash, hp_context)) {
        throw error;
      }

      const refreshed = await bookingModel.refreshPrebook(hp_context, {
        priceIncreasePercent: price_increase_percent,
        meal,
        roomName: room_name,
      });

      const etgPayload = refreshed.response && typeof refreshed.response === "object" ? refreshed.response : {};
      return res.json({
        ...etgPayload,
        endpoint: "/hotel/prebook/",
        prebook_token: refreshed.token,
        refreshed: true,
        picked: refreshed.picked,
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Request booking form data once the prebook (p-) hash exists.
 */
async function bookingForm(req, res, next) {
  try {
    const { prebook_token, token, book_hash, language = "en" } = req.body || {};
    const raw = book_hash || prebook_token || token;
    const normalized = bookingModel.ensurePrebookHash(raw);
    const partner_order_id = randomUUID();
    const payload = {
      partner_order_id,
      book_hash: normalized,
      language,
      user_ip: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip,
    };

    const form = await bookingModel.requestBookingForm(payload);
    res.json({
      status: "ok",
      partner_order_id,
      form,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Final booking call (aka finish) with rooms, user, and payment payloads.
 */
async function startBooking(req, res, next) {
  try {
    const payload = bookingModel.buildBookingStartPayload(req.body || {});
    const start = await bookingModel.startBookingProcess(payload);
    res.json({ status: "ok", start });
  } catch (error) {
    next(error);
  }
}

/**
 * Poll ETG for the booking status.
 */
async function checkBooking(req, res, next) {
  try {
    const { partner_order_id } = req.body || {};
    if (!partner_order_id) {
      throw httpError(400, "partner_order_id is required");
    }
    const check = await bookingModel.checkBookingStatus(partner_order_id);
    res.json({ status: "ok", check });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  prebook,
  bookingForm,
  startBooking,
  checkBooking,
};
