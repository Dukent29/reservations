"use strict";

const fs = require("fs").promises;
const path = require("path");

const db = require("../utils/db");

let schemaPromise = null;

function resolveSchemaPath() {
  return path.join(process.cwd(), "data", "sql", "hotel_poi_schema.sql");
}

async function ensureHotelPoiSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const schemaSql = await fs.readFile(resolveSchemaPath(), "utf8");
      await db.query(schemaSql);
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function createImportRun(payload = {}) {
  await ensureHotelPoiSchema();
  const result = await db.query(
    `INSERT INTO hotel_poi_import_runs (
       source_name,
       source_file,
       source_format,
       status,
       notes
     )
     VALUES ($1, $2, $3, 'running', $4::jsonb)
     RETURNING id`,
    [
      payload.sourceName,
      payload.sourceFile,
      payload.sourceFormat,
      JSON.stringify(payload.notes || {}),
    ]
  );

  return result.rows[0]?.id || null;
}

async function updateImportRunProgress(runId, stats = {}) {
  await ensureHotelPoiSchema();
  await db.query(
    `UPDATE hotel_poi_import_runs
     SET processed_hotels = $2,
         processed_pois = $3,
         kept_pois = $4,
         skipped_pois = $5,
         malformed_hotels = $6,
         malformed_pois = $7,
         upserted_pois = $8
     WHERE id = $1`,
    [
      runId,
      stats.processedHotels || 0,
      stats.processedPois || 0,
      stats.keptPois || 0,
      stats.skippedPois || 0,
      stats.malformedHotels || 0,
      stats.malformedPois || 0,
      stats.upsertedPois || 0,
    ]
  );
}

async function finalizeImportRun(runId, payload = {}) {
  await ensureHotelPoiSchema();
  await db.query(
    `UPDATE hotel_poi_import_runs
     SET status = $2,
         completed_at = NOW(),
         processed_hotels = $3,
         processed_pois = $4,
         kept_pois = $5,
         skipped_pois = $6,
         malformed_hotels = $7,
         malformed_pois = $8,
         upserted_pois = $9,
         pruned_pois = $10,
         error_samples = $11::jsonb,
         notes = notes || $12::jsonb
     WHERE id = $1`,
    [
      runId,
      payload.status,
      payload.stats?.processedHotels || 0,
      payload.stats?.processedPois || 0,
      payload.stats?.keptPois || 0,
      payload.stats?.skippedPois || 0,
      payload.stats?.malformedHotels || 0,
      payload.stats?.malformedPois || 0,
      payload.stats?.upsertedPois || 0,
      payload.stats?.prunedPois || 0,
      JSON.stringify(payload.errorSamples || []),
      JSON.stringify(payload.notes || {}),
    ]
  );
}

