// utils/etg.js
"use strict";

const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const DEFAULT_BASE = "https://api.worldota.net/api/b2b/v3";
const DEFAULT_CONTENT_BASE = "https://api.worldota.net/api/content/v1";
const DEFAULT_CONTENT_BASE_SANDBOX = "https://api-sandbox.worldota.net/api/content/v1";
const PROD_BASE = process.env.ETG_BASE_PROD || DEFAULT_BASE;
const SANDBOX_BASE = process.env.ETG_BASE_SANDBOX || DEFAULT_BASE;
const CONTENT_BASE_PROD = process.env.ETG_CONTENT_BASE_PROD || DEFAULT_CONTENT_BASE;
const CONTENT_BASE_SANDBOX = process.env.ETG_CONTENT_BASE_SANDBOX || DEFAULT_CONTENT_BASE_SANDBOX;
const TARGET_ENV = (process.env.ETG_ENV || "prod").toLowerCase();
const BASE = TARGET_ENV === "sandbox" ? SANDBOX_BASE : PROD_BASE;
const CONTENT_BASE = TARGET_ENV === "sandbox" ? CONTENT_BASE_SANDBOX : CONTENT_BASE_PROD;
const AUTH = Buffer.from(`${process.env.ETG_PARTNER_ID}:${process.env.ETG_API_KEY}`).toString("base64");

const { insertApiLog } = require("./repo");

/** Turn any value into a JSON-serializable object for logging (no "[object Object]"). */
function toLoggableResponse(resOrErr, statusCode) {
  const body = resOrErr && resOrErr.data !== undefined ? resOrErr.data : resOrErr;
  const httpStatus = resOrErr && resOrErr.status != null ? resOrErr.status : statusCode;

  function serialize(obj) {
    if (obj == null) return null;
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return { _message: String(obj.message || obj.error || obj) };
    }
  }

  const out = {
    status: httpStatus,
    data: null,
  };
  if (body != null && typeof body === "object") {
    out.data = serialize(body);
  } else if (body != null) {
    out.data = { body: String(body) };
  }
  if (resOrErr && resOrErr.headers && typeof resOrErr.headers === "object") {
    out.headers = {};
    for (const [k, v] of Object.entries(resOrErr.headers)) {
      out.headers[k] = k.toLowerCase() === "authorization" ? "[REDACTED]" : v;
    }
  }
  if (out.data == null && resOrErr && typeof resOrErr === "object") {
    out.data = {
      _noBody: true,
      message: resOrErr.message,
      status: resOrErr.status,
      http: resOrErr.http,
      debug: resOrErr.debug,
    };
  }
  if (out.data == null) out.data = { _error: resOrErr == null ? "null" : String(resOrErr) };
  return out;
}

function logEtgCall(endpoint, method, url, data, resOrErr, statusCode) {
  const requestPayload = {
    method,
    url,
    headers: { "Content-Type": "application/json", Authorization: "[REDACTED]" },
    body: data,
  };
  const responsePayload = toLoggableResponse(resOrErr, statusCode);
  insertApiLog({
    endpoint: `${method} ${endpoint}`.slice(0, 255),
    request: requestPayload,
    response: responsePayload,
    statusCode: statusCode || 0,
  }).catch((e) => console.error("[ETG] api_log insert failed:", e.message));
}

async function callETG(method, endpoint, data = null) {
  const url = `${BASE}${endpoint}`;
  try {
    const res = await axios({
      method,
      url,
      headers: {
        Authorization: `Basic ${AUTH}`,
        "Content-Type": "application/json"
      },
      data
    });

    const requestId = res.headers["request-id"];
    if (requestId) console.log(`[ETG] request-id: ${requestId} → ${endpoint}`);

    logEtgCall(endpoint, method, url, data, res, res.status);
    return res.data.data ?? res.data;
  } catch (err) {
    const requestId = err.response?.headers?.["request-id"];
    console.error(`[ETG ERROR] ${endpoint} | request-id: ${requestId}`);
    const statusCode = err.response?.status || 500;
    const errorBody = err.response?.data || {
      message: err.message,
      status: "error",
      http: statusCode,
      debug: null,
    };
    // Pass full axios error so toLoggableResponse can extract status/headers/data
    logEtgCall(endpoint, method, url, data, err.response || { data: errorBody, status: statusCode }, statusCode);
    throw {
      message: errorBody.error || err.message,
      status: errorBody.status || "error",
      http: statusCode,
      debug: errorBody.debug || null
    };
  }
}

/**
 * Call ETG and return full request/response for display (e.g. order info). Does not throw.
 * options.baseUrl: override base URL (e.g. SANDBOX_BASE for test env).
 */
async function callETGReturnRaw(method, endpoint, data = null, options = {}) {
  const base = options.baseUrl != null ? options.baseUrl : BASE;
  const url = `${base}${endpoint}`;
  try {
    const res = await axios({
      method,
      url,
      headers: {
        Authorization: `Basic ${AUTH}`,
        "Content-Type": "application/json"
      },
      data
    });
    logEtgCall(endpoint, method, url, data, res, res.status);
    return {
      request: { method, url, body: data },
      response: { statusCode: res.status, data: res.data }
    };
  } catch (err) {
    const statusCode = err.response?.status || 500;
    const errorBody = err.response?.data || { error: err.message };
    logEtgCall(endpoint, method, url, data, err.response || { data: errorBody, status: statusCode }, statusCode);
    return {
      request: { method, url, body: data },
      response: { statusCode, data: errorBody }
    };
  }
}

async function callETGContent(method, endpoint, data = null) {
  const safeEndpoint = String(endpoint || "").startsWith("/") ? endpoint : `/${endpoint || ""}`;
  const url = `${CONTENT_BASE}${safeEndpoint}`;
  try {
    const res = await axios({
      method,
      url,
      headers: {
        Authorization: `Basic ${AUTH}`,
        "Content-Type": "application/json"
      },
      data
    });
    logEtgCall(`CONTENT ${safeEndpoint}`, method, url, data, res, res.status);
    return res.data.data ?? res.data;
  } catch (err) {
    const statusCode = err.response?.status || 500;
    const errorBody = err.response?.data || {
      message: err.message,
      status: "error",
      http: statusCode,
      debug: null,
    };
    logEtgCall(
      `CONTENT ${safeEndpoint}`,
      method,
      url,
      data,
      err.response || { data: errorBody, status: statusCode },
      statusCode
    );
    throw {
      message: errorBody.error || err.message,
      status: errorBody.status || "error",
      http: statusCode,
      debug: errorBody.debug || null
    };
  }
}

module.exports = {
  callETG,
  callETGReturnRaw,
  callETGContent,
  BASE,
  PROD_BASE,
  SANDBOX_BASE,
  CONTENT_BASE,
};

