"use strict";

const db = require("../utils/db");
const { getPrebookSummary, parseAmount } = require("../utils/repo");
const httpError = require("../src/utils/httpError");

const DEFAULT_MARKUP_PERCENT = 10;
const DEFAULT_MAX_USES = 20;
const DEFAULT_PER_USER_LIMIT = 1;
const MAX_PROMO_DURATION_DAYS = 31;

let promoSchemaEnsured = false;

function roundMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.round(num * 100) / 100);
}

function applyMarkupAmount(amount, percent = DEFAULT_MARKUP_PERCENT) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return null;
  return roundMoney(num * (1 + percent / 100));
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function normalizeUserId(value) {
  return String(value || "").trim().toLowerCase() || null;
}

function toIsoDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeBoolean(value, fallback = true) {
  if (value === true || value === false) return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

async function ensurePromoSchema() {
  if (promoSchemaEnsured) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id BIGSERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'percentage',
      value NUMERIC NOT NULL,
      min_amount NUMERIC,
      max_uses INTEGER NOT NULL DEFAULT 20,
      used_count INTEGER NOT NULL DEFAULT 0,
      per_user_limit INTEGER NOT NULL DEFAULT 1,
      start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      end_date TIMESTAMPTZ NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const promoChanges = [
    "ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS min_amount NUMERIC",
    "ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS max_uses INTEGER NOT NULL DEFAULT 20",
    "ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS used_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS per_user_limit INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    "ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ",
    "ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    "ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
  ];

  for (const change of promoChanges) {
    await db.query(change);
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS promo_code_usages (
      id BIGSERIAL PRIMARY KEY,
      promo_code_id BIGINT NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
      user_id TEXT,
      booking_id TEXT,
      partner_order_id TEXT,
      metadata JSONB,
      used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query("CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(UPPER(code))");
  await db.query("CREATE INDEX IF NOT EXISTS idx_promo_codes_active_dates ON promo_codes(is_active, start_date, end_date)");
  await db.query("CREATE INDEX IF NOT EXISTS idx_promo_usage_code_user ON promo_code_usages(promo_code_id, LOWER(user_id))");
  await db.query("CREATE INDEX IF NOT EXISTS idx_promo_usage_partner_order ON promo_code_usages(partner_order_id)");

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
  await db.query("ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS promo_code_id BIGINT");
  await db.query("ALTER TABLE booking_forms ADD COLUMN IF NOT EXISTS promo_snapshot JSONB");
  await db.query("CREATE INDEX IF NOT EXISTS idx_booking_forms_partner_order_id ON booking_forms(partner_order_id)");

  promoSchemaEnsured = true;
}

function normalizePromo(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    value: Number(row.value),
    min_amount: row.min_amount == null ? null : Number(row.min_amount),
    max_uses: Number(row.max_uses || 0),
    used_count: Number(row.used_count || 0),
    per_user_limit: Number(row.per_user_limit || 0),
    start_date: toIsoDate(row.start_date),
    end_date: toIsoDate(row.end_date),
    is_active: row.is_active === true,
    created_at: toIsoDate(row.created_at),
    updated_at: toIsoDate(row.updated_at),
  };
}

async function getPromoByCode(code) {
  await ensurePromoSchema();
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const result = await db.query(
    `SELECT *
       FROM promo_codes
      WHERE UPPER(code) = $1
      LIMIT 1`,
    [normalized],
  );
  return result.rows[0] || null;
}

async function getPromoById(id) {
  await ensurePromoSchema();
  const result = await db.query("SELECT * FROM promo_codes WHERE id = $1", [id]);
  return result.rows[0] || null;
}

async function getLatestBookingForm(partnerOrderId) {
  await ensurePromoSchema();
  const result = await db.query(
    `SELECT *
       FROM booking_forms
      WHERE partner_order_id = $1
      ORDER BY id DESC
      LIMIT 1`,
    [String(partnerOrderId || "").trim()],
  );
  return result.rows[0] || null;
}

function getPrebookSummaryAmount(prebookSummary) {
  return parseAmount(
    prebookSummary?.summary?.room?.price ??
      prebookSummary?.room?.price ??
      prebookSummary?.summary?.pricing?.total_amount ??
      prebookSummary?.pricing?.total_amount,
  );
}

function getPrebookSummaryCurrency(prebookSummary) {
  return (
    prebookSummary?.summary?.room?.currency ||
    prebookSummary?.room?.currency ||
    prebookSummary?.summary?.pricing?.currency ||
    prebookSummary?.pricing?.currency ||
    null
  );
}

function resolveBookingFormTotal(bookingFormRow, prebookSummary = null) {
  const form = bookingFormRow?.form || {};
  const paymentType = Array.isArray(form.payment_types) ? form.payment_types[0] : null;
  const pricingTotal = parseAmount(form?.pricing?.total_amount);
  const summaryAmount = getPrebookSummaryAmount(prebookSummary);
  const supplierAmount =
    parseAmount(paymentType?.amount) ||
    parseAmount(bookingFormRow?.amount) ||
    parseAmount(form?.total_amount) ||
    parseAmount(form?.order_amount);
  const total =
    Number.isFinite(pricingTotal) && pricingTotal > 0
      ? pricingTotal
      : Number.isFinite(summaryAmount) && summaryAmount > 0
        ? summaryAmount
        : applyMarkupAmount(supplierAmount);
  const currency =
    form?.pricing?.currency ||
    bookingFormRow?.currency_code ||
    paymentType?.currency_code ||
    form?.currency_code ||
    getPrebookSummaryCurrency(prebookSummary) ||
    "EUR";

  return {
    amount: roundMoney(total),
    currency: String(currency || "EUR").toUpperCase(),
  };
}

function calculateDiscount(promo, amount) {
  const original = roundMoney(amount);
  if (!Number.isFinite(original) || original <= 0) return null;

  let discount = 0;
  if (promo.type === "percentage") {
    discount = original * (Number(promo.value) / 100);
  } else if (promo.type === "fixed") {
    discount = Number(promo.value);
  }

  const roundedDiscount = Math.min(original, roundMoney(discount) || 0);
  return {
    original_amount: original,
    discount_amount: roundedDiscount,
    final_amount: roundMoney(original - roundedDiscount),
  };
}

async function countUserUsage(promoCodeId, userId) {
  const normalizedUser = normalizeUserId(userId);
  if (!normalizedUser) return 0;
  const result = await db.query(
    `SELECT COUNT(*)::int AS total
       FROM promo_code_usages
      WHERE promo_code_id = $1
        AND LOWER(COALESCE(user_id, '')) = $2`,
    [promoCodeId, normalizedUser],
  );
  return Number(result.rows[0]?.total || 0);
}

async function validatePromoForBooking({
  code,
  partnerOrderId,
  userId,
  attach = false,
  existingPromoId,
}) {
  await ensurePromoSchema();

  const promoRow = existingPromoId ? await getPromoById(existingPromoId) : await getPromoByCode(code);
  if (!promoRow) throw httpError(404, "promo_code_not_found");

  const promo = normalizePromo(promoRow);
  const now = Date.now();
  const start = Date.parse(promo.start_date);
  const end = Date.parse(promo.end_date);

  if (!promo.is_active) throw httpError(400, "promo_code_inactive");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw httpError(400, "promo_code_invalid_period");
  }
  if (now < start) throw httpError(400, "promo_code_not_started");
  if (now > end) throw httpError(400, "promo_code_expired");
  if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
    throw httpError(400, "promo_code_global_limit_reached");
  }

  const bookingForm = await getLatestBookingForm(partnerOrderId);
  if (!bookingForm) throw httpError(404, "booking_form_not_found");

  const prebookSummary = bookingForm.prebook_token
    ? await getPrebookSummary(bookingForm.prebook_token)
    : null;
  const { amount, currency } = resolveBookingFormTotal(bookingForm, prebookSummary);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw httpError(400, "booking_amount_unavailable");
  }
  if (promo.min_amount != null && amount < Number(promo.min_amount)) {
    throw httpError(400, "promo_code_min_amount_not_met", {
      min_amount: Number(promo.min_amount),
      amount,
      currency_code: currency,
    });
  }

  const normalizedUser = normalizeUserId(userId);
  if (normalizedUser && promo.per_user_limit > 0) {
    const userUsage = await countUserUsage(promo.id, normalizedUser);
    if (userUsage >= promo.per_user_limit) {
      throw httpError(400, "promo_code_user_limit_reached");
    }
  }

  const discount = calculateDiscount(promo, amount);
  if (!discount || discount.discount_amount <= 0 || discount.final_amount <= 0) {
    throw httpError(400, "promo_code_discount_invalid");
  }

  const snapshot = {
    ...promo,
    user_id: normalizedUser,
    partner_order_id: partnerOrderId,
    currency_code: currency,
    validated_at: new Date().toISOString(),
    ...discount,
  };

  if (attach) {
    await db.query(
      `UPDATE booking_forms
          SET promo_code_id = $1,
              promo_snapshot = $2::jsonb
        WHERE id = $3`,
      [promo.id, JSON.stringify(snapshot), bookingForm.id],
    );
  }

  return {
    promo: snapshot,
    booking_form_id: bookingForm.id,
  };
}

