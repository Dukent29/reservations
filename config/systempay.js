
"use strict";

const MODE = (process.env.SYSTEMPAY_MODE || "test").toLowerCase();

function resolveCreatePaymentUrl(raw) {
  const defaultBase = "https://api.systempay.fr";
  const base = (raw && raw.trim()) || defaultBase;

  // If user already provided the full endpoint, keep it as is
  if (/\/api-payment\/V4\/Charge\/CreatePayment\/?$/i.test(base)) {
    return base;
  }

  const normalizedBase = base.replace(/\/+$/, "");
  return `${normalizedBase}/api-payment/V4/Charge/CreatePayment`;
}

const systempayConfig = {
  mode: MODE, // "test" or "production"
  restUsername: process.env.SYSTEMPAY_REST_USERNAME,
  restPassword: process.env.SYSTEMPAY_REST_PASSWORD,
  sdkPublicKey: process.env.SYSTEMPAY_SDK_PUBLIC_KEY,
  hmacKey: process.env.SYSTEMPAY_HMAC_KEY,
  createPaymentUrl: resolveCreatePaymentUrl(process.env.SYSTEMPAY_CREATE_PAYMENT_URL),
  ipnUrl: process.env.SYSTEMPAY_IPN_URL,
};

module.exports = { systempayConfig };
