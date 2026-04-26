"use strict";

const httpError = require("../utils/httpError");
const { getSessionWithUserByToken, touchSessionById } = require("../../models/adminSessionModel");

function resolveIdleMinutes() {
  const explicitMinutes = Number(process.env.ADMIN_SESSION_IDLE_MINUTES);
  if (Number.isFinite(explicitMinutes) && explicitMinutes > 0) {
    return explicitMinutes;
  }

  const legacyHours = Number(process.env.ADMIN_SESSION_TTL_HOURS);
  if (Number.isFinite(legacyHours) && legacyHours > 0) {
    return legacyHours * 60;
  }

  return 60;
}

function extractBearerToken(headerValue) {
  const authHeader = String(headerValue || "").trim();
  if (!authHeader.toLowerCase().startsWith("bearer ")) return "";
  return authHeader.slice(7).trim();
}

async function requireAdminAuth(req, _res, next) {
  try {
    const token = extractBearerToken(req.get("authorization"));
    if (!token) {
      return next(httpError(401, "missing_authorization_token"));
    }

    const record = await getSessionWithUserByToken(token);
    if (!record) {
      return next(httpError(401, "invalid_or_expired_session"));
    }

    if (record.session.revokedAt) {
      return next(httpError(401, "invalid_or_expired_session"));
    }

    const expiresAt = new Date(record.session.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return next(httpError(401, "invalid_or_expired_session"));
    }

    const touched = await touchSessionById(record.session.id, resolveIdleMinutes());
    if (!touched?.id || !touched?.expires_at) {
      return next(httpError(401, "invalid_or_expired_session"));
    }

    req.adminAuth = {
      token,
      session: {
        ...record.session,
        expiresAt: touched.expires_at,
      },
      user: record.user,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

function requireRoles(...roles) {
  const allowed = new Set(
    roles
      .map((role) => String(role || "").trim().toLowerCase())
      .filter(Boolean)
  );

  return (req, _res, next) => {
    const currentRole = String(req.adminAuth?.user?.role || "").toLowerCase();
    if (!allowed.size || allowed.has(currentRole)) {
      return next();
    }
    return next(httpError(403, "forbidden"));
  };
}

module.exports = {
  requireAdminAuth,
  requireRoles,
};