async function upsertHotelPois(rows = [], options = {}) {
  await ensureHotelPoiSchema();
  if (!Array.isArray(rows) || !rows.length) return 0;

  const values = [];
  const tuples = rows.map((row, index) => {
    const base = index * 12;
    values.push(
      row.hotelHid,
      row.hotelLegacyId || null,
      row.poiName,
      row.poiNameEn || null,
      row.poiType,
      row.poiSubtype,
      row.distanceMeters,
      row.relevanceScore,
      row.isFeatured === true,
      options.sourceName,
      row.dedupeKey,
      options.runId || null
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12})`;
  });

  const sql = `
    INSERT INTO hotel_pois (
      hotel_hid,
      hotel_legacy_id,
      poi_name,
      poi_name_en,
      poi_type,
      poi_subtype,
      distance_meters,
      relevance_score,
      is_featured,
      source_name,
      dedupe_key,
      last_import_run_id
    )
    VALUES ${tuples.join(", ")}
    ON CONFLICT (dedupe_key) DO UPDATE
      SET hotel_hid = EXCLUDED.hotel_hid,
          hotel_legacy_id = EXCLUDED.hotel_legacy_id,
          poi_name = EXCLUDED.poi_name,
          poi_name_en = EXCLUDED.poi_name_en,
          poi_type = EXCLUDED.poi_type,
          poi_subtype = EXCLUDED.poi_subtype,
          distance_meters = EXCLUDED.distance_meters,
          relevance_score = EXCLUDED.relevance_score,
          is_featured = EXCLUDED.is_featured,
          source_name = EXCLUDED.source_name,
          last_import_run_id = EXCLUDED.last_import_run_id,
          updated_at = NOW()
  `;

  const result = await db.query(sql, values);
  return result.rowCount || 0;
}

async function pruneMissingHotelPois(runId, sourceName) {
  await ensureHotelPoiSchema();
  const result = await db.query(
    `DELETE FROM hotel_pois
     WHERE source_name = $1
       AND (last_import_run_id IS NULL OR last_import_run_id <> $2)`,
    [sourceName, runId]
  );

  return result.rowCount || 0;
}

async function findHotelPois(filters = {}) {
  await ensureHotelPoiSchema();
  const values = [];
  const where = [];

  if (filters.hotelHid != null) {
    values.push(filters.hotelHid);
    where.push(`hotel_hid = $${values.length}`);
  } else if (filters.hotelLegacyId) {
    values.push(filters.hotelLegacyId);
    where.push(`hotel_legacy_id = $${values.length}`);
  }

  if (filters.subtype) {
    values.push(filters.subtype);
    where.push(`poi_subtype = $${values.length}`);
  }

  if (filters.maxDistanceM != null) {
    values.push(filters.maxDistanceM);
    where.push(`distance_meters <= $${values.length}`);
  }

  if (filters.featuredOnly) {
    where.push(`is_featured = TRUE`);
  }

  values.push(filters.limit);
  const limitPlaceholder = `$${values.length}`;

  const sql = `
    SELECT
      hotel_hid,
      hotel_legacy_id,
      poi_name,
      poi_name_en,
      poi_type,
      poi_subtype,
      distance_meters,
      relevance_score,
      is_featured
    FROM hotel_pois
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY is_featured DESC, relevance_score DESC, distance_meters ASC, poi_name ASC
    LIMIT ${limitPlaceholder}
  `;

  const result = await db.query(sql, values);
  return result.rows || [];
}

async function findHotelPoisBatch(filters = {}) {
  await ensureHotelPoiSchema();
  const values = [
    Array.isArray(filters.hotelHids) ? filters.hotelHids : [],
    Array.isArray(filters.hotelLegacyIds) ? filters.hotelLegacyIds : [],
  ];
  const where = [
    `(
      (cardinality($1::bigint[]) > 0 AND hotel_hid = ANY($1::bigint[]))
      OR
      (cardinality($2::text[]) > 0 AND hotel_legacy_id = ANY($2::text[]))
    )`,
  ];

  if (filters.subtype) {
    values.push(filters.subtype);
    where.push(`poi_subtype = $${values.length}`);
  }

  if (filters.maxDistanceM != null) {
    values.push(filters.maxDistanceM);
    where.push(`distance_meters <= $${values.length}`);
  }

  if (filters.featuredOnly) {
    where.push(`is_featured = TRUE`);
  }

  values.push(filters.limitPerHotel);
  const limitPlaceholder = `$${values.length}`;

  const sql = `
    WITH ranked AS (
      SELECT
        hotel_hid,
        hotel_legacy_id,
        poi_name,
        poi_name_en,
        poi_type,
        poi_subtype,
        distance_meters,
        relevance_score,
        is_featured,
        ROW_NUMBER() OVER (
          PARTITION BY hotel_hid
          ORDER BY is_featured DESC, relevance_score DESC, distance_meters ASC, poi_name ASC
        ) AS row_num
      FROM hotel_pois
      WHERE ${where.join(" AND ")}
    )
    SELECT
      hotel_hid,
      hotel_legacy_id,
      poi_name,
      poi_name_en,
      poi_type,
      poi_subtype,
      distance_meters,
      relevance_score,
      is_featured
    FROM ranked
    WHERE row_num <= ${limitPlaceholder}
    ORDER BY hotel_hid ASC, row_num ASC
  `;

  const result = await db.query(sql, values);
  return result.rows || [];
}

module.exports = {
  ensureHotelPoiSchema,
  createImportRun,
  updateImportRunProgress,
  finalizeImportRun,
  upsertHotelPois,
  pruneMissingHotelPois,
  findHotelPois,
  findHotelPoisBatch,
};
