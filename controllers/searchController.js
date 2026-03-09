"use strict";

const searchModel = require("../models/searchModel");
const contentModel = require("../models/contentModel");
const { saveSerpSearch } = require("../utils/repo");
const {
  trimSerpPayload,
  filterHotelsByPreferences,
  sanitizeHpResults,
  paginateCollection,
  rankHotelsByOccupancy,
} = require("../src/utils/payloadUtils");

function parseDistanceMeters(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  const raw = String(value).trim().toLowerCase();
  if (!raw) return null;
  const normalized = raw.replace(",", ".");
  const kmMatch = normalized.match(/(\d+(?:\.\d+)?)\s*km\b/);
  if (kmMatch) return Number(kmMatch[1]) * 1000;
  const mMatch = normalized.match(/(\d+(?:\.\d+)?)\s*m\b/);
  if (mMatch) return Number(mMatch[1]);
  const miMatch = normalized.match(/(\d+(?:\.\d+)?)\s*mi\b/);
  if (miMatch) return Number(miMatch[1]) * 1609.34;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function firstDistanceFromCandidates(candidates = []) {
  for (const candidate of candidates) {
    const parsed = parseDistanceMeters(candidate);
    if (parsed !== null) return parsed;
  }
  return null;
}

function findPoiDistance(source, keywords = []) {
  if (!source || typeof source !== "object") return null;
  const poiGroups = [
    source?.points_of_interest,
    source?.pois,
    source?.nearby_points,
    source?.rg_ext?.points_of_interest,
  ];
  for (const pois of poiGroups) {
    if (!Array.isArray(pois)) continue;
    const matches = pois
      .map((poi) => {
        const label = String(
          poi?.name || poi?.label || poi?.description || poi?.type || poi?.kind || ""
        )
          .trim()
          .toLowerCase();
        if (!label) return null;
        const isMatch = keywords.some((kw) => label.includes(kw));
        if (!isMatch) return null;
        return firstDistanceFromCandidates([
          poi?.distance,
          poi?.distance_meters,
          poi?.distance_center_meters,
        ]);
      })
      .filter((num) => Number.isFinite(num));
    if (matches.length) return Math.min(...matches);
  }
  return null;
}

function extractBeachDistanceMeters(hotel, content) {
  const direct = firstDistanceFromCandidates([
    hotel?.beachDistanceM,
    hotel?.distance_to_beach,
    hotel?.beach_distance,
    hotel?.distance_beach,
    hotel?.location?.distance_to_beach,
    hotel?.distances?.beach,
    hotel?.rg_ext?.distance_to_beach,
    hotel?.rg_ext?.beach_distance,
    content?.distance_to_beach,
    content?.beach_distance,
    content?.distance_beach,
    content?.location?.distance_to_beach,
    content?.distances?.beach,
  ]);
  if (direct !== null) return Math.round(direct);
  const fromHotelPoi = findPoiDistance(hotel, ["beach", "plage", "sea", "shore", "coast"]);
  if (fromHotelPoi !== null) return Math.round(fromHotelPoi);
  const fromContentPoi = findPoiDistance(content, ["beach", "plage", "sea", "shore", "coast"]);
  if (fromContentPoi !== null) return Math.round(fromContentPoi);
  return null;
}

function normalizeCoord(value) {
  if (value === undefined || value === null) return null;
  const normalized =
    typeof value === "string" ? value.trim().replace(",", ".") : value;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function resolveCoordinates(obj = {}) {
  return {
    lat: normalizeCoord(
      obj?.latitude ??
        obj?.lat ??
        obj?.geo?.latitude ??
        obj?.geo?.lat ??
        obj?.coordinates?.latitude ??
        obj?.coordinates?.lat ??
        obj?.point?.latitude ??
        obj?.point?.lat ??
        obj?.center?.latitude ??
        obj?.center?.lat ??
        obj?.location?.latitude ??
        obj?.location?.lat
    ),
    lon: normalizeCoord(
      obj?.longitude ??
        obj?.lon ??
        obj?.lng ??
        obj?.geo?.longitude ??
        obj?.geo?.lon ??
        obj?.geo?.lng ??
        obj?.coordinates?.longitude ??
        obj?.coordinates?.lon ??
        obj?.coordinates?.lng ??
        obj?.point?.longitude ??
        obj?.point?.lon ??
        obj?.point?.lng ??
        obj?.center?.longitude ??
        obj?.center?.lon ??
        obj?.center?.lng ??
        obj?.location?.longitude ??
        obj?.location?.lon ??
        obj?.location?.lng ??
        obj?.long
    ),
  };
}

function haversineMeters(aLat, aLon, bLat, bLon) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const aa =
    s1 * s1 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

function resolveDestinationCenter(payload, resolvedRegion, regionSuggestions) {
  const payloadCoords = resolveCoordinates(payload || {});
  if (payloadCoords.lat !== null && payloadCoords.lon !== null) {
    return { latitude: payloadCoords.lat, longitude: payloadCoords.lon, source: "payload" };
  }
  const regionCoords = resolveCoordinates(resolvedRegion || {});
  if (regionCoords.lat !== null && regionCoords.lon !== null) {
    return { latitude: regionCoords.lat, longitude: regionCoords.lon, source: "resolvedRegion" };
  }
  const firstSuggestion = Array.isArray(regionSuggestions) ? regionSuggestions[0] : null;
  const suggestionCoords = resolveCoordinates(firstSuggestion || {});
  if (suggestionCoords.lat !== null && suggestionCoords.lon !== null) {
    return { latitude: suggestionCoords.lat, longitude: suggestionCoords.lon, source: "regionSuggestion" };
  }
  return null;
}


/**
 * Destination autocomplete shared between SERP and front filters.
 */
async function searchRegions(req, res, next) {
  try {
    const term = (req.query.q || "").trim();
    const language = (req.query.lang || req.query.language || "en").trim() || "en";

    if (!term) {
      return res.json({ regions: [], hotels: [] });
    }

    const suggestions = await searchModel.fetchDestinationSuggestions(term, language);
    res.json(suggestions);
  } catch (error) {
    next(error);
  }
}

/**
 * Main SERP endpoint with basic filters and built-in trimming to keep payloads light.
 */
async function searchSerp(req, res, next) {
  try {
    const filters = req.body?.filters || {};
    const page = req.query.page || 1;
    const hotelsLimit = req.query.limit || 20;
    const payload = { ...req.body };

    const {
      payload: resolvedPayload,
      resolvedRegion,
      regionSuggestions,
      resolvedHotel,
      hotelSuggestions,
    } =
      await searchModel.resolveDestination(payload);

    const { endpoint, body } = searchModel.buildSerpRequest(resolvedPayload);
    const data = await searchModel.fetchSerp(endpoint, body);

    let hotels =
      data?.results?.hotels ||
      data?.hotels ||
      (Array.isArray(data?.results) ? data.results : []);

    hotels = Array.isArray(hotels) ? hotels : [];
    const destinationCenter = resolveDestinationCenter(
      resolvedPayload,
      resolvedRegion,
      regionSuggestions
    );
    const hids = Array.from(new Set(hotels.map((hotel) => extractHotelHid(hotel)).filter(Boolean)));
    let contentByHid = new Map();
    if (hids.length) {
      try {
        const contentResponse = await contentModel.fetchHotelContentByIds({
          hids,
          language: body.language || "en",
        });
        const rows = Array.isArray(contentResponse?.hotels) ? contentResponse.hotels : [];
        contentByHid = new Map(
          rows
            .map((row) => [normalizeHid(row?.hid || row?.id || row?.hotel_id), row])
            .filter((entry) => entry[0] !== null)
        );
      } catch {
        contentByHid = new Map();
      }
    }
    hotels = hotels.map((hotel) => {
      const hid = extractHotelHid(hotel);
      const content = hid !== null ? contentByHid.get(hid) || null : null;
      const hotelCoords = resolveCoordinates(hotel);
      const contentCoords = resolveCoordinates(content || {});
      const lat = hotelCoords.lat ?? contentCoords.lat;
      const lon = hotelCoords.lon ?? contentCoords.lon;
      const cityCenterDistanceM =
        destinationCenter &&
        Number.isFinite(lat) &&
        Number.isFinite(lon)
          ? Math.round(
              haversineMeters(
                lat,
                lon,
                destinationCenter.latitude,
                destinationCenter.longitude
              )
            )
          : null;
      const beachDistanceM = extractBeachDistanceMeters(hotel, content);
      return {
        ...hotel,
        content,
        lat,
        lon,
        cityCenterDistanceM,
        beachDistanceM,
        geo: {
          lat,
          lon,
          cityCenterDistanceM,
          beachDistanceM,
          destinationCenter,
        },
      };
    });
    hotels = filterHotelsByPreferences(hotels, filters);
    const requestedCapacity = searchModel.getRequestedCapacity(resolvedPayload.guests);
    hotels = rankHotelsByOccupancy(hotels, requestedCapacity);
    const pagination = paginateCollection(hotels, { page, limit: hotelsLimit });

    const trimmed = trimSerpPayload(
      { hotels: pagination.items },
      { hotelsLimit: pagination.perPage, ratesLimit: 40, offersLimit: 40 }
    );

    await saveSerpSearch({
      endpoint,
      payload: body,
      resultsSample: trimmed,
      requestId: data?.debug?.request_id || null,
      ip: req.ip,
    });

    res.json({
      status: "ok",
      endpoint,
      results: trimmed,
      resolvedRegion,
      resolvedHotel,
      regionSuggestions,
      hotelSuggestions,
      geo_enrichment: {
        destination_center: destinationCenter,
        requested_hids: hids.length,
        content_hits: contentByHid.size,
      },
      pagination: {
        page: pagination.page,
        perPage: pagination.perPage,
        total: pagination.total,
        totalPages: pagination.totalPages,
        hasNext: pagination.hasNext,
        hasPrev: pagination.hasPrev,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Hotel-page search (single hotel refresh) used after SERP prebook.
 */
async function searchHotelPage(req, res, next) {
  try {
    const payload = searchModel.buildHotelPageRequest(req.body || {});
    const data = await searchModel.fetchHotelPage(payload);
    const sanitized = sanitizeHpResults(data, { ratesLimit: Number(req.query.rateLimit) || 25 });
    res.json({ status: "ok", results: sanitized });
  } catch (error) {
    next(error);
  }
}

function extractHotels(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.hotels)) return payload.hotels;
  if (Array.isArray(payload.results)) return payload.results;
  if (payload.results) return extractHotels(payload.results);
  if (payload.data) return extractHotels(payload.data);
  return [];
}

function normalizeHid(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const direct = Number(raw);
  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
  const match = raw.match(/(\d{4,})/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function extractHotelHid(hotel = {}) {
  const candidates = [
    hotel?.hid,
    hotel?.id,
    hotel?.hotel_id,
    hotel?.hotelId,
    hotel?.rg_ext?.hid,
    hotel?.rg_ext?.id,
    hotel?.rg_ext?.hotel_id,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeHid(candidate);
    if (normalized !== null) return normalized;
  }
  return null;
}

async function searchNearbyHotels(req, res, next) {
  try {
    const page = req.query.page || 1;
    const hotelsLimit = req.query.limit || 20;
    const payload = searchModel.buildNearbySearchPayload(req.body || {});
    const data = await searchModel.fetchSerp("/search/serp/geo/", payload.serpPayload);

    let hotels = extractHotels(data);
    hotels = Array.isArray(hotels) ? hotels : [];

    const hids = Array.from(new Set(hotels.map((hotel) => extractHotelHid(hotel)).filter(Boolean)));
    let contentByHid = new Map();
    if (hids.length) {
      try {
        const contentResponse = await contentModel.fetchHotelContentByIds({
          hids,
          language: payload.serpPayload.language || "en",
        });
        const rows = Array.isArray(contentResponse?.hotels) ? contentResponse.hotels : [];
        contentByHid = new Map(
          rows
            .map((row) => [normalizeHid(row?.hid || row?.id || row?.hotel_id), row])
            .filter((entry) => entry[0] !== null)
        );
      } catch {
        contentByHid = new Map();
      }
    }

    hotels = hotels.map((hotel) => {
      const hid = extractHotelHid(hotel);
      if (hid === null) return hotel;
      const content = contentByHid.get(hid);
      if (!content) return hotel;
      return {
        ...hotel,
        content,
      };
    });

    hotels = filterHotelsByPreferences(hotels, payload.filters || {});
    const requestedCapacity = searchModel.getRequestedCapacity(payload.serpPayload.guests);
    hotels = rankHotelsByOccupancy(hotels, requestedCapacity);
    const pagination = paginateCollection(hotels, { page, limit: hotelsLimit });
    const trimmed = trimSerpPayload(
      { hotels: pagination.items },
      { hotelsLimit: pagination.perPage, ratesLimit: 40, offersLimit: 40 }
    );

    await saveSerpSearch({
      endpoint: "/search/serp/geo/",
      payload: payload.serpPayload,
      resultsSample: trimmed,
      requestId: data?.debug?.request_id || null,
      ip: req.ip,
    });

    res.json({
      status: "ok",
      endpoint: "/search/serp/geo/",
      source: "nearby_geo",
      nearby: {
        latitude: payload.latitude,
        longitude: payload.longitude,
        radius_m: payload.radiusMeters,
        radius_km: Number((payload.radiusMeters / 1000).toFixed(2)),
      },
      enrichment: {
        requested_hids: hids.length,
        content_hits: contentByHid.size,
      },
      results: trimmed,
      pagination: {
        page: pagination.page,
        perPage: pagination.perPage,
        total: pagination.total,
        totalPages: pagination.totalPages,
        hasNext: pagination.hasNext,
        hasPrev: pagination.hasPrev,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  searchRegions,
  searchSerp,
  searchHotelPage,
  searchNearbyHotels,
};
