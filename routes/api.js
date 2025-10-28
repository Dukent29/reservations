"use strict";
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
const express = require("express");
const router = express.Router();
const dotenv = require("dotenv");
const { saveSerpSearch, savePrebook } = require("../utils/repo");
function trimSerpPayload(data, limitHotels = 20, limitOffers = 50) {
  if (Array.isArray(data)) return data.slice(0, limitHotels);

  const copy = typeof data === "object" && data !== null ? { ...data } : data;

  if (copy?.hotels && Array.isArray(copy.hotels)) {
    copy.hotels = copy.hotels.slice(0, limitHotels);
  }
  if (copy?.offers && Array.isArray(copy.offers)) {
    copy.offers = copy.offers.slice(0, limitOffers);
  }
  if (copy?.results && Array.isArray(copy.results)) {
    copy.results = copy.results.slice(0, limitHotels);
  }

  return copy;
}
dotenv.config();

const { callETG, BASE } = require("../utils/etg"); // helper created in utils/etg.js

// ========== HEALTH CHECK ==========
router.get("/health", (_req, res) => {
  res.json({ ok: true, env: process.env.ETG_ENV, base: BASE });
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
// POST /api/search/serp  (dispatches to /search/serp/{hotels|region|geo} on ETG)

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
  const checkinDate = new Date(p.checkin);
const checkoutDate = new Date(p.checkout);

if (checkoutDate <= checkinDate) {
  return res.status(400).json({ error: "checkout must be after checkin" });
}

if (p.radius && p.radius > 5000) {
  return res.status(400).json({ error: "radius too large (max 5000 meters)" });
}

if (p.guests && p.guests.length > 4) {
  return res.status(400).json({ error: "too many rooms/guests for one request" });
}

    // Coerce region_id to number if it's a string containing numeric characters
    if (typeof p.region_id === "string" && /^\d+$/.test(p.region_id)) {
      body.region_id = Number(p.region_id);
    }

    const isValid = (d) => d instanceof Date && !isNaN(d.getTime());
if (!isValid(checkinDate) || !isValid(checkoutDate)) {
  return res.status(400).json({ error: "invalid date format (use YYYY-MM-DD)" });
}

  // normalization to match doc behavior
  if (body.residency && typeof body.residency === "string") {
    body.residency = body.residency.toLowerCase(); // "gb"
  }
  if (body.region_id && typeof body.region_id === "string" && /^\d+$/.test(body.region_id)) {
    body.region_id = Number(body.region_id);
  }
  if (Array.isArray(body.guests)) {
    body.guests = body.guests.map(g => {
      const cleaned = { ...g };
      if (Array.isArray(cleaned.children) && cleaned.children.length === 0) {
        delete cleaned.children; // omit empty array
      }
      return cleaned;
    });
  }

  try {
    const data = await callETG("POST", endpoint, body);

    const limit = Number(req.query.limit) || 20;
    const trimmed = trimSerpPayload(data, limit, 50);

    // 🧩 get ETG request-id if your callETG returns it; if not, skip (null is fine)
    const etgRequestId = (data && data.debug && data.debug.request_id) ? data.debug.request_id : null;

    // save a lightweight trace (payload/body is what you sent to ETG)
    await saveSerpSearch({
      endpoint,
      payload: body,
      resultsSample: trimmed, // small snippet you returned (already trimmed)
      requestId: etgRequestId,
      ip: req.ip
    });

    res.json({ status: "ok", endpoint, results: trimmed });
  } catch (e) {
    res.status(400).json({ error: e.message, status: e.status, debug: e.debug, http: e.http });
  }
});


// ========== PREBOOK ==========
// Accept BOTH flows:
// - SERP flow:  { "search_hash": "<hash from /search/serp/...>" }  -> POST /serp/prebook/
// - HOTEL flow: { "book_hash":   "<hash from /hotel/info/>" }      -> POST /hotel/prebook/
//
// Also keep backward-compat for { "offer_id": "<book_hash>" }.

