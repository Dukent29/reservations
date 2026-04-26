"use strict";

const { randomUUID } = require("crypto");
const https = require("https");
const axios = require("axios");
const bookingModel = require("../models/bookingModel");
const httpError = require("../src/utils/httpError");
const {
  saveBookingForm,
  saveBooking,
  getPrebookSummary,
  parseAmount,
  insertApiLog,
  updateBookingVoucherState,
  createAdminNotification,
} = require("../utils/repo");
const db = require("../utils/db");
const { queueVoucherEmailJob } = require("../services/voucherEmailService");
const promoCodeModel = require("../models/promoCodeModel");
const {
  normalizeVoucherLanguage,
  downloadVoucherPdfWithRetry,
} = require("../services/etgVoucherClient");

const KOTAN_EXTERN_INFO_URL = process.env.KOTAN_EXTERN_INFO_URL || "";
const KOTAN_EXTERN_ACCEPT_SELF_SIGNED =
  String(process.env.KOTAN_EXTERN_ACCEPT_SELF_SIGNED || "").toLowerCase() ===
  "true";
const ETG_BOOKING_CONTACT_EMAIL = String(
  process.env.ETG_BOOKING_CONTACT_EMAIL || "kotanvoyages@outlook.com",
).trim();

const DEFAULT_PRICE_INCREASE_PERCENT = 10;
const ETG_VOUCHER_AUTO_REQUEUE_WINDOWS_MINUTES = String(
  process.env.ETG_VOUCHER_AUTO_REQUEUE_WINDOWS_MINUTES || "2,5,6",
)
  .split(",")
  .map((value) => Number.parseInt(String(value).trim(), 10))
  .filter((value) => Number.isFinite(value) && value > 0);
const ETG_VOUCHER_AUTO_MAX_CYCLES = Math.max(
  1,
  Number.parseInt(process.env.ETG_VOUCHER_AUTO_MAX_CYCLES, 10) || 4,
);

function buildEtgBookingPayload(payload) {
  if (!ETG_BOOKING_CONTACT_EMAIL) return payload;

  return {
    ...payload,
    user: {
      ...(payload.user || {}),
      email: ETG_BOOKING_CONTACT_EMAIL,
    },
    supplier_data:
      payload.supplier_data && typeof payload.supplier_data === "object"
        ? {
            ...payload.supplier_data,
            email: ETG_BOOKING_CONTACT_EMAIL,
          }
        : payload.supplier_data,
  };
}

function applyMarkupAmount(amount, percent) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return null;
  const markup = Number(percent);
  const ratio = Number.isFinite(markup) ? 1 + markup / 100 : 1;
  return Math.round(num * ratio * 100) / 100;
}

