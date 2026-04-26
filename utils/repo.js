"use strict";

const db = require("./db");

function parseAmount(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/\s/g, "");
  s = s.replace(/[^0-9,.\-]/g, "");
  if (!s) return null;
  if (s.includes(",") && !s.includes(".")) {
    const lastComma = s.lastIndexOf(",");
    s =
      s.slice(0, lastComma).replace(/[,\.]/g, "") +
      "." +
      s.slice(lastComma + 1).replace(/[,\.]/g, "");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

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
let bookingsSchemaEnsured = false;
let adminNotificationsSchemaEnsured = false;

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
        systempay_order_id TEXT,
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
  try {
    await db.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS systempay_order_id TEXT`);
  } catch (err) {
    console.warn("[DB] ensurePaymentsSchema column ensure failed:", err.message);
  }
  paymentsSchemaEnsured = true;
}

async function ensureBookingsSchema() {
  if (bookingsSchemaEnsured) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id BIGSERIAL PRIMARY KEY,
        partner_order_id TEXT,
        prebook_token TEXT,
        etg_order_id BIGINT,
        status TEXT,
        user_email TEXT,
        user_phone TEXT,
        user_name TEXT,
        amount NUMERIC,
        currency_code TEXT,
        raw JSONB,
        voucher_status TEXT,
        voucher_attempts INTEGER NOT NULL DEFAULT 0,
        voucher_last_error TEXT,
        voucher_filename TEXT,
        voucher_ready_at TIMESTAMPTZ,
        voucher_last_attempt_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (err) {
    console.error("[DB] ensureBookingsSchema failed:", err.message);
    return;
  }

  const schemaChanges = [
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS voucher_status TEXT`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS voucher_attempts INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS voucher_last_error TEXT`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS voucher_filename TEXT`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS voucher_ready_at TIMESTAMPTZ`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS voucher_last_attempt_at TIMESTAMPTZ`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
  ];

  for (const change of schemaChanges) {
    try {
      await db.query(change);
    } catch (err) {
      console.warn("[DB] ensureBookingsSchema warning:", err.message);
    }
  }

  bookingsSchemaEnsured = true;
}

async function savePayment({
  provider,
  status,
  partnerOrderId,
  systempayOrderId,
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
        systempay_order_id,
        prebook_token,
        etg_order_id,
        item_id,
        amount,
        currency_code,
        external_reference,
        payload
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `,
      [
        provider || null,
        status || null,
        partnerOrderId || null,
        systempayOrderId || null,
        prebookToken || null,
        etgOrderId || null,
        itemId || null,
        parseAmount(amount),
        currencyCode || null,
        externalReference || null,
        payload ? JSON.stringify(payload) : null,
      ]
    );
  } catch (err) {
    console.error("[DB] savePayment failed:", err.message);
  }
}

async function saveBooking({
  partnerOrderId,
  prebookToken,
  etgOrderId,
  status,
  userEmail,
  userPhone,
  userName,
  amount,
  currencyCode,
  raw,
}) {
  try {
    await ensureBookingsSchema();
    await db.query(
      `
      INSERT INTO bookings (
        partner_order_id,
        prebook_token,
        etg_order_id,
        status,
        user_email,
        user_phone,
        user_name,
        amount,
        currency_code,
        raw
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `,
      [
        partnerOrderId || null,
        prebookToken || null,
        etgOrderId || null,
        status || null,
        userEmail || null,
        userPhone || null,
        userName || null,
        parseAmount(amount),
        currencyCode || null,
        raw ? JSON.stringify(raw) : null,
      ]
    );
  } catch (err) {
    console.error("[DB] saveBooking failed:", err.message);
  }
}

async function ensureAdminNotificationsSchema() {
  if (adminNotificationsSchemaEnsured) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_notifications (
        id BIGSERIAL PRIMARY KEY,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        entity_type TEXT,
        entity_key TEXT,
        payload JSONB,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.query(
      "CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at DESC)"
    );
    await db.query(
      "CREATE INDEX IF NOT EXISTS idx_admin_notifications_read_at ON admin_notifications(read_at)"
    );
    adminNotificationsSchemaEnsured = true;
  } catch (err) {
    console.error("[DB] ensureAdminNotificationsSchema failed:", err.message);
  }
}

async function createAdminNotification({
  kind,
  title,
  message,
  entityType,
  entityKey,
  payload,
}) {
  try {
    await ensureAdminNotificationsSchema();
    await db.query(
      `INSERT INTO admin_notifications (
         kind,
         title,
         message,
         entity_type,
         entity_key,
         payload
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        String(kind || "generic"),
        String(title || "Notification"),
        message ? String(message) : null,
        entityType ? String(entityType) : null,
        entityKey ? String(entityKey) : null,
        payload ? JSON.stringify(payload) : null,
      ]
    );
  } catch (err) {
    console.error("[DB] createAdminNotification failed:", err.message);
  }
}

