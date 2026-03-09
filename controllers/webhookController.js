"use strict";

const crypto = require("crypto");
const db = require("../utils/db");
const { systempayConfig } = require("../config/systempay");

let ipnEventsSchemaEnsured = false;

async function ensureIpnEventsSchema() {
  if (ipnEventsSchemaEnsured) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS ipn_events (
        id BIGSERIAL PRIMARY KEY,
        provider TEXT,
        order_id TEXT,
        transaction_id TEXT,
        payload JSONB,
        received_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (provider, order_id, transaction_id)
      )
    `);
  } catch (err) {
    console.error("[DB] ensureIpnEventsSchema failed:", err.message);
  }
  ipnEventsSchemaEnsured = true;
}

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

// Floa notification webhook (payment status callback)
async function floaWebhook(req, res) {
  try {
    const payload = req.body || {};
    console.log("[Floa Webhook] payload:", payload);

    // Basic shape validation: make sure required fields are present
    const status = payload.status || null;
    const orderRef = payload.orderRef || null; // our merchantReference (e.g. "<partner_order_id>-abc123")
    const dealRegistration = payload.dealRegistration || payload.deal_registration || null; // FIN...

    if (!status || (!orderRef && !dealRegistration)) {
      console.warn("[Floa Webhook] missing status and/or orderRef/dealRegistration, nothing to update");
      return res.status(200).send("OK");
    }

    let newStatus = "pending";
    switch ((status || "").toLowerCase()) {
      case "accepted":
      case "validated":
      case "ok":
      case "success":
        newStatus = "paid";
        break;
      case "refusal":
      case "refused":
      case "canceled":
      case "cancelled":
      case "abandoned":
      case "failed":
        newStatus = "failed";
        break;
      default:
        newStatus = "pending";
    }

    // Try to recover partner_order_id from orderRef (we built merchantReference as `${partner_order_id}-${Date.now().toString(36)}`)
    let partnerOrderId = null;
    if (orderRef) {
      const idx = orderRef.lastIndexOf("-");
      if (idx > 0) {
        partnerOrderId = orderRef.slice(0, idx);
      }
    }

    // Update payments table for provider 'floa'.
    // When creating the payment row we stored:
    //   - external_reference = Floa dealReference (e.g. FIN000000001)
    //   - partner_order_id   = UUID from bookingForm
    // Floa sends:
    //   - dealRegistration = FIN...
    //   - orderRef         = our merchantReference `${partner_order_id}-...`
    const externalRefKey = dealRegistration || orderRef || null;

    const result = await db.query(
      `
      UPDATE payments
      SET status = $1, updated_at = NOW()
      WHERE provider = 'floa'
        AND (
          external_reference = $2
          OR partner_order_id = $3
        )
    `,
      [newStatus, externalRefKey, partnerOrderId]
    );

    console.log(
      "[Floa Webhook] updated payments rows:",
      result.rowCount,
      "→",
      newStatus,
      "matching external_reference =",
      externalRefKey,
      "partner_order_id =",
      partnerOrderId
    );
    return res.status(200).send("OK");
  } catch (err) {
    console.error("[Floa Webhook] error:", err);
    return res.status(200).send("OK");
  }
}

async function systempayWebhook(req, res) {
  console.log("🔥 [Systempay IPN] Handler reached, method =", req.method, "path =", req.originalUrl);
  console.log("🔥 [Systempay IPN] Headers:", req.headers);
  console.log("🔥 [Systempay IPN] Body:", req.body);
  try {
    const isProd = process.env.NODE_ENV === "production";
    if (isProd) {
      const expectedSecret = process.env.IPN_GATEWAY_SECRET || null;
      const receivedSecret = req.headers["x-ipn-gateway"] || null;
      if (!expectedSecret || receivedSecret !== expectedSecret) {
        console.error("[Systempay IPN] Invalid or missing x-ipn-gateway header");
        return res.status(403).json({ error: "Forbidden" });
      }
    }

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
    let partnerOrderId =
      (krAnswerData && krAnswerData.metadata && krAnswerData.metadata.partner_order_id) ||
      (krAnswerData && krAnswerData.orderDetails && krAnswerData.orderDetails.metadata && krAnswerData.orderDetails.metadata.partner_order_id) ||
      null;

    if (!partnerOrderId && typeof orderId === "string" && orderId.startsWith("BT-")) {
      partnerOrderId = orderId.slice(3);
    }

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

    const transactionId =
      (krAnswerData && krAnswerData.transactions && krAnswerData.transactions[0] && (krAnswerData.transactions[0].uuid || krAnswerData.transactions[0].transactionId || krAnswerData.transactions[0].id)) ||
      null;
    const dedupeTransactionId = transactionId || "unknown";

    await ensureIpnEventsSchema();
    try {
      await db.query(
        `
        INSERT INTO ipn_events (provider, order_id, transaction_id, payload)
        VALUES ($1, $2, $3, $4)
      `,
        ["systempay", orderId || null, dedupeTransactionId, payload ? JSON.stringify(payload) : null]
      );
    } catch (err) {
      if (err && err.code === "23505") {
        console.warn("[Systempay IPN] Duplicate IPN event, skipping");
        return res.status(200).send("OK");
      }
      console.error("[Systempay IPN] Failed to persist IPN event:", err.message);
    }

    console.log("[Systempay IPN] DB update with:", {
      newStatus,
      orderId: orderId || null,
      partnerOrderId: partnerOrderId || null,
    });

    const result = await db.query(
      `
      UPDATE payments
      SET status = $1, updated_at = NOW()
      WHERE provider = 'systempay'
        AND (partner_order_id = $2 OR systempay_order_id = $3)
    `,
      [newStatus, partnerOrderId || null, orderId || null]
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
  floaWebhook,
};
