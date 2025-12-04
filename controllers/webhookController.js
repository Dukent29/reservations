"use strict";

const crypto = require("crypto");
const db = require("../utils/db");
const { systempayConfig } = require("../config/systempay");

/**
 * Validates the HMAC signature for Systempay IPN webhooks.
 * Systempay sends the signature in the 'kr-hash' header.
 * The signature is computed as HMAC-SHA256 of the 'kr-answer' field (JSON string)
 * using the HMAC key, then hex encoded.
 *
 * @param {object} req - Express request object
 * @returns {{ valid: boolean, message: string }}
 */
function validateSystempaySignature(req) {
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    console.warn("[Systempay IPN] DEV MODE: skipping signature validation");
    return { valid: true, message: "dev_skip" };
  }

  const hmacKey = systempayConfig.hmacKey;

  if (!hmacKey) {
    console.warn("[Systempay IPN] No HMAC key configured, skipping signature validation");
    return { valid: true, message: "no_hmac_key_configured" };
  }

  const receivedHash = req.headers["kr-hash"];
  const hashAlgorithm = req.headers["kr-hash-algorithm"] || "sha256_hmac";
  const krAnswer = req.body && req.body["kr-answer"];

  if (!receivedHash || !krAnswer) {
    console.warn(
      "[Systempay IPN] No kr-hash and/or kr-answer in request; skipping signature validation for this IPN"
    );
    return { valid: true, message: "no_kr_hash_or_answer_present" };
  }

  if (hashAlgorithm !== "sha256_hmac") {
    return { valid: false, message: `unsupported_hash_algorithm: ${hashAlgorithm}` };
  }

  let expectedHash;
  try {
    expectedHash = crypto
      .createHmac("sha256", hmacKey)
      .update(krAnswer)
      .digest("hex");
  } catch (err) {
    console.error("[Systempay IPN] Error while computing HMAC:", err.message);
    return { valid: false, message: "hmac_computation_error" };
  }

  let hashesMatch = false;
  try {
    hashesMatch =
      receivedHash.length === expectedHash.length &&
      crypto.timingSafeEqual(Buffer.from(receivedHash, "hex"), Buffer.from(expectedHash, "hex"));
  } catch (err) {
    console.error("[Systempay IPN] Invalid hash format:", err.message);
    return { valid: false, message: "invalid_hash_format" };
  }

  if (!hashesMatch) {
    console.error("[Systempay IPN] Signature mismatch");
    return { valid: false, message: "signature_mismatch" };
  }

  return { valid: true, message: "signature_valid" };
}


function ratehawkWebhook(req, res) {
  console.log("[ETG Webhook]", req.body);
  res.status(200).send("OK");
}

function stripeWebhook(req, res) {
  console.log("[Stripe Webhook]", req.body);
  res.status(200).send("OK");
}

async function systempayWebhook(req, res) {
  console.log("🔥 [Systempay IPN] Handler reached, method =", req.method, "path =", req.originalUrl);
  console.log("🔥 [Systempay IPN] Headers:", req.headers);
  console.log("🔥 [Systempay IPN] Body:", req.body);
  try {
    const payload = req.body || {};
    console.log("[Systempay IPN] Raw payload:", payload);

    // Validate signature/HMAC using systempayConfig.hmacKey
    const signatureValidation = validateSystempaySignature(req);
    if (!signatureValidation.valid) {
      console.error("[Systempay IPN] Signature validation failed:", signatureValidation.message);
      return res.status(401).json({ error: "Invalid signature", detail: signatureValidation.message });
    }
    console.log("[Systempay IPN] Signature validation:", signatureValidation.message);

    // Parse kr-answer JSON if present (Systempay IPN format)
    let krAnswerData = null;
    if (payload["kr-answer"]) {
      try {
        krAnswerData = JSON.parse(payload["kr-answer"]);
        console.log("[Systempay IPN] Parsed kr-answer:", krAnswerData);
      } catch (parseErr) {
        console.warn("[Systempay IPN] Failed to parse kr-answer:", parseErr.message);
      }
    }

    // Extract status from various possible locations
    const spStatus =
      (krAnswerData && krAnswerData.orderStatus) ||
      (krAnswerData && krAnswerData.transactions && krAnswerData.transactions[0] && krAnswerData.transactions[0].status) ||
      payload.status ||
      payload.transactionStatus ||
      null;

    // Extract order ID from various possible locations
    const orderId =
      (krAnswerData && krAnswerData.orderDetails && krAnswerData.orderDetails.orderId) ||
      (krAnswerData && krAnswerData.orderId) ||
      payload.orderId ||
      payload.paymentOrderId ||
      payload.order_id ||
      null;

    // Extract partner order ID from metadata
    const partnerOrderId =
      (krAnswerData && krAnswerData.orderDetails && krAnswerData.orderDetails.metadata && krAnswerData.orderDetails.metadata.partner_order_id) ||
      payload.partner_order_id ||
      payload.metadata_partner_order_id ||
      orderId;

    if (!orderId && !partnerOrderId) {
      console.error("[Systempay IPN] Missing order reference");
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
    console.log(
  "[Systempay IPN] DB update with:",
  { newStatus, ref, partnerOrderId: partnerOrderId || null }
);


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
  validateSystempaySignature,
};
