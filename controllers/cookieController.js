"use strict";

const { COOKIE_CATEGORIES } = require("../config/cookieConfig");
const cookieService = require("../services/cookieService");

/**
 * Cookie consent controller.
 *
 * The frontend reads and updates consent through these handlers. Consent is
 * saved server-side as a signed cookie, and preference cookies are only written
 * when the user explicitly allows the preference category.
 */

function getCookieConsent(req, res, next) {
  try {
    const consent = cookieService.getConsent(req);
    res.json({
      status: "ok",
      hasConsent: Boolean(consent),
      consent,
      categories: {
        [COOKIE_CATEGORIES.necessary]: true,
        [COOKIE_CATEGORIES.preferences]: Boolean(consent?.preferences),
        [COOKIE_CATEGORIES.analytics]: false,
        [COOKIE_CATEGORIES.marketing]: false,
      },
    });
  } catch (error) {
    next(error);
  }
}

function postCookieConsent(req, res, next) {
  try {
    const body = req.body || {};
    const preferencesEnabled = Boolean(body.preferences);
    const consent = cookieService.setConsent(req, {
      preferences: preferencesEnabled,
    });

    if (preferencesEnabled) {
      cookieService.setPreferenceCookies(req, {
        currency: body.currency || "EUR",
        locale: body.locale || "fr",
      });
    } else {
      cookieService.clearPreferenceCookies(req);
    }

    res.json({
      status: "ok",
      hasConsent: true,
      consent,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCookieConsent,
  postCookieConsent,
};
