"use strict";

const axios = require("axios");

const PAYPAL_ENV = (process.env.PAYPAL_ENV || "sandbox").toLowerCase(); // sandbox|live
const PAYPAL_BASE_URL =
  PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;

if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
  console.warn("[PayPal] Missing PAYPAL_CLIENT_ID / PAYPAL_SECRET");
}

async function getAccessToken() {
  const basicAuth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString("base64");
  const { data } = await axios.post(
    `${PAYPAL_BASE_URL}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 12000,
    }
  );
  return data.access_token;
}

async function createOrder({ referenceId, amount, currency, returnUrl, cancelUrl }) {
  const accessToken = await getAccessToken();

  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: referenceId,
        amount: {
          currency_code: currency,
          value: Number(amount).toFixed(2),
        },
      },
    ],
    application_context: {
      return_url: returnUrl,
      cancel_url: cancelUrl,
      user_action: "PAY_NOW",
    },
  };

  const { data } = await axios.post(`${PAYPAL_BASE_URL}/v2/checkout/orders`, body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      // helps prevent duplicate orders if you retry
      "PayPal-Request-Id": `${referenceId}-${Date.now()}`,
    },
    timeout: 12000,
  });

  return data;
}

async function captureOrder(orderId) {
  const accessToken = await getAccessToken();
  const { data } = await axios.post(
    `${PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {},
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 12000,
    }
  );
  return data;
}

module.exports = { createOrder, captureOrder, PAYPAL_ENV };