"use strict";

const { randomUUID } = require("crypto");
const bookingModel = require("../models/bookingModel");
const httpError = require("../src/utils/httpError");
const { saveBookingForm, saveBooking } = require("../utils/repo");
const db = require("../utils/db");

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
    const { prebook_token, token, book_hash, language = "fr" } = req.body || {};
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

    // NEW: persist for later payment / post‑payment steps
    try {
      await saveBookingForm({
        partnerOrderId: partner_order_id,
        prebookToken: normalized,
        form,
      });
    } catch (e) {
      console.error("[DB] failed to persist booking form:", e.message);
      // keep request flowing even if logging fails
    }

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
    const body = req.body || {};
    const payload = bookingModel.buildBookingStartPayload(body);

    // Enforce that payment has been successfully completed before calling ETG.
    const partnerOrderId = payload.partner?.partner_order_id || null;
    if (!partnerOrderId) {
      throw httpError(400, "partner_order_id is required");
    }

    try {
      const paymentCheck = await db.query(
        `SELECT provider, status, amount, currency_code, external_reference
         FROM payments
         WHERE partner_order_id = $1
         ORDER BY id DESC
         LIMIT 1`,
        [partnerOrderId]
      );

      const paymentRow = paymentCheck.rows[0] || null;

      // If there is no payment row, or status is not "paid", block the booking.
      // This protects against calling /api/booking/start without going through Floa/Systempay.
      if (!paymentRow || paymentRow.status !== "paid") {
        const status = paymentRow ? paymentRow.status : "none";
        throw httpError(403, "payment_required_before_booking_finish", {
          partner_order_id: partnerOrderId,
          payment_status: status,
          provider: paymentRow && paymentRow.provider,
        });
      }
    } catch (err) {
      // If httpError was thrown above, let the global error handler send it.
      if (err && err.statusCode) {
        throw err;
      }
      console.error("[DB] payment check failed before booking finish:", err.message);
      throw httpError(500, "payment_check_failed");
    }

    const start = await bookingModel.startBookingProcess(payload);

    try {
      const etgOrderId = start?.order_id || start?.id || null;
      const user = payload.user || {};
      const paymentType = payload.payment_type || {};
      const status = start?.status || "pending";

      await saveBooking({
        partnerOrderId,
        prebookToken: payload.prebook_token || null,
        etgOrderId,
        status,
        userEmail: user.email || null,
        userPhone: user.phone || null,
        userName: `${user.first_name || ""} ${user.last_name || ""}`.trim() || null,
        amount: paymentType.amount,
        currencyCode: paymentType.currency_code,
        raw: start,
      });
    } catch (e) {
      console.error("[DB] saveBooking failed:", e.message);
    }

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

/**
 * Return booking/payment status from our DB for a given partner_order_id.
 */
async function getBookingStatus(req, res, next) {
  try {
    const partner_order_id =
      req.query.partner_order_id || (req.body && req.body.partner_order_id);

    if (!partner_order_id) {
      throw httpError(400, "partner_order_id is required");
    }

    const bookingResult = await db.query(
      `SELECT *
       FROM bookings
       WHERE partner_order_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [partner_order_id]
    );

    const paymentResult = await db.query(
      `SELECT *
       FROM payments
       WHERE partner_order_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [partner_order_id]
    );

    const booking = bookingResult.rows[0] || null;
    const payment = paymentResult.rows[0] || null;

    // Simple synthesized status for frontend convenience
    let combinedStatus = "unknown";
    const paymentStatus = payment && payment.status;
    const bookingStatus = booking && booking.status;

    if (bookingStatus) {
      combinedStatus = bookingStatus;
    } else if (paymentStatus) {
      combinedStatus = paymentStatus;
    }

    res.json({
      status: "ok",
      partner_order_id,
      combined_status: combinedStatus,
      booking,
      payment,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  prebook,
  bookingForm,
  startBooking,
  checkBooking,
  getBookingStatus,
};
