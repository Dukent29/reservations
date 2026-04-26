"use strict";

const crypto = require("crypto");
const db = require("../utils/db");
const { ensureUsersRoleSchema } = require("./userModel");

let sessionSchemaEnsured = false;
const DEFAULT_IDLE_MINUTES = 60;

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

async function ensureSessionSchema() {
  if (sessionSchemaEnsured) return;

  await ensureUsersRoleSchema();

  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ
    )
  `);
  await db.query(
    "ALTER TABLE admin_sessions ALTER COLUMN user_id TYPE TEXT USING user_id::text"
  );

  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id ON admin_sessions(user_id)"
  );
  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at)"
  );

  sessionSchemaEnsured = true;
}

async function createSession(userId, ttlMinutes = DEFAULT_IDLE_MINUTES) {
  await ensureSessionSchema();

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const safeTtlMinutes = Number.isFinite(Number(ttlMinutes))
    ? Math.max(5, Number(ttlMinutes))
    : DEFAULT_IDLE_MINUTES;

  const result = await db.query(
    `INSERT INTO admin_sessions (user_id, token_hash, expires_at)
      VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)
     RETURNING id, user_id, created_at, expires_at`,
    [String(userId), tokenHash, String(safeTtlMinutes)]
  );

  return {
    token,
    session: result.rows[0] || null,
  };
}

async function touchSessionById(sessionId, idleMinutes = DEFAULT_IDLE_MINUTES) {
  await ensureSessionSchema();
  const safeIdleMinutes = Number.isFinite(Number(idleMinutes))
    ? Math.max(5, Number(idleMinutes))
    : DEFAULT_IDLE_MINUTES;

  const result = await db.query(
    `UPDATE admin_sessions
        SET expires_at = NOW() + ($2 || ' minutes')::interval
      WHERE id = $1
        AND revoked_at IS NULL
      RETURNING id, expires_at`,
    [String(sessionId), String(safeIdleMinutes)]
  );

  return result.rows[0] || null;
}

async function getSessionWithUserByToken(token) {
  await ensureSessionSchema();
  const tokenHash = hashToken(token);

  const result = await db.query(
    `SELECT
       s.id AS session_id,
       s.user_id,
       s.created_at AS session_created_at,
       s.expires_at,
       s.revoked_at,
       u.id,
       u.email,
       u.role,
       u.created_at,
       u.updated_at
     FROM admin_sessions s
     JOIN public.users u
       ON u.id::text = s.user_id
     WHERE s.token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );

  if (!result.rows[0]) return null;
  const row = result.rows[0];

  return {
    session: {
      id: row.session_id,
      userId: row.user_id,
      createdAt: row.session_created_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    },
    user: {
      id: row.id,
      email: row.email,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  };
}

async function revokeSessionByToken(token) {
  await ensureSessionSchema();
  const tokenHash = hashToken(token);

  const result = await db.query(
    `UPDATE admin_sessions
        SET revoked_at = NOW()
      WHERE token_hash = $1
        AND revoked_at IS NULL
      RETURNING id`,
    [tokenHash]
  );

  return result.rowCount > 0;
}

module.exports = {
  ensureSessionSchema,
  createSession,
  getSessionWithUserByToken,
  touchSessionById,
  revokeSessionByToken,
};
