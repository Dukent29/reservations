"use strict";

const crypto = require("crypto");
const fs = require("fs").promises;

const httpError = require("../src/utils/httpError");
const {
  DEFAULT_IMPORT_SOURCE_NAME,
  POI_SUBTYPE_RULES,
  POI_TYPE_RULES,
  POI_TYPE_ALIASES,
  IMPORT_LIMITS,
} = require("../config/hotelPoiConfig");
const hotelPoiRepository = require("../repositories/hotelPoiRepository");

function sanitizeText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeToken(value) {
  const text = sanitizeText(value).toLowerCase();
  if (!text) return "";
  return text.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parsePositiveInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const raw = typeof value === "string" ? value.trim() : value;
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.floor(num);
}

function parseNonNegativeInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const raw = typeof value === "string" ? value.trim() : value;
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.floor(num);
}

function parseBooleanFlag(value) {
  if (value === undefined || value === null || value === "") return false;
  const normalized = sanitizeText(value).toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function formatDistanceLabel(distanceMeters) {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return null;
  if (distanceMeters >= 1000) {
    const km = distanceMeters / 1000;
    return `${km >= 10 ? km.toFixed(0) : km.toFixed(1)} km`;
  }
  return `${Math.round(distanceMeters)} m`;
}

function computeRelevanceScore(baseScore, distanceMeters) {
  const distancePenalty = Math.floor(distanceMeters / 250);
  return Math.max(1, baseScore - distancePenalty);
}

function buildDedupeKey(payload = {}) {
  const basis = [
    payload.hotelHid,
    payload.poiSubtype,
    normalizeToken(payload.poiNameEn || payload.poiName),
    payload.distanceMeters,
  ].join("|");

  return crypto.createHash("sha1").update(basis).digest("hex");
}

function recordErrorSample(errorSamples, type, details = {}) {
  if (errorSamples.length >= IMPORT_LIMITS.errorSampleLimit) return;
  errorSamples.push({ type, ...details });
}

function resolvePoiRule(rawType, rawSubtype) {
  const normalizedSubtype = normalizeToken(rawSubtype);
  if (normalizedSubtype && POI_SUBTYPE_RULES[normalizedSubtype]) {
    return {
      poiSubtype: normalizedSubtype,
      rule: POI_SUBTYPE_RULES[normalizedSubtype],
    };
  }

  const normalizedType = POI_TYPE_ALIASES[normalizeToken(rawType)] || normalizeToken(rawType);
  const typeRule = POI_TYPE_RULES[normalizedType];
  if (typeRule && (normalizedSubtype || typeRule.keepWhenSubtypeMissing)) {
    return {
      poiSubtype: typeRule.normalizedSubtype || normalizedSubtype || normalizedType,
      rule: typeRule,
    };
  }

  return null;
}

function normalizeHotelHeader(rawHotel, errorSamples) {
  const hotelHid = parsePositiveInteger(rawHotel?.hid);
  if (!hotelHid) {
    recordErrorSample(errorSamples, "malformed_hotel", {
      reason: "missing_hid",
      hotelId: sanitizeText(rawHotel?.id) || null,
    });
    return null;
  }

  return {
    hotelHid,
    hotelLegacyId: sanitizeText(rawHotel?.id) || null,
    pois: Array.isArray(rawHotel?.pois) ? rawHotel.pois : [],
  };
}

function normalizePoiRecord(hotel, rawPoi, errorSamples) {
  const names = {
    poiName: sanitizeText(rawPoi?.poi_name),
    poiNameEn: sanitizeText(rawPoi?.poi_name_en),
  };
  const chosenName = names.poiName || names.poiNameEn;
  if (!chosenName) {
    recordErrorSample(errorSamples, "malformed_poi", {
      reason: "missing_name",
      hotelHid: hotel.hotelHid,
    });
    return { status: "malformed" };
  }

  const distanceMeters = parseNonNegativeInteger(rawPoi?.distance);
  if (distanceMeters === null) {
    recordErrorSample(errorSamples, "malformed_poi", {
      reason: "invalid_distance",
      hotelHid: hotel.hotelHid,
      poiName: chosenName,
    });
    return { status: "malformed" };
  }

  const resolvedRule = resolvePoiRule(rawPoi?.poi_type, rawPoi?.poi_subtype);
  if (!resolvedRule) {
    return { status: "skipped" };
  }

  if (distanceMeters > resolvedRule.rule.maxDistanceM) {
    return { status: "skipped" };
  }

  const record = {
    hotelHid: hotel.hotelHid,
    hotelLegacyId: hotel.hotelLegacyId,
    poiName: chosenName,
    poiNameEn: names.poiNameEn || null,
    poiType: sanitizeText(rawPoi?.poi_type) || "Point of Interest",
    poiSubtype: resolvedRule.poiSubtype,
    distanceMeters,
    relevanceScore: computeRelevanceScore(resolvedRule.rule.baseScore, distanceMeters),
    isFeatured: false,
    dedupeKey: null,
    perHotelLimit: resolvedRule.rule.perHotelLimit,
  };

  record.dedupeKey = buildDedupeKey(record);
  return { status: "kept", record };
}

function prepareHotelPoiRows(rawHotel, errorSamples) {
  const hotel = normalizeHotelHeader(rawHotel, errorSamples);
  if (!hotel) {
    return {
      rows: [],
      stats: {
        processedHotels: 1,
        processedPois: 0,
        keptPois: 0,
        skippedPois: 0,
        malformedHotels: 1,
        malformedPois: 0,
      },
    };
  }

  const uniqueByKey = new Map();
  let malformedPois = 0;
  let skippedPois = 0;

  for (const rawPoi of hotel.pois) {
    const normalized = normalizePoiRecord(hotel, rawPoi, errorSamples);
    if (normalized.status === "malformed") {
      malformedPois += 1;
      continue;
    }
    if (normalized.status === "skipped") {
      skippedPois += 1;
      continue;
    }

    const current = uniqueByKey.get(normalized.record.dedupeKey);
    if (!current || normalized.record.relevanceScore > current.relevanceScore) {
      uniqueByKey.set(normalized.record.dedupeKey, normalized.record);
    }
  }

  const subtypeCounts = new Map();
  const sorted = Array.from(uniqueByKey.values()).sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    if (a.distanceMeters !== b.distanceMeters) return a.distanceMeters - b.distanceMeters;
    return a.poiName.localeCompare(b.poiName);
  });

  const selected = [];
  for (const record of sorted) {
    const subtypeCount = subtypeCounts.get(record.poiSubtype) || 0;
    if (subtypeCount >= record.perHotelLimit) continue;
    if (selected.length >= IMPORT_LIMITS.maxPoisPerHotel) break;
    subtypeCounts.set(record.poiSubtype, subtypeCount + 1);
    selected.push(record);
  }

  selected.forEach((record, index) => {
    record.isFeatured = index < IMPORT_LIMITS.maxFeaturedPoisPerHotel;
    delete record.perHotelLimit;
  });

  return {
    rows: selected,
    stats: {
      processedHotels: 1,
      processedPois: hotel.pois.length,
      keptPois: selected.length,
      skippedPois: skippedPois + Math.max(0, uniqueByKey.size - selected.length),
      malformedHotels: 0,
      malformedPois,
    },
  };
}

