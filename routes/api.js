"use strict";
/**
 * FILE: routes/api.js
 * DEPENDENCIES:
 *   - utils/etg.js  (must exist)
 *   - utils/repo.js (saveSerpSearch/savePrebook can be no-op if not ready)
 *   - Express + dotenv + axios
 * DESCRIPTION:
 *   Proxy vers Emerging Travel Group (RateHawk) B2B v3.
 *   Auth Basic via .env (gérée par callETG).
 *
 * FLOW DOC:
 *   SERP/HOTEL → PREBOOK (h- or sr-) → BOOKING FORM (CREATE) [p- book_hash] → START → CHECK
 */

const express = require("express");
const router = express.Router();
const dotenv = require("dotenv");
dotenv.config();

const { callETG, BASE } = require("../utils/etg");
const { saveSerpSearch, savePrebook } = require("../utils/repo"); // ok si no-op

// -------- utils --------
function trimSerpPayload(data, limitHotels = 20, limitOffers = 50) {
  if (Array.isArray(data)) return data.slice(0, limitHotels);
  const copy = typeof data === "object" && data !== null ? { ...data } : data;
  if (copy?.hotels && Array.isArray(copy.hotels)) copy.hotels = copy.hotels.slice(0, limitHotels);
  if (copy?.offers && Array.isArray(copy.offers)) copy.offers = copy.offers.slice(0, limitOffers);
  if (copy?.results && Array.isArray(copy.results)) copy.results = copy.results.slice(0, limitHotels);
  return copy;
}

// ========== HEALTH ==========
router.get("/health", (_req, res) => {
  res.json({ ok: true, env: process.env.ETG_ENV, base: BASE });
});

// ========== OVERVIEW ==========
router.get("/etg/overview", async (_req, res) => {
  try {
    const data = await callETG("GET", "/overview/", null);
    res.json({ status: "ok", endpoints: data });
  } catch (e) {
    res.status(400).json({ error: e.message, status: e.status, debug: e.debug, http: e.http });
  }
});

// ========== SERP (dispatch hotels/region/geo) ==========
router.post("/search/serp", async (req, res) => {
  const p = req.body || {};

  if (!p.checkin || !p.checkout) {
    return res.status(400).json({ error: "checkin & checkout are required (YYYY-MM-DD)" });
  }
  if (!p.guests || !Array.isArray(p.guests) || p.guests.length === 0) {
    return res.status(400).json({ error: "guests is required (e.g., [{ adults: 2 }])" });
  }
  if (!p.language) p.language = "en";
  if (!p.currency) p.currency = "EUR";

  let endpoint = null;
  let body = { ...p };

  if ((Array.isArray(p.ids) && p.ids.length) || (Array.isArray(p.hids) && p.hids.length)) {
    endpoint = "/search/serp/hotels/";
  } else if (typeof p.region_id === "number" || typeof p.region_id === "string") {
    endpoint = "/search/serp/region/";
  } else if (
    typeof p.latitude === "number" &&
    typeof p.longitude === "number" &&
    typeof p.radius === "number"
  ) {
    endpoint = "/search/serp/geo/";
    if (p.geo) {
      body.latitude = p.geo.latitude;
      body.longitude = p.geo.longitude;
      body.radius = p.geo.radius;
      delete body.geo;
    }
  } else {
    return res.status(400).json({
      error:
        "You must provide either ids/hids (for /hotels), region_id (for /region), or latitude/longitude/radius (for /geo).",
    });
  }

  const checkinDate = new Date(p.checkin);
  const checkoutDate = new Date(p.checkout);

  const isValid = (d) => d instanceof Date && !isNaN(d.getTime());
  if (!isValid(checkinDate) || !isValid(checkoutDate)) {
    return res.status(400).json({ error: "invalid date format (use YYYY-MM-DD)" });
  }
  if (checkoutDate <= checkinDate) {
    return res.status(400).json({ error: "checkout must be after checkin" });
  }
  if (p.radius && p.radius > 5000) {
    return res.status(400).json({ error: "radius too large (max 5000 meters)" });
  }
  if (p.guests && p.guests.length > 4) {
    return res.status(400).json({ error: "too many rooms/guests for one request" });
  }

  if (typeof p.region_id === "string" && /^\d+$/.test(p.region_id)) {
    body.region_id = Number(p.region_id);
  }
  if (body.residency && typeof body.residency === "string") {
    body.residency = body.residency.toLowerCase();
  }
  if (Array.isArray(body.guests)) {
    body.guests = body.guests.map((g) => {
      const cleaned = { ...g };
      if (Array.isArray(cleaned.children) && cleaned.children.length === 0) {
        delete cleaned.children;
      }
      return cleaned;
    });
  }

  try {
    const data = await callETG("POST", endpoint, body);
    const limit = Number(req.query.limit) || 20;
    const trimmed = trimSerpPayload(data, limit, 50);

    const etgRequestId = data?.debug?.request_id || null;
    await saveSerpSearch({
      endpoint,
      payload: body,
      resultsSample: trimmed,
      requestId: etgRequestId,
      ip: req.ip,
    });

    res.json({ status: "ok", endpoint, results: trimmed });
  } catch (e) {
    res.status(400).json({ error: e.message, status: e.status, debug: e.debug, http: e.http });
  }
});

