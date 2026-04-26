"use strict";

const httpError = require("../src/utils/httpError");
const { createSession, revokeSessionByToken } = require("../models/adminSessionModel");
const { verifyUserCredentials } = require("../models/userModel");

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.created_at || user.createdAt || null,
    updatedAt: user.updated_at || user.updatedAt || null,
  };
}

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

async function login(req, res, next) {
  try {
    const email = String(req.body?.email || "").trim();
    const password = String(req.body?.password || "");

    const user = await verifyUserCredentials(email, password);
    if (!user) {
      return next(httpError(401, "invalid_credentials"));
    }

    const role = String(user.role || "viewer").toLowerCase();
    if (role !== "admin" && role !== "editor") {
      return next(httpError(403, "forbidden"));
    }

    const idleMinutes = resolveIdleMinutes();
    const { token, session } = await createSession(user.id, idleMinutes);

    return res.json({
      status: "ok",
      token,
      tokenType: "Bearer",
      expiresAt: session?.expires_at || null,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

async function me(req, res, next) {
  try {
    return res.json({
      status: "ok",
      user: sanitizeUser(req.adminAuth?.user),
      session: {
        id: req.adminAuth?.session?.id,
        expiresAt: req.adminAuth?.session?.expiresAt,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function logout(req, res, next) {
  try {
    const token = req.adminAuth?.token || "";
    if (!token) {
      return next(httpError(400, "missing_authorization_token"));
    }

    await revokeSessionByToken(token);
    return res.json({ status: "ok" });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  login,
  me,
  logout,
};
