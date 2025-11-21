"use strict";

const axios = require("axios");
const httpError = require("../utils/httpError");

const DEFAULT_PAYOTA_BASE = "https://api.payota.net/api/public/v1/manage";

const PAYOTA_BASE_URL = process.env.PAYOTA_BASE_URL || DEFAULT_PAYOTA_BASE;
const PAYOTA_KEY_ID = process.env.PAYOTA_KEY_ID || process.env.ETG_PARTNER_ID || "";
const PAYOTA_API_KEY = process.env.PAYOTA_API_KEY || process.env.ETG_API_KEY || "";

function ensureCredentials() {
  if (!PAYOTA_KEY_ID || !PAYOTA_API_KEY) {
    throw httpError(
      500,
      "PAYOTA_CREDENTIALS_MISSING",
      "Missing PAYOTA_KEY_ID/PAYOTA_API_KEY (or ETG_PARTNER_ID/ETG_API_KEY)"
    );
  }
}

function normalizeCardPayload(payload = {}) {
  const clone = { ...payload };
  if (clone.credit_card_data_core && typeof clone.credit_card_data_core === "object") {
    const core = { ...clone.credit_card_data_core };
    if (typeof core.card_number === "string") {
      core.card_number = core.card_number.replace(/\s+/g, "");
    }
    if (typeof core.month === "string") {
      core.month = core.month.trim();
    }
    if (typeof core.year === "string") {
      core.year = core.year.trim();
    }
    if (typeof core.card_holder === "string") {
      core.card_holder = core.card_holder.trim();
    }
    clone.credit_card_data_core = core;
  }
  return clone;
}

async function createCreditCardToken(payload = {}) {
  ensureCredentials();

  const auth = Buffer.from(`${PAYOTA_KEY_ID}:${PAYOTA_API_KEY}`).toString("base64");
  const body = normalizeCardPayload(payload);

  try {
    const res = await axios.post(`${PAYOTA_BASE_URL}/init_partners`, body, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 10000,
    });

    return res.data;
  } catch (error) {
    const status = error?.response?.status || 500;
    const data = error?.response?.data;
    throw httpError(status, "PAYOTA_API_ERROR", data || error.message);
  }
}

module.exports = {
  createCreditCardToken,
};

