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

const axios = require("axios");
const { callETG, BASE: UTIL_BASE } = require("../utils/etg");
const BASE =
  (process.env.ETG_ENV || "prod").toLowerCase() === "sandbox"
    ? process.env.ETG_BASE_SANDBOX || UTIL_BASE
    : process.env.ETG_BASE_PROD || UTIL_BASE;
const KEY_ID = String(process.env.ETG_PARTNER_ID || "").trim();
const API_KEY = String(process.env.ETG_API_KEY || "").trim();
const AUTH = "Basic " + Buffer.from(`${KEY_ID}:${API_KEY}`).toString("base64");
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

// ========== REGION / HOTEL AUTOCOMPLETE ==========
router.get("/regions/search", async (req, res) => {
  const term = (req.query.q || "").trim();
  const language = (req.query.lang || req.query.language || "en").trim() || "en";

  if (!term) return res.json({ regions: [], hotels: [] });

  try {
    const mc = await axios.post(
      `${BASE}/search/multicomplete/`,
      { query: term, language },
      {
        headers: {
          Authorization: AUTH,
          Accept: "application/json",
          "User-Agent": process.env.APP_USER_AGENT || "KotanVoyages/1.0 (+tech@kotan)",
        },
        timeout: 12000,
      }
    );

    const raw = mc.data || {};
    const pickArray = (...candidates) => {
      for (const c of candidates) {
        if (Array.isArray(c)) return c;
      }
      return [];
    };

    const regions = pickArray(raw?.data?.regions, raw?.results?.regions, raw?.regions)
      .filter((r) => r && r.id && r.is_searchable !== false)
      .map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        country_code: r.country_code,
        full_name: r.full_name || r.fullName || null,
        is_searchable: r.is_searchable !== false,
      }));

    const hotels = pickArray(raw?.data?.hotels, raw?.results?.hotels, raw?.hotels)
      .filter((h) => h && (h.hid || h.id))
      .map((h) => ({
        id: h.id || null,
        hid: h.hid || null,
        name: h.name || null,
        region_id: h.region_id || null,
      }));

    res.json({ regions, hotels });
  } catch (e) {
    res.status(400).json({ error: e.message, status: e.status, debug: e.debug, http: e.http });
  }
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

  const rawRegionId = typeof p.region_id === "string" ? p.region_id.trim() : null;
  const regionIdIsNumeric =
    typeof p.region_id === "number" ||
    (rawRegionId && /^\d+$/.test(rawRegionId));

  const destinationQuery = (() => {
    if (typeof p.query === "string" && p.query.trim().length >= 2) {
      return p.query.trim();
    }
    if (!regionIdIsNumeric && rawRegionId && rawRegionId.length >= 2) {
      return rawRegionId;
    }
    return null;
  })();

  if (!regionIdIsNumeric && destinationQuery) {
    const language = (p.language || "en").trim() || "en";
    try {
      const mc = await axios.post(
        `${BASE}/search/multicomplete/`,
        { query: destinationQuery, language },
        {
          headers: {
            Authorization: AUTH,
            Accept: "application/json",
            "User-Agent": process.env.APP_USER_AGENT || "KotanVoyages/1.0 (+tech@kotan)",
          },
          timeout: 12000,
        }
      );

      let regions =
        (mc.data?.results?.regions ||
          mc.data?.data?.regions ||
          mc.data?.regions ||
          []) || [];

      regions = regions.filter((r) => r && r.id && r.is_searchable !== false);
      if (!regions.length) {
        return res.status(404).json({ error: "region_not_found", query: destinationQuery });
      }

      const norm = (val) => String(val || "").trim().toLowerCase();
      const target = norm(destinationQuery);
      const scoreRegion = (r, idx) => {
        const name = norm(r.name);
        const full = norm(r.full_name || r.fullName || r.name);
        const type = norm(r.type);
        let score = 0;
        if (name === target || full === target) score += 5;
        if (type === "city") score += 2;
        if (name.includes(target) || full.includes(target)) score += 1;
        score -= idx * 0.01; // keep initial order as tiebreaker
        return score;
      };

      const ranked = regions
        .map((r, idx) => ({ r, score: scoreRegion(r, idx) }))
        .sort((a, b) => b.score - a.score);

      const picked = ranked[0]?.r;
      if (!picked) {
        return res.status(404).json({ error: "region_not_found", query: destinationQuery });
      }

      p.region_id = picked.id;
      p._resolved_region = picked;
      p._region_suggestions = regions.slice(0, 7).map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        country_code: r.country_code,
      }));
    } catch (err) {
      return res.status(400).json({ error: "region_lookup_failed", debug: err.message });
    }
  }

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

    // ----- FILTER HELPERS -----
    function hotelStars(hotel) {
      const direct = hotel?.stars ?? hotel?.category ?? hotel?.rg_ext?.class;
      const directNum = Number(direct);
      if (Number.isFinite(directNum) && directNum > 0) return directNum;
      if (Array.isArray(hotel?.rates)) {
        const vals = hotel.rates
          .map(r => Number(r?.rg_ext?.class))
          .filter(n => Number.isFinite(n) && n > 0);
        if (vals.length) return Math.max(...vals);
      }
      return null;
    }
    function rateHasFreeCancellation(rate) {
      const fc = rate?.payment_options?.payment_types?.[0]?.cancellation_penalties?.free_cancellation_before;
      if (!fc) return false;
      const ts = Date.parse(fc);
      return Number.isFinite(ts) ? ts > Date.now() : false;
    }
    function rateMealCode(rate) {
      return rate?.meal || rate?.meal_data?.value || null;
    }
    function rateMatchesMeal(rate, meals) {
      if (!meals?.length) return true;
      const code = rateMealCode(rate);
      return code ? meals.includes(code) : false;
    }

    // ----- APPLY FILTERS -----
    const filters = req.body?.filters || {};
    let hotels = (data?.results?.hotels) || (data?.hotels) || [];
    if (!Array.isArray(hotels) && Array.isArray(data?.results)) hotels = data.results;

    if (Array.isArray(hotels) && hotels.length) {
      if (filters.stars?.length) {
        const starSet = new Set(
          filters.stars
            .map((v) => Number(v))
            .filter((n) => Number.isFinite(n) && n > 0)
        );
        if (starSet.size) {
          hotels = hotels.filter((h) => {
            const st = Number(hotelStars(h));
            return Number.isFinite(st) && starSet.has(st);
          });
        }
      }

      if (filters.meals?.length || filters.free_cancel) {
        hotels = hotels
          .map(h => {
            const rates = Array.isArray(h.rates) ? h.rates : [];
            const filteredRates = rates.filter(r => {
              const mealOk = rateMatchesMeal(r, filters.meals);
              const cancelOk = filters.free_cancel ? rateHasFreeCancellation(r) : true;
              return mealOk && cancelOk;
            });
            return { ...h, rates: filteredRates };
          })
          .filter(h => (Array.isArray(h.rates) && h.rates.length > 0));
      }
    }

    // ----- TRIM + RESPOND -----
    const trimmed = trimSerpPayload({ hotels }, limit, 50);

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

