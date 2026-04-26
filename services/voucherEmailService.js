"use strict";

const nodemailer = require("nodemailer");
const { etg } = require("../src/lib/etgClient");
const db = require("../utils/db");

const SMTP_HOST = String(process.env.SMTP_HOST || "").trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = String(process.env.SMTP_USER || "").trim();
const SMTP_PASS = String(process.env.SMTP_PASS || "").trim();
const SMTP_SECURE =
  String(process.env.SMTP_SECURE || "").toLowerCase() === "true" ||
  SMTP_PORT === 465;
const MAIL_FROM = String(
  process.env.VOUCHER_EMAIL_FROM ||
    process.env.MAIL_FROM ||
    process.env.KOTAN_MERCHANT_EMAIL ||
    "",
).trim();

const NOTIFICATION_KIND = "voucher_pdf_email";
const RETRY_DELAYS_MS = [0, 20_000, 60_000, 180_000];

let notificationsSchemaEnsured = false;
let transporterInstance = null;

function isMailTransportConfigured() {
  return Boolean(SMTP_HOST && SMTP_PORT && MAIL_FROM);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTransporter() {
  if (!isMailTransportConfigured()) {
    throw new Error("voucher_mail_transport_not_configured");
  }
  if (transporterInstance) return transporterInstance;

  const transportConfig = {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
  };

  if (SMTP_USER || SMTP_PASS) {
    transportConfig.auth = {
      user: SMTP_USER,
      pass: SMTP_PASS,
    };
  }

  transporterInstance = nodemailer.createTransport(transportConfig);
  return transporterInstance;
}

async function ensureNotificationsSchema() {
  if (notificationsSchemaEnsured) return;

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS booking_notifications (
        id BIGSERIAL PRIMARY KEY,
        partner_order_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        recipient_email TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (partner_order_id, kind)
      )
    `);
  } catch (err) {
    console.error("[DB] ensure booking_notifications schema failed:", err.message);
    throw err;
  }

  notificationsSchemaEnsured = true;
}

async function claimVoucherNotification(partnerOrderId, recipientEmail) {
  await ensureNotificationsSchema();

  const result = await db.query(
    `
    INSERT INTO booking_notifications (
      partner_order_id,
      kind,
      recipient_email,
      status,
      attempt_count,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, 'queued', 0, NOW(), NOW())
    ON CONFLICT (partner_order_id, kind) DO UPDATE
      SET recipient_email = EXCLUDED.recipient_email,
          updated_at = NOW()
      WHERE booking_notifications.status IN ('failed', 'retrying')
    RETURNING status
  `,
    [partnerOrderId, NOTIFICATION_KIND, recipientEmail || null],
  );

  return result.rowCount > 0;
}

async function updateNotification(partnerOrderId, fields = {}) {
  await ensureNotificationsSchema();

  const updates = [];
  const values = [];

  function push(column, value) {
    values.push(value);
    updates.push(`${column} = $${values.length}`);
  }

  if (Object.prototype.hasOwnProperty.call(fields, "recipientEmail")) {
    push("recipient_email", fields.recipientEmail || null);
  }
  if (Object.prototype.hasOwnProperty.call(fields, "status")) {
    push("status", fields.status || "pending");
  }
  if (Object.prototype.hasOwnProperty.call(fields, "attemptCount")) {
    push("attempt_count", Number(fields.attemptCount) || 0);
  }
  if (Object.prototype.hasOwnProperty.call(fields, "lastError")) {
    push("last_error", fields.lastError || null);
  }
  if (Object.prototype.hasOwnProperty.call(fields, "sentAt")) {
    push("sent_at", fields.sentAt || null);
  }

  push("updated_at", new Date().toISOString());
  values.push(partnerOrderId);

  await db.query(
    `
    UPDATE booking_notifications
    SET ${updates.join(", ")}
    WHERE partner_order_id = $${values.length}
      AND kind = '${NOTIFICATION_KIND}'
  `,
    values,
  );
}

function normalizeVoucherLanguage(language) {
  const raw = String(language || "fr").trim();
  return raw || "fr";
}

function parseVoucherError(response) {
  const contentType = String(response.headers?.["content-type"] || "").toLowerCase();
  const buffer = Buffer.isBuffer(response.data)
    ? response.data
    : Buffer.from(response.data || "");
  const looksLikePdf = buffer.length >= 4 && buffer.slice(0, 4).toString("utf8") === "%PDF";

  if (
    contentType.includes("application/pdf") ||
    contentType.includes("application/octet-stream") ||
    looksLikePdf
  ) {
    return null;
  }

  const text = buffer.toString("utf8").trim();
  if (!text) {
    return { error: `voucher_request_failed_http_${response.status}` };
  }

  try {
    return JSON.parse(text);
  } catch (_) {
    return {
      error: text.length > 500 ? text.slice(0, 500) : text,
    };
  }
}

async function downloadVoucherPdf(partnerOrderId, language = "fr") {
  const response = await etg.get("/hotel/order/document/voucher/download/", {
    params: {
      data: JSON.stringify({
        partner_order_id: partnerOrderId,
        language: normalizeVoucherLanguage(language),
      }),
    },
    headers: {
      Accept: "application/pdf, application/json;q=0.9, text/plain;q=0.8, */*;q=0.5",
    },
    responseType: "arraybuffer",
    timeout: 20_000,
    validateStatus: () => true,
  });

  const parsedError = parseVoucherError(response);
  if (response.status >= 400 || parsedError) {
    const errorCode =
      parsedError?.error ||
      parsedError?.message ||
      `voucher_request_failed_http_${response.status}`;
    const error = new Error(String(errorCode || "voucher_request_failed"));
    error.http = response.status;
    error.debug = parsedError || null;
    throw error;
  }

  return {
    filename: `bedtrip-voucher-${partnerOrderId}.pdf`,
    content: Buffer.from(response.data),
    contentType: "application/pdf",
  };
}

function isRetryableVoucherError(error) {
  const message = String(
    error?.message || error?.debug?.error || error?.debug?.message || "",
  ).toLowerCase();

  return (
    /failed_to_generate_document/.test(message) ||
    /\bpending\b/.test(message) ||
    /voucher_is_not_downloadable/.test(message) ||
    /timeout/.test(message) ||
    /socket/.test(message) ||
    /network/.test(message)
  );
}

async function sendVoucherMail({
  partnerOrderId,
  customerEmail,
  customerName,
  attachment,
}) {
  const transporter = getTransporter();
  const displayName = String(customerName || "").trim();
  const greetingName = displayName || "client";

  await transporter.sendMail({
    from: MAIL_FROM,
    to: customerEmail,
    subject: `Votre voucher BedTrip - réservation ${partnerOrderId}`,
    text:
      `Bonjour ${greetingName},\n\n` +
      "Votre réservation BedTrip est confirmée.\n" +
      "Veuillez trouver votre voucher en pièce jointe.\n\n" +
      `Référence: ${partnerOrderId}\n\n` +
      "Cordialement,\nBedTrip",
    attachments: [attachment],
  });
}

async function processVoucherEmailJob({
  partnerOrderId,
  customerEmail,
  customerName,
  language,
}) {
  if (!partnerOrderId || !customerEmail) return false;

  const canRun = await claimVoucherNotification(partnerOrderId, customerEmail);
  if (!canRun) {
    return false;
  }

  if (!isMailTransportConfigured()) {
    await updateNotification(partnerOrderId, {
      status: "failed",
      recipientEmail: customerEmail,
      lastError: "voucher_mail_transport_not_configured",
    });
    console.warn(
      "[voucher-email] SMTP not configured, skipping voucher mail for",
      partnerOrderId,
    );
    return false;
  }

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay > 0) {
      await sleep(delay);
    }

    await updateNotification(partnerOrderId, {
      status: "processing",
      recipientEmail: customerEmail,
      attemptCount: attempt + 1,
      lastError: null,
    });

    try {
      const attachment = await downloadVoucherPdf(partnerOrderId, language);
      await sendVoucherMail({
        partnerOrderId,
        customerEmail,
        customerName,
        attachment,
      });

      await updateNotification(partnerOrderId, {
        status: "sent",
        recipientEmail: customerEmail,
        attemptCount: attempt + 1,
        lastError: null,
        sentAt: new Date().toISOString(),
      });
      console.log(
        "[voucher-email] sent voucher mail",
        JSON.stringify({ partnerOrderId, customerEmail }),
      );
      return true;
    } catch (error) {
      const retryable = isRetryableVoucherError(error);
      const isLastAttempt = attempt === RETRY_DELAYS_MS.length - 1;
      await updateNotification(partnerOrderId, {
        status: !isLastAttempt && retryable ? "retrying" : "failed",
        recipientEmail: customerEmail,
        attemptCount: attempt + 1,
        lastError: String(error?.message || error || "voucher_email_failed"),
      });

      console.warn(
        "[voucher-email] attempt failed",
        JSON.stringify({
          partnerOrderId,
          customerEmail,
          attempt: attempt + 1,
          retryable,
          error: error?.message || String(error),
        }),
      );

      if (!retryable || isLastAttempt) {
        throw error;
      }
    }
  }

  return false;
}

function queueVoucherEmailJob(options) {
  setImmediate(() => {
    processVoucherEmailJob(options).catch((error) => {
      console.error(
        "[voucher-email] background job failed:",
        error?.message || String(error),
      );
    });
  });
}

module.exports = {
  queueVoucherEmailJob,
  processVoucherEmailJob,
};
