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

let prebookSchemaEnsured = false;
let prebookTokenColumn = "prebook_token";
let prebookDetailsColumn = null;
let prebookExpiryColumn = null;
let paymentsSchemaEnsured = false;

async function ensurePrebookSchema() {
  if (prebookSchemaEnsured) return;
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS prebooks (
      id BIGSERIAL PRIMARY KEY,
      offer_id TEXT,
      token TEXT,
      request_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  } catch (_) {}

  let offerIdHasForeignKey = false;
  try {
    const fkCheck = await db.query(
      `SELECT 1
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.constraint_schema = kcu.constraint_schema
      WHERE tc.table_name = 'prebooks'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'offer_id'
      LIMIT 1`
    );
    offerIdHasForeignKey = fkCheck.rowCount > 0;
  } catch (err) {
    console.warn("[DB] offer_id FK detection failed:", err.message);
  }

  const schemaChanges = [
    `ALTER TABLE prebooks ADD COLUMN IF NOT EXISTS prebook_token TEXT`,
    `ALTER TABLE prebooks ADD COLUMN IF NOT EXISTS request_id TEXT`,
    `ALTER TABLE prebooks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
    `ALTER TABLE prebooks ADD COLUMN IF NOT EXISTS details JSONB`
  ];
  if (!offerIdHasForeignKey) {
    schemaChanges.push(`ALTER TABLE prebooks ALTER COLUMN offer_id TYPE TEXT USING offer_id::text`);
  } else {
    console.info("[DB] prebooks.offer_id FK detected, skipping type change");
  }
  for (const change of schemaChanges) {
    try {
      await db.query(change);
    } catch (err) {
      console.warn("[DB] ensurePrebookSchema warning:", err.message);
    }
  }

  try {
    const res = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='prebooks'`);
    const columns = res.rows.map((row) => row.column_name).filter(Boolean);
    const lowers = columns.map((name) => name.toLowerCase());
    if (lowers.includes("prebook_token")) {
      prebookTokenColumn = "prebook_token";
    } else if (lowers.includes("token")) {
      prebookTokenColumn = "token";
    } else {
      prebookTokenColumn = "prebook_token";
    }
    if (lowers.includes("details")) {
      prebookDetailsColumn = columns[lowers.indexOf("details")] || "details";
    }
    if (lowers.includes("expires_at")) {
      prebookExpiryColumn = columns[lowers.indexOf("expires_at")] || "expires_at";
    }
  } catch (err) {
    console.warn("[DB] column detection failed:", err.message);
  }

  prebookSchemaEnsured = true;
}

// save a prebook token
async function savePrebook({ offerId, token, requestId, summary, rawPayload }) {
  try {
    await ensurePrebookSchema();
    let dbOfferId = null;
    if (typeof offerId === "number") {
      dbOfferId = offerId;
    } else if (typeof offerId === "string" && /^\d+$/.test(offerId)) {
      dbOfferId = Number(offerId);
    }
    const fields = ["offer_id", prebookTokenColumn, "request_id"];
    const placeholders = ["$1", "$2", "$3"];
    const tokenValue = typeof token === "string" ? token : JSON.stringify(token ?? null);
    const values = [dbOfferId, tokenValue, requestId ?? null];

    if (prebookDetailsColumn) {
      fields.push(prebookDetailsColumn);
      placeholders.push(`$${values.length + 1}`);
      const detailsPayload = {
        offer: offerId ?? null,
        prebook_token: token,
        request_id: requestId ?? null,
      };
      if (summary) {
        detailsPayload.summary = summary;
      }
      if (rawPayload) {
        detailsPayload.prebook_payload = rawPayload;
      }
      values.push(JSON.stringify(detailsPayload));
    }

    if (prebookExpiryColumn) {
      fields.push(prebookExpiryColumn);
      placeholders.push(`$${values.length + 1}`);
      const expires = new Date(Date.now() + 30 * 60 * 1000); // +30 minutes
      values.push(expires.toISOString());
    }

    const sql = `INSERT INTO prebooks (${fields.join(", ")}) VALUES (${placeholders.join(", ")})`;
    await db.query(sql, values);
  } catch (e) {
    console.error("[DB] savePrebook failed:", e.message);
  }
}

