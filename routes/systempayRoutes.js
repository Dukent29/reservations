// routes/systempayRoutes.js
"use strict";

const router = require("express").Router();
const axios = require("axios");
const { systempayConfig } = require("../config/systempay");
const db = require("../utils/db");
const { savePayment } = require("../utils/repo");
const { extractAmountFromBookingForm } = require("../utils/bookingForms");
const { buildInsuranceSummary } = require("../utils/insurance");
const { validate } = require("../src/middlewares/validateRequest");
const { paymentSchemas } = require("../src/middlewares/requestSchemas");

router.post("/payments/systempay/create-order", validate(paymentSchemas.systempayCreateOrder), async (req, res) => {
  try {
    const { partner_order_id, customerEmail } = req.body || {};

    if (!partner_order_id) {
      return res.status(400).json({ success: false, message: "partner_order_id is required" });
    }

    const bfResult = await db.query(
      `SELECT *
       FROM booking_forms
       WHERE partner_order_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [partner_order_id]
    );

    if (!bfResult.rows.length) {
      return res.status(404).json({ success: false, message: "booking_form_not_found_for_partner_order_id" });
    }

    const bf = bfResult.rows[0];

    const amountData = extractAmountFromBookingForm(bf);
    const amount = amountData.amount;
    if (!Number.isFinite(amount) || amount <= 0) {
      console.error("[Systempay] invalid booking_form amount", {
        partner_order_id,
        booking_form_row: bf,
        tried_candidates: amountData.candidates,
        parsedAmount: amount,
      });
      return res.status(400).json({
        success: false,
        message: "invalid_amount_in_booking_form_for_systempay",
        debug: { tried_candidates: amountData.candidates, booking_form: bf },
      });
    }

    const currency = amountData.currency || "EUR";
    const insuranceSummary = buildInsuranceSummary(req.body?.insurance);
    const hotelAmount = amount;
    const totalAmount = Number(hotelAmount || 0) + Number(insuranceSummary.total || 0);
    const amountInCents = Math.round(totalAmount * 100);

    const email = customerEmail || "sample@example.com";

    const payload = {
      amount: amountInCents,
      currency,
      paymentMethods: ["CARDS"],
      customer: {
        email,
      },
      orderId: partner_order_id,
      metadata: {
        partner_order_id,
        prebook_token: bf.prebook_token || null,
        etg_order_id: bf.etg_order_id || null,
        item_id: bf.item_id || null,
      },
    };

    if (systempayConfig.ipnUrl) {
      payload.ipnUrl = systempayConfig.ipnUrl;
    }

    console.log("[Systempay] Using auth from config:", {
      username: systempayConfig.restUsername,
      password: systempayConfig.restPassword,
      url: systempayConfig.createPaymentUrl,
    });

    // 🔹 HERE is the Basic Auth replacement you asked about
    const basicAuth = Buffer.from(
      `${systempayConfig.restUsername}:${systempayConfig.restPassword}`,
      "utf8"
    ).toString("base64");

    console.log("[Systempay] Basic header:", `Basic ${basicAuth}`);

    const response = await axios.post(
      systempayConfig.createPaymentUrl,
      payload,
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
      }
    );

    const raw = response.data || {};
    console.log("[Systempay] Raw response:", raw);

    const status = raw.status;
    const formToken = raw.answer && raw.answer.formToken;

    if (status !== "SUCCESS" || !formToken) {
      console.error("[Systempay] Unexpected response (no valid formToken):", raw);
      return res.status(500).json({
        success: false,
        message: "Systempay did not return a valid formToken",
        raw,
      });
    }

    // Persist payment row (initiated / pending)
    try {
      const answer = raw.answer || {};
      const externalReference =
        answer.transactionId ||
        answer.uuid ||
        answer.orderId ||
        raw.transactionId ||
        raw.uuid ||
        raw.orderId ||
        partner_order_id;

      await savePayment({
        provider: "systempay",
        status: "pending",
        partnerOrderId: partner_order_id,
        prebookToken: bf.prebook_token || null,
        etgOrderId: bf.etg_order_id || null,
        itemId: bf.item_id || null,
        amount: totalAmount,
        currencyCode: currency,
        externalReference,
        payload: {
          raw,
          hotel_amount: hotelAmount,
          insurance: insuranceSummary,
        },
      });
    } catch (e) {
      console.error("[Systempay] savePayment failed:", e.message);
      // Do not block the payment flow if logging fails
    }

    return res.json({
      success: true,
      formToken,
      publicKey: systempayConfig.sdkPublicKey,
      raw,
    });
  } catch (err) {
    console.error(
      "[Systempay] create-order error:",
      err.response?.data || err.message
    );
    return res.status(500).json({
      success: false,
      message: "Failed to create Systempay payment",
      error: err.response?.data || err.message,
    });
  }
});

module.exports = router;
