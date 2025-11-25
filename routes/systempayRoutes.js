// routes/systempayRoutes.js
"use strict";

const router = require("express").Router();
const axios = require("axios");
const { systempayConfig } = require("../config/systempay");

/**
 * TEMP: test route to get a formToken from Systempay
 * Full URL: POST /api/payments/systempay/create-order
 */
router.post("/payments/systempay/create-order", async (req, res) => {
  try {
    const fakeBooking = {
      id: "TEST_BOOKING_123",
      price_client: 10.0,
      customer_email: "test@example.com",
    };

    const amountInCents = Math.round(Number(fakeBooking.price_client) * 100);

    const payload = {
      amount: amountInCents,
      currency: "EUR",
      customer: {
        email: fakeBooking.customer_email,
      },
      orderId: `BKG-${fakeBooking.id}`,
      paymentMethods: ["CARD"],
      ipnTargetUrl: systempayConfig.ipnUrl,
      metadata: {
        booking_id: fakeBooking.id,
      },
    };

    const response = await axios.post(systempayConfig.createPaymentUrl, payload, {
      auth: {
        username: systempayConfig.restUsername,
        password: systempayConfig.restPassword,
      },
    });

    const { formToken } = response.data || {};

    if (!formToken) {
      console.error("[Systempay] No formToken:", response.data);
      return res.status(500).json({
        success: false,
        message: "Systempay did not return a formToken",
        raw: response.data,
      });
    }

    return res.json({
      success: true,
      formToken,
      publicKey: systempayConfig.sdkPublicKey,
      raw: response.data,
    });
  } catch (err) {
    console.error("[Systempay] create-order error:", err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to create Systempay payment",
      error: err.response?.data || err.message,
    });
  }
});

module.exports = router;