async function getPrebookSummary(prebookToken) {
  if (!prebookToken) return null;
  await ensurePrebookSchema();
  if (!prebookDetailsColumn) return null;
  try {
    const query = `
      SELECT ${prebookDetailsColumn} AS details
      FROM prebooks
      WHERE ${prebookTokenColumn} = $1
      ORDER BY id DESC
      LIMIT 1
    `;
    const res = await db.query(query, [prebookToken]);
    if (!res.rows.length || !res.rows[0].details) return null;
    let details = res.rows[0].details;
    if (typeof details === "string") {
      try {
        details = JSON.parse(details);
      } catch (_) {
        return null;
      }
    }
    const summary = details.summary || null;
    const payload = details.prebook_payload || details.prebook_token || null;
    if (!summary && !payload) return null;
    return { summary, payload };
  } catch (err) {
    console.warn("[DB] getPrebookSummary failed:", err.message);
    return null;
  }
}

async function ensurePaymentsSchema() {
  if (paymentsSchemaEnsured) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id BIGSERIAL PRIMARY KEY,
        provider TEXT,
        status TEXT,
        partner_order_id TEXT,
        prebook_token TEXT,
        etg_order_id BIGINT,
        item_id BIGINT,
        amount NUMERIC,
        currency_code TEXT,
        external_reference TEXT,
        payload JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (err) {
    console.error("[DB] ensurePaymentsSchema failed:", err.message);
  }
  paymentsSchemaEnsured = true;
}

async function savePayment({
  provider,
  status,
  partnerOrderId,
  prebookToken,
  etgOrderId,
  itemId,
  amount,
  currencyCode,
  externalReference,
  payload,
}) {
  try {
    await ensurePaymentsSchema();
    await db.query(
      `
      INSERT INTO payments (
        provider,
        status,
        partner_order_id,
        prebook_token,
        etg_order_id,
        item_id,
        amount,
        currency_code,
        external_reference,
        payload
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `,
      [
        provider || null,
        status || null,
        partnerOrderId || null,
        prebookToken || null,
        etgOrderId || null,
        itemId || null,
        typeof amount === "number" ? amount : amount != null ? Number(amount) : null,
        currencyCode || null,
        externalReference || null,
        payload ? JSON.stringify(payload) : null,
      ]
    );
  } catch (err) {
    console.error("[DB] savePayment failed:", err.message);
  }
}

async function saveBookingForm({ partnerOrderId, prebookToken, form }) {
  console.log("[DB] saveBookingForm called with", { partnerOrderId, prebookToken });
  try {
    // Ensure table exists (simple, one‑time)
    await db.query(`
      CREATE TABLE IF NOT EXISTS booking_forms (
        id BIGSERIAL PRIMARY KEY,
        partner_order_id TEXT,
        prebook_token TEXT,
        etg_order_id BIGINT,
        item_id BIGINT,
        amount NUMERIC,
        currency_code TEXT,
        form JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const paymentType = Array.isArray(form.payment_types) ? form.payment_types[0] : null;

    await db.query(
      `INSERT INTO booking_forms (
         partner_order_id,
         prebook_token,
         etg_order_id,
         item_id,
         amount,
         currency_code,
         form
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        partnerOrderId,
        prebookToken,
        form.order_id || null,
        form.item_id || null,
        paymentType ? Number(paymentType.amount) : null,
        paymentType ? paymentType.currency_code : null,
        JSON.stringify(form),
      ]
    );
  } catch (e) {
    console.error("[DB] saveBookingForm failed:", e);
  }
}

module.exports = { saveSerpSearch, savePrebook, getPrebookSummary, ensurePaymentsSchema, savePayment, saveBookingForm };