async function getAppliedPromoForBooking(partnerOrderId, userId = null) {
  const bookingForm = await getLatestBookingForm(partnerOrderId);
  if (!bookingForm?.promo_code_id || !bookingForm?.promo_snapshot) return null;
  const snapshot =
    typeof bookingForm.promo_snapshot === "string"
      ? JSON.parse(bookingForm.promo_snapshot)
      : bookingForm.promo_snapshot;
  const result = await validatePromoForBooking({
    partnerOrderId,
    existingPromoId: bookingForm.promo_code_id,
    userId: userId || snapshot?.user_id || null,
    attach: true,
  });
  return result.promo;
}

async function clearAppliedPromo(partnerOrderId) {
  await ensurePromoSchema();
  const bookingForm = await getLatestBookingForm(partnerOrderId);
  if (!bookingForm) throw httpError(404, "booking_form_not_found");
  await db.query(
    `UPDATE booking_forms
        SET promo_code_id = NULL,
            promo_snapshot = NULL
      WHERE id = $1`,
    [bookingForm.id],
  );
  return { status: "ok" };
}

async function resolvePayableAmount(bookingFormRow, userId = null) {
  const prebookSummary = bookingFormRow?.prebook_token
    ? await getPrebookSummary(bookingFormRow.prebook_token)
    : null;
  const base = resolveBookingFormTotal(bookingFormRow, prebookSummary);
  if (!bookingFormRow?.promo_code_id) return base;
  const result = await validatePromoForBooking({
    partnerOrderId: bookingFormRow.partner_order_id,
    existingPromoId: bookingFormRow.promo_code_id,
    userId: userId || bookingFormRow?.promo_snapshot?.user_id || null,
    attach: true,
  });
  return {
    amount: result.promo.final_amount,
    currency: result.promo.currency_code || base.currency,
    promo: result.promo,
  };
}

