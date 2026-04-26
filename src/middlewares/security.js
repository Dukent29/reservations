"use strict";

const rateLimit = require("express-rate-limit");
const httpError = require("../utils/httpError");

const ipKeyGenerator =
  typeof rateLimit.ipKeyGenerator === "function"
    ? rateLimit.ipKeyGenerator
    : (ip) => String(ip || "");

const SUSPICIOUS_PATTERNS = [
  /(?:'|%27)\s*(?:or|and)\s*(?:'[^']*'|\d+)\s*=\s*(?:'[^']*'|\d+)/i,
  /\bunion(?:\s+all)?\s+select\b/i,
  /\bdrop\s+table\b/i,
  /\binformation_schema\b/i,
  /;\s*(?:drop|truncate|alter|shutdown)\b/i,
  /<\s*script\b/i,
  /javascript\s*:/i,
  /on\w+\s*=/i,
];

function createRateLimitHandler(message) {
  return (_req, _res, next) => next(httpError(429, message));
}

const adminLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    return `${ipKeyGenerator(req.ip)}:${email}`;
  },
  handler: createRateLimitHandler("too_many_login_attempts"),
});

const adminApiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: createRateLimitHandler("too_many_admin_requests"),
});

function collectStringValues(value, out, depth = 0) {
  if (depth > 5 || out.length > 100) return;

  if (typeof value === "string") {
    out.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectStringValues(entry, out, depth + 1);
      if (out.length > 100) return;
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      collectStringValues(value[key], out, depth + 1);
      if (out.length > 100) return;
    }
  }
}

function isSuspiciousValue(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return false;

  const sample = normalized.length > 2000 ? normalized.slice(0, 2000) : normalized;
  return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(sample));
}

function suspiciousInputGuard(fields) {
  const expectedFields = Array.isArray(fields)
    ? fields.map((field) => String(field || "").trim()).filter(Boolean)
    : null;

  return (req, _res, next) => {
    const method = String(req.method || "").toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      return next();
    }

    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return next();
    }

    const values = [];
    if (expectedFields && expectedFields.length) {
      for (const field of expectedFields) {
        collectStringValues(body[field], values);
      }
    } else {
      collectStringValues(body, values);
    }

    const hasSuspiciousValue = values.some((value) => isSuspiciousValue(value));
    if (hasSuspiciousValue) {
      return next(httpError(400, "suspicious_payload_detected"));
    }

    return next();
  };
}

function setSecurityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  if (String(req.path || "").startsWith("/api")) {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    );
    res.setHeader("Cache-Control", "no-store");
  }

  next();
}

module.exports = {
  adminLoginRateLimiter,
  adminApiRateLimiter,
  suspiciousInputGuard,
  setSecurityHeaders,
};
