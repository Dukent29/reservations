
"use strict";

const MODE = (process.env.SYSTEMPAY_MODE || "test").toLowerCase();

const systempayConfig = {
  mode: MODE, // "test" or "production"
  restUsername: process.env.SYSTEMPAY_REST_USERNAME,
  restPassword: process.env.SYSTEMPAY_REST_PASSWORD,
  sdkPublicKey: process.env.SYSTEMPAY_SDK_PUBLIC_KEY,
  hmacKey: process.env.SYSTEMPAY_HMAC_KEY,
  createPaymentUrl:
    (process.env.SYSTEMPAY_CREATE_PAYMENT_URL && process.env.SYSTEMPAY_CREATE_PAYMENT_URL.trim()) ||
    "https://api.systempay.fr/api-payment/V4/Charge/CreatePayment",
  ipnUrl: process.env.SYSTEMPAY_IPN_URL,
};

module.exports = { systempayConfig };

