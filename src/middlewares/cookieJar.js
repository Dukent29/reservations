"use strict";

const Cookies = require("cookies");
const Keygrip = require("keygrip");
const { isCookieSecure } = require("../../config/cookieConfig");
const { ensureCsrfCookie } = require("../../services/cookieService");

/**
 * Attaches a signed cookie jar to every request.
 *
 * Signing keys come from COOKIE_SIGNING_KEYS or COOKIE_SIGNING_KEY. In
 * production, configure at least two comma-separated keys so rotation is easy:
 * COOKIE_SIGNING_KEYS=current-secret,previous-secret
 */

function getSigningKeys() {
  const raw = process.env.COOKIE_SIGNING_KEYS || process.env.COOKIE_SIGNING_KEY || "";
  const keys = raw
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);

  if (keys.length) return keys;
  if (process.env.NODE_ENV === "production") {
    throw new Error("COOKIE_SIGNING_KEYS is required in production");
  }
  return ["bedtrip-dev-cookie-signing-key-change-me"];
}

const signingKeys = new Keygrip(getSigningKeys(), "sha256", "base64");

function getRequestHostname(req) {
  const hostHeader = String(req.headers.host || "");
  const hostWithoutPort = hostHeader.startsWith("[")
    ? hostHeader.slice(1, hostHeader.indexOf("]"))
    : hostHeader.split(":")[0];
  return String(req.hostname || hostWithoutPort || "").toLowerCase();
}

function isLocalRequest(req) {
  return ["localhost", "127.0.0.1", "::1"].includes(getRequestHostname(req));
}

function shouldTreatRequestAsSecure(req) {
  return isCookieSecure() || req.secure || process.env.NODE_ENV !== "production" || isLocalRequest(req);
}

function attachCookieJar(req, res, next) {
  req.cookieJar = new Cookies(req, res, {
    keys: signingKeys,
    secure: shouldTreatRequestAsSecure(req),
  });
  ensureCsrfCookie(req);
  next();
}

module.exports = attachCookieJar;