function mergeStats(target, delta) {
  target.processedHotels += delta.processedHotels || 0;
  target.processedPois += delta.processedPois || 0;
  target.keptPois += delta.keptPois || 0;
  target.skippedPois += delta.skippedPois || 0;
  target.malformedHotels += delta.malformedHotels || 0;
  target.malformedPois += delta.malformedPois || 0;
  target.upsertedPois += delta.upsertedPois || 0;
  target.prunedPois += delta.prunedPois || 0;
}

async function flushImportBatch(batch, options, stats) {
  if (!batch.length) return 0;
  const rowCount = await hotelPoiRepository.upsertHotelPois(batch, {
    runId: options.runId,
    sourceName: options.sourceName,
  });
  stats.upsertedPois += rowCount;
  batch.length = 0;
  return rowCount;
}

function buildLogLine(stats, startedAt, extra = {}) {
  const elapsedMs = Date.now() - startedAt;
  const elapsedSec = Math.max(1, Math.round(elapsedMs / 1000));
  const rate = Math.round(stats.processedHotels / elapsedSec);
  return [
    `[ETG POI IMPORT] hotels=${stats.processedHotels}`,
    `pois=${stats.processedPois}`,
    `kept=${stats.keptPois}`,
    `upserted=${stats.upsertedPois}`,
    `skipped=${stats.skippedPois}`,
    `malformed=${stats.malformedHotels + stats.malformedPois}`,
    `rate=${rate}/s`,
    extra.batch ? `batch=${extra.batch}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

async function detectDumpFormat(filePath) {
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(256);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const firstChar = buffer
      .toString("utf8", 0, bytesRead)
      .replace(/^\uFEFF/, "")
      .trimStart()
      .charAt(0);

    if (firstChar === "[") return "json_array";
    if (firstChar === "{") return "jsonl";
    throw new Error(`Unsupported dump format. First token was "${firstChar || "<empty>"}"`);
  } finally {
    await handle.close();
  }
}

function normalizeQueryFilters(query = {}) {
  const hotelHid = parsePositiveInteger(query.hid);
  const hotelLegacyId = sanitizeText(query.id) || null;
  if (!hotelHid && !hotelLegacyId) {
    throw httpError(400, "hid or id is required");
  }

  const subtype = sanitizeText(query.subtype);
  const maxDistanceM = query.max_distance_m === undefined
    ? null
    : parsePositiveInteger(query.max_distance_m);
  if (query.max_distance_m !== undefined && maxDistanceM === null) {
    throw httpError(400, "max_distance_m must be a positive integer");
  }

  const limit = query.limit === undefined
    ? IMPORT_LIMITS.defaultQueryLimit
    : parsePositiveInteger(query.limit);
  if (query.limit !== undefined && limit === null) {
    throw httpError(400, "limit must be a positive integer");
  }

  return {
    hotelHid,
    hotelLegacyId,
    subtype: subtype ? normalizeToken(subtype) : null,
    maxDistanceM,
    limit: Math.min(limit || IMPORT_LIMITS.defaultQueryLimit, IMPORT_LIMITS.maxQueryLimit),
    featuredOnly: parseBooleanFlag(query.featured),
  };
}

function sanitizePositiveIntegerList(values = []) {
  const unique = new Set();
  const list = [];
  for (const value of values) {
    const parsed = parsePositiveInteger(value);
    if (parsed === null || unique.has(parsed)) continue;
    unique.add(parsed);
    list.push(parsed);
  }
  return list;
}

function sanitizeStringList(values = []) {
  const unique = new Set();
  const list = [];
  for (const value of values) {
    const parsed = sanitizeText(value);
    if (!parsed || unique.has(parsed)) continue;
    unique.add(parsed);
    list.push(parsed);
  }
  return list;
}

function normalizeBatchFilters(body = {}) {
  const hotelHids = sanitizePositiveIntegerList(Array.isArray(body.hids) ? body.hids : []);
  const hotelLegacyIds = sanitizeStringList(Array.isArray(body.ids) ? body.ids : []);

  if (!hotelHids.length && !hotelLegacyIds.length) {
    throw httpError(400, "hids or ids is required");
  }

  const subtype = sanitizeText(body.subtype);
  const maxDistanceM = body.max_distance_m === undefined
    ? null
    : parsePositiveInteger(body.max_distance_m);
  if (body.max_distance_m !== undefined && maxDistanceM === null) {
    throw httpError(400, "max_distance_m must be a positive integer");
  }

  const rawLimitPerHotel = body.limit_per_hotel === undefined
    ? 3
    : parsePositiveInteger(body.limit_per_hotel);
  if (body.limit_per_hotel !== undefined && rawLimitPerHotel === null) {
    throw httpError(400, "limit_per_hotel must be a positive integer");
  }

  return {
    hotelHids,
    hotelLegacyIds,
    subtype: subtype ? normalizeToken(subtype) : null,
    maxDistanceM,
    limitPerHotel: Math.min(rawLimitPerHotel || 3, 12),
    featuredOnly: parseBooleanFlag(body.featured),
  };
}

async function listHotelPois(query = {}) {
  const filters = normalizeQueryFilters(query);
  const rows = await hotelPoiRepository.findHotelPois(filters);
  return {
    hotel: {
      hid: filters.hotelHid || rows[0]?.hotel_hid || null,
      id: filters.hotelLegacyId || rows[0]?.hotel_legacy_id || null,
    },
    filters: {
      subtype: filters.subtype,
      max_distance_m: filters.maxDistanceM,
      limit: filters.limit,
      featured: filters.featuredOnly,
    },
    count: rows.length,
    pois: rows.map((row) => ({
      name: row.poi_name,
      name_en: row.poi_name_en,
      type: row.poi_type,
      subtype: row.poi_subtype,
      distance_meters: row.distance_meters,
      distance_label: formatDistanceLabel(row.distance_meters),
      is_featured: row.is_featured,
      relevance_score: row.relevance_score,
    })),
  };
}

async function listHotelPoisBatch(body = {}) {
  const filters = normalizeBatchFilters(body);
  const rows = await hotelPoiRepository.findHotelPoisBatch(filters);
  const groups = new Map();

  rows.forEach((row) => {
    const hotelKey = `hid:${row.hotel_hid}`;
    if (!groups.has(hotelKey)) {
      groups.set(hotelKey, {
        hid: row.hotel_hid,
        id: row.hotel_legacy_id || null,
        count: 0,
        pois: [],
      });
    }

    const group = groups.get(hotelKey);
    const payload = {
      name: row.poi_name,
      name_en: row.poi_name_en,
      type: row.poi_type,
      subtype: row.poi_subtype,
      distance_meters: row.distance_meters,
      distance_label: formatDistanceLabel(row.distance_meters),
      is_featured: row.is_featured,
      relevance_score: row.relevance_score,
    };

    group.id = group.id || row.hotel_legacy_id || null;
    group.pois.push(payload);
    group.count = group.pois.length;
  });

  return {
    filters: {
      subtype: filters.subtype,
      max_distance_m: filters.maxDistanceM,
      limit_per_hotel: filters.limitPerHotel,
      featured: filters.featuredOnly,
    },
    count_hotels: groups.size,
    hotels: Array.from(groups.values()),
  };
}

module.exports = {
  DEFAULT_IMPORT_SOURCE_NAME,
  IMPORT_LIMITS,
  detectDumpFormat,
  prepareHotelPoiRows,
  mergeStats,
  flushImportBatch,
  buildLogLine,
  recordErrorSample,
  listHotelPois,
  listHotelPoisBatch,
};
