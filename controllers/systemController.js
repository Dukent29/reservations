"use strict";

const path = require("path");
const fs = require("fs").promises;
const systemModel = require("../models/systemModel");
const bookingModel = require("../models/bookingModel");
const db = require("../utils/db");
const { ensureApiLogsSchema } = require("../utils/repo");

/**
 * Lightweight heartbeat endpoint so ops can confirm the API is reachable.
 */
function healthCheck(_req, res) {
  res.json(systemModel.getHealthSnapshot());
}

/**
 * Proxy ETG overview to help clients discover active upstream endpoints.
 */
async function getOverview(_req, res, next) {
  try {
    const endpoints = await systemModel.fetchOverview();
    res.json({ status: "ok", endpoints });
  } catch (error) {
    next(error);
  }
}

/**
 * Public config for the frontend. Autofill is only exposed when set in .env;
 * ETG env indicates which endpoint is used (sandbox = TEST, prod = LIVE).
 */
function getConfig(_req, res) {
  const autofill = String(process.env.autofill || "").toLowerCase() === "true";
  const etgEnv = (process.env.ETG_ENV || "prod").toLowerCase();
  const etgEnvLabel = etgEnv === "sandbox" ? "TEST (Sandbox)" : "LIVE (Production)";
  const paypalClientId = "AUVsjMjnuX-I-TfeKOLdcFHAlpyidqNK_HipRv3WHWaPGrOdFO-VSaVVmfyYoMk-eVVsNFeSBDtcDiDv";
  res.json({
    autofill,
    etgEnv,
    etgEnvLabel,
    paypalClientId: paypalClientId || null,
  });
}

/**
 * Serve test client data for autofill only when process.env.autofill is true.
 * Returns 404 otherwise so the endpoint is not discoverable/usable when disabled.
 */
async function getTestClient(_req, res, next) {
  const autofill = String(process.env.autofill || "").toLowerCase() === "true";
  if (!autofill) {
    return res.status(404).json({ error: "not_found" });
  }
  try {
    const filePath = path.join(process.cwd(), "data", "test", "client.json");
    const raw = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(raw);
    res.json(data);
  } catch (err) {
    if (err.code === "ENOENT") {
      return res.status(404).json({ error: "not_found" });
    }
    next(err);
  }
}

/**
 * Extract partner_order_id from request or response (any nested object).
 */
function extractPartnerOrderId(request, response) {
  const objs = [request, response];
  if (request && typeof request === "object") {
    objs.push(request.body, request.query, request.url);
  }
  if (response && typeof response === "object") {
    objs.push(response.data);
  }
  for (const o of objs) {
    if (o && typeof o === "object" && o.partner_order_id != null) {
      return o.partner_order_id;
    }
  }
  // URL or string might contain partner_order_id=...
  for (const o of objs) {
    if (typeof o === "string" && o.includes("partner_order_id=")) {
      const m = o.match(/partner_order_id=([^&\s]+)/);
      if (m) return m[1];
    }
  }
  return null;
}

/**
 * List api_logs entries. Only when process.env.autofill is true.
 * Default limit 50; supports offset for pagination.
 * url_filter: "all" | "sandbox" | "prod" — filter by request url containing "sandbox" or not.
 */
async function getApiLogs(req, res, next) {
  const autofill = String(process.env.autofill || "").toLowerCase() === "true";
  if (!autofill) {
    return res.status(404).json({ error: "not_found" });
  }
  try {
    await ensureApiLogsSchema();
    const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 50), 500);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const urlFilter = String(req.query.url_filter || "all").toLowerCase();
    const whereClause =
      urlFilter === "sandbox"
        ? "WHERE (request->>'url')::text ILIKE '%sandbox%'"
        : urlFilter === "prod"
          ? "WHERE ((request->>'url')::text IS NULL OR (request->>'url')::text NOT ILIKE '%sandbox%')"
          : "";
    const result = await db.query(
      `SELECT id, endpoint, request, response, status_code, created_at
       FROM api_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const countResult = await db.query(
      `SELECT COUNT(*) AS total FROM api_logs ${whereClause}`
    );
    const total = parseInt(countResult.rows[0]?.total || "0", 10);
    const rows = (result.rows || []).map((row) => ({
      ...row,
      partner_order_id: extractPartnerOrderId(row.request, row.response) || undefined,
    }));
    res.json({
      status: "ok",
      logs: rows,
      total,
      limit,
      offset,
      url_filter: urlFilter === "all" ? "all" : urlFilter,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get all completed orders from ETG (fetches every page; ETG returns max 50 per page). Only when autofill is true.
 * Query sys=test: use ETG sandbox (ETG_BASE_SANDBOX); otherwise use prod (ETG_BASE_PROD / default).
 */
async function getEtgOrders(req, res, next) {
  const autofill = String(process.env.autofill || "").toLowerCase() === "true";
  if (!autofill) {
    return res.status(404).json({ error: "not_found" });
  }
  const useSandbox = String(req.query.sys || "").toLowerCase() === "test";
  const etgEnv = useSandbox ? "sandbox" : "prod";
  const etgEnvLabel = useSandbox ? "TEST (Sandbox)" : "LIVE (Production)";
  const etgBaseUrl = useSandbox
    ? (process.env.ETG_BASE_SANDBOX || "https://api-sandbox.worldota.net/api/b2b/v3")
    : (process.env.ETG_BASE_PROD || "https://api.worldota.net/api/b2b/v3");
  const etgPartnerId = process.env.ETG_PARTNER_ID || "";
  try {
    const data = await bookingModel.fetchAllCompletedOrders(useSandbox);
    res.json({ status: "ok", etgEnv, etgEnvLabel, etgBaseUrl, etgPartnerId, ...data });
  } catch (err) {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 502;
    res.status(status).json({
      error: err.message || "ETG request failed",
      response: err.responseData
    });
  }
}

/**
 * Get ETG order info (hotel, guests, amounts) by partner_order_id. Only when autofill is true.
 */
async function getEtgOrderInfo(req, res, next) {
  const autofill = String(process.env.autofill || "").toLowerCase() === "true";
  if (!autofill) {
    return res.status(404).json({ error: "not_found" });
  }
  const partnerOrderId = req.query.partner_order_id || (req.body && req.body.partner_order_id);
  if (!partnerOrderId) {
    return res.status(400).json({ error: "partner_order_id is required" });
  }
  try {
    const result = await bookingModel.retrieveOrderInfo(partnerOrderId);
    res.json({ status: "ok", ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  healthCheck,
  getOverview,
  getConfig,
  getTestClient,
  getApiLogs,
  getEtgOrders,
  getEtgOrderInfo,
};
