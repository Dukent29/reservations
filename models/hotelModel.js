"use strict";

const { callETG } = require("../utils/etg");
const httpError = require("../src/utils/httpError");

const HOTEL_IMAGES_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const HOTEL_INFO_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const HOTEL_CACHE_MAX_ENTRIES = 300;
const hotelInfoCache = new Map();
const hotelInfoInFlight = new Map();
const hotelImagesCache = new Map();
const hotelImagesInFlight = new Map();

function buildHotelInfoPayload(body = {}) {
  if (!body.id && !body.hid) {
    throw httpError(400, "id or hid is required");
  }
  return {
    ...body,
    language: (body.language || "en").trim() || "en",
  };
}

async function fetchHotelInfo(payload) {
  return callETG("POST", "/hotel/info/", payload);
}

function pruneCache(cache) {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (!entry || entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
  while (cache.size > HOTEL_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

async function fetchCachedHotelInfo(payload, cacheIdentity, language) {
  const cacheKey = `${String(cacheIdentity)}|${language}`;
  const now = Date.now();
  const cachedEntry = hotelInfoCache.get(cacheKey);
  if (cachedEntry && cachedEntry.expiresAt > now) {
    return cachedEntry.value;
  }
  if (hotelInfoInFlight.has(cacheKey)) {
    return hotelInfoInFlight.get(cacheKey);
  }

  const requestPromise = (async () => {
    const staleEntry = hotelInfoCache.get(cacheKey);
    try {
      const info = await fetchHotelInfo(payload);
      hotelInfoCache.set(cacheKey, {
        expiresAt: Date.now() + HOTEL_INFO_CACHE_TTL_MS,
        value: info,
      });
      pruneCache(hotelInfoCache);
      return info;
    } catch (error) {
      if (staleEntry && staleEntry.value) {
        return staleEntry.value;
      }
      throw error;
    } finally {
      hotelInfoInFlight.delete(cacheKey);
    }
  })();

  hotelInfoInFlight.set(cacheKey, requestPromise);
  return requestPromise;
}

function categoryBonus(slug = "") {
  const normalized = slug.toLowerCase();
  if (!normalized) return 0;
  if (normalized.includes("outside") || normalized.includes("exterior")) return 40;
  if (normalized.includes("lobby") || normalized.includes("reception")) return 25;
  if (normalized.includes("restaurant") || normalized.includes("bar")) return 20;
  if (normalized.includes("pool") || normalized.includes("spa") || normalized.includes("wellness")) return 18;
  if (normalized.includes("room") || normalized.includes("bedroom") || normalized.includes("suite")) return 12;
  if (normalized.includes("bathroom")) return 10;
  if (normalized.includes("others")) return 5;
  return 8;
}

function normalizeCandidates(info) {
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
}

function replaceSizeToken(url, requestedSize) {
  if (typeof url !== "string") return null;
  if (url.includes("{size}")) {
    return url.replace("{size}", requestedSize || "x500");
  }
  return url;
}

async function fetchHotelImages(options = {}) {
  const language = (options.language || "en").trim() || "en";
  const limit = Number(options.limit);
  const hasLimit = Number.isFinite(limit) && limit > 0;
  const cappedLimit = hasLimit ? Math.max(1, Math.min(limit, 50)) : null;
  const size = options.size || "x500";
  const cacheIdentity = options.hid || options.id || "";
  const cacheKey = [
    String(cacheIdentity),
    language,
    size,
    cappedLimit == null ? "all" : cappedLimit,
  ].join("|");

  const now = Date.now();
  const cachedEntry = hotelImagesCache.get(cacheKey);
  if (cachedEntry && cachedEntry.expiresAt > now) {
    return cachedEntry.value;
  }
  if (hotelImagesInFlight.has(cacheKey)) {
    return hotelImagesInFlight.get(cacheKey);
  }

  const payload = buildHotelInfoPayload(options);
  payload.language = language;

  const requestPromise = (async () => {
    const staleEntry = hotelImagesCache.get(cacheKey);
    try {
      const info = await fetchCachedHotelInfo(payload, cacheIdentity, language);
      const candidates = normalizeCandidates(info);
      const selected = cappedLimit ? candidates.slice(0, cappedLimit) : candidates;

      const images = selected
        .map((candidate) => replaceSizeToken(candidate.url, size))
        .filter((url) => typeof url === "string" && url.length);

      const result = {
        images,
        sizeUsed: size,
        hid: info?.hid || payload.hid || payload.id,
      };

      hotelImagesCache.set(cacheKey, {
        expiresAt: Date.now() + HOTEL_IMAGES_CACHE_TTL_MS,
        value: result,
      });
      pruneCache(hotelImagesCache);

      return result;
    } catch (error) {
      if (staleEntry && staleEntry.value) {
        return staleEntry.value;
      }
      throw error;
    } finally {
      hotelImagesInFlight.delete(cacheKey);
    }
  })();

  hotelImagesInFlight.set(cacheKey, requestPromise);
  return requestPromise;
}

module.exports = {
  buildHotelInfoPayload,
  fetchHotelInfo,
  fetchHotelImages,
};
