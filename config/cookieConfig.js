"use strict";

/**
 * Central cookie policy for BedTrip.
 *
 * Keep names and lifetimes here so controllers and services do not duplicate
 * cookie strings or security decisions.
 */

const COOKIE_NAMES = {
  session: "__Host-bedtrip_session",
  bookingSession: "__Host-bedtrip_booking_session",
  consent: "__Host-cookie_consent",
  csrfToken: "__Host-csrf_token",
  currency: "bedtrip_currency",
  locale: "bedtrip_locale",
};

const COOKIE_CATEGORIES = {
  necessary: "necessary",
  preferences: "preferences",
  analytics: "analytics",
  marketing: "marketing",
};

const COOKIE_MAX_AGE_MS = {
  session: 7 * 24 * 60 * 60 * 1000,
  bookingSession: 24 * 60 * 60 * 1000,
  consent: 180 * 24 * 60 * 60 * 1000,
  csrfToken: 2 * 60 * 60 * 1000,
  preferences: 180 * 24 * 60 * 60 * 1000,
};

function isCookieSecure() {
  if (String(process.env.COOKIE_SECURE || "").toLowerCase() === "true") return true;
  if (String(process.env.COOKIE_SECURE || "").toLowerCase() === "false") return false;
  return process.env.NODE_ENV === "production";
}

module.exports = {
  COOKIE_CATEGORIES,
  COOKIE_MAX_AGE_MS,
  COOKIE_NAMES,
  isCookieSecure,
};