router.post("/prebook", async (req, res) => {
  const {
    // accepted inputs
    search_hash,            // sr-... (SERP)
    book_hash,              // h-... from hotelpage
    hash,                   // alias (can be sr- or h-)
    offer_id,               // alias
    price_increase_percent = 0,

    // optional auto-refresh context (REQUIRED for refresh to work)
    hp_context              // { id|hid, checkin, checkout, guests, residency, currency, language, meal, room_name }
  } = req.body || {};

  // normalize
  const h = search_hash || book_hash || hash || offer_id;
  if (!h || typeof h !== "string" || /^m-/.test(h)) {
    return res.status(400).json({ error: "invalid hash: provide sr-... (SERP) or h-... (hotelpage)" });
  }

  // decide endpoint/payload
  const isSerp = /^sr-/.test(h);
  let endpoint = isSerp ? "/serp/prebook/" : "/hotel/prebook/";
  let payload  = isSerp ? { hash: h, price_increase_percent } : { hash: h, price_increase_percent };

  // helper: single attempt
  const doPrebook = async () => {
    return callETG("POST", endpoint, payload);
  };

  try {
    const token = await doPrebook();
    return res.json({ status: "ok", endpoint, prebook_token: token });
  } catch (e) {
    // Only try auto-refresh when:
    // - we used an h- hash (hotelpage), AND
    // - ETG says the rate is stale, AND
    // - we have hp_context to re-fetch the hotelpage
    const stale = e?.debug?.error === "no_available_rates" || e?.message === "no_available_rates";
    const isHotelHash = /^h-/.test(h);
    if (!stale || !isHotelHash || !hp_context) {
      return res.status(400).json({ error: e.message, status: e.status, http: e.http, debug: e.debug });
    }

    // -------------- AUTO-REFRESH --------------
    try {
      // Re-fetch hotelpage
      const {
        id, hid, checkin, checkout, guests, residency, currency, language,
        meal: desiredMeal, room_name: desiredRoomName
      } = hp_context || {};

      if (!(id || hid) || !checkin || !checkout || !Array.isArray(guests) || !guests.length) {
        return res.status(400).json({
          error: "hp_context is incomplete; need id|hid, checkin, checkout, guests at minimum"
        });
      }

      const hpRequest = {
        id: id || hid, // ETG accepts numeric HID as "id"
        checkin, checkout, guests,
        residency: residency ? String(residency).toLowerCase() : undefined,
        currency:  currency || "EUR",
        language:  language || "en"
      };

      const hp = await callETG("POST", "/search/hp/", hpRequest);
      const hotels = Array.isArray(hp?.hotels) ? hp.hotels : [];
      const rates  = hotels[0]?.rates || [];

      if (!rates.length) {
        return res.status(400).json({ error: "no fresh rates available after refresh" });
      }

      // Try to pick same meal + room_name first
      let candidate =
        rates.find(r =>
          (!desiredMeal || r.meal === desiredMeal) &&
          (!desiredRoomName || r.room_name === desiredRoomName)
        )
        || rates[0];

      if (!candidate?.hash || !/^h-/.test(candidate.hash)) {
        return res.status(400).json({ error: "no valid h- hash in refreshed rates" });
      }

      // retry prebook with new h- hash
      endpoint = "/hotel/prebook/";
      payload  = { hash: candidate.hash, price_increase_percent };
      const token2 = await callETG("POST", endpoint, payload);

      return res.json({
        status: "ok",
        endpoint,
        prebook_token: token2,
        refreshed: true,
        picked: {
          meal: candidate.meal,
          room_name: candidate.room_name,
          hash: candidate.hash
        }
      });
    } catch (e2) {
      return res.status(400).json({
        error: e2.message || "refresh_failed",
        status: e2.status,
        http: e2.http,
        debug: e2.debug
      });
    }
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
// BOOKING FORM — accepts prebook_token (preferred) or book_hash fallback
// [routes/api.js] — Create booking process (booking form) per docs
const { randomUUID } = require("crypto");

router.post("/booking/form", async (req, res) => {
  const {
    prebook_token,   // may be p-... (we'll map to book_hash)
    token,           // alias from client, ignore unless it's p-...
    book_hash,       // preferred field name
    language = "en",
    customer,        // keep if you want to store locally; ETG form call doesn't need it unless your contract says so
    tourists         // same as above; the docs' minimal request doesn’t require them here
  } = req.body || {};

  // pick the provided value
  const raw = book_hash || prebook_token || token;

  // must be a p-... “book hash” from /hotel.prebook or /serp.prebook
  if (!raw || typeof raw !== "string" || !/^p-/.test(raw)) {
    return res.status(400).json({ error: "book_hash is required and must start with 'p-'" });
  }

  // per docs: partner_order_id (UUID), book_hash, language, user_ip
  const payload = {
    partner_order_id: randomUUID(),
    book_hash: raw,
    language,
    user_ip: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip
  };

  try {
    const form = await callETG("POST", "/hotel/order/booking/form/", payload);
    // Return ETG response + echo our partner_order_id so you can reuse it for the next steps
    return res.json({ status: "ok", partner_order_id: payload.partner_order_id, form });
  } catch (e) {
    return res.status(400).json({ error: e.message, status: e.status, http: e.http, debug: e.debug });
  }
});




// ========== BOOKING FINISH (⚠️ REAL RESA IN PROD) ==========
/**
 * POST /api/booking/finish
 * Body: { "prebook_token": "..." }
 */
// BOOKING FINISH — finalize the order
router.post("/booking/finish", async (req, res) => {
  const { prebook_token, token, book_hash } = req.body || {};
  const effectiveToken = prebook_token || token || book_hash;

  if (!effectiveToken || typeof effectiveToken !== "string" || effectiveToken.length < 16) {
    return res.status(400).json({ error: "token (prebook_token) is required" });
  }

  try {
    const finish = await callETG("POST", "/hotel/order/booking/finish/", {
      token: effectiveToken
    });
    // ETG usually returns an order id or structure you can poll
    return res.json({ status: "ok", finish });
  } catch (e) {
    return res
      .status(400)
      .json({ error: e.message, status: e.status, http: e.http, debug: e.debug });
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
    return res.json({ status: "ok", booking_status: status });
  } catch (e) {
    return res
      .status(400)
      .json({ error: e.message, status: e.status, http: e.http, debug: e.debug });
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
// ========== HOTEL PAGE SEARCH ==========
router.post("/search/hp", async (req, res) => {
  const p = req.body || {};
  if (!p.id && !p.hid) return res.status(400).json({ error: "id (hid) is required" });
  if (!p.checkin || !p.checkout) return res.status(400).json({ error: "checkin/checkout required" });
  if (!p.guests || !Array.isArray(p.guests) || !p.guests.length) {
    return res.status(400).json({ error: "guests is required (e.g., [{ adults: 2 }])" });
  }
  if (!p.language) p.language = "en";
  if (!p.currency) p.currency = "EUR";
  if (p.residency) p.residency = String(p.residency).toLowerCase();

  try {
    // ETG HP endpoint expects top-level id/hid + search params
    const data = await callETG("POST", "/search/hp/", p);
    res.json({ status: "ok", results: data });
  } catch (e) {
    res.status(400).json({ error: e.message, status: e.status, http: e.http, debug: e.debug });
  }
});

//========= BOOKING FORM ==========
// BOOKING FORM — accepts prebook_token (preferred) or book_hash fallback
router.post("/booking/form", async (req, res) => {
  const {
    prebook_token,          // preferred from /prebook
    token,                  // alias if caller already named it token
    book_hash,              // fallback if your prebook returned book_hash
    customer,
    tourists
  } = req.body || {};

  const effectiveToken = prebook_token || token || book_hash;

  // basic validation
  if (!effectiveToken || typeof effectiveToken !== "string" || effectiveToken.length < 16) {
    return res.status(400).json({ error: "token (prebook_token) is required" });
  }
  if (!customer || !customer.email) {
    return res.status(400).json({ error: "customer.email is required" });
  }
  if (!Array.isArray(tourists) || tourists.length === 0) {
    return res.status(400).json({ error: "tourists is required (non-empty array)" });
  }

  try {
    const form = await callETG("POST", "/hotel/order/booking/form/", {
      token: effectiveToken,
      customer,
      tourists
    });

    // form may already contain an order token; we just surface the response
    return res.json({ status: "ok", form });
  } catch (e) {
    return res
      .status(400)
      .json({ error: e.message, status: e.status, http: e.http, debug: e.debug });
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

router.use((err, req, res, _next) => {
  console.error("[API Error]", err);

  const status = err.status || "error";
  const http = err.http || 500;
  const request_id = err?.debug?.request_id || null;

  res.status(400).json({
    error: err.message || "Unexpected error",
    status,
    http,
    request_id,
    debug: err.debug || null
  });
});

module.exports = router;