function validatePromoPayload(payload = {}, partial = false) {
  const type = payload.type == null && partial ? undefined : String(payload.type || "percentage").trim();
  const value = payload.value == null && partial ? undefined : Number(payload.value);
  const startDate = payload.start_date == null && partial ? undefined : new Date(payload.start_date || Date.now());
  const endDate = payload.end_date == null && partial ? undefined : new Date(payload.end_date);

  if (!partial || payload.code != null) {
    const code = normalizeCode(payload.code);
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
      throw httpError(400, "invalid_promo_code_format");
    }
  }
  if (type !== undefined && !["percentage", "fixed"].includes(type)) {
    throw httpError(400, "invalid_promo_type");
  }
  if (value !== undefined) {
    if (!Number.isFinite(value) || value <= 0) throw httpError(400, "invalid_promo_value");
    if ((payload.type || type) === "percentage" && value > 100) {
      throw httpError(400, "invalid_percentage_value");
    }
  }
  if (endDate !== undefined) {
    if (!Number.isFinite(endDate.getTime())) throw httpError(400, "invalid_end_date");
    if (startDate !== undefined && Number.isFinite(startDate.getTime())) {
      const diffMs = endDate.getTime() - startDate.getTime();
      if (diffMs <= 0) throw httpError(400, "promo_end_must_be_after_start");
      if (diffMs > MAX_PROMO_DURATION_DAYS * 24 * 60 * 60 * 1000) {
        throw httpError(400, "promo_period_max_one_month");
      }
    }
  }
}

async function listPromoCodes({ limit = 50, offset = 0 } = {}) {
  await ensurePromoSchema();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const [rows, total] = await Promise.all([
    db.query(
      `SELECT *
         FROM promo_codes
        ORDER BY created_at DESC, id DESC
        LIMIT $1 OFFSET $2`,
      [safeLimit, safeOffset],
    ),
    db.query("SELECT COUNT(*)::int AS total FROM promo_codes"),
  ]);
  return {
    promo_codes: rows.rows.map(normalizePromo),
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      total: Number(total.rows[0]?.total || 0),
    },
  };
}

