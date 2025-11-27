"use strict";

const db = require("../utils/db");
const { systempayConfig } = require("../config/systempay");
const crypto = require("crypto");

function ratehawkWebhook(req, res) {
  console.log("[ETG Webhook]", req.body);
  res.status(200).send("OK");
}

function stripeWebhook(req, res) {
  console.log("[Stripe Webhook]", req.body);
  res.status(200).send("OK");
}

async function systempayWebhook(req, res) {
  try {
    const payload = req.body || {};
    console.log("[Systempay IPN] Raw payload:", payload);

    if (!systempayConfig.hmacKey) {
      console.warn(
        "[Systempay IPN] No SYSTEMPAY_HMAC_KEY configured in backend, skipping signature verification"
      );
    } else {
      console.log(
        "[Systempay IPN] HMAC key is configured (length:",
        systempayConfig.hmacKey.length,
        ")"
      );
      console.log("[Systempay IPN] headers:", req.headers);

      const headerSignature =
        req.headers["x-systempay-signature"] ||
        req.headers["x-systempay-hmac"] ||
        req.headers["x-kr-hash"] ||
        req.headers["signature"] ||
        "";
      const bodySignature =
        payload.signature ||
        payload.hash ||
        payload["kr-hash"] ||
        payload.mac ||
        payload.hmac ||
        "";
      const receivedSignature = String(headerSignature || bodySignature).trim();

      if (!receivedSignature) {
        console.warn(
          "[Systempay IPN] Missing signature in headers/body – processing payload anyway (dev mode)"
        );
      } else {
        const signedPayload = { ...payload };
        delete signedPayload.signature;
        delete signedPayload.hash;
        delete signedPayload["kr-hash"];
        delete signedPayload.mac;
        delete signedPayload.hmac;

        const sortedKeys = Object.keys(signedPayload).sort();
        const stringToSign = sortedKeys
          .map((key) => `${key}=${signedPayload[key] ?? ""}`)
          .join("&");

        const computedSignature = crypto
          .createHmac("sha256", Buffer.from(systempayConfig.hmacKey, "utf8"))
          .update(stringToSign, "utf8")
          .digest("hex")
          .toLowerCase();

        if (computedSignature !== receivedSignature.toLowerCase()) {
          console.error("[Systempay IPN] Invalid signature", {
            receivedSignature,
            computedSignature,
          });
          // In dev we still continue; for production you might early-return here.
        }
      }
    }

    const spStatus = payload.status || payload.transactionStatus || null;
    const orderId =
      payload.orderId ||
      payload.paymentOrderId ||
      payload.order_id ||
      null;

    const partnerOrderId =
      payload.partner_order_id ||
      payload.metadata_partner_order_id ||
      orderId;

    if (!orderId && !partnerOrderId) {
      console.error("[Systempay IPN] Missing order reference", payload);
      return res.status(200).send("OK");
    }

    console.log("[Systempay IPN] orderId =", orderId, "status =", spStatus);

    let newStatus = "pending";
    switch ((spStatus || "").toUpperCase()) {
      case "PAID":
      case "ACCEPTED":
      case "AUTHORISED":
        newStatus = "paid";
        break;
      case "CANCELED":
      case "CANCELLED":
      case "REFUSED":
      case "ABANDONED":
      case "FAILED":
        newStatus = "failed";
        break;
      default:
        newStatus = "pending";
    }

    const ref = orderId || partnerOrderId;

    const result = await db.query(
      `
      UPDATE payments
      SET status = $1, updated_at = NOW()
      WHERE provider = 'systempay'
        AND (external_reference = $2 OR partner_order_id = $3)
    `,
      [newStatus, ref, partnerOrderId || ref]
    );

    console.log(
      "[Systempay IPN] Updated payments rows:",
      result.rowCount,
      "→",
      newStatus
    );

    if (partnerOrderId) {
      let bookingStatus = null;
      if (newStatus === "paid") bookingStatus = "paid";
      if (newStatus === "failed") bookingStatus = "payment_failed";

      if (bookingStatus) {
        await db.query(
          `
          UPDATE bookings
          SET status = $1
          WHERE partner_order_id = $2
        `,
          [bookingStatus, partnerOrderId]
        );
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("[Systempay IPN] Error:", err);
    return res.status(200).send("OK");
  }
}

module.exports = {
  ratehawkWebhook,
  stripeWebhook,
  systempayWebhook,
};