async function listAdminNotifications(limit = 20) {
  await ensureAdminNotificationsSchema();
  const normalizedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const result = await db.query(
    `SELECT id, kind, title, message, entity_type, entity_key, payload, read_at, created_at
       FROM admin_notifications
      ORDER BY created_at DESC
      LIMIT $1`,
    [normalizedLimit]
  );
  return result.rows || [];
}

async function markAdminNotificationRead(id) {
  await ensureAdminNotificationsSchema();
  const result = await db.query(
    `UPDATE admin_notifications
        SET read_at = COALESCE(read_at, NOW())
      WHERE id = $1
      RETURNING id, read_at`,
    [String(id)]
  );
  return result.rows[0] || null;
}

async function updateBookingVoucherState(partnerOrderId, fields = {}) {
  if (!partnerOrderId) return;

  await ensureBookingsSchema();

  const mappings = [
    ["voucherStatus", "voucher_status"],
    ["voucherAttempts", "voucher_attempts"],
    ["voucherLastError", "voucher_last_error"],
    ["voucherFilename", "voucher_filename"],
    ["voucherReadyAt", "voucher_ready_at"],
    ["voucherLastAttemptAt", "voucher_last_attempt_at"],
  ];

  const updates = [];
  const values = [];
  const nowIso = new Date().toISOString();

  for (const [fieldName, columnName] of mappings) {
    if (Object.prototype.hasOwnProperty.call(fields, fieldName)) {
      values.push(fields[fieldName] ?? null);
      updates.push(`${columnName} = $${values.length}`);
    }
  }

  values.push(nowIso);
  updates.push(`updated_at = $${values.length}`);

  const latestResult = await db.query(
    `SELECT id
     FROM bookings
     WHERE partner_order_id = $1
     ORDER BY id DESC
     LIMIT 1`,
    [partnerOrderId],
  );

  const latestId = latestResult.rows[0]?.id || null;
  if (latestId) {
    values.push(latestId);
    await db.query(
      `UPDATE bookings
       SET ${updates.join(", ")}
       WHERE id = $${values.length}`,
      values,
    );
    return;
  }

  const insertColumns = ["partner_order_id"];
  const insertValues = [partnerOrderId];
  const insertPlaceholders = ["$1"];

  for (const [fieldName, columnName] of mappings) {
    if (Object.prototype.hasOwnProperty.call(fields, fieldName)) {
      insertValues.push(fields[fieldName] ?? null);
      insertColumns.push(columnName);
      insertPlaceholders.push(`$${insertValues.length}`);
    }
  }

  insertValues.push(nowIso);
  insertColumns.push("updated_at");
  insertPlaceholders.push(`$${insertValues.length}`);

  await db.query(
    `INSERT INTO bookings (${insertColumns.join(", ")})
     VALUES (${insertPlaceholders.join(", ")})`,
    insertValues,
  );
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
        paymentType ? parseAmount(paymentType.amount) : null,
        paymentType ? paymentType.currency_code : null,
        JSON.stringify(form),
      ]
    );
  } catch (e) {
    console.error("[DB] saveBookingForm failed:", e);
  }
}

let apiLogsSchemaEnsured = false;

async function ensureApiLogsSchema() {
  if (apiLogsSchemaEnsured) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS api_logs (
        id SERIAL PRIMARY KEY,
        endpoint VARCHAR(255) NOT NULL,
        request JSONB NOT NULL,
        response JSONB NOT NULL,
        status_code INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    apiLogsSchemaEnsured = true;
  } catch (err) {
    console.error("[DB] ensureApiLogsSchema failed:", err.message);
  }
}

async function insertApiLog({ endpoint, request, response, statusCode }) {
  try {
    await ensureApiLogsSchema();
    await db.query(
      `INSERT INTO api_logs (endpoint, request, response, status_code)
       VALUES ($1, $2, $3, $4)`,
      [
        String(endpoint).slice(0, 255),
        request != null ? JSON.stringify(request) : "{}",
        response != null ? JSON.stringify(response) : "{}",
        Number(statusCode) || 0,
      ]
    );
  } catch (err) {
    console.error("[DB] insertApiLog failed:", err.message);
  }
}

module.exports = {
  saveSerpSearch,
  savePrebook,
  getPrebookSummary,
  ensurePaymentsSchema,
  ensureBookingsSchema,
  ensureAdminNotificationsSchema,
  savePayment,
  saveBooking,
  createAdminNotification,
  listAdminNotifications,
  markAdminNotificationRead,
  updateBookingVoucherState,
  saveBookingForm,
  parseAmount,
  ensureApiLogsSchema,
  insertApiLog,
};
