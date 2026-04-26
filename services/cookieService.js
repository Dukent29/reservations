"use strict";

const crypto = require("crypto");
const { COOKIE_MAX_AGE_MS, COOKIE_NAMES, isCookieSecure } = require("../config/cookieConfig");

/**
 * Cookie service.
 *
 * All cookie reads/writes go through this module so options stay consistent:
 * signed where needed, Secure in production, SameSite=Lax, Path=/, and
 * HttpOnly for sensitive cookies.
 */

function baseOptions(maxAge) {
  return {
    path: "/",
    sameSite: "lax",
    secure: isCookieSecure(),
    overwrite: true,
    maxAge,
  };
}

function signedOptions(maxAge, extra = {}) {
  return {
    ...baseOptions(maxAge),
    secure: true,
    signed: true,
    ...extra,
  };
}

function preferenceOptions(maxAge = COOKIE_MAX_AGE_MS.preferences) {
  return {
    ...baseOptions(maxAge),
    httpOnly: false,
    signed: false,
  };
}

function clearOptions(extra = {}) {
  return {
    ...baseOptions(0),
    expires: new Date(0),
    ...extra,
  };
}

function getSignedCookie(req, name) {
  return req.cookieJar?.get(name, { signed: true }) || "";
}

function setSignedCookie(req, name, value, options = {}) {
  req.cookieJar?.set(name, value, {
    signed: true,
    ...options,
  });
}

function clearCookie(req, name, options = {}) {
  req.cookieJar?.set(name, "", clearOptions(options));
}

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeConsent(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    necessary: true,
    preferences: Boolean(source.preferences),
    analytics: false,
    marketing: false,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
}

function getConsent(req) {
  const raw = getSignedCookie(req, COOKIE_NAMES.consent);
  const parsed = safeJsonParse(raw);
  if (!parsed || parsed.necessary !== true) return null;
  return {
    necessary: true,
    preferences: Boolean(parsed.preferences),
    analytics: false,
    marketing: false,
    version: Number(parsed.version) || 1,
    updatedAt: parsed.updatedAt || null,
  };
}

function setConsent(req, consentInput) {
  const consent = normalizeConsent(consentInput);
  setSignedCookie(req, COOKIE_NAMES.consent, JSON.stringify(consent), signedOptions(COOKIE_MAX_AGE_MS.consent, {
    httpOnly: true,
  }));
  return consent;
}

function clearConsent(req) {
  clearCookie(req, COOKIE_NAMES.consent, { signed: true, httpOnly: true, secure: true });
}

function getSessionCookie(req) {
  return getSignedCookie(req, COOKIE_NAMES.session);
}

function setSessionCookie(req, value) {
  setSignedCookie(req, COOKIE_NAMES.session, value, signedOptions(COOKIE_MAX_AGE_MS.session, {
    httpOnly: true,
  }));
}

function clearSessionCookie(req) {
  clearCookie(req, COOKIE_NAMES.session, { signed: true, httpOnly: true, secure: true });
}

function getBookingSessionCookie(req) {
  return getSignedCookie(req, COOKIE_NAMES.bookingSession);
}

function setBookingSessionCookie(req, value) {
  setSignedCookie(req, COOKIE_NAMES.bookingSession, value, signedOptions(COOKIE_MAX_AGE_MS.bookingSession, {
    httpOnly: true,
  }));
}

function clearBookingSessionCookie(req) {
  clearCookie(req, COOKIE_NAMES.bookingSession, { signed: true, httpOnly: true, secure: true });
}

function setPreferenceCookies(req, preferences = {}) {
  const options = preferenceOptions();
  if (preferences.currency) {
    req.cookieJar?.set(COOKIE_NAMES.currency, String(preferences.currency).toUpperCase(), options);
  }
  if (preferences.locale) {
    req.cookieJar?.set(COOKIE_NAMES.locale, String(preferences.locale).toLowerCase(), options);
  }
}

function clearPreferenceCookies(req) {
  clearCookie(req, COOKIE_NAMES.currency, { signed: false, httpOnly: false });
  clearCookie(req, COOKIE_NAMES.locale, { signed: false, httpOnly: false });
}

function ensureCsrfCookie(req) {
  const existing = getSignedCookie(req, COOKIE_NAMES.csrfToken);
  if (existing) return existing;
  const token = crypto.randomBytes(24).toString("base64url");
  setSignedCookie(req, COOKIE_NAMES.csrfToken, token, signedOptions(COOKIE_MAX_AGE_MS.csrfToken, {
    httpOnly: false,
  }));
  return token;
}

module.exports = {
  clearConsent,
  clearBookingSessionCookie,
  clearCookie,
  clearPreferenceCookies,
  clearSessionCookie,
  ensureCsrfCookie,
  getBookingSessionCookie,
  getConsent,
  getSessionCookie,
  getSignedCookie,
  normalizeConsent,
  setBookingSessionCookie,
  setConsent,
  setPreferenceCookies,
  setSessionCookie,
  setSignedCookie,
};