// ========== HOTEL IMAGES (LIGHTWEIGHT PROXY) ==========
router.post("/hotel/images", async (req, res) => {
  const {
    hid,
    id,
    language = "en",
    size = "x500",
    limit,
  } = req.body || {};

  const payload = { language: language || "en" };
  if (hid) payload.hid = hid;
  else if (id) payload.id = id;
  else return res.status(400).json({ error: "hid or id is required" });

  const parsedLimit = Number(limit);
  const hasLimit = Number.isFinite(parsedLimit) && parsedLimit > 0;
  const cappedLimit = hasLimit ? Math.max(1, Math.min(parsedLimit, 50)) : null;

  const categoryBonus = (slug) => {
    const s = (slug || "").toLowerCase();
    if (!s) return 0;
    if (s.includes("outside") || s.includes("exterior")) return 40;
    if (s.includes("lobby") || s.includes("reception")) return 25;
    if (s.includes("restaurant") || s.includes("bar")) return 20;
    if (s.includes("pool") || s.includes("spa") || s.includes("wellness")) return 18;
    if (s.includes("room") || s.includes("bedroom") || s.includes("suite")) return 12;
    if (s.includes("bathroom")) return 10;
    if (s.includes("others")) return 5;
    return 8;
  };

  const normalizeCandidates = (info) => {
    const candidates = [];
    const seen = new Set();

    const pushCandidate = (url, meta = {}) => {
      if (typeof url !== "string" || !url.length) return;
      const key = url.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const sourceBase = meta.sourcePriority ?? 0;
      const priority = sourceBase + categoryBonus(meta.category);
      candidates.push({
        url,
        priority,
        category: meta.category || null,
        source: meta.source || null,
      });
    };

    const hotelImagesExt = Array.isArray(info?.images_ext) ? info.images_ext : [];
    hotelImagesExt.forEach((img) =>
      pushCandidate(img?.url, {
        category: img?.category_slug,
        source: "hotel_ext",
        sourcePriority: 70,
      })
    );

    const hotelImages = Array.isArray(info?.images) ? info.images : [];
    hotelImages.forEach((img) =>
      pushCandidate(img, {
        category: null,
        source: "hotel",
        sourcePriority: 60,
      })
    );

    const rooms = Array.isArray(info?.room_groups) ? info.room_groups : [];
    rooms.forEach((room) => {
      const roomName = room?.name || room?.name_struct?.main_name || "room";
      const base = 40;
      if (Array.isArray(room?.images_ext)) {
        room.images_ext.forEach((img) =>
          pushCandidate(img?.url, {
            category: img?.category_slug || roomName,
            source: "room_ext",
            sourcePriority: base + 5,
          })
        );
      }
      if (Array.isArray(room?.images)) {
        room.images.forEach((img) =>
          pushCandidate(img, {
            category: roomName,
            source: "room",
            sourcePriority: base,
          })
        );
      }
    });

    return candidates.sort((a, b) => b.priority - a.priority);
  };

  const replaceSizeToken = (url, requestedSize) => {
    if (typeof url !== "string") return null;
    if (url.includes("{size}")) {
      return url.replace("{size}", requestedSize || "x500");
    }
    return url;
  };

  try {
    const info = await callETG("POST", "/hotel/info/", payload);
    const candidates = normalizeCandidates(info);
    const selected = cappedLimit ? candidates.slice(0, cappedLimit) : candidates;
    const images = selected
      .map((c) => replaceSizeToken(c.url, size))
      .filter((u) => typeof u === "string" && u.length);

    return res.json({
      status: "ok",
      hid: info?.hid || payload.hid || payload.id,
      count: images.length,
      sizeUsed: size,
      images,
    });
  } catch (e) {
    return res.status(400).json({ error: e.message, status: e.status, debug: e.debug, http: e.http });
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

// ===== HOTEL FULL DUMP (download URL) =====
// POST /api/content/hotel-dump
// Body (optionnel): { "language": "en" }  // par défaut "en"
router.post("/content/hotel-dump", async (req, res) => {
  try {
    const { language = "en" } = req.body || {};
    // ETG: full hotel dump
    const data = await callETG("POST", "/hotel/info/dump/", { language });

    // Selon ETG, la réponse contient généralement un lien de téléchargement (ex: data.url ou data.download_url)
    // On renvoie brut + un alias "download_url" si on le détecte.
    const download_url =
      data?.download_url || data?.url || data?.link || null;

    return res.json({
      status: "ok",
      hint: "Use download_url to fetch the .zst file (often .jsonl.zst or .tar.zst)",
      download_url,
      raw: data,
    });
  } catch (e) {
    return res.status(400).json({
      error: e.message,
      status: e.status,
      http: e.http,
      debug: e.debug
    });
  }
});


module.exports = router;