async function createPromoCode(payload = {}) {
  await ensurePromoSchema();
  validatePromoPayload(payload);
  const code = normalizeCode(payload.code);
  const startDate = toIsoDate(payload.start_date || new Date());
  const endDate = toIsoDate(payload.end_date);
  const result = await db.query(
    `INSERT INTO promo_codes (
       code, type, value, min_amount, max_uses, used_count,
       per_user_limit, start_date, end_date, is_active
     ) VALUES ($1,$2,$3,$4,$5,0,$6,$7,$8,$9)
     RETURNING *`,
    [
      code,
      String(payload.type || "percentage"),
      Number(payload.value),
      payload.min_amount == null || payload.min_amount === "" ? null : Number(payload.min_amount),
      Math.max(1, Number.parseInt(payload.max_uses, 10) || DEFAULT_MAX_USES),
      Math.max(1, Number.parseInt(payload.per_user_limit, 10) || DEFAULT_PER_USER_LIMIT),
      startDate,
      endDate,
      normalizeBoolean(payload.is_active, true),
    ],
  );
  return normalizePromo(result.rows[0]);
}

async function updatePromoCode(id, payload = {}) {
  await ensurePromoSchema();
  const existing = await getPromoById(id);
  if (!existing) throw httpError(404, "promo_code_not_found");
  validatePromoPayload(
    {
      ...existing,
      ...payload,
      start_date: payload.start_date ?? existing.start_date,
      end_date: payload.end_date ?? existing.end_date,
    },
    true,
  );

  const result = await db.query(
    `UPDATE promo_codes
        SET code = $1,
            type = $2,
            value = $3,
            min_amount = $4,
            max_uses = $5,
            per_user_limit = $6,
            start_date = $7,
            end_date = $8,
            is_active = $9,
            updated_at = NOW()
      WHERE id = $10
      RETURNING *`,
    [
      normalizeCode(payload.code ?? existing.code),
      String(payload.type ?? existing.type),
      Number(payload.value ?? existing.value),
      payload.min_amount === "" ? null : payload.min_amount ?? existing.min_amount,
      Math.max(1, Number.parseInt(payload.max_uses ?? existing.max_uses, 10) || DEFAULT_MAX_USES),
      Math.max(1, Number.parseInt(payload.per_user_limit ?? existing.per_user_limit, 10) || DEFAULT_PER_USER_LIMIT),
      toIsoDate(payload.start_date ?? existing.start_date),
      toIsoDate(payload.end_date ?? existing.end_date),
      normalizeBoolean(payload.is_active ?? existing.is_active, true),
      id,
    ],
  );
  return normalizePromo(result.rows[0]);
}

async function deletePromoCode(id) {
  await ensurePromoSchema();
  const result = await db.query("DELETE FROM promo_codes WHERE id = $1 RETURNING id", [id]);
  return result.rowCount > 0;
}

async function recordPromoUsage({ partnerOrderId, userId, bookingId = null, metadata = null }) {
  await ensurePromoSchema();
  const bookingForm = await getLatestBookingForm(partnerOrderId);
  if (!bookingForm?.promo_code_id) return null;
  const snapshot =
    typeof bookingForm.promo_snapshot === "string"
      ? JSON.parse(bookingForm.promo_snapshot)
      : bookingForm.promo_snapshot || {};
  const normalizedUser = normalizeUserId(userId || snapshot.user_id);

  const existing = await db.query(
    `SELECT id
       FROM promo_code_usages
      WHERE promo_code_id = $1
        AND partner_order_id = $2
      LIMIT 1`,
    [bookingForm.promo_code_id, partnerOrderId],
  );
  if (existing.rows.length) return existing.rows[0];

  const result = await db.query(
    `INSERT INTO promo_code_usages (
       promo_code_id, user_id, booking_id, partner_order_id, metadata
     ) VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [
      bookingForm.promo_code_id,
      normalizedUser,
      bookingId ? String(bookingId) : null,
      partnerOrderId,
      JSON.stringify({
        promo: snapshot,
        ...(metadata && typeof metadata === "object" ? metadata : {}),
      }),
    ],
  );
  await db.query(
    `UPDATE promo_codes
        SET used_count = used_count + 1,
            updated_at = NOW()
      WHERE id = $1`,
    [bookingForm.promo_code_id],
  );
  return result.rows[0] || null;
}

module.exports = {
  ensurePromoSchema,
  normalizeCode,
  normalizePromo,
  listPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  validatePromoForBooking,
  getAppliedPromoForBooking,
  clearAppliedPromo,
  resolvePayableAmount,
  recordPromoUsage,
  resolveBookingFormTotal,
};
