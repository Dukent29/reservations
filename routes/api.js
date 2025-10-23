/**
 * FILE: routes/api.js
 * DEPENDENCIES:
 *   - utils/etg.js  (must exist)
 *   - Express + dotenv + axios
 * DESCRIPTION:
 *   This file handles all API endpoints that proxy to
 *   Emerging Travel Group (RateHawk) B2B v3 endpoints.
 *   Uses Basic Auth via .env credentials and a helper (callETG).
 */

"use strict";

const express = require("express");
const router = express.Router();
const dotenv = require("dotenv");
dotenv.config();

const { callETG } = require("../utils/etg"); // helper created in utils/etg.js

// ========== HEALTH CHECK ==========
router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    env: process.env.ETG_ENV,
    base: process.env.ETG_BASE_PROD || "https://api.worldota.net/api/b2b/v3",
  });
});

// ========== OVERVIEW ==========
router.get("/etg/overview", async (_req, res) => {
  try {
    const data = await callETG("GET", "/overview/", null);
    res.json({ status: "ok", endpoints: data });
  } catch (e) {
    res
      .status(400)
      .json({ error: e.message, status: e.status, debug: e.debug, http: e.http });
  }
});

// ========== HOTEL SEARCH (SERP) ==========
/**
 * POST /api/search/serp/hotels
 * Example body:
 * {
 *   "checkin": "2025-11-10",
 *   "checkout": "2025-11-12",
 *   "currency": "EUR",
 *   "language": "fr",
 *   "guests": [{ "adults": 2 }],
 *   "geo": { "latitude": 48.8566, "longitude": 2.3522, "radius": 5000 }
 * }
 */
// [routes/api.js] — remplace l’ancienne route /search/serp/hotels par celle-ci
router.post("/search/serp", async (req, res) => {
  const p = req.body || {};

  // garde-fous génériques
  if (!p.checkin || !p.checkout) {
    return res.status(400).json({ error: "checkin & checkout are required (YYYY-MM-DD)" });
  }
  if (!p.guests || !Array.isArray(p.guests) || p.guests.length === 0) {
    return res.status(400).json({ error: "guests is required (e.g., [{ adults: 2 }])" });
  }
  if (!p.language) p.language = "en";
  if (!p.currency) p.currency = "EUR";

  // dispatch selon les champs présents
  let endpoint = null;
  let body = { ...p };

  if ((Array.isArray(p.ids) && p.ids.length) || (Array.isArray(p.hids) && p.hids.length)) {
    // recherche par hôtel(s)
    endpoint = "/search/serp/hotels/";
    // ETG attend "ids" OU "hids" — tu laisses tel quel
  } else if (typeof p.region_id === "number" || typeof p.region_id === "string") {
    // recherche par région
    endpoint = "/search/serp/region/";
    // ETG attend généralement { region_id, ...dates/currency/language/guests }
  } else if (
    typeof p.latitude === "number" &&
    typeof p.longitude === "number" &&
    typeof p.radius === "number"
  ) {
    // recherche géo
    endpoint = "/search/serp/geo/";
    // Pour /geo, ETG attend { latitude, longitude, radius, ... }
    // On enlève éventuellement l'objet "geo" si tu l’utilisais avant
    if (p.geo) {
      body.latitude = p.geo.latitude;
      body.longitude = p.geo.longitude;
      body.radius = p.geo.radius;
      delete body.geo;
    }
  } else {
    return res.status(400).json({
      error:
        "You must provide either ids/hids (for /hotels), region_id (for /region), or latitude/longitude/radius (for /geo)."
    });
  }

  try {
    const data = await callETG("POST", endpoint, body);
    res.json({ status: "ok", endpoint, results: data });
  } catch (e) {
    res.status(400).json({ error: e.message, status: e.status, debug: e.debug, http: e.http });
  }
});


// ========== PREBOOK ==========
/**
 * POST /api/prebook
 * Body: { "offer_id": "..." }
 */
router.post("/prebook", async (req, res) => {
  const { offer_id } = req.body || {};
  if (!offer_id) return res.status(400).json({ error: "offer_id is required" });

  try {
    const token = await callETG("POST", "/hotel/prebook/", { id: offer_id });
    res.json({ status: "ok", prebook_token: token });
  } catch (e) {
    res
      .status(400)
      .json({ error: e.message, status: e.status, debug: e.debug, http: e.http });
  }
});

// ========== BOOKING FORM ==========
/**
 * POST /api/booking/form
 * Body example:
 * {
 *   "prebook_token": "...",
 *   "customer": { "email": "you@example.com", "phone": "+33123456789" },
 *   "tourists": [{ "first_name": "KEVIN", "last_name": "MULINDA" }]
 * }
 */
router.post("/booking/form", async (req, res) => {
  const { prebook_token, customer, tourists } = req.body || {};
  if (!prebook_token)
    return res.status(400).json({ error: "prebook_token is required" });
  if (!customer || !customer.email)
    return res.status(400).json({ error: "customer.email is required" });
  if (!tourists || !Array.isArray(tourists) || tourists.length === 0) {
    return res
      .status(400)
      .json({ error: "tourists is required (non-empty array)" });
  }

  try {
    const form = await callETG("POST", "/hotel/order/booking/form/", {
      token: prebook_token,
      customer,
      tourists,
    });
    res.json({ status: "ok", form });
  } catch (e) {
    res
      .status(400)
      .json({ error: e.message, status: e.status, debug: e.debug, http: e.http });
  }
});

// ========== BOOKING FINISH (⚠️ REAL RESA IN PROD) ==========
/**
 * POST /api/booking/finish
 * Body: { "prebook_token": "..." }
 */
router.post("/booking/finish", async (req, res) => {
  const { prebook_token } = req.body || {};
  if (!prebook_token)
    return res.status(400).json({ error: "prebook_token is required" });

  try {
    const finish = await callETG("POST", "/hotel/order/booking/finish/", {
      token: prebook_token,
    });
    res.json({ status: "ok", finish });
  } catch (e) {
    res
      .status(400)
      .json({ error: e.message, status: e.status, debug: e.debug, http: e.http });
  }
});

// ========== BOOKING STATUS ==========
/**
 * GET /api/booking/status/:id
 */
router.get("/booking/status/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "id is required" });

  try {
    const status = await callETG(
      "GET",
      `/hotel/order/booking/finish/status/?id=${encodeURIComponent(id)}`
    );
    res.json({ status: "ok", booking_status: status });
  } catch (e) {
    res
      .status(400)
      .json({ error: e.message, status: e.status, debug: e.debug, http: e.http });
  }
});

// ========== HOTEL INFO ==========
/**
 * POST /api/hotel/info
 * Body: { "id": HID, "language": "en" }
 */
router.post("/hotel/info", async (req, res) => {
  const body = req.body || {};
  if (!body.id && !body.hid) {
    return res.status(400).json({ error: "id or hid is required" });
  }
  if (!body.language) body.language = "en";

  try {
    const info = await callETG("POST", "/hotel/info/", body);
    res.json({ status: "ok", info });
  } catch (e) {
    res
      .status(400)
      .json({ error: e.message, status: e.status, debug: e.debug, http: e.http });
  }
});

// ========== WEBHOOK PLACEHOLDERS ==========
router.post("/webhook/ratehawk", async (req, res) => {
  try {
    console.log("RateHawk Webhook:", req.body);
    res.status(200).send("OK");
  } catch (e) {
    res.status(500).send("Internal Server Error");
  }
});

router.post("/webhook/stripe", async (req, res) => {
  try {
    console.log("Stripe Webhook:", req.body);
    res.status(200).send("OK");
  } catch (e) {
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
