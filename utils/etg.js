// utils/etg.js
"use strict";

const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const DEFAULT_BASE = "https://api.worldota.net/api/b2b/v3";
const PROD_BASE = process.env.ETG_BASE_PROD || DEFAULT_BASE;
const SANDBOX_BASE = process.env.ETG_BASE_SANDBOX || DEFAULT_BASE;
const TARGET_ENV = (process.env.ETG_ENV || "prod").toLowerCase();
const BASE = TARGET_ENV === "sandbox" ? SANDBOX_BASE : PROD_BASE;
const AUTH = Buffer.from(`${process.env.ETG_PARTNER_ID}:${process.env.ETG_API_KEY}`).toString("base64");

async function callETG(method, endpoint, data = null) {
  try {
    const res = await axios({
      method,
      url: `${BASE}${endpoint}`,
      headers: {
        Authorization: `Basic ${AUTH}`,
        "Content-Type": "application/json"
      },
      data
    });

    // extract ETG request-id for tracing
    const requestId = res.headers["request-id"];
    if (requestId) console.log(`[ETG] request-id: ${requestId} → ${endpoint}`);

    return res.data.data ?? res.data;
  } catch (err) {
    const requestId = err.response?.headers?.["request-id"];
    console.error(`[ETG ERROR] ${endpoint} | request-id: ${requestId}`);
    throw {
      message: err.response?.data?.error || err.message,
      status: err.response?.data?.status || "error",
      http: err.response?.status || 500,
      debug: err.response?.data?.debug || null
    };
  }
}

module.exports = { callETG, BASE };

