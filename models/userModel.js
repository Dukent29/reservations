"use strict";

const db = require("../utils/db");
const httpError = require("../src/utils/httpError");

let usersRoleSchemaEnsured = false;

async function ensureUsersRoleSchema() {
  if (usersRoleSchemaEnsured) return;

  await db.query("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT");
  await db.query("UPDATE public.users SET role = 'viewer' WHERE role IS NULL");
  await db.query("ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'viewer'");
  await db.query("ALTER TABLE public.users ALTER COLUMN role SET NOT NULL");

  const checkConstraint = await db.query(
    `SELECT 1
       FROM pg_constraint
      WHERE conname = 'users_role_check'
      LIMIT 1`
  );

  if (!checkConstraint.rowCount) {
    await db.query(
      `ALTER TABLE public.users
         ADD CONSTRAINT users_role_check
         CHECK (role IN ('admin', 'editor', 'viewer'))`
    );
  }

  usersRoleSchemaEnsured = true;
}

async function getUserById(id) {
  await ensureUsersRoleSchema();
  const result = await db.query(
    `SELECT id, email, role, created_at, updated_at
       FROM public.users
      WHERE id = $1
      LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function findUserByEmail(email) {
  await ensureUsersRoleSchema();
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;

  const result = await db.query(
    `SELECT id, email, password_hash, role, created_at, updated_at
       FROM public.users
      WHERE lower(email) = $1
      LIMIT 1`,
    [normalized]
  );

  return result.rows[0] || null;
}

async function verifyUserCredentials(email, password) {
  await ensureUsersRoleSchema();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const rawPassword = String(password || "");
  if (!normalizedEmail || !rawPassword) return null;

  try {
    const result = await db.query(
      `SELECT id, email, role, created_at, updated_at
         FROM public.users
        WHERE lower(email) = $1
          AND password_hash = crypt($2, password_hash)
        LIMIT 1`,
      [normalizedEmail, rawPassword]
    );
    if (result.rows[0]) return result.rows[0];
  } catch (error) {
    const noCryptFunction =
      String(error.message || "").includes("function crypt") ||
      error.code === "42883";

    if (noCryptFunction) {
      throw httpError(500, "password_verifier_unavailable");
    }

    throw error;
  }

  return null;
}

async function countUsers() {
  await ensureUsersRoleSchema();
  const result = await db.query(`SELECT COUNT(*)::int AS total FROM public.users`);
  return Number(result.rows[0]?.total || 0);
}

async function listUsers(limit = 100, offset = 0) {
  await ensureUsersRoleSchema();
  const normalizedLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const normalizedOffset = Math.max(Number(offset) || 0, 0);
  const result = await db.query(
    `SELECT id, email, role, created_at, updated_at
       FROM public.users
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT $1
      OFFSET $2`,
    [normalizedLimit, normalizedOffset]
  );
  return result.rows || [];
}

async function updateUserRole(userId, role) {
  await ensureUsersRoleSchema();
  const normalizedRole = String(role || "").trim().toLowerCase();

  const result = await db.query(
    `UPDATE public.users
        SET role = $2,
            updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, role, created_at, updated_at`,
    [userId, normalizedRole]
  );

  return result.rows[0] || null;
}

module.exports = {
  ensureUsersRoleSchema,
  getUserById,
  findUserByEmail,
  verifyUserCredentials,
  countUsers,
  listUsers,
  updateUserRole,
};