// ========== HOTEL PAGE SEARCH (HP) ==========
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
    const data = await callETG("POST", "/search/hp/", p);
    res.json({ status: "ok", results: data });
  } catch (e) {
    res.status(400).json({ error: e.message, status: e.status, http: e.http, debug: e.debug });
  }
});

// ========== HOTEL INFO ==========
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
    res.status(400).json({ error: e.message, status: e.status, debug: e.debug, http: e.http });
  }
});

// ========== PREBOOK (SERP or HOTEL hash) ==========
router.post("/prebook", async (req, res) => {
  const {
    search_hash,            // sr-... (SERP)
    book_hash,              // h-... from hotelpage
    hash,                   // alias (sr- or h-)
    offer_id,               // alias
    price_increase_percent = 0,
    hp_context              // optional refresh context (id/hid + dates + guests...)
  } = req.body || {};

  const h = search_hash || book_hash || hash || offer_id;
  if (!h || typeof h !== "string" || /^m-/.test(h)) {
    return res.status(400).json({ error: "invalid hash: provide sr-... or h-..." });
  }

  const endpoint = "/hotel/prebook/"; // ETG accepte { hash: sr-|h- } ici aussi
  const payload  = { hash: h, price_increase_percent };

  try {
    const token = await callETG("POST", endpoint, payload);
    // Optionnel: log / persist
    try {
      await savePrebook({ hash: h, token });
    } catch (_) {}
    return res.json({ status: "ok", endpoint, prebook_token: token });
  } catch (e) {
    // refresh auto seulement si hotel hash + contexte fourni + "no_available_rates"
    const stale = e?.debug?.error === "no_available_rates" || e?.message === "no_available_rates";
    const isHotelHash = /^h-/.test(h);
    if (!stale || !isHotelHash || !hp_context) {
      return res.status(400).json({ error: e.message, status: e.status, http: e.http, debug: e.debug });
    }

    try {
      const {
        id, hid, checkin, checkout, guests, residency, currency, language,
        meal: desiredMeal, room_name: desiredRoomName
      } = hp_context || {};

      if (!(id || hid) || !checkin || !checkout || !Array.isArray(guests) || !guests.length) {
        return res.status(400).json({
          error: "hp_context is incomplete; need id|hid, checkin, checkout, guests"
        });
      }

      const hpReq = {
        id: id || hid,
        checkin, checkout, guests,
        residency: residency ? String(residency).toLowerCase() : undefined,
        currency: currency || "EUR",
        language: language || "en",
      };

      const hp = await callETG("POST", "/search/hp/", hpReq);
      const hotels = Array.isArray(hp?.hotels) ? hp.hotels : [];
      const rates = hotels[0]?.rates || [];
      if (!rates.length) return res.status(400).json({ error: "no fresh rates available after refresh" });

      let candidate =
        rates.find(r =>
          (!desiredMeal || r.meal === desiredMeal) &&
          (!desiredRoomName || r.room_name === desiredRoomName)
        ) || rates[0];

      if (!candidate?.hash || !/^h-/.test(candidate.hash)) {
        return res.status(400).json({ error: "no valid h- hash in refreshed rates" });
      }

      const token2 = await callETG("POST", "/hotel/prebook/", { hash: candidate.hash, price_increase_percent });
      return res.json({
        status: "ok",
        endpoint: "/hotel/prebook/",
        prebook_token: token2,
        refreshed: true,
        picked: { meal: candidate.meal, room_name: candidate.room_name, hash: candidate.hash }
      });
    } catch (e2) {
      return res.status(400).json({ error: e2.message || "refresh_failed", status: e2.status, http: e2.http, debug: e2.debug });
    }
  }
});

