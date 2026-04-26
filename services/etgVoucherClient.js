"use strict";

const axios = require("axios");

const BASE =
  (process.env.ETG_ENV || "prod").toLowerCase() === "sandbox"
    ? process.env.ETG_BASE_SANDBOX
    : process.env.ETG_BASE_PROD;

const KEY_ID = String(process.env.ETG_PARTNER_ID || "").trim();
const API_KEY = String(process.env.ETG_API_KEY || "").trim();
const USER_AGENT = String(
  process.env.APP_USER_AGENT || "KotanVoyages/1.0 (+tech@kotan)",
).trim();

const RETRYABLE_ETG_ERRORS = new Set([
  "pending",
  "failed_to_generate_document",
  "voucher_is_not_downloadable",
]);

function normalizeVoucherLanguage(language) {
  const raw = String(language || "fr").trim();
  return raw || "fr";
}

function getVoucherRetryAttempts() {
  const value = Number.parseInt(process.env.ETG_VOUCHER_RETRY_ATTEMPTS, 10);
  return Number.isFinite(value) && value > 0 ? value : 6;
}

function getVoucherRetryDelayMs() {
  const value = Number.parseInt(process.env.ETG_VOUCHER_RETRY_DELAY_MS, 10);
  return Number.isFinite(value) && value > 0 ? value : 5000;
}

function getVoucherRetryMaxDelayMs() {
  const value = Number.parseInt(process.env.ETG_VOUCHER_RETRY_MAX_DELAY_MS, 10);
  return Number.isFinite(value) && value > 0 ? value : 30000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPdfPayload(buffer, contentType) {
  return (
    String(contentType || "").toLowerCase().includes("application/pdf") ||
    String(contentType || "").toLowerCase().includes("application/octet-stream") ||
    (Buffer.isBuffer(buffer) &&
      buffer.length >= 4 &&
      buffer.slice(0, 4).toString("utf8") === "%PDF")
  );
}

function parseVoucherErrorBody(response) {
  const contentType = String(response?.headers?.["content-type"] || "");
  const buffer = Buffer.isBuffer(response?.data)
    ? response.data
    : Buffer.from(response?.data || "");

  if (isPdfPayload(buffer, contentType)) {
    return null;
  }

  const text = buffer.toString("utf8").trim();
  if (!text) {
    return { error: `voucher_request_failed_http_${response?.status || 500}` };
  }

  try {
    return JSON.parse(text);
  } catch (_) {
    return { error: text.slice(0, 500) };
  }
}

function extractFilename(disposition, fallbackName) {
  const value = String(disposition || "");
  if (!value) return fallbackName;

  const utf8Match = value.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).replace(/[/\\]/g, "_");
    } catch (_) {
      return utf8Match[1].replace(/[/\\]/g, "_");
    }
  }

  const basicMatch = value.match(/filename\s*=\s*"?([^\";]+)"?/i);
  if (basicMatch && basicMatch[1]) {
    return basicMatch[1].replace(/[/\\]/g, "_");
  }

  return fallbackName;
}

function createVoucherError(code, details = {}) {
  const error = new Error(String(code || "voucher_request_failed"));
  Object.assign(error, details);
  return error;
}

function isRetryableVoucherError(error) {
  const message = String(
    error?.message || error?.debug?.error || error?.debug?.message || "",
  ).toLowerCase();

  if (RETRYABLE_ETG_ERRORS.has(message)) {
    return true;
  }

  return (
    /failed_to_generate_document/.test(message) ||
    /\bpending\b/.test(message) ||
    /voucher_is_not_downloadable/.test(message) ||
    /timeout/.test(message) ||
    /socket/.test(message) ||
    /network/.test(message)
  );
}

async function downloadVoucherPdf(partnerOrderId, language = "fr") {
  if (!partnerOrderId) {
    throw createVoucherError("partner_order_id is required", { http: 400 });
  }

  const authHeader =
    "Basic " + Buffer.from(`${KEY_ID}:${API_KEY}`).toString("base64");

  const response = await axios.get(
    `${BASE || "https://api.worldota.net/api/b2b/v3"}/hotel/order/document/voucher/download/`,
    {
      params: {
        data: JSON.stringify({
          partner_order_id: partnerOrderId,
          language: normalizeVoucherLanguage(language),
        }),
      },
      headers: {
        Accept:
          "application/pdf, application/octet-stream, application/json;q=0.9, text/plain;q=0.8, */*;q=0.5",
        Authorization: authHeader,
        "User-Agent": USER_AGENT,
      },
      responseType: "arraybuffer",
      timeout: 20000,
      validateStatus: () => true,
    },
  );

  const parsedError = parseVoucherErrorBody(response);
  if (response.status >= 400 || parsedError) {
    const errorCode =
      parsedError?.error ||
      parsedError?.message ||
      `voucher_request_failed_http_${response.status}`;
    throw createVoucherError(errorCode, {
      http: response.status,
      debug: parsedError || null,
      retryable: RETRYABLE_ETG_ERRORS.has(String(errorCode || "").toLowerCase()),
    });
  }

  const buffer = Buffer.isBuffer(response.data)
    ? response.data
    : Buffer.from(response.data || "");
  const fallbackFilename = `bedtrip-voucher-${partnerOrderId}.pdf`;

  return {
    buffer,
    contentType: String(response.headers?.["content-type"] || "application/pdf"),
    filename: extractFilename(
      response.headers?.["content-disposition"],
      fallbackFilename,
    ),
  };
}

async function downloadVoucherPdfWithRetry(
  partnerOrderId,
  language = "fr",
  options = {},
) {
  const attempts = Number.isFinite(Number(options.attempts))
    ? Math.max(1, Number(options.attempts))
    : getVoucherRetryAttempts();
  const maxDelayMs = Number.isFinite(Number(options.maxDelayMs))
    ? Math.max(0, Number(options.maxDelayMs))
    : getVoucherRetryMaxDelayMs();
  let delayMs = Number.isFinite(Number(options.delayMs))
    ? Math.max(0, Number(options.delayMs))
    : getVoucherRetryDelayMs();

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const voucher = await downloadVoucherPdf(partnerOrderId, language);
      if (typeof options.onAttempt === "function") {
        await options.onAttempt({
          attempt,
          status: "ready",
          filename: voucher.filename,
          contentType: voucher.contentType,
        });
      }
      return { ...voucher, attempts: attempt };
    } catch (error) {
      const retryable = isRetryableVoucherError(error);
      const isLastAttempt = attempt >= attempts;

      error.retryable = retryable;

      if (typeof options.onAttempt === "function") {
        await options.onAttempt({
          attempt,
          status: !isLastAttempt && retryable ? "processing" : "failed",
          error,
          retryable,
          final: isLastAttempt || !retryable,
        });
      }

      if (!retryable || isLastAttempt) {
        throw error;
      }

      if (delayMs > 0) {
        await sleep(delayMs);
        delayMs = Math.min(maxDelayMs, delayMs * 2 || maxDelayMs);
      }
    }
  }

  throw createVoucherError("voucher_request_failed");
}

module.exports = {
  RETRYABLE_ETG_ERRORS,
  normalizeVoucherLanguage,
  isRetryableVoucherError,
  downloadVoucherPdf,
  downloadVoucherPdfWithRetry,
};
