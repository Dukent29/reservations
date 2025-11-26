// routes/systempayRoutes.js
"use strict";

const router = require("express").Router();
const axios = require("axios");
const { systempayConfig } = require("../config/systempay");

/**
 * TEMP: test route to get a formToken from Systempay
 * Full URL (with api router): POST /api/payments/systempay/create-order
 */
router.post("/payments/systempay/create-order", async (req, res) => {
  try {
    const fakeBooking = {
      id: "TEST_BOOKING_123",
      price_client: 10.0, // 10 EUR
      customer_email: "sample@example.com",
    };

    const amountInCents = Math.round(Number(fakeBooking.price_client) * 100);

    const payload = {
      amount: amountInCents,
      currency: "EUR",
      orderId: `BKG-${fakeBooking.id}`,
      customer: {
        email: fakeBooking.customer_email,
      },
      metadata: {
        booking_id: fakeBooking.id,
      },
    };

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