function toSafeInlineFilename(filename, fallback) {
  const raw = String(filename || fallback || "voucher.pdf").trim();
  return raw.replace(/["\r\n]/g, "_") || "voucher.pdf";
}

function getVoucherAutoDelayMs(nextCycle) {
  if (!ETG_VOUCHER_AUTO_REQUEUE_WINDOWS_MINUTES.length) {
    return 2 * 60 * 1000;
  }
  const index = Math.max(
    0,
    Math.min(
      ETG_VOUCHER_AUTO_REQUEUE_WINDOWS_MINUTES.length - 1,
      nextCycle - 2,
    ),
  );
  return ETG_VOUCHER_AUTO_REQUEUE_WINDOWS_MINUTES[index] * 60 * 1000;
}

function buildVoucherHttpError(error, partnerOrderId) {
  const code = String(error?.message || "voucher_retrieve_failed");
  const statusCode = Number(error?.statusCode || error?.http || 0);
  const details = {
    partner_order_id: partnerOrderId,
  };

  if (error?.details && typeof error.details === "object") {
    Object.assign(details, error.details);
  }
  if (error?.debug && typeof error.debug === "object") {
    details.etg = error.debug;
  }

  if (error?.retryable) {
    return httpError(409, code, { ...details, retryable: true });
  }
  if (code === "order_not_found") {
    return httpError(404, code, details);
  }
  if (statusCode >= 400) {
    return httpError(statusCode, code, details);
  }
  return httpError(502, code, details);
}

async function fetchVoucherForBooking(partnerOrderId, options = {}) {
  const language = normalizeVoucherLanguage(options.language);

  await updateBookingVoucherState(partnerOrderId, {
    voucherStatus: "queued",
    voucherAttempts: 0,
    voucherLastError: null,
  }).catch((error) => {
    console.error(
      "[voucher] failed to persist queued state:",
      error?.message || String(error),
    );
  });

  return downloadVoucherPdfWithRetry(partnerOrderId, language, {
    onAttempt: async ({ attempt, status, error, filename }) => {
      const fields = {
        voucherStatus: status,
        voucherAttempts: attempt,
        voucherLastError: error ? String(error.message || error) : null,
        voucherLastAttemptAt: new Date().toISOString(),
      };

      if (filename) {
        fields.voucherFilename = filename;
      }
      if (status === "ready") {
        fields.voucherReadyAt = new Date().toISOString();
      }

      await updateBookingVoucherState(partnerOrderId, fields).catch((dbError) => {
        console.error(
          "[voucher] failed to persist attempt state:",
          dbError?.message || String(dbError),
        );
      });
    },
  });
}

function queueVoucherRetrieval({ partnerOrderId, language = "fr", cycle = 1 }) {
  const run = async () => {
    try {
      await fetchVoucherForBooking(partnerOrderId, { language });
    } catch (error) {
      console.warn(
        "[voucher] retrieval cycle failed",
        JSON.stringify({
          partnerOrderId,
          cycle,
          retryable: Boolean(error?.retryable),
          error: error?.message || String(error),
        }),
      );

      const nextCycle = cycle + 1;
      if (!error?.retryable || nextCycle > ETG_VOUCHER_AUTO_MAX_CYCLES) {
        return;
      }

      const delayMs = getVoucherAutoDelayMs(nextCycle);
      setTimeout(() => {
        queueVoucherRetrieval({
          partnerOrderId,
          language,
          cycle: nextCycle,
        });
      }, delayMs);
    }
  };

  setImmediate(() => {
    run().catch((error) => {
      console.error(
        "[voucher] background retrieval failed:",
        error?.message || String(error),
      );
    });
  });
}

/**
 * Create a prebook token from an ETG hash. Tries to refresh rates when stale.
 * Logs request and response to api_logs (Réserver button flow).
 */
async function prebook(req, res, next) {
  const logRequest = {
    method: req.method || "POST",
    url: req.originalUrl || req.url || "/api/prebook",
    body: req.body || {},
  };

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
        },
      );
      const etgPayload =
        response && typeof response === "object" ? response : {};
      const responseData = {
        ...etgPayload,
        endpoint: "/hotel/prebook/",
        prebook_token: token,
      };
      await insertApiLog({
        endpoint: "POST /api/prebook",
        request: logRequest,
        response: responseData,
        statusCode: 200,
      });
      return res.json(responseData);
    } catch (error) {
      if (
        !bookingModel.shouldRefreshAfterPrebookError(
          error,
          normalizedHash,
          hp_context,
        )
      ) {
        throw error;
      }

      const refreshed = await bookingModel.refreshPrebook(hp_context, {
        priceIncreasePercent: price_increase_percent,
        meal,
        roomName: room_name,
      });

      const etgPayload =
        refreshed.response && typeof refreshed.response === "object"
          ? refreshed.response
          : {};
      const responseData = {
        ...etgPayload,
        endpoint: "/hotel/prebook/",
        prebook_token: refreshed.token,
        refreshed: true,
        picked: refreshed.picked,
      };
      await insertApiLog({
        endpoint: "POST /api/prebook",
        request: logRequest,
        response: responseData,
        statusCode: 200,
      });
      return res.json(responseData);
    }
  } catch (error) {
    const statusCode = error.statusCode || error.http || 500;
    const responseData = {
      error: error.message || "prebook_failed",
      code: error.code || error.message,
      ...(error.details && typeof error.details === "object"
        ? error.details
        : {}),
    };
    await insertApiLog({
      endpoint: "POST /api/prebook",
      request: logRequest,
      response: responseData,
      statusCode,
    }).catch((e) => console.error("[DB] prebook api_log failed:", e.message));
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

    const paymentType =
      form && Array.isArray(form.payment_types) && form.payment_types.length > 0
        ? form.payment_types[0]
        : null;
    const baseAmount =
      parseAmount(paymentType?.amount) ||
      parseAmount(form?.total_amount) ||
      parseAmount(form?.order_amount) ||
      null;
    const currency = paymentType?.currency_code || form?.currency_code || "EUR";
    const totalAmount = baseAmount
      ? applyMarkupAmount(baseAmount, DEFAULT_PRICE_INCREASE_PERCENT)
      : null;
    if (!form.pricing) {
      form.pricing = {
        base_amount: baseAmount,
        markup_percent: DEFAULT_PRICE_INCREASE_PERCENT,
        total_amount: totalAmount,
        currency,
      };
    }

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
 * Logs full request/response to api_logs (Confirmer la réservation on payment/success).
 */
async function startBooking(req, res, next) {
  const logRequest = {
    method: req.method || "POST",
    url: req.originalUrl || req.url || "/api/booking/start",
    body: req.body || {},
  };

  try {
    const body = req.body || {};
    const payload = bookingModel.buildBookingStartPayload(body);
    const customerEmail = String(payload.user?.email || "").trim().toLowerCase() || null;
    const mainGuest = Array.isArray(payload.rooms?.[0]?.guests)
      ? payload.rooms[0].guests[0] || {}
      : {};
    const customerName =
      `${mainGuest.first_name || ""} ${mainGuest.last_name || ""}`.trim() || null;

    // Enforce that payment has been successfully completed before calling ETG (unless payment_check_deactive=true).
    const partnerOrderId = payload.partner?.partner_order_id || null;
    if (!partnerOrderId) {
      throw httpError(400, "partner_order_id is required");
    }

    const paymentCheckDeactivated =
      String(process.env.payment_check_deactive || "").toLowerCase() === "true";
    if (paymentCheckDeactivated) {
      console.log(
        "[booking/start] Payment check DEACTIVATED (payment_check_deactive=true), skipping payment validation",
      );
    }

    if (!paymentCheckDeactivated) {
      try {
        console.log(
          "[booking/start] Step 1: partner_order_id =",
          partnerOrderId,
        );

        const paymentCheck = await db.query(
          `SELECT id, provider, status, amount, currency_code, external_reference, payload, created_at
         FROM payments
         WHERE partner_order_id = $1
         ORDER BY id DESC`,
          [partnerOrderId],
        );

        const allRows = paymentCheck.rows || [];
        console.log(
          "[booking/start] Step 2: payment rows count =",
          allRows.length,
        );

        allRows.forEach((row, idx) => {
          const payloadPreview =
            row.payload && typeof row.payload === "object"
              ? {
                  has_extern_payment_data: !!row.payload.extern_payment_data,
                  payment_variant:
                    row.payload?.extern_payment_data?.payment_variant,
                }
              : row.payload && typeof row.payload === "string"
                ? "(string)"
                : row.payload;
          console.log("[booking/start] Step 2.row[" + idx + "]:", {
            id: row.id,
            provider: row.provider,
            status: row.status,
            external_reference: row.external_reference,
            payload_preview: payloadPreview,
          });
        });

        let externInfoResponse = null;
        const hasKotanExtern = allRows.some(
          (r) => String(r.provider || "").trim() === "kotan_extern",
        );
        const refForExtern =
          partnerOrderId ||
          allRows.find((r) => r.external_reference)?.external_reference;

        if (hasKotanExtern && refForExtern && KOTAN_EXTERN_INFO_URL) {
          console.log(
            "[booking/start] Step 3: fetching externInfo with ref =",
            refForExtern,
            "url =",
            KOTAN_EXTERN_INFO_URL,
          );
          try {
            const axiosConfig = {
              params: { ref: refForExtern },
              timeout: 12000,
              headers: { Accept: "application/json, text/plain, */*" },
            };
            if (KOTAN_EXTERN_ACCEPT_SELF_SIGNED) {
              axiosConfig.httpsAgent = new https.Agent({
                rejectUnauthorized: false,
              });
            }
            const response = await axios.get(
              KOTAN_EXTERN_INFO_URL,
              axiosConfig,
            );
            externInfoResponse = response.data;
            console.log(
              "[booking/start] Step 3.externInfo response (ref = " +
                refForExtern +
                "):",
              JSON.stringify(externInfoResponse, null, 2),
            );
          } catch (externErr) {
            console.log(
              "[booking/start] Step 3.externInfo request failed:",
              externErr.message,
              externErr.response?.status,
              externErr.response?.data,
            );
          }
        } else {
          console.log(
            "[booking/start] Step 3: skip externInfo (hasKotanExtern =",
            hasKotanExtern,
            ", ref =",
            refForExtern,
            ", url set =",
            !!KOTAN_EXTERN_INFO_URL,
            ")",
          );
        }

        const anyPaidOrSuccess = allRows.some(
          (r) =>
            String(r.status || "")
              .trim()
              .toLowerCase() === "paid" ||
            String(r.status || "")
              .trim()
              .toLowerCase() === "success",
        );
        const anyKotanExtern = allRows.some(
          (r) => String(r.provider || "").trim() === "kotan_extern",
        );

        // ExternInfo as source of truth: if ref response says paid/success, allow booking even if DB still pending
        let externInfoSaysPaid = false;
        if (externInfoResponse && typeof externInfoResponse === "object") {
          const latest = String(externInfoResponse.latestStatus || "")
            .trim()
            .toLowerCase();
          const paymentsList = Array.isArray(externInfoResponse.payments)
            ? externInfoResponse.payments
            : [];
          const anyPaymentPaid = paymentsList.some(
            (p) =>
              p &&
              String(p.status || "")
                .trim()
                .toLowerCase() === "paid",
          );
          externInfoSaysPaid =
            latest === "paid" || latest === "success" || anyPaymentPaid;
          console.log(
            "[booking/start] Step 3b: externInfoSaysPaid =",
            externInfoSaysPaid,
            "(latestStatus =",
            externInfoResponse.latestStatus,
            ", anyPaymentPaid =",
            anyPaymentPaid,
            ")",
          );
        }

        const paymentOk =
          (allRows.length > 0 && (anyPaidOrSuccess || anyKotanExtern)) ||
          externInfoSaysPaid;

        console.log(
          "[booking/start] Step 4: anyPaidOrSuccess =",
          anyPaidOrSuccess,
          ", anyKotanExtern =",
          anyKotanExtern,
          ", externInfoSaysPaid =",
          externInfoSaysPaid,
          ", paymentOk =",
          paymentOk,
        );

        if (!paymentOk) {
          const status = allRows.length
            ? allRows.map((r) => r.status).join(",")
            : "none";
          const providers = allRows.length
            ? allRows.map((r) => r.provider).join(",")
            : "none";
          console.log(
            "[booking/start] Step 5: REJECTED — no row with status paid/success and no kotan_extern. statuses =",
            status,
            ", providers =",
            providers,
          );
          throw httpError(403, "payment_required_before_booking_finish", {
            partner_order_id: partnerOrderId,
            payment_status: status,
            provider: providers,
          });
        }
        console.log(
          "[booking/start] Step 5: payment check OK, proceeding to ETG finish",
        );
      } catch (err) {
        // If httpError was thrown above, let the global error handler send it.
        if (err && (err.statusCode || err.http)) {
          throw err;
        }
        console.error(
          "[DB] payment check failed before booking finish:",
          err.message,
        );
        throw httpError(500, "payment_check_failed");
      }
    }

    let appliedPromo = null;
    try {
      appliedPromo = await promoCodeModel.getAppliedPromoForBooking(
        partnerOrderId,
        customerEmail,
      );
    } catch (promoError) {
      if (promoError && (promoError.statusCode || promoError.http)) {
        throw promoError;
      }
      console.error("[booking/start] promo revalidation failed:", promoError.message);
      throw httpError(500, "promo_revalidation_failed");
    }

    // ETG finds the  dorder by partner_order_id; the order is created only when we called booking/form first.
    // We need book_hash so ETG can tie the finish to the same prebook; load from DB if not in body.
    if (!payload.book_hash && !payload.prebook_token) {
      try {
        const formRow = await db.query(
          `SELECT prebook_token FROM booking_forms WHERE partner_order_id = $1 ORDER BY id DESC LIMIT 1`,
          [partnerOrderId],
        );
        const token = formRow.rows[0]?.prebook_token;
        if (token) {
          payload.book_hash = token;
        }
      } catch (e) {
        console.error(
          "[DB] failed to load prebook_token for finish:",
          e.message,
        );
      }
    } else if (payload.prebook_token && !payload.book_hash) {
      payload.book_hash = payload.prebook_token;
    }

    if (!payload.book_hash) {
      throw httpError(400, "booking_form_not_found", {
        message:
          "No booking form found for this order. Please start the booking from the hotel search/booking form page. The form expires 60 minutes after loading.",
        partner_order_id: partnerOrderId,
      });
    }

    const etgPayload = buildEtgBookingPayload(payload);

    const paymentType = payload.payment_type || {};

    let start;
    try {
      start = await bookingModel.startBookingProcess(etgPayload);
    } catch (etgErr) {
      const code = etgErr && etgErr.message ? String(etgErr.message) : "";
      if (code === "order_not_found") {
        throw httpError(400, "order_not_found", {
          message:
            "The booking session was not found. Please start the booking from the hotel search/booking form page and complete payment within 60 minutes.",
          partner_order_id: partnerOrderId,
        });
      }
      if (code === "booking_form_expired") {
        throw httpError(400, "booking_form_expired", {
          message:
            "The booking form has expired (60 minutes). Please start a new search and complete the booking within 60 minutes.",
          partner_order_id: partnerOrderId,
        });
      }
      throw etgErr;
    }

    try {
      const etgOrderId = start?.order_id || start?.id || null;
      const user = payload.user || {};
      const status = start?.status || "pending";

      await saveBooking({
        partnerOrderId,
        prebookToken: payload.prebook_token || null,
        etgOrderId,
        status,
        userEmail: user.email || null,
        userPhone: user.phone || null,
        userName:
          customerName ||
          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          null,
        amount: paymentType.amount,
        currencyCode: paymentType.currency_code,
        raw: start,
      });
      if (appliedPromo) {
        await promoCodeModel.recordPromoUsage({
          partnerOrderId,
          userId: customerEmail,
          bookingId: etgOrderId || null,
          metadata: { source: "booking_start" },
        });
      }
    } catch (e) {
      console.error("[DB] saveBooking failed:", e.message);
    }

    createAdminNotification({
      kind: "booking_created",
      title: "Nouvelle reservation",
      message: customerName
        ? `${customerName} a finalise la reservation ${partnerOrderId}.`
        : `Nouvelle reservation ${partnerOrderId} finalisee.`,
      entityType: "booking",
      entityKey: partnerOrderId,
      payload: {
        partner_order_id: partnerOrderId,
        user_email: customerEmail,
        user_name: customerName,
        amount: paymentType.amount || null,
        currency_code: paymentType.currency_code || null,
      },
    });

    queueVoucherRetrieval({
      partnerOrderId,
      language: payload.language || "fr",
    });

    if (customerEmail) {
      queueVoucherEmailJob({
        partnerOrderId,
        customerEmail,
        customerName,
        language: payload.language || "fr",
      });
    }

    const responseData = { status: "ok", start };
    await insertApiLog({
      endpoint: "POST /api/booking/start",
      request: logRequest,
      response: responseData,
      statusCode: 200,
    });
    res.json(responseData);
  } catch (error) {
    const statusCode = error.statusCode || error.http || 500;
    const responseData = {
      error: error.message || "booking_start_failed",
      code: error.code || error.message,
      ...(error.details && typeof error.details === "object"
        ? error.details
        : {}),
    };
    await insertApiLog({
      endpoint: "POST /api/booking/start",
      request: logRequest,
      response: responseData,
      statusCode,
    }).catch((e) =>
      console.error("[DB] booking/start api_log failed:", e.message),
    );
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

async function downloadVoucher(req, res, next) {
  const logRequest = {
    method: req.method || "GET",
    url: req.originalUrl || req.url || "/api/booking/voucher",
    query: req.query || {},
  };

  try {
    const { partner_order_id, language = "fr" } = req.query || {};
    const voucher = await fetchVoucherForBooking(partner_order_id, { language });

    res.setHeader("Content-Type", voucher.contentType || "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${toSafeInlineFilename(
        voucher.filename,
        `bedtrip-voucher-${partner_order_id}.pdf`,
      )}"`,
    );

    await insertApiLog({
      endpoint: "GET /api/booking/voucher",
      request: logRequest,
      response: {
        status: "ok",
        partner_order_id,
        filename: voucher.filename,
        content_type: voucher.contentType,
        size: voucher.buffer?.length || 0,
      },
      statusCode: 200,
    });

    return res.send(voucher.buffer);
  } catch (error) {
    const wrappedError = buildVoucherHttpError(
      error,
      req.query?.partner_order_id,
    );
    const statusCode = wrappedError.statusCode || wrappedError.http || 500;

    await insertApiLog({
      endpoint: "GET /api/booking/voucher",
      request: logRequest,
      response: {
        error: wrappedError.message || "voucher_retrieve_failed",
        code: error?.code || wrappedError.message,
        ...(wrappedError.details && typeof wrappedError.details === "object"
          ? wrappedError.details
          : {}),
      },
      statusCode,
    }).catch((e) =>
      console.error("[DB] booking/voucher api_log failed:", e.message),
    );

    next(wrappedError);
  }
}

/**
 * Return booking/payment status from our DB for a given partner_order_id.
 * Logged to api_logs (payment/success page loads and polls this).
 */
async function getBookingStatus(req, res, next) {
  const logRequest = {
    method: req.method || "GET",
    url: req.originalUrl || req.url || "/api/booking/status",
    query: req.query || {},
    body: req.body && Object.keys(req.body).length ? req.body : undefined,
  };

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
      [partner_order_id],
    );

    const paymentResult = await db.query(
      `SELECT *
       FROM payments
       WHERE partner_order_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [partner_order_id],
    );

    const booking = bookingResult.rows[0] || null;
    const payment = paymentResult.rows[0] || null;

    const bookingFormResult = await db.query(
      `SELECT *
       FROM booking_forms
       WHERE partner_order_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [partner_order_id],
    );
    const bookingForm = bookingFormResult.rows[0] || null;
    const prebookSummary =
      bookingForm?.prebook_token
        ? await getPrebookSummary(bookingForm.prebook_token)
        : null;

    // Simple synthesized status for frontend convenience
    let combinedStatus = "unknown";
    const paymentStatus = payment && payment.status;
    const bookingStatus = booking && booking.status;

    if (bookingStatus) {
      combinedStatus = bookingStatus;
    } else if (paymentStatus) {
      combinedStatus = paymentStatus;
    }

    const voucher = booking
      ? {
          status: booking.voucher_status || null,
          attempts: Number(booking.voucher_attempts || 0),
          last_error: booking.voucher_last_error || null,
          ready_at: booking.voucher_ready_at || null,
          filename: booking.voucher_filename || null,
        }
      : {
          status: null,
          attempts: 0,
          last_error: null,
          ready_at: null,
          filename: null,
        };

    const responseData = {
      status: "ok",
      partner_order_id,
      combined_status: combinedStatus,
      booking,
      payment,
      booking_form: bookingForm,
      prebook_summary: prebookSummary,
      voucher,
    };
    await insertApiLog({
      endpoint: "GET /api/booking/status",
      request: logRequest,
      response: responseData,
      statusCode: 200,
    });
    res.json(responseData);
  } catch (error) {
    const statusCode = error.statusCode || error.http || 500;
    const responseData = {
      error: error.message || "booking_status_failed",
      code: error.code || error.message,
      ...(error.details && typeof error.details === "object"
        ? error.details
        : {}),
    };
    await insertApiLog({
      endpoint: "GET /api/booking/status",
      request: logRequest,
      response: responseData,
      statusCode,
    }).catch((e) =>
      console.error("[DB] booking/status api_log failed:", e.message),
    );
    next(error);
  }
}

