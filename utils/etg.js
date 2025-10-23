// utils/etg.js
"use strict";

const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const ETG_ENV = (process.env.ETG_ENV || "prod").toLowerCase();

// Chez toi, sandbox == prod (d’après tes tests). Si un jour ETG te donne un vrai host sandbox,
// tu n’auras qu’à changer ETG_BASE_SANDBOX dans le .env.
const BASE_PROD = process.env.ETG_BASE_PROD || "https://api.worldota.net/api/b2b/v3";
const BASE_SANDBOX = process.env.ETG_BASE_SANDBOX || "https://api.worldota.net/api/b2b/v3";

const BASE = (ETG_ENV === "sandbox" ? BASE_SANDBOX : BASE_PROD).replace(/\/+$/, "");

const KEY_ID = process.env.ETG_PARTNER_ID || process.env.KEY_ID;
const API_KEY = process.env.ETG_API_KEY || process.env.API_KEY;

if (!KEY_ID || !API_KEY) {
  console.warn("[WARN][ETG] Missing ETG_PARTNER_ID / ETG_API_KEY in .env");
}

const AUTH_B64 = Buffer.from(`${KEY_ID || ""}:${API_KEY || ""}`).toString("base64");

// Instance Axios correctement configurée (toujours objet config, JAMAIS string)
const etgAxios = axios.create({
  baseURL: `${BASE}/`,
  headers: {
    Authorization: `Basic ${AUTH_B64}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 15000,
});

// Helper unique: on passe TOUJOURS un objet config
async function callETG(method, endpoint, data) {
  if (!KEY_ID || !API_KEY) {
    const e = new Error("Missing ETG credentials");
    e.status = "error";
    e.debug = { hint: "Set ETG_PARTNER_ID and ETG_API_KEY in .env" };
    throw e;
  }

  const url = String(endpoint || "").replace(/^\//, ""); // "search/serp/hotels/"

  try {
    const res = await etgAxios.request({ method, url, data });
    const body = res.data;

    if (body?.status === "error") {
      const err = new Error(body.error || "ETG error");
      err.status = body.status;
      err.debug = body.debug;
      err.http = res.status;
      throw err;
    }
    return body?.data ?? null;
  } catch (err) {
    if (err.response?.data) {
      const d = err.response.data;
      const e = new Error(d.error || `ETG HTTP ${err.response.status}`);
      e.status = d.status || "error";
      e.debug = d.debug;
      e.http = err.response.status;
      throw e;
    }
    throw err;
  }
}

module.exports = { callETG, BASE };
