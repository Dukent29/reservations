"use strict";

const { callETG } = require("../utils/etg");
const { etg } = require("../src/lib/etgClient");
const httpError = require("../src/utils/httpError");

function pickArray(...candidates) {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

async function fetchDestinationSuggestions(query, language = "en") {
  const response = await etg.post("/search/multicomplete/", { query, language });
  const raw = response?.data || {};

  const regions = pickArray(raw?.data?.regions, raw?.results?.regions, raw?.regions)
    .filter((region) => region && region.id && region.is_searchable !== false)
    .map((region) => ({
      id: region.id,
      name: region.name,
      type: region.type,
      country_code: region.country_code,
      full_name: region.full_name || region.fullName || null,
      is_searchable: region.is_searchable !== false,
    }));

  const hotels = pickArray(raw?.data?.hotels, raw?.results?.hotels, raw?.hotels)
    .filter((hotel) => hotel && (hotel.hid || hotel.id))
    .map((hotel) => ({
      id: hotel.id || null,
      hid: hotel.hid || null,
      name: hotel.name || null,
      region_id: hotel.region_id || null,
    }));

  return { regions, hotels };
}

function normalizeLanguage(value) {
  return (value || "en").trim() || "en";
}

function shouldResolveRegion(payload = {}) {
  const rawRegionId = typeof payload.region_id === "string" ? payload.region_id.trim() : null;
  const regionIdIsNumeric =
    typeof payload.region_id === "number" || (rawRegionId && /^\d+$/.test(rawRegionId));
  const possibleQuery = (() => {
    if (typeof payload.query === "string" && payload.query.trim().length >= 2) {
      return payload.query.trim();
    }
    if (!regionIdIsNumeric && rawRegionId && rawRegionId.length >= 2) {
      return rawRegionId;
    }
    return null;
  })();
  return { regionIdIsNumeric, possibleQuery };
}

async function resolveDestination(payload = {}) {
  const cloned = { ...payload };
  const language = normalizeLanguage(cloned.language);
  const { regionIdIsNumeric, possibleQuery } = shouldResolveRegion(cloned);

  if (!regionIdIsNumeric && possibleQuery) {
    try {
      const suggestions = await fetchDestinationSuggestions(possibleQuery, language);
      if (!suggestions.regions.length) {
        throw httpError(404, "region_not_found", { query: possibleQuery });
      }

      const norm = (value) => String(value || "").trim().toLowerCase();
      const target = norm(possibleQuery);
      const ranked = suggestions.regions
        .map((region, idx) => {
          const name = norm(region.name);
          const full = norm(region.full_name || region.name);
          const type = norm(region.type);
          let score = 0;
          if (name === target || full === target) score += 5;
          if (type === "city") score += 2;
          if (name.includes(target) || full.includes(target)) score += 1;
          score -= idx * 0.01;
          return { region, score };
        })
        .sort((a, b) => b.score - a.score);

      const picked = ranked[0]?.region;
      if (!picked) {
        throw httpError(404, "region_not_found", { query: possibleQuery });
      }

      cloned.region_id = picked.id;
      return {
        payload: cloned,
        resolvedRegion: picked,
        regionSuggestions: suggestions.regions.slice(0, 7),
      };
    } catch (error) {
      if (error.http) throw error;
      throw httpError(400, "region_lookup_failed", { message: error.message });
    }
  }

  return { payload: cloned, resolvedRegion: null, regionSuggestions: [] };
}

function buildSerpRequest(payload = {}) {
  const body = { ...payload };
  delete body.filters;
  body.language = normalizeLanguage(body.language);
  body.currency = (body.currency || "EUR").trim() || "EUR";

  if (!body.checkin || !body.checkout) {
    throw httpError(400, "checkin & checkout are required (YYYY-MM-DD)");
  }
  if (!body.guests || !Array.isArray(body.guests) || body.guests.length === 0) {
    throw httpError(400, "guests is required (e.g., [{ adults: 2 }])");
  }

  const checkinDate = new Date(body.checkin);
  const checkoutDate = new Date(body.checkout);
  if (!(checkinDate instanceof Date) || Number.isNaN(checkinDate.getTime())) {
    throw httpError(400, "invalid date format (use YYYY-MM-DD)");
  }
  if (!(checkoutDate instanceof Date) || Number.isNaN(checkoutDate.getTime())) {
    throw httpError(400, "invalid date format (use YYYY-MM-DD)");
  }
  if (checkoutDate <= checkinDate) {
    throw httpError(400, "checkout must be after checkin");
  }
  if (body.radius && body.radius > 5000) {
    throw httpError(400, "radius too large (max 5000 meters)");
  }
  if (body.guests && body.guests.length > 4) {
    throw httpError(400, "too many rooms/guests for one request");
  }

  let endpoint = null;
  if ((Array.isArray(body.ids) && body.ids.length) || (Array.isArray(body.hids) && body.hids.length)) {
    endpoint = "/search/serp/hotels/";
  } else if (typeof body.region_id === "number" || typeof body.region_id === "string") {
    endpoint = "/search/serp/region/";
  } else if (
    typeof body.latitude === "number" &&
    typeof body.longitude === "number" &&
    typeof body.radius === "number"
  ) {
    endpoint = "/search/serp/geo/";
    if (body.geo) {
      body.latitude = body.geo.latitude;
      body.longitude = body.geo.longitude;
      body.radius = body.geo.radius;
      delete body.geo;
    }
  }

  if (!endpoint) {
    throw httpError(
      400,
      "You must provide either ids/hids (for /hotels), region_id (for /region), or latitude/longitude/radius (for /geo)."
    );
  }

  if (typeof body.region_id === "string" && /^\d+$/.test(body.region_id)) {
    body.region_id = Number(body.region_id);
  }
  if (body.residency && typeof body.residency === "string") {
    body.residency = body.residency.toLowerCase();
  }
  if (Array.isArray(body.guests)) {
    body.guests = body.guests.map((guest) => {
      const cleaned = { ...guest };
      if (Array.isArray(cleaned.children) && cleaned.children.length === 0) {
        delete cleaned.children;
      }
      return cleaned;
    });
  }

  return { endpoint, body };
}

function buildHotelPageRequest(payload = {}) {
  if (!payload.id && !payload.hid) {
    throw httpError(400, "id (hid) is required");
  }
  if (!payload.checkin || !payload.checkout) {
    throw httpError(400, "checkin/checkout required");
  }
  if (!Array.isArray(payload.guests) || !payload.guests.length) {
    throw httpError(400, "guests is required (e.g., [{ adults: 2 }])");
  }

  const body = { ...payload };
  body.language = normalizeLanguage(body.language);
  body.currency = (body.currency || "EUR").trim() || "EUR";
  if (body.residency) body.residency = String(body.residency).toLowerCase();

  return body;
}

function fetchSerp(endpoint, body) {
  return callETG("POST", endpoint, body);
}

function fetchHotelPage(body) {
  return callETG("POST", "/search/hp/", body);
}

function getRequestedCapacity(guestsPayload = []) {
  if (!Array.isArray(guestsPayload) || !guestsPayload.length) {
    return 1;
  }

  const normalizeChildren = (childrenField) => {
    if (Array.isArray(childrenField)) return childrenField.length;
    const num = Number(childrenField);
    return Number.isFinite(num) && num > 0 ? num : 0;
  };

  return guestsPayload.reduce((max, room) => {
    const adults = Number(room?.adults) || 0;
    const children = normalizeChildren(room?.children);
    const total = Math.max(1, adults + children);
    return Math.max(max, total);
  }, 1);
}

module.exports = {
  fetchDestinationSuggestions,
  resolveDestination,
  buildSerpRequest,
  fetchSerp,
  buildHotelPageRequest,
  fetchHotelPage,
  getRequestedCapacity,
};
