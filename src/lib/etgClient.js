// src/lib/etgClient.js
const axios = require("axios");

const BASE =
  (process.env.ETG_ENV || "prod").toLowerCase() === "sandbox"
    ? process.env.ETG_BASE_SANDBOX
    : process.env.ETG_BASE_PROD;

const KEY_ID = String(process.env.ETG_PARTNER_ID || "").trim();
const API_KEY = String(process.env.ETG_API_KEY || "").trim();
const AUTH = "Basic " + Buffer.from(`${KEY_ID}:${API_KEY}`).toString("base64");

const etg = axios.create({
  baseURL: BASE || "https://api.worldota.net/api/b2b/v3",
  timeout: 12000,
});

etg.interceptors.request.use((cfg) => {
  cfg.headers["Accept"] = "application/json";
  cfg.headers["User-Agent"] = process.env.APP_USER_AGENT || "KotanVoyages/1.0 (+tech@kotan)";
  cfg.headers["Authorization"] = AUTH; // <-- force HTTP Basic
  return cfg;
});

module.exports = { etg };