/**
 * List all reservations from DB and optionally enrich with ETG status.
 * Connects to both our database and ETG API.
 */
async function listReservations(req, res, next) {
  try {
    const limit = Math.min(
      Math.max(1, parseInt(req.query.limit, 10) || 100),
      200,
    );
    const withEtg = String(req.query.etg || "true").toLowerCase() === "true";

    const bookingsResult = await db.query(
      `SELECT b.id, b.partner_order_id, b.prebook_token, b.etg_order_id, b.status,
              b.user_email, b.user_phone, b.user_name, b.amount, b.currency_code,
              b.raw, b.created_at,
              bf.form AS booking_form
       FROM bookings b
       LEFT JOIN (
         SELECT DISTINCT ON (partner_order_id) partner_order_id, form
         FROM booking_forms
         ORDER BY partner_order_id, id DESC
       ) bf ON bf.partner_order_id = b.partner_order_id
       ORDER BY b.created_at DESC
       LIMIT $1`,
      [limit],
    );

    const rows = bookingsResult.rows || [];

    if (withEtg && rows.length > 0) {
      const timeoutMs = 8000;
      const withEtgStatus = await Promise.all(
        rows.map(async (row) => {
          let etgStatus = null;
          try {
            const p = bookingModel.checkBookingStatus(row.partner_order_id);
            const t = new Promise((_, rej) =>
              setTimeout(() => rej(new Error("timeout")), timeoutMs),
            );
            const result = await Promise.race([p, t]);
            etgStatus = result;
            // If status API returned order_not_found (or similar) but we have etg_order_id in DB,
            // treat as success so the list does not show error when the order actually exists in ETG.
            const errMsg =
              (etgStatus &&
                (etgStatus.error || etgStatus.message || etgStatus.reason)) ||
              "";
            const isNotFound =
              /order_not_found|not_found|order not found/i.test(String(errMsg));
            if (isNotFound && row.etg_order_id) {
              etgStatus = {
                order_status: "confirmed",
                id: row.etg_order_id,
                _fromDb: true,
              };
            }
          } catch (err) {
            etgStatus =
              err && typeof err === "object"
                ? {
                    _error: err.message || "Erreur inconnue",
                    _http: err.http,
                    _status: err.status,
                    _debug: err.debug,
                  }
                : { _error: String(err) };
            // Same: if we have etg_order_id in DB but status call failed (e.g. timeout), show as confirmed.
            if (row.etg_order_id) {
              etgStatus = {
                order_status: "confirmed",
                id: row.etg_order_id,
                _fromDb: true,
              };
            }
          }
          return { ...row, etg_status: etgStatus };
        }),
      );
      return res.json({ status: "ok", reservations: withEtgStatus });
    }

    res.json({
      status: "ok",
      reservations: rows.map((r) => ({ ...r, etg_status: null })),
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
  fetchVoucherForBooking,
  downloadVoucher,
  getBookingStatus,
  listReservations,
};
// --
