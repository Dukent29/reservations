"use strict";

const crypto = require("crypto");

const PUBLIC_PATHS = new Set(["/health", "/webhook/ratehawk", "/webhook/stripe"]);

function apiKeyAuth(req, res, next) {
  const requiredKey = process.env.INTERNAL_API_KEY;
  if (!requiredKey) return next();
  if (PUBLIC_PATHS.has(req.path)) return next();

  const provided = req.get("x-api-key") || "";
  const providedBuffer = Buffer.from(provided);
  const requiredBuffer = Buffer.from(requiredKey);

  if (
    providedBuffer.length !== requiredBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, requiredBuffer)
  ) {
    return res.status(401).json({ error: "invalid_api_key" });
  }

  return next();
}

module.exports = apiKeyAuth;
