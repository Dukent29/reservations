"use strict";

const db = require("./db");

// save one SERP search (trim data to avoid huge rows)
async function saveSerpSearch({ endpoint, payload, resultsSample, requestId, ip }) {
  try {
    await db.query(
      `INSERT INTO serp_searches (endpoint, payload, results_sample, request_id, ip)
       VALUES ($1, $2, $3, $4, $5)`,
      [endpoint, payload, resultsSample ?? null, requestId ?? null, ip ?? null]
    );
  } catch (e) {
    console.error("[DB] saveSerpSearch failed:", e.message);
  }
}

// save a prebook token
async function savePrebook({ offerId, token, requestId }) {
  try {
    await db.query(
      `INSERT INTO prebooks (offer_id, prebook_token, request_id)
       VALUES ($1, $2, $3)`,
      [offerId, token, requestId ?? null]
    );
  } catch (e) {
    console.error("[DB] savePrebook failed:", e.message);
  }
}

module.exports = { saveSerpSearch, savePrebook };