// ========== BOOKING FORM (CREATE booking process) ==========
// >>> GARDER CETTE VERSION, SUPPRIMER TOUTE AUTRE /booking/form
const { randomUUID } = require("crypto");
router.post("/booking/form", async (req, res) => {
  const {
    prebook_token,   // p-... (recommandé)
    token,           // alias
    book_hash,       // fallback si tu le nommes comme ça côté client
    language = "en",
  } = req.body || {};

  const raw = book_hash || prebook_token || token;
  if (!raw || typeof raw !== "string" || !/^p-/.test(raw)) {
    return res.status(400).json({ error: "book_hash is required and must start with 'p-'" });
  }

  const payload = {
    partner_order_id: randomUUID(),
    book_hash: raw,
    language,
    user_ip: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip,
  };

  try {
    const form = await callETG("POST", "/hotel/order/booking/form/", payload);
    return res.json({ status: "ok", partner_order_id: payload.partner_order_id, form });
  } catch (e) {
    return res.status(400).json({ error: e.message, status: e.status, http: e.http, debug: e.debug });
  }
});

// ========== START BOOKING (aka finish) ==========
// >>> C’EST LA BONNE VERSION (avec partner_order_id, rooms, user, payment_type…)
router.post("/booking/start", async (req, res) => {
  try {
    const {
      partner_order_id,
      language = "en",
      user,
      rooms,
      payment_type,
      supplier_data,
      upsell_data,
      return_path,
      arrival_datetime,
    } = req.body || {};

    if (!partner_order_id) return res.status(400).json({ error: "partner_order_id is required" });
    if (!user?.email || !user?.phone) {
      return res.status(400).json({ error: "user.email and user.phone are required" });
    }
    if (!Array.isArray(rooms) || rooms.length === 0) {
      return res.status(400).json({ error: "rooms (with guests[]) is required" });
    }
    if (!payment_type?.currency_code) {
      return res.status(400).json({ error: "payment_type.currency_code is required (e.g., 'EUR')" });
    }
    if (!payment_type?.type) payment_type.type = "deposit";

    const payload = {
      partner: { partner_order_id, comment: null, amount_sell_b2b2c: null },
      language,
      user,
      supplier_data,
      rooms,
      upsell_data,
      payment_type,
      return_path,
      arrival_datetime,
    };

    const startResp = await callETG("POST", "/hotel/order/booking/finish/", payload);
    return res.json({ status: "ok", start: startResp });
  } catch (e) {
    return res.status(400).json({ error: e.message, status: e.status, http: e.http, debug: e.debug });
  }
});

// ========== CHECK BOOKING STATUS ==========
// FILE: routes/api.js  (replace your current /booking/check route)

// Poll booking status (ETG calls this "Check booking process")
router.post("/booking/check", async (req, res) => {
  try {
    const { partner_order_id } = req.body || {};
    if (!partner_order_id) {
      return res.status(400).json({ error: "partner_order_id is required" });
    }

    // Correct ETG endpoint (POST + body with partner_order_id)
    const payload = { partner_order_id };
    const resp = await callETG("POST", "/hotel/order/booking/finish/status/", payload);

    return res.json({ status: "ok", check: resp });
  } catch (e) {
    return res
      .status(400)
      .json({ error: e.message, status: e.status, http: e.http, debug: e.debug });
  }
});


// ========== WEBHOOKS ==========
router.post("/webhook/ratehawk", async (req, res) => {
  try {
    console.log("[ETG Webhook]", req.body);
    res.status(200).send("OK");
  } catch (e) {
    res.status(500).send("Internal Server Error");
  }
});

router.post("/webhook/stripe", async (req, res) => {
  try {
    console.log("[Stripe Webhook]", req.body);
    res.status(200).send("OK");
  } catch (e) {
    res.status(500).send("Internal Server Error");
  }
});

// ========== ERROR HANDLER ==========
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
    debug: err.debug || null,
  });
});

module.exports = router;
