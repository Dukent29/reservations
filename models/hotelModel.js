"use strict";

const { callETG } = require("../utils/etg");
const httpError = require("../src/utils/httpError");

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
  const limit = Number(options.limit);
  const hasLimit = Number.isFinite(limit) && limit > 0;
  const cappedLimit = hasLimit ? Math.max(1, Math.min(limit, 50)) : null;
  const payload = buildHotelInfoPayload(options);
  const info = await fetchHotelInfo(payload);
  const candidates = normalizeCandidates(info);
  const selected = cappedLimit ? candidates.slice(0, cappedLimit) : candidates;
  const size = options.size || "x500";

  const images = selected
    .map((candidate) => replaceSizeToken(candidate.url, size))
    .filter((url) => typeof url === "string" && url.length);

  return {
    images,
    sizeUsed: size,
    hid: info?.hid || payload.hid || payload.id,
  };
}

module.exports = {
  buildHotelInfoPayload,
  fetchHotelInfo,
  fetchHotelImages,
};
