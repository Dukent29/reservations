"use strict";

const { callETG, callETGContent } = require("../utils/etg");

async function fetchHotelDump(language = "en") {
  return callETG("POST", "/hotel/info/dump/", { language });
}

function sanitizeHids(hids = []) {
  const unique = new Set();
  const out = [];
  for (const value of hids) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) continue;
    const normalized = Math.floor(num);
    if (unique.has(normalized)) continue;
    unique.add(normalized);
    out.push(normalized);
  }
  return out;
}

async function fetchHotelContentByIds(options = {}) {
  const language = (options.language || "en").trim() || "en";
  const hids = sanitizeHids(Array.isArray(options.hids) ? options.hids : []);
  if (!hids.length) return { hotels: [], hids: [] };
  const limited = hids.slice(0, 200);
  const data = await callETGContent("POST", "/hotel_content_by_ids/", {
    language,
    hids: limited,
  });
  const hotels = Array.isArray(data?.hotels)
    ? data.hotels
    : Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
        ? data
        : [];
  return { hotels, hids: limited };
}

module.exports = {
  fetchHotelDump,
  fetchHotelContentByIds,
};
