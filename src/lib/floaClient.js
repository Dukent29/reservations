"use strict";

const axios = require("axios");
const httpError = require("../utils/httpError");

const FLOA_BASE_URL = process.env.FLOA_BASE_URL || "";
const FLOA_CLIENT_ID = process.env.FLOA_CLIENT_ID || "";
const FLOA_CLIENT_SECRET = process.env.FLOA_CLIENT_SECRET || "";

let cachedToken = null;
let tokenExpiry = 0;
let tokenRefreshPromise = null;

// ---------- CREDENTIALS ----------

function ensureCredentials() {
  if (!FLOA_BASE_URL || !FLOA_CLIENT_ID || !FLOA_CLIENT_SECRET) {
    throw httpError(
      500,
      "FLOA_CREDENTIALS_MISSING",
      "Missing FLOA_BASE_URL, FLOA_CLIENT_ID, or FLOA_CLIENT_SECRET"
    );
  }
}

// ---------- UTILITIES ----------

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- TOKEN FETCH WITH RETRY ----------

async function requestNewAccessToken() {
  ensureCredentials();

  const auth = Buffer.from(`${FLOA_CLIENT_ID}:${FLOA_CLIENT_SECRET}`).toString("base64");
  const payload = new URLSearchParams({ grant_type: "client_credentials" });
  const url = `${FLOA_BASE_URL}/oauth/token`;

  const maxAttempts = 3;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const response = await axios.post(url, payload.toString(), {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 5000,
      });

      const token = response.data?.access_token;
      const expiresIn = Number(response.data?.expires_in) || 3600;

      if (!token) {
        throw new Error("Missing access_token field");
      }

      cachedToken = token;
      tokenExpiry = Date.now() + expiresIn * 1000;

      return token;
    } catch (err) {
      if (attempt >= maxAttempts) {
        throw httpError(
          err?.response?.status || 500,
          "FLOA_AUTH_FAILED",
          err?.response?.data || err.message
        );
      }

      const wait = 500 * Math.pow(2, attempt - 1); // 500, 1000, 2000
      await delay(wait);
    }
  }
}

async function fetchAccessToken() {
  ensureCredentials();
  const now = Date.now();

  if (cachedToken && tokenExpiry > now + 5000) {
    return cachedToken;
  }

  if (tokenRefreshPromise) {
    return tokenRefreshPromise;
  }

  tokenRefreshPromise = requestNewAccessToken();

  try {
    const token = await tokenRefreshPromise;
    return token;
  } finally {
    tokenRefreshPromise = null;
  }
}

// ---------- GENERIC FLOA REQUEST ----------

async function floaRequest(method, endpoint, data = {}, config = {}) {
  const token = await fetchAccessToken();
  const extraHeaders = config.headers || {};
  const { headers, ...restConfig } = config || {};

  try {
    const response = await axios({
      method,
      url: `${FLOA_BASE_URL}${endpoint}`,
      data,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      ...restConfig,
    });

    return response.data;
  } catch (error) {
    throw httpError(
      error?.response?.status || 500,
      "FLOA_API_ERROR",
      error?.response?.data || error.message
    );
  }
}

// ---------- SIMULATE PLAN (kept as before) ----------

async function simulatePlan(payload = {}) {
  const { amount, merchantFinancedAmount, currency, country_code, products } = payload;

  const toCents = (value, fieldName) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      throw httpError(400, `${fieldName} must be a positive number`);
    }
    return Math.round(num * 100);
  };

  if (amount == null) {
    throw httpError(400, "amount is required for Floa simulation");
  }

  const params = {
    amount: toCents(amount, "amount"),
    merchantFinancedAmount: toCents(
      merchantFinancedAmount != null ? merchantFinancedAmount : amount,
      "merchantFinancedAmount"
    ),
  };

  if (currency) params.currency = currency;
  if (country_code) params.country_code = country_code;
  if (Array.isArray(products) && products.length) {
    params.products = products;
  }

  const data = await floaRequest(
    "GET",
    "/api/v1/simulated-installment-plans",
    null,
    { params }
  );

  return data;
}

// ---------- CREATE DEAL (REAL) ----------

async function createDeal(payload = {}) {
  const {
    productCode,
    implementationType, // optional, e.g. "CustomerInformationForm"
    ...body
  } = payload || {};

  if (!productCode) {
    throw httpError(400, "productCode is required to create a Floa deal");
  }

  if (!body.merchantFinancedAmount) {
    throw httpError(400, "merchantFinancedAmount is required");
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw httpError(400, "items must be a non-empty array");
  }

  const config = {
    params: { productCode },   // → ?productCode=BC3XF
    headers: {}
  };

  if (implementationType) {
    config.headers["Implementation-type"] = implementationType;
  }

  // Let floaRequest handle errors
  return floaRequest("POST", "/api/v1/deals", body, config);
}



// ---------- STUBS FOR LATER ----------

async function finalizeDeal(payload = {}) {
  throw httpError(501, "FLOA_FINALIZE_DEAL_NOT_IMPLEMENTED", payload);
}

async function retrieveDeal(dealReference) {
  if (!dealReference) {
    throw httpError(400, "dealReference is required to retrieve a Floa installment plan");
  }

  const endpoint = `/api/v1/deals/${encodeURIComponent(
    dealReference
  )}/installment-plan`;

  // Let floaRequest handle errors (FLOA_API_ERROR with debug info)
  return floaRequest("GET", endpoint);
}


async function cancelDeal(dealReference, payload = {}) {
  throw httpError(501, "FLOA_CANCEL_DEAL_NOT_IMPLEMENTED", { dealReference, payload });
}

// ---------- EXPORTS ----------

module.exports = {
  fetchAccessToken,
  floaRequest,
  simulatePlan,
  createDeal,
  finalizeDeal,
  retrieveDeal,
  cancelDeal,
};
